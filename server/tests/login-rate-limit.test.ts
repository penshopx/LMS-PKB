import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";
import { users } from "@shared/schema";
import {
  LoginAttemptLimiter, loginAttemptLimiter, loginAttemptKeys,
  LOGIN_ACCOUNT_MAX_ATTEMPTS, LOGIN_SOURCE_MAX_ATTEMPTS, LOGIN_WINDOW_MS,
} from "../login-attempt-limiter";

const prefix = `login-limit-${randomUUID()}`;
const password = "test-only-login-password";
const keys = new Set<string>();
const accountIds: string[] = [];
let server: Server;
let baseUrl: string;

function track(username: string, source: string) {
  loginAttemptKeys(username, source).forEach(key => keys.add(key));
}

async function login(username: unknown, supplied: unknown = password, source = "198.51.100.170", left = "") {
  if (typeof username === "string") track(username, source);
  return fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": left ? `${left}, ${source}` : source },
    body: JSON.stringify({ username, password: supplied }),
  });
}

async function account(suffix: string) {
  const username = `${prefix}-${suffix}`;
  const user = await createUser(username, password);
  accountIds.push(user.id);
  return username;
}

beforeAll(async () => {
  await pool.query(readFileSync(new URL("../migrations/014_login_attempts.sql", import.meta.url), "utf8"));
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const id of accountIds) await db.delete(users).where(eq(users.id, id));
  await pool.query("DELETE FROM login_attempts WHERE attempt_key = ANY($1::text[])", [[...keys]]);
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});

describe("persistent login protection", () => {
  it("shares source capacity across IPv4 and mapped IPv6 spellings", async () => {
    const forms = ["192.0.2.170", "::ffff:192.0.2.170", "::ffff:c000:2aa"];
    for (let i = 0; i < LOGIN_SOURCE_MAX_ATTEMPTS; i++) {
      expect((await login(`${prefix}-mapped-${i}`, "wrong", forms[i % forms.length])).status).toBe(401);
    }
    expect((await login(`${prefix}-mapped-blocked`, "wrong", forms[1])).status).toBe(429);
    expect((await login(`${prefix}-mapped-other`, "wrong", "192.0.2.171")).status).toBe(401);
  });

  it("canonicalizes native IPv6 without combining distinct networks", async () => {
    const forms = ["2001:db8:1234::ab", "2001:0DB8:1234:0000:0000:0000:0000:00AB"];
    for (let i = 0; i < LOGIN_SOURCE_MAX_ATTEMPTS; i++) {
      expect((await login(`${prefix}-ipv6-${i}`, "wrong", forms[i % forms.length])).status).toBe(401);
    }
    expect((await login(`${prefix}-ipv6-blocked`, "wrong", forms[1])).status).toBe(429);
    expect((await login(`${prefix}-ipv6-other`, "wrong", "2001:db8:5678::ab")).status).toBe(401);
  });

  it("limits repeated failures across sources, survives a new limiter, and recovers after expiry", async () => {
    const username = await account("repeated");
    for (let i = 0; i < LOGIN_ACCOUNT_MAX_ATTEMPTS; i++) {
      expect((await login(username, "wrong", `198.51.100.${i + 1}`)).status).toBe(401);
    }
    const blocked = await login(username);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(LOGIN_WINDOW_MS / 1000);
    expect(blocked.headers.get("retry-after")).toBe(String(body.retryAfterSeconds));
    const source = "198.51.100.180";
    track(username, source);
    expect((await new LoginAttemptLimiter().tryAcquire(username, source)).allowed).toBe(false);
    const [accountKey] = loginAttemptKeys(username, source);
    await pool.query(
      "UPDATE login_attempts SET window_started_at = now() - ($2::bigint * interval '1 millisecond') WHERE attempt_key = $1",
      [accountKey, LOGIN_WINDOW_MS + 1],
    );
    const recovered = await login(username);
    expect(recovered.status).toBe(200);
    const cookie = recovered.headers.get("set-cookie")!.split(";")[0];
    expect((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookie } })).status).toBe(200);
  });

  it("reserves slots atomically for simultaneous login requests", async () => {
    const username = await account("parallel");
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      login(username, "wrong", "198.51.100.181")));
    expect(responses.filter(r => r.status === 401)).toHaveLength(LOGIN_ACCOUNT_MAX_ATTEMPTS);
    expect(responses.filter(r => r.status === 429)).toHaveLength(12 - LOGIN_ACCOUNT_MAX_ATTEMPTS);
  });

  it("does not let an exhausted account consume the shared source or lock other users", async () => {
    const target = await account("target");
    const other = await account("other");
    const source = "198.51.100.182";
    for (let i = 0; i < LOGIN_ACCOUNT_MAX_ATTEMPTS; i++) {
      expect((await login(target, "wrong", source)).status).toBe(401);
    }
    for (let i = 0; i < LOGIN_SOURCE_MAX_ATTEMPTS + 1; i++) {
      expect((await login(target, "wrong", source)).status).toBe(429);
    }
    expect((await login(other, password, source)).status).toBe(200);
    expect((await login(other, password, "198.51.100.183")).status).toBe(200);
    const [, sourceKey] = loginAttemptKeys(target, source);
    const { rows } = await pool.query("SELECT attempt_count FROM login_attempts WHERE attempt_key = $1", [sourceKey]);
    expect(rows[0].attempt_count).toBe(LOGIN_ACCOUNT_MAX_ATTEMPTS);
  });

  it("limits username spraying, ignores spoofed leftmost addresses, and isolates other sources", async () => {
    const source = "198.51.100.184";
    for (let i = 0; i < LOGIN_SOURCE_MAX_ATTEMPTS; i++) {
      expect((await login(`${prefix}-unknown-${i}`, "wrong", source, `203.0.113.${i + 1}`)).status).toBe(401);
    }
    const valid = await account("spray-valid");
    expect((await login(valid, password, source, "203.0.113.200")).status).toBe(429);
    expect((await login(valid, password, "198.51.100.185")).status).toBe(200);
    const [, sourceKey] = loginAttemptKeys(valid, source);
    await pool.query("UPDATE login_attempts SET window_started_at = now() - interval '16 minutes' WHERE attempt_key = $1", [sourceKey]);
    expect((await login(valid, password, source)).status).toBe(200);
  });

  it("enforces the source limit concurrently across different accounts", async () => {
    const source = "198.51.100.186";
    const responses = await Promise.all(Array.from({ length: LOGIN_SOURCE_MAX_ATTEMPTS + 8 }, (_, i) =>
      login(`${prefix}-concurrent-unknown-${i}`, "wrong", source)));
    expect(responses.filter(r => r.status === 401)).toHaveLength(LOGIN_SOURCE_MAX_ATTEMPTS);
    expect(responses.filter(r => r.status === 429)).toHaveLength(8);
  });

  it("refunds successful logins without clearing failures or newer reservations", async () => {
    const username = await account("success");
    const source = "198.51.100.187";
    expect((await login(username, "wrong", source)).status).toBe(401);
    for (let i = 0; i < LOGIN_ACCOUNT_MAX_ATTEMPTS + 1; i++) {
      const response = await login(username, password, source);
      expect(response.status).toBe(200);
      expect(await response.json()).not.toHaveProperty("password");
    }
    const [accountKey] = loginAttemptKeys(username, source);
    const { rows } = await pool.query("SELECT attempt_count FROM login_attempts WHERE attempt_key = $1", [accountKey]);
    expect(rows[0].attempt_count).toBe(1);
    const reservation = await loginAttemptLimiter.tryAcquire(username, source);
    if (!reservation.allowed) throw new Error("Expected reservation");
    await pool.query("UPDATE login_attempts SET window_started_at = now() - interval '16 minutes' WHERE attempt_key = ANY($1::text[])", [loginAttemptKeys(username, source)]);
    expect((await new LoginAttemptLimiter().tryAcquire(username, source)).allowed).toBe(true);
    await loginAttemptLimiter.recordSuccess(reservation.reservations);
    const current = await pool.query("SELECT attempt_count FROM login_attempts WHERE attempt_key = $1", [accountKey]);
    expect(current.rows[0].attempt_count).toBe(1);
  });

  it("uses the same validated username for authentication and throttling", async () => {
    const username = await account("normalized");
    const source = "198.51.100.189";
    track(username, source);
    expect((await login(` ${username} `, password, source)).status).toBe(200);
    for (let i = 0; i < LOGIN_ACCOUNT_MAX_ATTEMPTS; i++) {
      expect((await login(` ${username} `, "wrong", source)).status).toBe(401);
    }
    expect((await login(username, password, source)).status).toBe(429);
    expect((await login("   ", password, source)).status).toBe(400);
  });

  it("stores only hashed identifiers, validates malformed bodies, and sanitizes failures", async () => {
    const username = await account("private");
    expect((await login(username, password, "198.51.100.188")).status).toBe(200);
    const { rows } = await pool.query("SELECT * FROM login_attempts WHERE attempt_key = ANY($1::text[])", [loginAttemptKeys(username, "198.51.100.188")]);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(username);
    expect(stored).not.toContain(password);
    expect(stored).not.toContain("198.51.100.188");
    expect((await login({ username }, password)).status).toBe(400);
    const spy = vi.spyOn(loginAttemptLimiter, "tryAcquire").mockRejectedValueOnce(new Error(`private ${username} ${password}`));
    try {
      const response = await login(username);
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain(username);
    } finally {
      spy.mockRestore();
    }
    const logger = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
    expect(logger).toContain("(?:me|login|logout|invitations|access");
  });
});
