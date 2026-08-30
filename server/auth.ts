import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import type { User } from "@shared/schema";

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
  const rows = await db.select().from(users).where(eq(users.username, username));
  return rows[0];
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function createUser(username: string, password: string): Promise<User> {
  const hashed = await hashPassword(password);
  const id = randomUUID();
  const row = { id, username, password: hashed };
  await db.insert(users).values(row);
  return row;
}

export type ChangePasswordResult =
  | "updated"
  | "user_not_found"
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
  const [storedUser] = await db.select().from(users).where(eq(users.id, userId));
  if (!storedUser) return "user_not_found";

  const currentPasswordMatches = await comparePassword(currentPassword, storedUser.password);
  if (!currentPasswordMatches) return "invalid_current_password";

  const hashed = await hashPassword(newPassword);
  await db.update(users).set({ password: hashed }).where(eq(users.id, userId));
  return "updated";
}

/** Creates a default admin account if no users exist. */
export async function ensureAdminUser(): Promise<void> {
  try {
    const existing = await db.select().from(users).limit(1);
    if (existing.length === 0) {
      await createUser("admin", "admin123");
      console.log("[auth] Default admin created — username: admin, password: admin123");
      console.log("[auth] Change your password after first login!");
    }
  } catch (err) {
    console.error("[auth] Failed to ensure admin user:", err);
  }
}

const DEFAULT_PASSWORD = "admin123";
export const ADMIN_RECOVERY_PASSWORD_ENV = "ADMIN_RECOVERY_PASSWORD";
export const ADMIN_RECOVERY_PASSWORD_MIN_LENGTH = 12;

export function getAdminRecoveryPassword(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (environment.NODE_ENV !== "production") return undefined;

  const password = environment[ADMIN_RECOVERY_PASSWORD_ENV];
  if (!password?.trim()) return undefined;

  if (password.length < ADMIN_RECOVERY_PASSWORD_MIN_LENGTH) {
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
  const recoveryPassword = getAdminRecoveryPassword();
  if (!recoveryPassword) return false;

  const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!admin) return false;

  const isDefault = await comparePassword(DEFAULT_PASSWORD, admin.password);
  if (!isDefault) return false;

  const hashed = await hashPassword(recoveryPassword);
  await db.update(users).set({ password: hashed }).where(eq(users.id, admin.id));
  console.log(
    `[auth] Admin password recovered from ${ADMIN_RECOVERY_PASSWORD_ENV}. ` +
      "Remove this secret after the deployment is healthy.",
  );
  return true;
}

/**
 * Checks whether the admin account still uses the default password.
 * In production this is a critical security risk — the function throws so
 * the server refuses to serve traffic until the password is changed.
 * In development / test it only prints a prominent warning.
 */
export async function checkDefaultAdminPassword(): Promise<void> {
  try {
    const rows = await db.select().from(users).where(eq(users.username, "admin"));
    if (rows.length === 0) return; // no admin user — nothing to check

    const admin = rows[0];
    const isDefault = await comparePassword(DEFAULT_PASSWORD, admin.password);
    if (!isDefault) return; // password has been changed — all good

    const warning = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║          ⚠  CRITICAL SECURITY WARNING  ⚠                   ║",
      "║                                                              ║",
      "║  The admin account is still using the default password.     ║",
      "║  Anyone who knows this password can log in to your app.     ║",
      "║                                                              ║",
      "║  Log in as admin and change the password immediately.       ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
    ].join("\n");

    if (process.env.NODE_ENV === "production") {
      console.error(warning);
      throw new Error(
        "Server refused to start: admin account is using the default password. " +
          "Change the password and restart the server."
      );
    } else {
      console.warn(warning);
    }
  } catch (err) {
    // Re-throw only errors we deliberately raised above; swallow DB / lookup errors
    if (err instanceof Error && err.message.startsWith("Server refused to start")) {
      throw err;
    }
    console.error("[auth] Could not verify admin password security:", err);
  }
}

export function setupAuth(app: Express): void {
  // Replit ingress connects to the application through a local sidecar. Trust
  // only loopback proxy hops so req.ip uses the edge-appended client address
  // without accepting an arbitrary leftmost X-Forwarded-For value.
  app.set("trust proxy", "loopback");

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
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await getUserById(id);
      done(null, user ?? null);
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
