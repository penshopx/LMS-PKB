import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
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
  const PgSession = connectPgSimple(session);

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
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
    secret,
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
