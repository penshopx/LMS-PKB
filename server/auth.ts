import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
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

export function setupPassport(): void {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await getUserByUsername(username);
        if (!user) return done(null, false, { message: "Username tidak ditemukan" });
        const match = await comparePassword(password, user.password);
        if (!match) return done(null, false, { message: "Password salah" });
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
      const rows = await db.select().from(users).where(eq(users.id, id));
      done(null, rows[0] ?? null);
    } catch (err) {
      done(err);
    }
  });
}
