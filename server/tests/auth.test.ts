import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import {
  ADMIN_RECOVERY_PASSWORD_ENV,
  ADMIN_RECOVERY_PASSWORD_MIN_LENGTH,
  changeUserPassword,
  comparePassword,
  createUser,
  getAdminRecoveryPassword,
  ensureAdminUser,
  recoverDefaultAdminPassword,
  checkDefaultAdminPassword,
} from "../auth";
import { users } from "@shared/schema";
import { acceptedPasswords, rejectedPasswords } from "./helpers/password-policy";

const isolatedDatabase = vi.hoisted(() => ({
  schemaName: `admin_setup_${Math.random().toString(36).slice(2)}`,
}));

vi.mock("../db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { default: pgModule } = await import("pg");
  const schema = await import("@shared/schema");
  const pool = new pgModule.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${isolatedDatabase.schemaName}`,
  });
  return { db: drizzle(pool, { schema }), pool };
});

const adminClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quotedSchema = `"${isolatedDatabase.schemaName}"`;

beforeAll(async () => {
  await adminClient.connect();
  await adminClient.query(`CREATE SCHEMA ${quotedSchema}`);
  await adminClient.query(
    `CREATE TABLE ${quotedSchema}.users (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      password text NOT NULL,
      role text NOT NULL DEFAULT 'admin',
      is_active boolean NOT NULL DEFAULT true,
      session_version integer NOT NULL DEFAULT 0,
      participant_id varchar,
      bujk_id varchar
    )`,
  );
});

afterAll(async () => {
  await pool.end();
  await adminClient.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
  await adminClient.end();
});

describe("changeUserPassword", () => {
  it.each(rejectedPasswords)("rejects unsafe replacement %j without modifying an existing weak password", async (password) => {
    const user = await createUser(`weak-${crypto.randomUUID()}`, "admin123");
    await expect(changeUserPassword(user.id, "admin123", password))
      .resolves.toBe("invalid_new_password");
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.password).toBe(user.password);
  });

  it.each(acceptedPasswords)("accepts boundary password %j without trimming the stored value", async (password) => {
    const user = await createUser(`boundary-${crypto.randomUUID()}`, "short");
    await expect(changeUserPassword(user.id, "short", password)).resolves.toBe("updated");
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await comparePassword(password, stored.password)).toBe(true);
    if (password !== password.trim()) {
      expect(await comparePassword(password.trim(), stored.password)).toBe(false);
    }
  });

  it("updates the password while keeping the same user account", async () => {
    const username = `password-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await createUser(username, "current-password");

    await expect(
      changeUserPassword(user.id, "current-password", "new-password"),
    ).resolves.toBe("updated");

    const [storedUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(storedUser).toBeDefined();
    expect(await comparePassword("current-password", storedUser.password)).toBe(false);
    expect(await comparePassword("new-password", storedUser.password)).toBe(true);
  });

  it("does not change the password when the current password is incorrect", async () => {
    const username = `password-invalid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await createUser(username, "current-password");

    await expect(
      changeUserPassword(user.id, "wrong-password", "new-password"),
    ).resolves.toBe("invalid_current_password");

    const [storedUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await comparePassword("current-password", storedUser.password)).toBe(true);
  });

  it("rejects an unchanged password only after checking the current credential, without changing the stored hash", async () => {
    const user = await createUser(`unchanged-${crypto.randomUUID()}`, "current-password");
    await expect(changeUserPassword(user.id, "incorrect-password", "incorrect-password"))
      .resolves.toBe("invalid_current_password");
    await expect(changeUserPassword(user.id, "current-password", "current-password"))
      .resolves.toBe("unchanged_password");
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.password).toBe(user.password);
    expect(stored.sessionVersion).toBe(user.sessionVersion);
  });

  it("reports a missing user without attempting an update", async () => {
    await expect(
      changeUserPassword("missing-user-id", "current-password", "new-password"),
    ).resolves.toBe("user_not_found");
  });
});

describe("initial administrator setup and legacy recovery", () => {
  const setupPassword = "test-only-initial-secret";

  beforeEach(async () => {
    await db.delete(users);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    const output = [console.log, console.error, console.warn]
      .flatMap(logger => vi.mocked(logger).mock.calls)
      .flat().join(" ");
    expect(output).not.toContain(setupPassword);
    expect(output).not.toContain("admin123");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["production", "development"])(
    "refuses an unconfigured fresh installation in %s without inserting any users",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      await expect(ensureAdminUser()).rejects.toThrow(
        `First-time admin setup requires ${ADMIN_RECOVERY_PASSWORD_ENV}`,
      );
      expect(await db.select().from(users)).toEqual([]);
    },
  );

  it.each(["short", "admin123", "     too short     ", "   "])(
    "never creates an account with an invalid setup secret",
    async (password) => {
      vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, password);
      await expect(ensureAdminUser()).rejects.toThrow();
      expect(await db.select().from(users)).toEqual([]);
    },
  );

  it.each(["production", "development"])(
    "creates a hashed administrator from the configured secret in %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, setupPassword);
      await ensureAdminUser();
      const [admin] = await db.select().from(users);
      expect(admin).toMatchObject({ username: "admin", role: "admin", isActive: true });
      expect(admin.password).not.toBe(setupPassword);
      expect(await comparePassword(setupPassword, admin.password)).toBe(true);
      expect(await comparePassword("admin123", admin.password)).toBe(false);
      await expect(checkDefaultAdminPassword()).resolves.toBeUndefined();
    },
  );

  it("serializes simultaneous first starts and does not reset the account on restart", async () => {
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, setupPassword);
    await Promise.all([ensureAdminUser(), ensureAdminUser()]);
    const [original] = await db.select().from(users);
    expect(await db.select().from(users)).toHaveLength(1);
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, undefined);
    await ensureAdminUser();
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, "short");
    await ensureAdminUser();
    expect(await db.select().from(users)).toEqual([original]);
  });

  it("does not recreate an admin on a populated installation", async () => {
    const user = await createUser("existing-member", "existing-user-secret", { role: "participant" });
    await ensureAdminUser();
    expect(await db.select().from(users)).toEqual([user]);
  });

  it("leaves an existing secured account unchanged even with invalid recovery configuration", async () => {
    const admin = await createUser("admin", "already-secured-password");
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, "short");
    await ensureAdminUser();
    await expect(recoverDefaultAdminPassword()).resolves.toBe(false);
    await checkDefaultAdminPassword();
    expect(await db.select().from(users)).toEqual([admin]);
  });

  it("blocks production startup for an unrecovered legacy default password", async () => {
    await createUser("admin", "admin123");
    await expect(recoverDefaultAdminPassword()).resolves.toBe(false);
    await expect(checkDefaultAdminPassword()).rejects.toThrow("Server refused to start");
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, "short");
    await expect(recoverDefaultAdminPassword()).rejects.toThrow("at least 12 characters");
    const [unchanged] = await db.select().from(users);
    expect(await comparePassword("admin123", unchanged.password)).toBe(true);
  });

  it("recovers only once, invalidates previous sessions, and does not reactivate the account", async () => {
    const admin = await createUser("admin", "admin123");
    await db.update(users).set({ isActive: false, sessionVersion: 3 }).where(eq(users.id, admin.id));
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, setupPassword);
    const results = await Promise.all([
      recoverDefaultAdminPassword(), recoverDefaultAdminPassword(),
    ]);
    expect(results.sort()).toEqual([false, true]);
    const [recovered] = await db.select().from(users);
    expect(recovered).toMatchObject({ id: admin.id, isActive: false, sessionVersion: 4 });
    expect(await comparePassword(setupPassword, recovered.password)).toBe(true);
    expect(await comparePassword("admin123", recovered.password)).toBe(false);
    await checkDefaultAdminPassword();
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, "a-different-recovery-secret");
    await expect(recoverDefaultAdminPassword()).resolves.toBe(false);
    expect(await db.select().from(users)).toEqual([recovered]);
  });

  it("never uses production recovery to reset a legacy account in development", async () => {
    const admin = await createUser("admin", "admin123");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, setupPassword);
    await expect(recoverDefaultAdminPassword()).resolves.toBe(false);
    await expect(checkDefaultAdminPassword()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
    expect(await db.select().from(users)).toEqual([admin]);
  });

  it("does not create an account through recovery", async () => {
    vi.stubEnv(ADMIN_RECOVERY_PASSWORD_ENV, setupPassword);
    await expect(recoverDefaultAdminPassword()).resolves.toBe(false);
    expect(await db.select().from(users)).toEqual([]);
  });

  it("propagates database failures instead of silently permitting startup", async () => {
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("database unavailable"));
    await expect(ensureAdminUser()).rejects.toThrow("database unavailable");
    vi.spyOn(db, "select").mockImplementationOnce(() => { throw new Error("database unavailable"); });
    await expect(checkDefaultAdminPassword()).rejects.toThrow("database unavailable");
  });
});

describe("admin password recovery configuration", () => {
  it("is disabled outside production", () => {
    expect(
      getAdminRecoveryPassword({
        NODE_ENV: "development",
        [ADMIN_RECOVERY_PASSWORD_ENV]: "a-secure-recovery-password",
      }),
    ).toBeUndefined();
  });

  it("is optional in production", () => {
    expect(
      getAdminRecoveryPassword({
        NODE_ENV: "production",
      }),
    ).toBeUndefined();
  });

  it("rejects weak recovery passwords without exposing their values", () => {
    const weakPassword = "short";

    expect(() =>
      getAdminRecoveryPassword({
        NODE_ENV: "production",
        [ADMIN_RECOVERY_PASSWORD_ENV]: weakPassword,
      }),
    ).toThrow(
      `${ADMIN_RECOVERY_PASSWORD_ENV} must contain at least ` +
        `${ADMIN_RECOVERY_PASSWORD_MIN_LENGTH} characters.`,
    );

    try {
      getAdminRecoveryPassword({
        NODE_ENV: "production",
        [ADMIN_RECOVERY_PASSWORD_ENV]: weakPassword,
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(weakPassword);
    }
  });

  it("accepts a strong production recovery password", () => {
    const recoveryPassword = "a-secure-recovery-password";

    expect(
      getAdminRecoveryPassword({
        NODE_ENV: "production",
        [ADMIN_RECOVERY_PASSWORD_ENV]: recoveryPassword,
      }),
    ).toBe(recoveryPassword);
  });
});