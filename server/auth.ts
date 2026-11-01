import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db";
import { configureClientSource } from "./client-source";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import type { ApplicationRole, User } from "@shared/schema";
import { LEGACY_DEFAULT_PASSWORD, newPasswordSchema, PASSWORD_MIN_LENGTH } from "@shared/auth-validation";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const normalized = username.trim();
  const rows = await db.select().from(users).where(normalized.includes("@")
    ? sql`lower(${users.username}) = ${normalized.toLowerCase()}`
    : eq(users.username, normalized));
  return rows[0];
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function createUser(
  username: string,
  password: string,
  access: {
    role?: ApplicationRole;
    participantId?: string;
    bujkId?: string;
  } = {},
): Promise<User> {
  const hashed = await hashPassword(password);
  const id = randomUUID();
  const row = {
    id,
    username,
    password: hashed,
    role: access.role ?? "admin",
    isActive: true,
    sessionVersion: 0,
    participantId: access.participantId ?? null,
    bujkId: access.bujkId ?? null,
  };
  await db.insert(users).values(row);
  return row;
}

export type ChangePasswordResult =
  | { sessionVersion: number }
  | "user_not_found"
  | "invalid_new_password"
  | "unchanged_password"
  | "invalid_current_password";

export const PASSWORD_CHANGE_MAX_ATTEMPTS = 5;
export const PASSWORD_CHANGE_WINDOW_MS = 15 * 60 * 1000;

type PasswordChangeAttemptBucket = {
  attempt_count: number;
  retry_after_seconds: number;
};

type PasswordChangeAttemptResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Limits password-change attempts independently by account and source.
 *
 * PostgreSQL keeps counters shared across server instances and restarts. Both
 * reservations are committed or rolled back together, so concurrent requests
 * cannot partially consume one bucket or exceed the limit.
 */
class PasswordChangeAttemptLimiter {
  async tryAcquire(userId: string, source: string): Promise<PasswordChangeAttemptResult> {
    const accountKey = `account:${userId}`;
    const sourceKey = `source:${source}`;
    await pool.query(
      `
        DELETE FROM password_change_attempts
        WHERE window_started_at <= now() - ($1::bigint * interval '1 millisecond')
      `,
      [PASSWORD_CHANGE_WINDOW_MS],
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        const { rows } = await client.query<PasswordChangeAttemptBucket>(
          `
            INSERT INTO password_change_attempts
              (attempt_key, attempt_count, window_started_at)
            VALUES
              ($1, 1, now()),
              ($2, 1, now())
            ON CONFLICT (attempt_key) DO UPDATE
            SET
              attempt_count = CASE
                WHEN password_change_attempts.window_started_at
                  <= now() - ($3::bigint * interval '1 millisecond')
                THEN 1
                ELSE password_change_attempts.attempt_count + 1
              END,
              window_started_at = CASE
                WHEN password_change_attempts.window_started_at
                  <= now() - ($3::bigint * interval '1 millisecond')
                THEN now()
                ELSE password_change_attempts.window_started_at
              END
            RETURNING
              attempt_count,
              GREATEST(
                1,
                CEIL(EXTRACT(EPOCH FROM (
                  window_started_at
                  + ($3::bigint * interval '1 millisecond')
                  - now()
                )))
              )::integer AS retry_after_seconds
          `,
          [accountKey, sourceKey, PASSWORD_CHANGE_WINDOW_MS],
        );

        const blockedBuckets = rows.filter(
          ({ attempt_count }) => attempt_count > PASSWORD_CHANGE_MAX_ATTEMPTS,
        );
        if (blockedBuckets.length > 0) {
          await client.query("ROLLBACK");
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              ...blockedBuckets.map(({ retry_after_seconds }) => retry_after_seconds),
            ),
          };
        }

        await client.query("COMMIT");
        return { allowed: true };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  }

  async recordSuccessfulChange(userId: string, source: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        await client.query(
          "DELETE FROM password_change_attempts WHERE attempt_key = $1",
          [`account:${userId}`],
        );
        await client.query(
          `
            UPDATE password_change_attempts
            SET attempt_count = GREATEST(attempt_count - 1, 0)
            WHERE attempt_key = $1
          `,
          [`source:${source}`],
        );
        await client.query(
          `
            DELETE FROM password_change_attempts
            WHERE attempt_key = $1 AND attempt_count = 0
          `,
          [`source:${source}`],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  }

  async reset(): Promise<void> {
    await pool.query("DELETE FROM password_change_attempts");
  }
}

export const passwordChangeAttemptLimiter = new PasswordChangeAttemptLimiter();

export async function resetPasswordChangeAttemptLimiter(): Promise<void> {
  await passwordChangeAttemptLimiter.reset();
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (!newPasswordSchema.safeParse(newPassword).success) return "invalid_new_password";
  return db.transaction(async (tx): Promise<ChangePasswordResult> => {
    const [storedUser] = await tx.select().from(users)
      .where(eq(users.id, userId)).for("update");
    if (!storedUser) return "user_not_found";

    const currentPasswordMatches = await comparePassword(currentPassword, storedUser.password);
    if (!currentPasswordMatches) return "invalid_current_password";
    if (newPassword === currentPassword) return "unchanged_password";

    const hashed = await hashPassword(newPassword);
    const [updated] = await tx.update(users).set({
      password: hashed,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    }).where(eq(users.id, userId)).returning({ sessionVersion: users.sessionVersion });
    return updated;
  });
}

/** Bootstrap only an empty installation, using an operator-provided secret. */
export async function ensureAdminUser(): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialize first-start workers so no worker can replace an existing account.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(749210040)`);
    const existing = await tx.select().from(users).limit(1);
    if (existing.length > 0) return;

    const password = readAdminSetupPassword(process.env);
    if (!password) {
      throw new Error(
        `First-time admin setup requires ${ADMIN_RECOVERY_PASSWORD_ENV} ` +
          `with at least ${ADMIN_RECOVERY_PASSWORD_MIN_LENGTH} characters. ` +
          "Configure it as a secret and restart the server.",
      );
    }
    await tx.insert(users).values({
      username: "admin",
      password: await hashPassword(password),
      role: "admin",
      isActive: true,
    });
    console.log(
      "[auth] Initial administrator created from the configured secret. " +
        "Remove the setup secret after confirming access.",
    );
  });
}

const DEFAULT_PASSWORD = LEGACY_DEFAULT_PASSWORD;
export const ADMIN_RECOVERY_PASSWORD_ENV = "ADMIN_RECOVERY_PASSWORD";
export const ADMIN_RECOVERY_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

export function getAdminRecoveryPassword(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (environment.NODE_ENV !== "production") return undefined;
  return readAdminSetupPassword(environment);
}

function readAdminSetupPassword(environment: NodeJS.ProcessEnv): string | undefined {
  const password = environment[ADMIN_RECOVERY_PASSWORD_ENV];
  if (!password?.trim()) return undefined;

  if (password.trim().length < ADMIN_RECOVERY_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `${ADMIN_RECOVERY_PASSWORD_ENV} must contain at least ` +
        `${ADMIN_RECOVERY_PASSWORD_MIN_LENGTH} characters.`,
    );
  }

  if (password === DEFAULT_PASSWORD) {
    throw new Error(`${ADMIN_RECOVERY_PASSWORD_ENV} must not use the default admin password.`);
  }

  return password;
}

/**
 * One-time production recovery for a database whose admin account still uses
 * the known default password. The secret is ignored after the admin password
 * has changed, and its value is never logged.
 */
export async function recoverDefaultAdminPassword(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  return db.transaction(async (tx) => {
    const [admin] = await tx.select().from(users)
      .where(eq(users.username, "admin")).for("update");
    if (!admin || !(await comparePassword(DEFAULT_PASSWORD, admin.password))) return false;

    const recoveryPassword = getAdminRecoveryPassword();
    if (!recoveryPassword) return false;

    await tx.update(users).set({
      password: await hashPassword(recoveryPassword),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    }).where(eq(users.id, admin.id));
    console.log(
      `[auth] Admin password recovered from ${ADMIN_RECOVERY_PASSWORD_ENV}. ` +
        "Remove this secret after the deployment is healthy.",
    );
    return true;
  });
}

/**
 * Checks whether the admin account still uses the default password.
 * In production this is a critical security risk — the function throws so
 * the server refuses to serve traffic until the password is changed.
 * In development / test it only prints a prominent warning.
 */
export async function checkDefaultAdminPassword(): Promise<void> {
  const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!admin || !(await comparePassword(DEFAULT_PASSWORD, admin.password))) return;

  const warning =
    "[auth] CRITICAL SECURITY WARNING: The administrator still uses the legacy " +
    "default password. Configure secure recovery before serving production traffic.";

  if (process.env.NODE_ENV === "production") {
    console.error(warning);
    throw new Error(
      "Server refused to start: admin account is using the default password. " +
        `Configure ${ADMIN_RECOVERY_PASSWORD_ENV} as a secret and restart the server.`,
    );
  }
  console.warn(warning);
}

export function setupAuth(app: Express): void {
  configureClientSource(app);

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("Origin");
    if (req.get("Sec-Fetch-Site") === "cross-site" ||
        (origin && origin !== `${req.protocol}://${req.get("host")}`)) {
      return res.status(403).json({ message: "Permintaan dari situs lain tidak diizinkan.", code: "INVALID_ORIGIN" });
    }
    next();
  });

  const PgSession = connectPgSimple(session);

  const configuredSecret = process.env.SESSION_SECRET;
  const secret = configuredSecret?.trim() ? configuredSecret : undefined;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  const sessionSecret = secret ?? randomBytes(32).toString("hex");
  if (!secret) {
    console.warn(
      "[startup] SESSION_SECRET is not set; using a temporary development secret. " +
        "Sessions will not survive a server restart.",
    );
  }

  const pgStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "session",
    createTableIfMissing: true,
  });

  // Prevent unhandled EventEmitter error from crashing the process
  pgStore.on("error", (err: Error) => {
    console.error("[session] Session store error:", err);
  });

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: pgStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };

  app.use(session(sessionSettings));

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await getUserByUsername(username);
        if (!user) return done(null, false, { message: "Username atau password salah" });
        const match = await comparePassword(password, user.password);
        if (!match) return done(null, false, { message: "Username atau password salah" });
        if (!user.isActive) return done(null, false, { message: "Akun dinonaktifkan. Hubungi admin untuk mengaktifkan kembali." });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    const account = user as User;
    done(null, { id: account.id, version: account.sessionVersion });
  });

  passport.deserializeUser(async (sessionUser: unknown, done) => {
    try {
      // Existing sessions predate versioning and are treated as version zero.
      const identity = typeof sessionUser === "string"
        ? { id: sessionUser, version: 0 }
        : sessionUser as { id?: unknown; version?: unknown } | null;
      if (!identity || typeof identity.id !== "string" || !identity.id.trim() ||
          identity.id.length > 256 || typeof identity.version !== "number" ||
          !Number.isSafeInteger(identity.version) || identity.version < 0) {
        return done(null, false);
      }
      const { id, version } = identity;
      const user = await getUserById(id);
      done(null, user?.isActive && user.sessionVersion === version ? user : false);
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Sesi berakhir. Silakan masuk kembali.", code: "SESSION_EXPIRED" });
};

export function requireRole(...roles: ApplicationRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sesi berakhir. Silakan masuk kembali.", code: "SESSION_EXPIRED" });
    }
    const user = req.user as User;
    if (roles.includes(user.role)) return next();
    res.status(403).json({ message: "Akses tidak diizinkan untuk peran akun ini." });
  };
}
