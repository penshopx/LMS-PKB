import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { users, certificatesTable, accountStatusHistory } from "@shared/schema";
import { createUser, setupAuth } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { registerRoutes } from "../routes";

const tag = randomUUID();
const password = "account-status-test-password";
const ids: string[] = [];
const cookies: Record<string, string> = {};
let server: Server;
let baseUrl: string;
let adminId: string;
let learnerId: string;
let picId: string;
let participantId: string;
let courseId: string;
let attemptId: string;
let certificateId: string;
let retainedData: unknown;

async function request(actor: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookies[actor] ? { Cookie: cookies[actor] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(actor: string) {
  const response = await request("", "/api/login", "POST", { username: `${actor}-${tag}`, password });
  if (response.status === 200) {
    cookies[actor] = response.headers.get("set-cookie")!.split(";")[0];
  }
  return response;
}

function setStatus(id: string, isActive: boolean, actor = "admin") {
  return request(actor, `/api/access/users/${id}/status`, "PATCH", { isActive });
}

async function learningData() {
  return {
    participant: await storage.getParticipant(participantId),
    attempts: await storage.getQuizAttemptsByParticipant(participantId),
    certificates: await storage.getCertificatesByParticipant(participantId),
  };
}

beforeAll(async () => {
  const participant = await storage.createParticipant({
    name: "Peserta status akun", email: `learner-${tag}@example.test`,
    nip: tag, position: "Staf", unit: "Uji",
  });
  participantId = participant.id;
  for (const role of ["admin", "participant", "bujk_pic"] as const) {
    const actor = role === "participant" ? "learner" : role === "bujk_pic" ? "pic" : "admin";
    const account = await createUser(`${actor}-${tag}`, password, {
      role, ...(role === "participant" ? { participantId } : {}),
    });
    ids.push(account.id);
    if (actor === "admin") adminId = account.id;
    if (actor === "learner") learnerId = account.id;
    if (actor === "pic") picId = account.id;
  }
  const course = await storage.createCourse({
    title: `Account status ${tag}`, description: "Uji", unitId: "tender-01",
    targetLevel: "L1", duration: "10 menit",
  });
  courseId = course.id;
  const quiz = await storage.createQuiz({
    courseId, title: "Uji", description: "Uji", passingScore: 80, questions: [],
  });
  const attempt = await storage.createQuizAttempt({
    quizId: quiz.id, participantId, answers: [], score: 90, maxScore: 100,
    passed: true, gradingStatus: "graded",
    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  });
  attemptId = attempt.id;
  const certificate = await storage.createCertificate({
    participantId, courseId, title: "Sertifikat uji", description: "Tetap tersimpan",
  });
  certificateId = certificate.id;
  retainedData = await learningData();
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
  for (const actor of ["admin", "learner", "pic"]) expect((await login(actor)).status).toBe(200);
});

afterAll(async () => {
  if (adminId) await db.delete(accountStatusHistory).where(eq(accountStatusHistory.actorId, adminId));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
  if (certificateId) await db.delete(certificatesTable).where(eq(certificatesTable.id, certificateId));
  if (courseId) await storage.deleteCourse(courseId);
  if (participantId) await storage.deleteParticipant(participantId);
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("account status management", () => {
  async function history() {
    return db.select().from(accountStatusHistory).where(eq(accountStatusHistory.actorId, adminId));
  }

  it("lists status without exposing password or session credentials", async () => {
    const response = await request("admin", "/api/access/users");
    expect(response.status).toBe(200);
    const accounts = await response.json();
    expect(accounts.find((a: { id: string }) => a.id === learnerId)).toMatchObject({ isActive: true, participantId });
    for (const account of accounts) {
      expect(account).not.toHaveProperty("password");
      expect(account).not.toHaveProperty("sessionVersion");
    }
  });

  it("rejects unauthenticated and non-admin changes, invalid input, absent accounts, and admin targets", async () => {
    const before = await history();
    expect((await request("", "/api/access/status-history")).status).toBe(401);
    expect((await setStatus(learnerId, false, "")).status).toBe(401);
    for (const actor of ["learner", "pic"]) {
      expect((await setStatus(learnerId, false, actor)).status).toBe(403);
      expect((await request(actor, "/api/access/users")).status).toBe(403);
      expect((await request(actor, "/api/access/status-history")).status).toBe(403);
    }
    for (const body of [{}, { isActive: "false" }, { isActive: false, role: "admin" }]) {
      expect((await request("admin", `/api/access/users/${learnerId}/status`, "PATCH", body)).status).toBe(400);
    }
    expect((await setStatus(randomUUID(), false)).status).toBe(404);
    expect((await setStatus(adminId, false)).status).toBe(403);
    expect((await setStatus(adminId, true)).status).toBe(403);
    expect((await request("admin", "/api/me")).status).toBe(200);
    expect(await history()).toEqual(before);
  });

  it("blocks login and every old session for participants and PICs, retaining learning history", async () => {
    for (const [actor, id] of [["learner", learnerId], ["pic", picId]]) {
      const oldSession = cookies[actor];
      // Keep a second session untouched while inactive, then try it after reactivation.
      expect((await login(actor)).status).toBe(200);
      const untouchedSession = cookies[actor];
      cookies[actor] = oldSession;
      const before = (await history()).length;
      const startedAt = Date.now();
      expect((await setStatus(id, false)).status).toBe(200);
      expect((await setStatus(id, false)).status).toBe(200);
      const deactivations = await history();
      expect(deactivations).toHaveLength(before + 1);
      const event = deactivations.find(entry => entry.targetUserId === id && !entry.newIsActive)!;
      expect(event).toMatchObject({
        actorId: adminId, actorUsername: `admin-${tag}`,
        targetUserId: id, targetUsername: `${actor}-${tag}`,
        previousIsActive: true, newIsActive: false,
      });
      expect(event.changedAt.getTime()).toBeGreaterThanOrEqual(startedAt - 1000);
      expect(event.changedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      const listed = await (await request("admin", "/api/access/users")).json();
      expect(listed.find((a: { id: string }) => a.id === id).isActive).toBe(false);
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await request(actor, "/api/courses")).status).toBe(401);
      const deniedLogin = await login(actor);
      expect(deniedLogin.status).toBe(401);
      expect(await deniedLogin.json()).toMatchObject({ message: expect.stringContaining("dinonaktifkan") });
      expect(await learningData()).toEqual(retainedData);
      expect((await setStatus(id, true)).status).toBe(200);
      cookies[actor] = untouchedSession;
      expect((await request(actor, "/api/me")).status).toBe(401);
      cookies[actor] = oldSession;
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await login(actor)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
      // An idempotent activation must not revoke the new session.
      expect((await setStatus(id, true)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
      const events = (await history()).filter(entry => entry.targetUserId === id);
      expect(events).toHaveLength(2);
      expect(events.find(entry => entry.newIsActive)).toMatchObject({
        previousIsActive: false, newIsActive: true, actorId: adminId,
      });
    }
    expect(await learningData()).toEqual(retainedData);
    expect((await storage.getQuizAttemptsByParticipant(participantId)).some(a => a.id === attemptId)).toBe(true);
  });

  it("rolls back status and session revocation when the audit insert fails", async () => {
    const [before] = await db.select().from(users).where(eq(users.id, learnerId));
    const events = await history();
    const realTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementationOnce(callback =>
      realTransaction(tx => callback(new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "insert") return () => { throw new Error("Audit unavailable"); };
          return Reflect.get(target, property, receiver);
        },
      }))),
    );
    try {
      expect((await setStatus(learnerId, false)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    const [after] = await db.select().from(users).where(eq(users.id, learnerId));
    expect(after).toEqual(before);
    expect(await history()).toEqual(events);
    expect((await request("learner", "/api/me")).status).toBe(200);
  });

  it("serializes duplicate concurrent changes and records only one real transition", async () => {
    const before = (await history()).length;
    const responses = await Promise.all([setStatus(learnerId, false), setStatus(learnerId, false)]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(await history()).toHaveLength(before + 1);
    expect((await setStatus(learnerId, true)).status).toBe(200);
  });

  it("serves paginated, newest-first admin history with only audit fields", async () => {
    // Enough rows to exercise pagination even on an otherwise empty installation.
    await db.insert(accountStatusHistory).values(Array.from({ length: 51 }, (_, index) => ({
      actorId: adminId, actorUsername: `admin-${tag}`,
      targetUserId: learnerId, targetUsername: `learner-${tag}`,
      previousIsActive: true, newIsActive: false,
      changedAt: new Date(Date.now() - (index + 1) * 1000),
    })));
    const response = await request("admin", "/api/access/status-history");
    expect(response.status).toBe(200);
    const page = await response.json();
    expect(page.entries).toHaveLength(50);
    expect(page.hasMore).toBe(true);
    expect(page.entries.map((entry: { changedAt: string }) => entry.changedAt))
      .toEqual(page.entries.map((entry: { changedAt: string }) => entry.changedAt).sort().reverse());
    for (const entry of page.entries) {
      expect(Object.keys(entry).sort()).toEqual([
        "id", "actorId", "actorUsername", "targetUserId", "targetUsername",
        "previousIsActive", "newIsActive", "changedAt",
      ].sort());
      expect(Number.isNaN(Date.parse(entry.changedAt))).toBe(false);
    }
    const next = await (await request("admin", "/api/access/status-history?offset=50")).json();
    expect(next.entries.length).toBeGreaterThan(0);
    const firstIds = page.entries.map((entry: { id: string }) => entry.id);
    expect(next.entries.every((entry: { id: string }) => !firstIds.includes(entry.id))).toBe(true);
    for (const query of ["offset=-1", "offset=1.5", "offset=oops", "offset=2147483648", "password=x"]) {
      expect((await request("admin", `/api/access/status-history?${query}`)).status).toBe(400);
    }
    const empty = await (await request("admin", "/api/access/status-history?offset=2147483647")).json();
    expect(empty).toEqual({ entries: [], hasMore: false });
  });
});
