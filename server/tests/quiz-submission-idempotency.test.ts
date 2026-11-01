import express from "express";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { coursesTable, quizAttemptsTable, users } from "@shared/schema";
import { db } from "../db";
import { createUser, setupAuth } from "../auth";
import { storage } from "../storage";
import { registerRoutes } from "../routes";
import { quizSubmissionFingerprint } from "../quiz-submission-identity";

let server: Server;
let origin = "";
let adminCookie = "";
const participantIds: string[] = [];
const participantCookies: string[] = [];
const userIds: string[] = [];
const courseIds: string[] = [];

async function login(username: string) {
  const response = await fetch(`${origin}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "quiz-idempotency-test-only" }),
  });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const tag = randomUUID();
  const admin = await createUser(`quiz-key-admin-${tag}`, "quiz-idempotency-test-only", { role: "admin" });
  userIds.push(admin.id);
  adminCookie = await login(admin.username);
  for (let i = 0; i < 2; i++) {
    const participant = await storage.createParticipant({
      nip: `KEY${tag.slice(0, 8)}${i}`, name: `Peserta retry ${i}`, position: "Staf", unit: "Uji",
      email: `quiz-key-${tag}-${i}@example.test`,
    });
    participantIds.push(participant.id);
    const user = await createUser(`quiz-key-${tag}-${i}`, "quiz-idempotency-test-only", {
      role: "participant", participantId: participant.id,
    });
    userIds.push(user.id);
    participantCookies.push(await login(user.username));
  }
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  for (const id of courseIds) await storage.deleteCourse(id);
  for (const id of userIds) await db.delete(users).where(eq(users.id, id));
  for (const id of participantIds) await storage.deleteParticipant(id);
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function fixture(type: "multiple_choice" | "essay" = "multiple_choice", maxAttempts = 2) {
  const course = await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: `Uji retry ${randomUUID()}`,
    description: "Fixture terisolasi untuk keamanan retry", duration: "1 jam",
  });
  courseIds.push(course.id);
  const quiz = await storage.createQuiz({
    courseId: course.id, title: "Post-test retry", description: "Uji idempotensi",
    passingScore: 80, maxAttempts, shuffleQuestions: false, showResults: true,
    questions: [{
      id: "q", type, text: "Jawab pertanyaan", points: 100, order: 1,
      options: [{ id: "a", text: "Benar", isCorrect: true }, { id: "b", text: "Salah", isCorrect: false }],
      correctAnswer: "Benar",
    }],
  });
  await db.update(coursesTable).set({ postTestId: quiz.id }).where(eq(coursesTable.id, course.id));
  for (const participantId of participantIds) await storage.createEnrollment(participantId, course.id);
  return { quiz, course };
}

function submit(quizId: string, key: string | undefined = randomUUID(), overrides: Record<string, unknown> = {}, cookie = participantCookies[0]) {
  return fetch(`${origin}/api/quizzes/${quizId}/attempts`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ participantId: participantIds[0], idempotencyKey: key, answers: { q: "Benar" }, timeSpent: 30, ...overrides }),
  });
}

describe("idempotensi pengiriman kuis melalui PostgreSQL dan API", () => {
  it("sepuluh retry paralel memakai satu slot dan mengembalikan ID yang sama", async () => {
    const { quiz } = await fixture("multiple_choice", 1);
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => submit(quiz.id, key)));
    expect(results.filter(result => result.status === 201)).toHaveLength(1);
    expect(results.filter(result => result.status === 200)).toHaveLength(9);
    const bodies = await Promise.all(results.map(result => result.json()));
    expect(new Set(bodies.map(body => body.id)).size).toBe(1);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(1);
    expect(bodies.every(body => !("submissionFingerprint" in body) && !("idempotencyKey" in body))).toBe(true);
  });

  it("kunci berbeda menghabiskan slot baru tetapi tidak melewati batas saat paralel", async () => {
    const { quiz } = await fixture();
    const keys = Array.from({ length: 10 }, () => randomUUID());
    const results = await Promise.all(keys.map(key => submit(quiz.id, key)));
    expect(results.filter(result => result.status === 201)).toHaveLength(2);
    expect(results.filter(result => result.status === 409)).toHaveLength(8);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(2);
    const successIndex = results.findIndex(result => result.status === 201);
    const original = await results[successIndex].json();
    const replay = await submit(quiz.id, keys[successIndex]);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
  });

  it("menolak perubahan jawaban atau durasi pada kunci yang sama tanpa mengubah percobaan", async () => {
    const { quiz, course } = await fixture();
    const key = randomUUID();
    const original = await (await submit(quiz.id, key)).json();
    const enrollment = (await storage.getEnrollmentsByParticipant(participantIds[0])).find(item => item.courseId === course.id);
    for (const overrides of [{ answers: { q: "Salah" } }, { timeSpent: 31 }]) {
      const response = await submit(quiz.id, key, overrides);
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("idempotency_conflict");
    }
    expect(await storage.getQuizAttempts(quiz.id)).toEqual([original]);
    expect((await storage.getEnrollmentsByParticipant(participantIds[0])).find(item => item.courseId === course.id)).toEqual(enrollment);
  });

  it("kiriman paralel dengan kunci sama tetapi isi berbeda hanya menerima satu isi", async () => {
    const { quiz } = await fixture();
    const key = randomUUID();
    const responses = await Promise.all([
      submit(quiz.id, key), submit(quiz.id, key, { answers: { q: "Salah" } }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(1);
  });

  it("kunci sama milik peserta berbeda atau kuis berbeda tidak berbagi hasil maupun jatah", async () => {
    const { quiz } = await fixture("multiple_choice", 1);
    const { quiz: otherQuiz } = await fixture("multiple_choice", 1);
    const key = randomUUID();
    const [a, b, other] = await Promise.all([
      submit(quiz.id, key),
      submit(quiz.id, key, { participantId: participantIds[1], answers: { q: "Salah" } }, participantCookies[1]),
      submit(otherQuiz.id, key),
    ]);
    expect([a.status, b.status, other.status]).toEqual([201, 201, 201]);
    const first = await a.json();
    const second = await b.json();
    expect(first.participantId).toBe(participantIds[0]);
    expect(second.participantId).toBe(participantIds[1]);
    expect([first.score, second.score]).toEqual([100, 0]);
    const forged = await submit(quiz.id, key, { participantId: participantIds[1] });
    expect(forged.status).toBe(404);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(2);
  });

  it("retry esai bekerja saat menunggu nilai dan setelah dinilai; ujian ulang membutuhkan kunci baru", async () => {
    const { quiz } = await fixture("essay");
    const key = randomUUID();
    const attempt = await (await submit(quiz.id, key)).json();
    const replayPending = await submit(quiz.id, key);
    expect(replayPending.status).toBe(200);
    expect((await replayPending.json()).gradingStatus).toBe("awaiting_review");
    const blocked = await submit(quiz.id);
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("awaiting_review");
    const review = await fetch(`${origin}/api/quizzes/${quiz.id}/attempts/${attempt.id}/grade`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ essayScores: { q: 0 } }),
    });
    expect(review.status).toBe(200);
    const replayGraded = await submit(quiz.id, key);
    expect(replayGraded.status).toBe(200);
    expect(await replayGraded.json()).toMatchObject({ id: attempt.id, gradingStatus: "graded", score: 0 });
    expect((await submit(quiz.id)).status).toBe(201);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(2);
  });

  it("rollback progres juga membatalkan receipt, sehingga retry berikutnya masih dapat membuat percobaan", async () => {
    const { quiz } = await fixture("multiple_choice", 1);
    const key = randomUUID();
    const transactional = storage as unknown as { refreshPostTestEnrollmentInTransaction: (...args: unknown[]) => Promise<void> };
    const spy = vi.spyOn(transactional, "refreshPostTestEnrollmentInTransaction").mockRejectedValueOnce(new Error("forced test rollback"));
    expect((await submit(quiz.id, key)).status).toBe(500);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(0);
    spy.mockRestore();
    expect((await submit(quiz.id, key)).status).toBe(201);
    expect((await submit(quiz.id, key)).status).toBe(200);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(1);
  });

  it("retry tidak menghitung ulang nilai atau menyentuh progres yang sudah tersimpan", async () => {
    const { quiz } = await fixture("multiple_choice", 1);
    const key = randomUUID();
    const original = await (await submit(quiz.id, key)).json();
    const transactional = storage as unknown as { refreshPostTestEnrollmentInTransaction: (...args: unknown[]) => Promise<void> };
    const spy = vi.spyOn(transactional, "refreshPostTestEnrollmentInTransaction").mockRejectedValue(new Error("replay must not refresh"));
    const replay = await submit(quiz.id, key);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    expect(spy).not.toHaveBeenCalled();
  });

  it("database menolak duplikasi receipt walaupun penulis melewati pemeriksaan aplikasi", async () => {
    const { quiz } = await fixture();
    const key = randomUUID();
    await submit(quiz.id, key);
    const [row] = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.quizId, quiz.id));
    await expect(db.insert(quizAttemptsTable).values({ ...row, id: `attempt-${randomUUID()}` }))
      .rejects.toMatchObject({ code: "23505", constraint: "quiz_attempts_submission_unique" });
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(1);
  });

  it("menolak UUID tidak valid dan tetap mendukung klien lama tanpa kunci", async () => {
    const { quiz } = await fixture();
    for (const idempotencyKey of ["", "invalid", 123]) {
      expect((await submit(quiz.id, randomUUID(), { idempotencyKey })).status).toBe(400);
    }
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(0);
    expect((await submit(quiz.id, randomUUID(), { idempotencyKey: undefined })).status).toBe(201);
    expect((await submit(quiz.id, randomUUID(), { idempotencyKey: undefined })).status).toBe(201);
    expect(await storage.getQuizAttempts(quiz.id)).toHaveLength(2);
  });
});

describe("fingerprint pengiriman", () => {
  it("tidak bergantung pada urutan properti tetapi tetap membedakan jawaban dan durasi", () => {
    const digest = quizSubmissionFingerprint({ b: "dua", a: "satu" }, 30);
    expect(quizSubmissionFingerprint({ a: "satu", b: "dua" }, 30)).toBe(digest);
    expect(quizSubmissionFingerprint({ a: "berubah", b: "dua" }, 30)).not.toBe(digest);
    expect(quizSubmissionFingerprint({ a: "satu", b: "dua" }, 31)).not.toBe(digest);
  });
});
