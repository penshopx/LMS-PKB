import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  certificatesTable,
  coursesTable,
  users,
} from "@shared/schema";
import { db } from "../db";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";
import { storage } from "../storage";

let server: Server;
let baseUrl = "";
let sessionCookie = "";
let participantId = "";
let courseId = "";
let preTestId = "";
let postTestId = "";
let username = "";
let userId = "";

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
      ...(init.headers ?? {}),
    },
  });
}

async function submitQuiz(quizId: string, answer: string, extra: Record<string, unknown> = {}) {
  return request(`/api/quizzes/${quizId}/attempts`, {
    method: "POST",
    body: JSON.stringify({
      participantId,
      answers: { "question-1": answer },
      ...extra,
    }),
  });
}

beforeAll(async () => {
  const tag = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  username = `lms-rules-${tag}`;
  const user = await createUser(username, "lms-test-password");
  userId = user.id;

  const participant = await storage.createParticipant({
    nip: `LMS${tag}`.slice(0, 18),
    name: "Peserta uji syarat kursus",
    position: "Staf",
    unit: "Uji",
    email: `lms-rules-${tag}@test.go.id`,
  });
  participantId = participant.id;

  const course = await storage.createCourse({
    unitId: "tender-01",
    targetLevel: "L2",
    title: `Kursus uji progres ${tag}`,
    description: "Kursus integrasi progres lesson dan syarat post-test",
    duration: "1 jam",
  });
  courseId = course.id;

  const preTest = await storage.createQuiz({
    courseId,
    title: "Pre-test diagnostik",
    description: "Tidak menjadi syarat kursus",
    passingScore: 80,
    maxAttempts: 3,
    shuffleQuestions: false,
    showResults: true,
    questions: [{
      id: "question-1",
      type: "multiple_choice",
      text: "Pilih jawaban benar",
      points: 10,
      options: [{ id: "a", text: "Tepat", isCorrect: true }, { id: "b", text: "Keliru", isCorrect: false }],
      correctAnswer: "Tepat",
      order: 1,
    }],
  });
  const postTest = await storage.createQuiz({
    courseId,
    title: "Post-test",
    description: "Esai harus dinilai sebelum kelulusan ditetapkan",
    passingScore: 70,
    maxAttempts: 3,
    shuffleQuestions: false,
    showResults: true,
    questions: [
      {
        id: "question-1",
        type: "multiple_choice",
        text: "Pilih jawaban benar",
        points: 10,
        options: [{ id: "a", text: "Tepat", isCorrect: true }, { id: "b", text: "Keliru", isCorrect: false }],
        correctAnswer: "Tepat",
        order: 1,
      },
      {
        id: "question-2",
        type: "essay",
        text: "Jelaskan alasan jawaban Anda",
        points: 10,
        order: 2,
      },
    ],
  });
  preTestId = preTest.id;
  postTestId = postTest.id;
  await db.update(coursesTable)
    .set({ preTestId, postTestId })
    .where(eq(coursesTable.id, courseId));
  await storage.createEnrollment(participantId, courseId);

  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not start");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  const login = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "lms-test-password" }),
  });
  expect(login.status).toBe(200);
  sessionCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!sessionCookie) throw new Error("Test login did not create a session");
});

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  if (participantId) {
    await db.delete(certificatesTable).where(eq(certificatesTable.participantId, participantId));
  }
  if (courseId) await storage.deleteCourse(courseId);
  if (participantId) await storage.deleteParticipant(participantId);
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

describe("aturan progres kursus melalui API", () => {
  it("menolak sertifikat sebelum semua syarat terpenuhi dan menilai post-test di server", async () => {
    const certificateData = {
      participantId,
      courseId,
      title: "Sertifikat Penyelesaian Kursus",
      description: "Sertifikat uji",
    };
    const earlyCertificate = await request("/api/certificates", {
      method: "POST",
      body: JSON.stringify(certificateData),
    });
    expect(earlyCertificate.status).toBe(409);

    const arbitraryProgress = await request(`/api/enrollments/${(await (await request(`/api/enrollments?participantId=${participantId}`)).json())[0].id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ progress: 100, status: "completed" }),
    });
    expect(arbitraryProgress.status).toBe(409);

    const lessons = (await storage.getCourse(courseId))!.lessons;
    const enrollment = (await storage.getEnrollmentsByParticipant(participantId))[0];
    for (const lesson of lessons) {
      const response = await request(`/api/enrollments/${enrollment.id}/lessons/${lesson.id}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(200);
    }

    const afterLessons = await request(`/api/courses/${courseId}/learning-state?participantId=${participantId}`);
    expect(await afterLessons.json()).toMatchObject({
      completion: { progress: 100, lessonsCompleted: true, isComplete: false },
    });

    const publicQuiz = await request(`/api/quizzes/${postTestId}`);
    const publicQuizBody = await publicQuiz.json();
    expect(publicQuizBody.questions[0]).not.toHaveProperty("correctAnswer");
    expect(publicQuizBody.questions[0].options[0]).not.toHaveProperty("isCorrect");

    const preTestAttempt = await submitQuiz(preTestId, "Keliru");
    expect((await preTestAttempt.json()).passed).toBe(false);

    const pendingPostTest = await submitQuiz(postTestId, "Tepat", {
      score: 100,
      passed: true,
      answers: { "question-1": "Tepat", "question-2": "Jawaban esai peserta" },
    });
    expect(pendingPostTest.status).toBe(201);
    const pendingAttempt = await pendingPostTest.json();
    expect(pendingAttempt).toMatchObject({
      score: 50,
      passed: false,
      gradingStatus: "awaiting_review",
    });

    const blockedCertificate = await request("/api/certificates", {
      method: "POST",
      body: JSON.stringify(certificateData),
    });
    expect(blockedCertificate.status).toBe(409);

    const invalidGrade = await request(
      `/api/quizzes/${postTestId}/attempts/${pendingAttempt.id}/grade`,
      {
        method: "PATCH",
        body: JSON.stringify({ essayScores: { "question-2": 11 } }),
      },
    );
    expect(invalidGrade.status).toBe(400);

    const gradedResponse = await request(
      `/api/quizzes/${postTestId}/attempts/${pendingAttempt.id}/grade`,
      {
        method: "PATCH",
        body: JSON.stringify({ essayScores: { "question-2": 4 } }),
      },
    );
    expect(gradedResponse.status).toBe(200);
    expect(await gradedResponse.json()).toMatchObject({
      score: 70,
      passed: true,
      gradingStatus: "graded",
    });

    const duplicateGrade = await request(
      `/api/quizzes/${postTestId}/attempts/${pendingAttempt.id}/grade`,
      {
        method: "PATCH",
        body: JSON.stringify({ essayScores: { "question-2": 10 } }),
      },
    );
    expect(duplicateGrade.status).toBe(409);

    const completeState = await request(`/api/courses/${courseId}/learning-state?participantId=${participantId}`);
    expect(await completeState.json()).toMatchObject({
      completion: { progress: 100, lessonsCompleted: true, postTestPassed: true, isComplete: true },
    });
    expect((await storage.getEnrollmentsByParticipant(participantId))[0]).toMatchObject({
      status: "completed",
      progress: 100,
    });

    const certificate = await request("/api/certificates", {
      method: "POST",
      body: JSON.stringify(certificateData),
    });
    expect(certificate.status).toBe(201);
  });

  it("menahan kelulusan esai sampai dinilai dan meminta peserta mengulang seluruh tes jika gagal", async () => {
    const essayQuiz = await storage.createQuiz({
      courseId,
      title: "Post-test esai",
      description: "Penilaian manual",
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: false,
      showResults: true,
      questions: [{
        id: "essay-question",
        type: "essay",
        text: "Jelaskan tahapan evaluasi dokumen tender.",
        points: 10,
        options: [],
        correctAnswer: "",
        order: 1,
      }],
    });
    await db.update(coursesTable)
      .set({ postTestId: essayQuiz.id })
      .where(eq(coursesTable.id, courseId));

    const submitEssay = (answer: string) => request(`/api/quizzes/${essayQuiz.id}/attempts`, {
      method: "POST",
      body: JSON.stringify({ participantId, answers: { "essay-question": answer } }),
    });
    const firstAttemptResponse = await submitEssay("Saya memeriksa persyaratan administrasi dan teknis.");
    expect(firstAttemptResponse.status).toBe(201);
    const firstAttempt = await firstAttemptResponse.json();
    expect(firstAttempt).toMatchObject({
      passed: false,
      gradingStatus: "awaiting_review",
    });

    const queueResponse = await request("/api/quiz-attempts/pending-review");
    const queue = await queueResponse.json();
    expect(queue).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: firstAttempt.id,
        participantName: expect.any(String),
        quizTitle: "Post-test esai",
        passingScore: 80,
        answers: expect.arrayContaining([
          expect.objectContaining({
            questionText: "Jelaskan tahapan evaluasi dokumen tender.",
            answer: "Saya memeriksa persyaratan administrasi dan teknis.",
          }),
        ]),
      }),
    ]));

    const blockedWhilePending = await submitEssay("Saya mengirim percobaan kedua.");
    expect(blockedWhilePending.status).toBe(409);

    const invalidGrade = await request(`/api/quiz-attempts/${firstAttempt.id}/grade`, {
      method: "POST",
      body: JSON.stringify({ score: 101, feedback: "Nilai di luar rentang." }),
    });
    expect(invalidGrade.status).toBe(400);

    const failedGrade = await request(`/api/quiz-attempts/${firstAttempt.id}/grade`, {
      method: "POST",
      body: JSON.stringify({ score: 79, feedback: "Ulasan belum mencakup seluruh tahapan." }),
    });
    expect(await failedGrade.json()).toMatchObject({
      passed: false,
      passingScore: 80,
      attempt: {
        gradingStatus: "graded",
        score: 79,
        maxScore: 100,
      },
    });

    const duplicateGrade = await request(`/api/quiz-attempts/${firstAttempt.id}/grade`, {
      method: "POST",
      body: JSON.stringify({ score: 95, feedback: "Penilaian ulang." }),
    });
    expect(duplicateGrade.status).toBe(409);

    const retakeResponse = await submitEssay("Saya memeriksa syarat administrasi, evaluasi teknis, dan jadwal.");
    expect(retakeResponse.status).toBe(201);
    const retake = await retakeResponse.json();
    expect(retake.gradingStatus).toBe("awaiting_review");

    const passedGrade = await request(`/api/quiz-attempts/${retake.id}/grade`, {
      method: "POST",
      body: JSON.stringify({ score: 85, feedback: "Jawaban telah mencakup tahapan utama dengan tepat." }),
    });
    expect(await passedGrade.json()).toMatchObject({
      passed: true,
      passingScore: 80,
      attempt: { score: 85, gradingStatus: "graded" },
    });

    const finalState = await request(`/api/courses/${courseId}/learning-state?participantId=${participantId}`);
    expect(await finalState.json()).toMatchObject({
      completion: { postTestPassed: true, isComplete: true },
    });
  });
});
