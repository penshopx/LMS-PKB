import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsTable, users, type ApplicationRole, type Notification } from "@shared/schema";
import { db } from "../db";
import { storage, MemStorage } from "../storage";
import { DrizzleStorage } from "../db-storage";
import {
  comparePassword, createUser, setupAuth, passwordChangeAttemptLimiter,
} from "../auth";
import { registerRoutes } from "../routes";

const original = "notification-original-password";
const replacement = "notification-replacement-password";
const tag = randomUUID();
const accounts: Array<{ id: string; username: string; role: ApplicationRole }> = [];
let server: Server;
let baseUrl: string;

async function request(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(account: typeof accounts[number], password = original) {
  const response = await request("/api/login", "", "POST", { username: account.username, password });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

function change(cookie: string, currentPassword: unknown = original, newPassword: unknown = replacement) {
  return request("/api/me/password", cookie, "POST", { currentPassword, newPassword });
}

// Other concurrent integration suites legitimately notify every active admin.
// Assert password alerts without assuming this account has no learning activity.
function securityAlerts(notices: Notification[]) {
  return notices.filter(notice => notice.category === "system");
}

beforeAll(async () => {
  for (const role of ["admin", "bujk_pic", "participant"] as const) {
    const user = await createUser(`notification-${role}-${tag}`, original, { role });
    accounts.push({ id: user.id, username: user.username, role });
    expect(user.participantId).toBeNull();
  }
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  // Exercise notification behavior at the limiter boundary without resetting
  // shared counters used by concurrent auth-session integration tests.
  vi.spyOn(passwordChangeAttemptLimiter, "tryAcquire").mockResolvedValue({ allowed: true });
  vi.spyOn(passwordChangeAttemptLimiter, "recordSuccessfulChange").mockResolvedValue();
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  const ids = accounts.map(account => account.id);
  await db.delete(notificationsTable).where(inArray(notificationsTable.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("private password-change security notifications", () => {
  it("does not create alerts for invalid input, wrong credentials, or throttled attempts", async () => {
    const account = accounts[0];
    const cookie = await login(account);
    const create = vi.spyOn(storage, "createNotification");
    for (const [current, next] of [[original, "short"], [null, replacement], [original, null]]) {
      expect((await change(cookie, current, next)).status).toBe(400);
    }
    expect((await change(cookie, original, original)).status).toBe(400);
    expect((await change(cookie, "wrong-current-password")).status).toBe(401);
    vi.mocked(passwordChangeAttemptLimiter.tryAcquire).mockResolvedValueOnce({
      allowed: false, retryAfterSeconds: 60,
    });
    expect((await change(cookie)).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
    expect(securityAlerts(await storage.getNotifications(account.id))).toEqual([]);
  });

  it.each(["admin", "bujk_pic", "participant"] as const)(
    "persists one private, unread alert only after the %s password commits, without requiring a participant",
    async role => {
      const account = accounts.find(account => account.role === role)!;
      const cookie = await login(account);
      const save = storage.createNotification.bind(storage);
      const create = vi.spyOn(storage, "createNotification").mockImplementation(async data => {
        const [stored] = await db.select().from(users).where(eq(users.id, account.id));
        expect(await comparePassword(replacement, stored.password)).toBe(true);
        return save(data);
      });
      const started = Date.now();
      const response = await change(cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Password berhasil diubah" });
      expect(create).toHaveBeenCalledTimes(1);
      const list = await request("/api/notifications", cookie);
      expect(list.status).toBe(200);
      const alerts = securityAlerts(await list.json());
      expect(alerts).toHaveLength(1);
      const [alert] = alerts;
      expect(alert).toMatchObject({
        userId: account.id, type: "warning", category: "system", isRead: false,
        title: "Password akun Anda telah diubah",
      });
      expect(alert.message).toContain("segera hubungi admin");
      expect(Date.parse(alert.createdAt)).toBeGreaterThanOrEqual(started);
      const [stored] = await db.select().from(users).where(eq(users.id, account.id));
      for (const secret of [original, replacement, stored.password, cookie]) {
        expect(JSON.stringify(alert)).not.toContain(secret);
      }
      expect(Object.keys(alert).sort()).toEqual([
        "id", "userId", "type", "category", "title", "message", "isRead", "createdAt",
      ].sort());

      // Re-login and a new storage instance see the persisted alert.
      const freshCookie = await login(account, replacement);
      expect(securityAlerts(await new DrizzleStorage().getNotifications(account.id))).toEqual([alert]);
      expect(securityAlerts(await (await request("/api/notifications", freshCookie)).json())).toEqual([alert]);
      const read = await request(`/api/notifications/${alert.id}/read`, freshCookie, "PATCH");
      expect(read.status).toBe(200);
      expect((await read.json()).isRead).toBe(true);
    },
  );

  it("does not expose or mark another account's alert, even for an admin", async () => {
    const owner = accounts[2];
    const alert = await storage.createNotification({
      userId: owner.id, type: "warning", category: "system", title: "Private alert", message: "Owner only",
    });
    for (const account of accounts.slice(0, 2)) {
      const cookie = await login(account, replacement);
      const list = await request("/api/notifications", cookie);
      expect(list.status).toBe(200);
      expect((await list.json()).every((item: { userId: string }) => item.userId === account.id)).toBe(true);
      expect((await request(`/api/notifications/${alert.id}/read`, cookie, "PATCH")).status).toBe(404);
      expect((await request("/api/notifications/read-all", cookie, "PATCH")).status).toBe(200);
      expect((await storage.getNotifications(owner.id)).find(item => item.id === alert.id)!.isRead).toBe(false);
    }
    const ownerCookie = await login(owner, replacement);
    expect((await request("/api/notifications/read-all", ownerCookie, "PATCH")).status).toBe(200);
    expect((await storage.getNotifications(owner.id)).every(item => item.isRead)).toBe(true);
    expect((await request("/api/notifications")).status).toBe(401);
    expect((await request(`/api/notifications/${alert.id}/read`, "", "PATCH")).status).toBe(401);
    expect((await request("/api/notifications/read-all", "", "PATCH")).status).toBe(401);
  });

  it("keeps the successful password result and session when alert storage fails, without logging the error", async () => {
    const account = accounts[0];
    const cookie = await login(account, replacement);
    const before = securityAlerts(await storage.getNotifications(account.id));
    const sensitiveError = "simulated-query-with-credential-or-session-values";
    vi.spyOn(storage, "createNotification").mockRejectedValueOnce(new Error(sensitiveError));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = "notification-next-password";
    const response = await change(cookie, replacement, next);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Password berhasil diubah" });
    expect((await request("/api/me", cookie)).status).toBe(200);
    expect(securityAlerts(await storage.getNotifications(account.id))).toEqual(before);
    expect(log).toHaveBeenCalledWith("[auth] Password-change notification could not be saved.");
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveError);
    const [stored] = await db.select().from(users).where(eq(users.id, account.id));
    expect(await comparePassword(next, stored.password)).toBe(true);
    expect(await comparePassword(replacement, stored.password)).toBe(false);
    expect((await request("/api/login", "", "POST", { username: account.username, password: replacement })).status).toBe(401);
    await login(account, next);
  });
});

it("MemStorage enforces the same ownership rules for creation, lists, and read updates", async () => {
  const memory = new MemStorage();
  const data = { type: "warning", category: "system", title: "Security", message: "Password changed" } as const;
  const own = await memory.createNotification({ ...data, userId: "account-a" });
  const other = await memory.createNotification({ ...data, userId: "account-b" });
  expect(await memory.getNotifications("account-a")).toEqual([own]);
  expect(own.isRead).toBe(false);
  expect(await memory.markNotificationRead(other.id, "account-a")).toBeUndefined();
  await memory.markAllNotificationsRead("account-a");
  expect((await memory.getNotifications("account-a"))[0].isRead).toBe(true);
  expect((await memory.getNotifications("account-b"))[0].isRead).toBe(false);
  expect((await memory.markNotificationRead(other.id, "account-b"))!.isRead).toBe(true);
});
