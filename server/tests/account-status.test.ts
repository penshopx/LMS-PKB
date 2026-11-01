import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users, certificatesTable } from "@shared/schema";
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
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
  if (certificateId) await db.delete(certificatesTable).where(eq(certificatesTable.id, certificateId));
  if (courseId) await storage.deleteCourse(courseId);
  if (participantId) await storage.deleteParticipant(participantId);
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("account status management", () => {
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
    expect((await setStatus(learnerId, false, "")).status).toBe(401);
    for (const actor of ["learner", "pic"]) {
      expect((await setStatus(learnerId, false, actor)).status).toBe(403);
      expect((await request(actor, "/api/access/users")).status).toBe(403);
    }
    for (const body of [{}, { isActive: "false" }, { isActive: false, role: "admin" }]) {
      expect((await request("admin", `/api/access/users/${learnerId}/status`, "PATCH", body)).status).toBe(400);
    }
    expect((await setStatus(randomUUID(), false)).status).toBe(404);
    expect((await setStatus(adminId, false)).status).toBe(403);
    expect((await setStatus(adminId, true)).status).toBe(403);
    expect((await request("admin", "/api/me")).status).toBe(200);
  });

  it("blocks login and every old session for participants and PICs, retaining learning history", async () => {
    for (const [actor, id] of [["learner", learnerId], ["pic", picId]]) {
      const oldSession = cookies[actor];
      // Keep a second session untouched while inactive, then try it after reactivation.
      expect((await login(actor)).status).toBe(200);
      const untouchedSession = cookies[actor];
      cookies[actor] = oldSession;
      expect((await setStatus(id, false)).status).toBe(200);
      expect((await setStatus(id, false)).status).toBe(200);
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
    }
    expect(await learningData()).toEqual(retainedData);
    expect((await storage.getQuizAttemptsByParticipant(participantId)).some(a => a.id === attemptId)).toBe(true);
  });
});
