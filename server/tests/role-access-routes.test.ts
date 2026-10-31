import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bujksTable, bujkInvitationsTable, users, participantsTable, quizAttemptsTable,
  type ApplicationRole,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";

const tag = randomUUID();
const password = "role-access-test-password";
const bujkA = randomUUID();
const bujkB = randomUUID();
let server: Server;
let baseUrl = "";
let adminId = "";
let participantA = "";
let participantB = "";
let courseId = "";
let quizId = "";
let essayQuizId = "";
let attemptA = "";
let attemptB = "";
let pendingEssayAttemptId = "";
const cookies: Record<string, string> = {};

async function request(role: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookies[role] ? { Cookie: cookies[role] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(key: string, username: string) {
  const response = await request("", "/api/login", "POST", { username, password });
  expect(response.status).toBe(200);
  cookies[key] = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookies[key]).not.toBe("");
}

async function invite(key: string, emailSuffix: string, extra: Record<string, unknown> = {}) {
  const response = await request(key, "/api/access/invitations", "POST", {
    email: `${emailSuffix}-${tag}@example.test`,
    participantName: "Peserta undangan uji",
    nip: randomUUID().slice(0, 12),
    position: "Staf",
    unit: "Unit Uji",
    ...extra,
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; role: string; bujkId: string; invitePath: string }>;
}

beforeAll(async () => {
  await db.insert(bujksTable).values([
    { id: bujkA, name: `BUJK A ${tag}`, createdAt: new Date().toISOString() },
    { id: bujkB, name: `BUJK B ${tag}`, createdAt: new Date().toISOString() },
  ]);
  const first = await storage.createParticipant({
    name: "Peserta A", email: `a-${tag}@example.test`, nip: `A-${tag}`, position: "Staf", unit: "A", bujkId: bujkA,
  });
  const second = await storage.createParticipant({
    name: "Peserta B", email: `b-${tag}@example.test`, nip: `B-${tag}`, position: "Staf", unit: "B", bujkId: bujkB,
  });
  participantA = first.id;
  participantB = second.id;
  await storage.addEvidence(participantA, { unitId: "tender-01", type: "reflection", title: "Refleksi pribadi rahasia", description: "Tidak boleh terlihat PIC" });
  await storage.addEvidence(participantA, { unitId: "tender-01", type: "document", title: "Evidensi terbuka untuk PIC", description: "Dokumen praktik" });

  const accounts: Array<[string, ApplicationRole, string | undefined, string | undefined]> = [
    ["admin", "admin", undefined, undefined],
    ["picA", "bujk_pic", undefined, bujkA],
    ["picB", "bujk_pic", undefined, bujkB],
    ["learnerA", "participant", participantA, bujkA],
    ["learnerB", "participant", participantB, bujkB],
  ];
  for (const [key, role, participantId, bujkId] of accounts) {
    const account = await createUser(`${key}-${tag}`, password, { role, participantId, bujkId });
    if (key === "admin") adminId = account.id;
  }
  const course = await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: `Role test ${tag}`, description: "Uji batas akses", duration: "1 jam",
  });
  courseId = course.id;
  const quiz = await storage.createQuiz({
    courseId, title: "Kuis akses", description: "Uji", passingScore: 80, questions: [],
  });
  quizId = quiz.id;
  const essayQuiz = await storage.createQuiz({
    courseId,
    title: "Kuis esai akses",
    description: "Uji akses penilaian esai",
    passingScore: 80,
    questions: [{
      id: "essay-1",
      type: "essay",
      text: "Jelaskan jawaban Anda.",
      points: 10,
      order: 1,
    }],
  });
  essayQuizId = essayQuiz.id;
  for (const participantId of [participantA, participantB]) {
    await storage.createEnrollment(participantId, courseId);
    const attempt = await storage.createQuizAttempt({
      quizId, participantId, answers: [], score: 80, maxScore: 100, passed: true,
      gradingStatus: "graded", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    });
    if (participantId === participantA) attemptA = attempt.id;
    else attemptB = attempt.id;
  }
  const pendingEssayAttempt = await storage.createQuizAttempt({
    quizId: essayQuizId,
    participantId: participantA,
    answers: [{ questionId: "essay-1", answer: "Jawaban untuk ditinjau.", points: 0 }],
    score: 0,
    maxScore: 10,
    passed: false,
    gradingStatus: "awaiting_review",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
  pendingEssayAttemptId = pendingEssayAttempt.id;
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  }));
  for (const [key] of accounts) await login(key, `${key}-${tag}`);
});

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (quizId) await db.delete(quizAttemptsTable).where(inArray(quizAttemptsTable.quizId, [quizId, essayQuizId]));
  if (courseId) await storage.deleteCourse(courseId);
  await db.delete(users).where(inArray(users.bujkId, [bujkA, bujkB]));
  if (adminId) await db.delete(users).where(eq(users.id, adminId));
  const profiles = await db.select({ id: participantsTable.id }).from(participantsTable).where(inArray(participantsTable.bujkId, [bujkA, bujkB]));
  for (const profile of profiles) await storage.deleteParticipant(profile.id);
  await db.delete(bujksTable).where(inArray(bujksTable.id, [bujkA, bujkB]));
});

describe("batas akses admin, PIC, dan peserta", () => {
  it("memerlukan login dan mengembalikan identitas peran tanpa sandi", async () => {
    expect((await request("", "/api/participants")).status).toBe(401);
    const me = await (await request("learnerA", "/api/me")).json();
    expect(me).toMatchObject({ role: "participant", participantId: participantA, bujkId: bujkA });
    expect(me).not.toHaveProperty("password");
  });

  it("peserta hanya melihat profil, pendaftaran, dan hasil miliknya", async () => {
    const participants = await (await request("learnerA", "/api/participants")).json();
    expect(participants.map((item: { id: string }) => item.id)).toEqual([participantA]);
    expect((await request("learnerA", `/api/participants/${participantB}`)).status).toBe(404);
    expect((await request("learnerA", `/api/participants/${participantB}/quiz-attempts`)).status).toBe(404);
    const enrollments = await (await request("learnerA", `/api/enrollments?participantId=${participantB}`)).json();
    expect(enrollments.every((item: { participantId: string }) => item.participantId === participantA)).toBe(true);
    const attempts = await (await request("learnerA", `/api/participants/${participantA}/quiz-attempts`)).json();
    expect(attempts.map((item: { id: string }) => item.id)).toContain(attemptA);
    expect(attempts.map((item: { id: string }) => item.id)).not.toContain(attemptB);
  });

  it("peserta tidak dapat mengirim jawaban, evidensi, atau pendaftaran atas nama orang lain", async () => {
    expect((await request("learnerA", `/api/quizzes/${quizId}/attempts`, "POST", { participantId: participantB, answers: {} })).status).toBe(404);
    expect((await request("learnerA", `/api/participants/${participantB}/evidences`, "POST", {})).status).toBe(404);
    expect((await request("learnerA", "/api/enrollments", "POST", { participantId: participantB, courseId })).status).toBe(403);
    expect((await request("learnerA", "/api/enrollments", "POST", { participantId: participantA, courseId })).status).toBe(200);
  });

  it("PIC hanya melihat BUJK sendiri dan tidak menerima refleksi pribadi pada daftar maupun detail", async () => {
    const participants = await (await request("picA", "/api/participants")).json();
    expect(participants.map((item: { id: string }) => item.id)).toContain(participantA);
    expect(participants.map((item: { id: string }) => item.id)).not.toContain(participantB);
    expect(JSON.stringify(participants)).not.toContain("Refleksi pribadi rahasia");
    const detail = await (await request("picA", `/api/participants/${participantA}`)).json();
    expect(detail.evidences.some((item: { type: string }) => item.type === "reflection")).toBe(false);
    expect(detail.evidences.some((item: { title: string }) => item.title === "Evidensi terbuka untuk PIC")).toBe(true);
    expect((await request("picA", `/api/participants/${participantB}`)).status).toBe(404);
    expect((await request("picA", `/api/participants/${participantB}/quiz-attempts`)).status).toBe(404);
    const attempts = await (await request("picA", `/api/quizzes/${quizId}/attempts`)).json();
    expect(attempts.map((item: { id: string }) => item.id)).toContain(attemptA);
    expect(attempts.map((item: { id: string }) => item.id)).not.toContain(attemptB);
  });

  it("menolak pengelolaan materi dan penilaian bagi peserta serta PIC", async () => {
    for (const key of ["picA", "learnerA"]) {
      expect((await request(key, "/api/courses", "POST", {})).status).toBe(403);
      expect((await request(key, "/api/quiz-attempts/pending-review")).status).toBe(403);
      expect((await request(key, `/api/quiz-attempts/${attemptA}/grade`, "POST", {})).status).toBe(403);
      expect((await request(key, `/api/quizzes/${quizId}/attempts/${attemptA}/grade`, "PATCH", {})).status).toBe(403);
      expect((await request(key, "/api/access/users")).status).toBe(403);
    }
    const pendingReviews = await (await request("admin", "/api/quiz-attempts/pending-review")).json();
    expect(pendingReviews.map((review: { id: string }) => review.id)).toContain(pendingEssayAttemptId);
    const graded = await request(
      "admin",
      `/api/quiz-attempts/${pendingEssayAttemptId}/grade`,
      "POST",
      { score: 85, feedback: "Jawaban memenuhi kriteria." },
    );
    expect(graded.status).toBe(200);
    expect(await graded.json()).toMatchObject({
      passed: true,
      attempt: { gradingStatus: "graded", score: 85 },
    });
    expect((await request("picA", `/api/participants/${participantA}/evidences`, "POST", {})).status).toBe(403);
    expect((await request("picA", "/api/enrollments", "POST", { participantId: participantA, courseId })).status).toBe(403);
    expect((await request("learnerA", "/api/access/invitations", "POST", {})).status).toBe(403);
  });

  it("admin tetap dapat melihat lintas BUJK tanpa mengirim hash kata sandi", async () => {
    expect((await request("admin", `/api/participants/${participantB}`)).status).toBe(200);
    const accounts = await (await request("admin", "/api/access/users")).json();
    expect(accounts.some((item: { participantId: string }) => item.participantId === participantA)).toBe(true);
    expect(accounts.every((item: object) => !("password" in item))).toBe(true);
    const ownDetail = await (await request("learnerA", `/api/participants/${participantA}`)).json();
    expect(ownDetail.evidences.some((item: { type: string }) => item.type === "reflection")).toBe(true);
  });
});

describe("undangan BUJK sekali pakai", () => {
  it("PIC tidak dapat menaikkan peran atau memindahkan undangan ke BUJK lain", async () => {
    const invitation = await invite("picA", "forced-scope", { role: "bujk_pic", bujkId: bujkB });
    expect(invitation).toMatchObject({ role: "participant", bujkId: bujkA });
    const token = invitation.invitePath.split("/").pop();
    const responses = await Promise.all([
      request("", "/api/invitations/accept", "POST", { token, password }),
      request("", "/api/invitations/accept", "POST", { token, password }),
    ]);
    expect(responses.filter(response => response.status === 201)).toHaveLength(1);
    expect(responses.filter(response => [400, 409].includes(response.status))).toHaveLength(1);
    const email = `forced-scope-${tag}@example.test`;
    await login("invited", email);
    const me = await (await request("invited", "/api/me")).json();
    expect(me).toMatchObject({ role: "participant", bujkId: bujkA });
    expect(me.participantId).toBeTruthy();
    const profile = await (await request("invited", `/api/participants/${me.participantId}`)).json();
    expect(profile).toMatchObject({ email, bujkId: bujkA });
  });

  it("daftar undangan tidak mengekspos token atau hash token", async () => {
    const list = await (await request("picA", "/api/access/invitations")).json();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((item: { bujkId: string }) => item.bujkId === bujkA)).toBe(true);
    expect(list.every((item: object) => !("tokenHash" in item) && !("invitePath" in item))).toBe(true);
  });

  it("PIC tidak dapat mencabut undangan BUJK lain; undangan dicabut tidak dapat diterima", async () => {
    const invitation = await invite("picB", "revoked");
    expect((await request("picA", `/api/access/invitations/${invitation.id}/revoke`, "POST", {})).status).toBe(404);
    expect((await request("picB", `/api/access/invitations/${invitation.id}/revoke`, "POST", {})).status).toBe(204);
    expect((await request("", "/api/invitations/accept", "POST", { token: invitation.invitePath.split("/").pop(), password })).status).toBe(400);
  });

  it("menolak undangan kedaluwarsa dan kata sandi terlalu pendek", async () => {
    const invitation = await invite("picA", "expired");
    const token = invitation.invitePath.split("/").pop();
    expect((await request("", "/api/invitations/accept", "POST", { token, password: "short" })).status).toBe(400);
    await db.update(bujkInvitationsTable).set({ expiresAt: "2000-01-01T00:00:00.000Z" }).where(eq(bujkInvitationsTable.id, invitation.id));
    expect((await request("", "/api/invitations/accept", "POST", { token, password })).status).toBe(400);
  });
});
