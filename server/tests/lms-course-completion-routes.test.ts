import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  certificatesTable,
  coursesTable,
  enrollmentsTable,
  users,
} from "@shared/schema";
import { db, pool } from "../db";
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
  it.each(["perhitungan", "pembaruan progres"] as const)(
    "membatalkan penandaan materi saat %s gagal dan dapat dicoba ulang",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus rollback materi ${mode} ${Date.now()}`,
        description: "Materi selesai dan progres harus tersimpan bersama",
        duration: "1 jam",
        postTestId,
      });
      try {
        const enrollment = await storage.createEnrollment(participantId, course.id);
        for (const lesson of course.lessons.slice(0, -1)) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        const lessonId = course.lessons.at(-1)!.id;
        const complete = () => request(
          `/api/enrollments/${enrollment.id}/lessons/${lessonId}/complete`,
          { method: "POST", body: "{}" },
        );
        const [before] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(before.progress).toBeLessThan(100);
        expect(before.completedLessonIds).not.toContain(lessonId);

        const transactional = storage as unknown as {
          refreshCourseEnrollmentProgressInTransaction: (...args: unknown[]) => Promise<unknown>;
        };
        const calculationFailure = mode === "perhitungan"
          ? vi.spyOn(transactional, "refreshCourseEnrollmentProgressInTransaction")
              .mockRejectedValueOnce(new Error("Simulasi kegagalan perhitungan"))
          : undefined;
        let lessonWrites = 0;
        let progressWrites = 0;
        const transaction = db.transaction.bind(db);
        const failure = vi.spyOn(db, "transaction").mockImplementation((callback, config) =>
          transaction(async tx => {
            const update = tx.update.bind(tx);
            vi.spyOn(tx, "update").mockImplementation(table => {
              if (table === enrollmentsTable) {
                if (lessonWrites === 0) {
                  lessonWrites++;
                } else {
                  progressWrites++;
                  throw new Error("Simulasi kegagalan pembaruan progres");
                }
              }
              return update(table);
            });
            return callback(tx);
          }, config),
        );
        try {
          expect((await complete()).status).toBe(500);
          expect(lessonWrites).toBe(1);
          expect(progressWrites).toBe(mode === "perhitungan" ? 0 : 1);
          if (calculationFailure) expect(calculationFailure).toHaveBeenCalledOnce();
        } finally {
          failure.mockRestore();
          calculationFailure?.mockRestore();
        }

        // Check raw persisted fields before any read path can refresh progress.
        expect((await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id)))[0]).toEqual(before);
        const retry = await complete();
        expect(retry.status).toBe(200);
        expect(await retry.json()).toMatchObject({
          completedLessonIds: course.lessons.map(lesson => lesson.id),
          progress: 100,
          status: "in_progress",
          startedAt: before.startedAt,
        });
        const [afterRetry] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(afterRetry.completedAt).toBeNull();
        expect((await complete()).status).toBe(200);
        const [afterDuplicate] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(afterDuplicate).toMatchObject({
          completedLessonIds: afterRetry.completedLessonIds,
          progress: 100,
          status: "in_progress",
          startedAt: before.startedAt,
          completedAt: null,
        });
      } finally {
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["materi berbeda", "materi yang sama"] as const)(
    "menjaga progres dan penandaan idempoten untuk penyelesaian paralel: %s",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus materi paralel ${mode} ${Date.now()}`,
        description: "Dua transaksi penandaan harus mempertahankan semua materi",
        duration: "1 jam",
      });
      const blocker = await pool.connect();
      let releaseTransactions!: () => void;
      const gate = new Promise<void>(resolve => { releaseTransactions = resolve; });
      let callbacksStarted!: () => void;
      const bothStarted = new Promise<void>(resolve => { callbacksStarted = resolve; });
      let callbackCount = 0;
      const transaction = db.transaction.bind(db);
      let transactionSpy: ReturnType<typeof vi.spyOn> | undefined;
      try {
        const enrollment = await storage.createEnrollment(participantId, course.id);
        for (const lesson of course.lessons.slice(0, -2)) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        const lessonIds = mode === "materi berbeda"
          ? course.lessons.slice(-2).map(lesson => lesson.id)
          : [course.lessons.at(-2)!.id, course.lessons.at(-2)!.id];

        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM enrollments WHERE id = $1 FOR UPDATE", [enrollment.id]);
        transactionSpy = vi.spyOn(db, "transaction").mockImplementation((callback, config) =>
          transaction(async tx => {
            await gate;
            // Both first SELECT ... FOR UPDATE queries start behind the held lock.
            const result = callback(tx);
            callbackCount++;
            if (callbackCount === 2) callbacksStarted();
            return result;
          }, config),
        );
        const completions = lessonIds.map(lessonId => request(
          `/api/enrollments/${enrollment.id}/lessons/${lessonId}/complete`,
          { method: "POST", body: "{}" },
        ));
        releaseTransactions();
        await bothStarted;
        await blocker.query("COMMIT");
        const responses = await Promise.all(completions);
        expect(responses.map(response => response.status)).toEqual([200, 200]);
        transactionSpy.mockRestore();

        const [stored] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        const expectedIds = [...new Set([
          ...course.lessons.slice(0, -2).map(lesson => lesson.id),
          ...lessonIds,
        ])];
        expect(stored.completedLessonIds).toHaveLength(expectedIds.length);
        expect(stored.completedLessonIds).toEqual(expect.arrayContaining(expectedIds));
        expect(stored.progress).toBe(Math.round(expectedIds.length / course.lessons.length * 100));
        expect(stored.status).toBe(mode === "materi berbeda" ? "completed" : "in_progress");
        expect(stored.startedAt).toEqual(expect.any(String));
        if (mode === "materi berbeda") {
          expect(stored.completedAt).toEqual(expect.any(String));
          const duplicate = await request(
            `/api/enrollments/${enrollment.id}/lessons/${lessonIds[0]}/complete`,
            { method: "POST", body: "{}" },
          );
          expect(duplicate.status).toBe(200);
          expect(await duplicate.json()).toMatchObject({
            completedLessonIds: stored.completedLessonIds,
            progress: 100,
            status: "completed",
            startedAt: stored.startedAt,
            completedAt: stored.completedAt,
          });
        } else {
          expect(stored.completedAt).toBeNull();
        }
      } finally {
        transactionSpy?.mockRestore();
        releaseTransactions();
        await blocker.query("ROLLBACK");
        blocker.release();
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["POST nilai akhir", "PATCH nilai per soal"] as const)(
    "membatalkan nilai esai saat progres gagal dan menyimpan kelulusan saat dicoba ulang: %s",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus rollback penilaian ${mode} ${Date.now()}`,
        description: "Nilai esai dan progres harus tersimpan bersama",
        duration: "1 jam",
      });
      try {
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test esai transaksional",
          description: "Penilaian dapat dicoba kembali setelah kegagalan",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: "essay",
            text: "Jelaskan tahapan evaluasi",
            points: 10,
            order: 1,
          }],
        });
        await db.update(coursesTable).set({ postTestId: quiz.id })
          .where(eq(coursesTable.id, course.id));
        const enrollment = await storage.createEnrollment(participantId, course.id);
        for (const lesson of course.lessons) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        const submission = await submitQuiz(quiz.id, "Jawaban peserta untuk dinilai");
        expect(submission.status).toBe(201);
        const { id: attemptId } = await submission.json();
        const attemptsBefore = await storage.getQuizAttempts(quiz.id);
        expect(attemptsBefore[0]).toMatchObject({
          gradingStatus: "awaiting_review",
          passed: false,
        });
        const enrollmentBefore = (await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)!;
        expect(enrollmentBefore).toMatchObject({ progress: 100, status: "in_progress" });
        expect(enrollmentBefore.completedAt).toBeUndefined();
        const statePath = `/api/courses/${course.id}/learning-state?participantId=${participantId}`;
        const stateBefore = await (await request(statePath)).json();
        expect(stateBefore).toMatchObject({
          completion: { postTestPassed: false, isComplete: false },
        });

        const grade = () => mode === "POST nilai akhir"
          ? request(`/api/quiz-attempts/${attemptId}/grade`, {
              method: "POST",
              body: JSON.stringify({ score: 90, feedback: "Jawaban sudah tepat." }),
            })
          : request(`/api/quizzes/${quiz.id}/attempts/${attemptId}/grade`, {
              method: "PATCH",
              body: JSON.stringify({ essayScores: { "question-1": 9 } }),
            });

        // Fail after the real grade UPDATE so persisted rows prove a DB rollback.
        let failedUpdates = 0;
        const transaction = db.transaction.bind(db);
        const failure = vi.spyOn(db, "transaction").mockImplementation((callback, config) =>
          transaction(async tx => {
            const update = tx.update.bind(tx);
            vi.spyOn(tx, "update").mockImplementation(table => {
              if (table === enrollmentsTable) {
                failedUpdates++;
                throw new Error("Simulasi kegagalan progres setelah penilaian");
              }
              return update(table);
            });
            return callback(tx);
          }, config),
        );
        try {
          expect((await grade()).status).toBe(500);
          expect(failedUpdates).toBe(1);
        } finally {
          failure.mockRestore();
        }

        expect(await storage.getQuizAttempts(quiz.id)).toEqual(attemptsBefore);
        expect((await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)).toEqual(enrollmentBefore);
        expect(await (await request(statePath)).json()).toEqual(stateBefore);
        const queueAfterFailure = await (await request("/api/quiz-attempts/pending-review")).json();
        expect(queueAfterFailure).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: attemptId }),
        ]));

        const retry = await grade();
        expect(retry.status).toBe(200);
        const body = await retry.json();
        const gradedAttempt = mode === "POST nilai akhir" ? body.attempt : body;
        expect(gradedAttempt).toMatchObject({
          id: attemptId,
          score: 90,
          passed: true,
          gradingStatus: "graded",
          gradedBy: userId,
          gradedAt: expect.any(String),
        });
        const attemptsAfter = await storage.getQuizAttempts(quiz.id);
        expect(attemptsAfter).toHaveLength(1);
        expect(attemptsAfter[0]).toEqual(gradedAttempt);
        expect((await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)).toMatchObject({
            progress: 100,
            status: "completed",
            completedAt: expect.any(String),
          });
        expect(await (await request(statePath)).json()).toMatchObject({
          completion: { progress: 100, postTestPassed: true, isComplete: true },
        });
        expect((await grade()).status).toBe(409);
        expect(await storage.getQuizAttempts(quiz.id)).toEqual(attemptsAfter);
      } finally {
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["API pilihan ganda", "API esai", "storage langsung"])(
    "membatalkan percobaan dan menjaga jatah ketika pembaruan progres gagal: %s",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus rollback ${mode} ${Date.now()}`,
        description: "Pengujian transaksi percobaan dan progres",
        duration: "1 jam",
      });
      try {
        const isEssay = mode === "API esai";
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test rollback",
          description: "Kegagalan progres tidak menghabiskan jatah",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: isEssay ? "essay" : "multiple_choice",
            text: "Jelaskan atau pilih jawaban yang tepat",
            points: 10,
            options: isEssay ? [] : [{ id: "a", text: "Tepat", isCorrect: true }],
            correctAnswer: isEssay ? "" : "Tepat",
            order: 1,
          }],
        });
        await db.update(coursesTable).set({ postTestId: quiz.id })
          .where(eq(coursesTable.id, course.id));
        const enrollment = await storage.createEnrollment(participantId, course.id);
        for (const lesson of course.lessons) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        const before = (await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)!;
        expect(before.status).not.toBe("completed");
        const stateBefore = await (await request(
          `/api/courses/${course.id}/learning-state?participantId=${participantId}`,
        )).json();

        const submit = () => mode === "storage langsung"
          ? storage.createQuizAttempt({
              quizId: quiz.id,
              participantId,
              answers: { "question-1": "Tepat" },
              score: 100,
              maxScore: 100,
              passed: true,
              startedAt: new Date().toISOString(),
            })
          : submitQuiz(quiz.id, "Tepat");

        // Use a real transaction and insert, but fail its enrollment update.
        // Checking persisted rows below therefore verifies an actual DB rollback.
        let failedUpdates = 0;
        const transaction = db.transaction.bind(db);
        const failure = vi.spyOn(db, "transaction").mockImplementation((callback, config) =>
          transaction(async tx => {
            const update = tx.update.bind(tx);
            vi.spyOn(tx, "update").mockImplementation(table => {
              if (table === enrollmentsTable) {
                failedUpdates++;
                throw new Error("Simulasi kegagalan pembaruan progres");
              }
              return update(table);
            });
            return callback(tx);
          }, config),
        );
        try {
          if (mode === "storage langsung") {
            await expect(submit()).rejects.toThrow("Simulasi kegagalan pembaruan progres");
          } else {
            expect((await submit() as Response).status).toBe(500);
          }
          expect(failedUpdates).toBe(1);
        } finally {
          failure.mockRestore();
        }

        expect(await storage.getQuizAttempts(quiz.id)).toEqual([]);
        expect((await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)).toEqual(before);
        expect(await (await request(
          `/api/courses/${course.id}/learning-state?participantId=${participantId}`,
        )).json()).toEqual(stateBefore);

        // The sole attempt remains available after a failed submission.
        const retry = await submit();
        if (mode !== "storage langsung") expect((retry as Response).status).toBe(201);
        const attempts = await storage.getQuizAttempts(quiz.id);
        expect(attempts).toHaveLength(1);
        expect(attempts[0]).toMatchObject({
          gradingStatus: isEssay ? "awaiting_review" : "graded",
          passed: !isEssay,
        });
        expect((await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)).toMatchObject({
            status: isEssay ? "in_progress" : "completed",
            progress: 100,
            completedAt: isEssay ? undefined : expect.any(String),
          });
      } finally {
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["multiple_choice", "essay"] as const)(
    "menjaga jatah dua peserta pada kuis %s saat kiriman paralel tanpa mengubah progres saat ditolak",
    async questionType => {
      const tag = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const otherParticipant = await storage.createParticipant({
        nip: `RACE${tag}`.slice(0, 18),
        name: "Peserta kedua uji batas percobaan",
        position: "Staf",
        unit: "Uji",
        email: `lms-race-${tag}@test.go.id`,
      });
      const participantIds = [participantId, otherParticipant.id];
      let raceCourseId = "";
      try {
      const raceCourse = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus uji batas percobaan ${tag}`,
        description: "Kursus khusus pengujian kiriman kuis paralel",
        duration: "1 jam",
      });

      raceCourseId = raceCourse.id;
      const quiz = await storage.createQuiz({
        courseId: raceCourse.id,
        title: "Post-test batas percobaan",
        description: "Menguji batas percobaan secara paralel",
        passingScore: 70,
        maxAttempts: questionType === "essay" ? 1 : 2,
        shuffleQuestions: false,
        showResults: true,
        questions: [{
          id: "question-1",
          type: questionType,
          text: "Pilih jawaban benar",
          points: 10,
          options: [{ id: "a", text: "Tepat", isCorrect: true }, { id: "b", text: "Keliru", isCorrect: false }],
          correctAnswer: "Tepat",
          order: 1,
        }],
      });
      await db.update(coursesTable)
        .set({ postTestId: quiz.id })
        .where(eq(coursesTable.id, raceCourse.id));
      for (const id of participantIds) {
        await storage.createEnrollment(id, raceCourse.id);
      }

      // Interleave both participants' requests so they compete on the same quiz.
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => participantIds.map(async id => ({
          participantId: id,
          response: await submitQuiz(quiz.id, "Tepat", { participantId: id }),
        }))).flat(),
      );
      const attempts = await storage.getQuizAttempts(quiz.id);
      expect(attempts).toHaveLength(participantIds.length * quiz.maxAttempts);
      for (const id of participantIds) {
        const ownResponses = responses.filter(result => result.participantId === id);
        expect(ownResponses.filter(({ response }) => response.status === 201))
          .toHaveLength(quiz.maxAttempts);
        expect(ownResponses.filter(({ response }) => response.status === 409))
          .toHaveLength(10 - quiz.maxAttempts);
        const ownAttempts = attempts.filter(attempt => attempt.participantId === id);
        expect(ownAttempts).toHaveLength(quiz.maxAttempts);
        for (const attempt of ownAttempts) {
          expect(attempt.gradingStatus)
            .toBe(questionType === "essay" ? "awaiting_review" : "graded");
        }

        const enrollmentBeforeRejection = (await storage.getEnrollmentsByParticipant(id))
          .find(enrollment => enrollment.courseId === raceCourse.id)!;
        const learningStateBeforeRejection = await (
          await request(`/api/courses/${raceCourse.id}/learning-state?participantId=${id}`)
        ).json();
        const extraAttempt = await submitQuiz(quiz.id, "Tepat", { participantId: id });
        expect(extraAttempt.status).toBe(409);
        expect(await extraAttempt.json()).toMatchObject({
          message: questionType === "essay"
            ? "Post-test sedang menunggu penilaian. Tunggu hasil sebelum mencoba ulang."
            : "Batas percobaan kuis telah tercapai",
        });

        const enrollmentAfterRejection = (await storage.getEnrollmentsByParticipant(id))
          .find(enrollment => enrollment.courseId === raceCourse.id)!;
        const learningStateAfterRejection = await (
          await request(`/api/courses/${raceCourse.id}/learning-state?participantId=${id}`)
        ).json();
        expect(enrollmentAfterRejection).toMatchObject({
          progress: enrollmentBeforeRejection.progress,
          status: enrollmentBeforeRejection.status,
          startedAt: enrollmentBeforeRejection.startedAt,
          completedAt: enrollmentBeforeRejection.completedAt,
          lastAccessedAt: enrollmentBeforeRejection.lastAccessedAt,
        });
        expect(learningStateAfterRejection).toEqual(learningStateBeforeRejection);
      }
      expect(await storage.getQuizAttempts(quiz.id)).toEqual(attempts);
      } finally {
        if (raceCourseId) await storage.deleteCourse(raceCourseId);
        await storage.deleteParticipant(otherParticipant.id);
      }
    },
  );

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
