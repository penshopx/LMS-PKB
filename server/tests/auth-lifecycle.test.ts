import express from "express";
import { createServer, type Server } from "http";
import { createHash, randomBytes, randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";
import { bujksTable, bujkInvitationsTable, participantsTable, users } from "@shared/schema";

const tag = randomUUID();
const password = "  lifecycle-password-strong  ";
const email = `lifecycle-${tag}@example.test`;
const bujkId = randomUUID();
const fixtureIds: string[] = [];
const sessionIds = new Set<string>();
let server: Server;
let baseUrl: string;
let adminId: string;
let emailUserId: string;

function cookie(response: Response) {
  const value = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  const signed = decodeURIComponent(value.slice(value.indexOf("=") + 1));
  if (signed.startsWith("s:")) sessionIds.add(signed.slice(2).split(".")[0]);
  return value;
}
function sessionId(value: string) {
  return decodeURIComponent(value.slice(value.indexOf("=") + 1)).slice(2).split(".")[0];
}
function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method, headers: { "Content-Type": "application/json", "X-Forwarded-For": `2001:db8:${tag.slice(0, 4)}::1`, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function login(username = email, value = password, previousCookie?: string) {
  return request("/api/login", "POST", { username, password: value }, previousCookie ? { Cookie: previousCookie } : {});
}
async function invitation(label: string, expiresAt = new Date(Date.now() + 3_600_000).toISOString(), inviteEmail?: string) {
  const token = randomBytes(32).toString("hex");
  const id = randomUUID();
  const username = inviteEmail ?? `${label}-${tag}@example.test`;
  await db.insert(bujkInvitationsTable).values({
    id, tokenHash: createHash("sha256").update(token).digest("hex"),
    email: username, role: "participant", bujkId, participantName: "Peserta pengujian",
    nip: randomUUID(), position: "Staf", unit: "Unit pengujian",
    invitedBy: adminId, expiresAt, createdAt: new Date().toISOString(),
  });
  return { id, token, username };
}

beforeAll(async () => {
  await db.insert(bujksTable).values({ id: bujkId, name: "BUJK uji autentikasi", createdAt: new Date().toISOString() });
  const admin = await createUser(`lifecycle-admin-${tag}`, password);
  const account = await createUser(email, password, { role: "bujk_pic", bujkId });
  adminId = admin.id;
  emailUserId = account.id;
  fixtureIds.push(admin.id, account.id);
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  }));
});

afterAll(async () => {
  for (const sid of sessionIds) await db.execute(sql`DELETE FROM session WHERE sid = ${sid}`);
  const registered = await db.select().from(users).where(eq(users.bujkId, bujkId));
  const participantIds = registered.flatMap(account => account.participantId ? [account.participantId] : []);
  const allIds = [...fixtureIds, ...registered.map(account => account.id)];
  if (allIds.length) await db.delete(users).where(inArray(users.id, allIds));
  if (participantIds.length) await db.delete(participantsTable).where(inArray(participantsTable.id, participantIds));
  await db.delete(bujksTable).where(eq(bujksTable.id, bujkId));
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("registration, login and logout lifecycle", () => {
  it("normalizes email and surrounding username spaces without altering the password", async () => {
    const response = await login(`  ${email.toUpperCase()}  `);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const session = cookie(response);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
    const data = await response.json();
    expect(data).toEqual({ id: emailUserId, username: email, role: "bujk_pic", bujkId, participantId: null });
    const me = await request("/api/me", "GET", undefined, { Cookie: session });
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect((await login(email, password.trim())).status).toBe(401);
  });

  it("rejects malformed login bodies without exposing submitted credentials", async () => {
    for (const body of [{}, { username: [], password }, { username: email, password: 7 },
      { username: " ", password }, { username: email, password: "a".repeat(1025) },
      { username: email, password, role: "admin" }]) {
      const response = await request("/api/login", "POST", body);
      expect(response.status).toBe(400);
      expect((await response.json()).message).not.toContain(password);
    }
  });

  it("rotates sessions on login and destroys the server session and cookie on logout", async () => {
    const first = await login();
    const oldCookie = cookie(first);
    const second = await login(email, password, oldCookie);
    expect(second.status).toBe(200);
    const currentCookie = cookie(second);
    expect(sessionId(currentCookie)).not.toBe(sessionId(oldCookie));
    expect((await request("/api/me", "GET", undefined, { Cookie: oldCookie })).status).toBe(401);
    const logout = await request("/api/logout", "POST", undefined, { Cookie: currentCookie });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("connect.sid=;");
    expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    expect((await db.execute(sql`SELECT sid FROM session WHERE sid = ${sessionId(currentCookie)}`)).rows).toHaveLength(0);
    expect((await request("/api/me", "GET", undefined, { Cookie: currentCookie })).status).toBe(401);
    const privateResponse = await request("/api/access/users", "GET", undefined, { Cookie: currentCookie });
    expect(privateResponse.status).toBe(401);
    expect(await privateResponse.json()).toMatchObject({ code: "SESSION_EXPIRED" });
    expect((await request("/api/logout", "POST")).status).toBe(200);
  });

  it("rejects cross-site authentication mutations without accepting cookies or creating an account", async () => {
    for (const path of ["/api/login", "/api/logout", "/api/invitations/accept", "/api/invitations/preview"]) {
      const response = await request(path, "POST", {}, { Origin: "https://untrusted.example.test" });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
    }
    expect((await request("/api/login", "POST", {}, { Origin: "null" })).status).toBe(403);
    expect((await request("/api/login", "POST", {}, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    const sameOrigin = await request("/api/login", "POST", { username: email, password }, { Origin: baseUrl });
    expect(sameOrigin.status).toBe(200);
    cookie(sameOrigin);
  });

  it("treats malformed or obsolete stored identities as signed out instead of granting access or returning 500", async () => {
    for (const identity of [null, 42, [], {}, { id: emailUserId }, { id: emailUserId, version: "0" },
      { id: "", version: 0 }, { id: emailUserId, version: -1 }, { id: emailUserId, version: 0.5 },
      { id: "a".repeat(257), version: 0 }, { id: emailUserId, version: 999 }]) {
      const response = await login();
      expect(response.status).toBe(200);
      const session = cookie(response);
      await db.execute(sql`UPDATE session SET sess = jsonb_set(sess::jsonb, '{passport,user}', ${JSON.stringify(identity)}::jsonb)::json WHERE sid = ${sessionId(session)}`);
      expect((await request("/api/me", "GET", undefined, { Cookie: session })).status).toBe(401);
    }
    const response = await login();
    const legacyCookie = cookie(response);
    await db.execute(sql`UPDATE session SET sess = jsonb_set(sess::jsonb, '{passport,user}', ${JSON.stringify(emailUserId)}::jsonb)::json WHERE sid = ${sessionId(legacyCookie)}`);
    expect((await request("/api/me", "GET", undefined, { Cookie: legacyCookie })).status).toBe(200);
  });

  it("previews an invitation without consuming it, then registers and signs in with its assigned role", async () => {
    const invite = await invitation("complete");
    for (let i = 0; i < 2; i++) {
      const preview = await request("/api/invitations/preview", "POST", { token: invite.token });
      expect(preview.status).toBe(200);
      expect(preview.headers.get("cache-control")).toBe("no-store");
      expect(Object.keys(await preview.json()).sort()).toEqual(["username", "participantName", "bujkName", "role", "expiresAt"].sort());
    }
    expect((await request("/api/invitations/accept", "POST", { token: invite.token, password, role: "admin" })).status).toBe(400);
    expect((await request("/api/invitations/accept", "POST", { token: invite.token, password: " ".repeat(12) })).status).toBe(400);
    const registered = await request("/api/invitations/accept", "POST", { token: invite.token, password });
    expect(registered.status).toBe(201);
    expect(await registered.json()).toMatchObject({ username: invite.username, role: "participant" });
    // Registration deliberately does not sign the browser into an unexpected account.
    expect(registered.headers.get("set-cookie")).toBeNull();
    const loggedIn = await login(invite.username.toUpperCase());
    expect(loggedIn.status).toBe(200);
    const me = await request("/api/me", "GET", undefined, { Cookie: cookie(loggedIn) });
    expect(await me.json()).toMatchObject({ username: invite.username, role: "participant", bujkId });
    expect((await request("/api/invitations/preview", "POST", { token: invite.token })).status).toBe(400);
    expect((await request("/api/invitations/accept", "POST", { token: invite.token, password })).status).toBe(400);
  });

  it("does not consume an invitation while another account is authenticated", async () => {
    const invite = await invitation("already-authenticated");
    const adminLogin = await login(`lifecycle-admin-${tag}`);
    const response = await request("/api/invitations/accept", "POST", { token: invite.token, password }, { Cookie: cookie(adminLogin) });
    expect(response.status).toBe(409);
    const [row] = await db.select().from(bujkInvitationsTable).where(eq(bujkInvitationsTable.id, invite.id));
    expect(row.acceptedAt).toBeNull();
    expect(await db.select().from(users).where(eq(users.username, invite.username))).toHaveLength(0);
  });

  it("rejects expired, malformed-expiry and unknown invitations before showing a registration form", async () => {
    for (const expiry of ["2000-01-01T00:00:00.000Z", "not-a-date"]) {
      const invite = await invitation("expired", expiry);
      for (const endpoint of ["preview", "accept"]) {
        expect((await request(`/api/invitations/${endpoint}`, "POST", {
          token: invite.token, ...(endpoint === "accept" ? { password } : {}),
        })).status).toBe(400);
      }
    }
    expect((await request("/api/invitations/preview", "POST", { token: randomBytes(32).toString("hex") })).status).toBe(400);
    expect((await request("/api/invitations/preview", "POST", { token: "short" })).status).toBe(400);
  });

  it("serializes different invitation tokens for the same email into one account and one participant", async () => {
    const commonEmail = `parallel-${tag}@example.test`;
    const first = await invitation("parallel-a", undefined, commonEmail);
    const second = await invitation("parallel-b", undefined, commonEmail.toUpperCase());
    const results = await Promise.all([first, second].map(invite => request("/api/invitations/accept", "POST", { token: invite.token, password })));
    expect(results.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(users).where(eq(users.username, commonEmail))).toHaveLength(1);
    expect(await db.select().from(participantsTable).where(eq(participantsTable.email, commonEmail))).toHaveLength(1);
    const rows = await db.select().from(bujkInvitationsTable).where(inArray(bujkInvitationsTable.id, [first.id, second.id]));
    expect(rows.filter(row => row.acceptedAt)).toHaveLength(1);
  });
});
