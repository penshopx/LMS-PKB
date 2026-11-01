import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  certificatesTable,
  coursesTable,
  enrollmentsTable,
  quizAttemptsTable,
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
  it("menolak penilaian dengan ID kuis lain tanpa mengubah percobaan atau enrollment kedua kursus", async () => {
    const courseIds: string[] = [];
    try {
      const fixtures = [];
      for (const label of ["asli", "lain"]) {
        const course = await storage.createCourse({
          unitId: "tender-01",
          targetLevel: "L2",
          title: `Kursus isolasi penilaian ${label} ${Date.now()}`,
          description: "Penilaian hanya boleh diterapkan pada percobaan milik kuis",
          duration: "1 jam",
        });
        courseIds.push(course.id);
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: `Post-test esai ${label}`,
          description: "Esai identik agar penolakan bukan akibat nilai tidak valid",
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
        const attempt = await submission.json();
        const [attemptBefore] = await db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.id, attempt.id));
        expect(attemptBefore).toMatchObject({
          quizId: quiz.id,
          score: 0,
          passed: 0,
          gradingStatus: "awaiting_review",
          gradedAt: null,
          gradedBy: null,
        });
        const [enrollmentBefore] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(enrollmentBefore).toMatchObject({
          progress: 100,
          status: "in_progress",
          completedAt: null,
        });
        fixtures.push({ quiz, attemptBefore, enrollmentBefore });
      }

      const [original, other] = fixtures;
      const response = await request(
        `/api/quizzes/${other.quiz.id}/attempts/${original.attemptBefore.id}/grade`,
        {
          method: "PATCH",
          body: JSON.stringify({ essayScores: { "question-1": 10 } }),
        },
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: "Percobaan kuis tidak ditemukan" });

      // Read persisted rows directly so a progress refresh cannot hide a write.
      for (const { attemptBefore, enrollmentBefore } of fixtures) {
        const [attemptAfter] = await db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.id, attemptBefore.id));
        expect(attemptAfter).toEqual(attemptBefore);
        const [enrollmentAfter] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollmentBefore.id));
        expect(enrollmentAfter).toEqual(enrollmentBefore);
      }
    } finally {
      for (const id of courseIds) await storage.deleteCourse(id);
    }
  });

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

  it.each(["perhitungan", "pembaruan progres"] as const)(
    "mengisolasi kegagalan %s dari peserta lain pada kursus yang sama",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus isolasi progres ${mode} ${Date.now()}`,
        description: "Rollback satu enrollment tidak mengganggu enrollment peserta lain",
        duration: "1 jam",
      });
      let otherParticipantId = "";
      const signal = () => {
        let resolve!: () => void;
        const promise = new Promise<void>(done => { resolve = done; });
        return { promise, resolve };
      };
      const firstMarked = signal();
      const releaseFailure = signal();
      const waitFor = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`Transaksi tidak mencapai ${label}`)), 5000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
      const transactional = storage as unknown as {
        refreshCourseEnrollmentProgressInTransaction: (
          tx: Transaction, id: string,
        ) => ReturnType<typeof storage.refreshCourseEnrollmentProgress>;
      };
      const refresh = transactional.refreshCourseEnrollmentProgressInTransaction.bind(storage);
      let refreshSpy: ReturnType<typeof vi.spyOn> | undefined;
      const requests: Promise<Response>[] = [];
      try {
        const tag = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const otherParticipant = await storage.createParticipant({
          nip: `ISO${tag}`.slice(0, 18),
          name: "Peserta uji isolasi progres",
          position: "Staf",
          unit: "Uji",
          email: `lms-isolation-${tag}@test.go.id`,
        });
        otherParticipantId = otherParticipant.id;
        const first = await storage.createEnrollment(participantId, course.id);
        const second = await storage.createEnrollment(otherParticipantId, course.id);
        expect(first.id).not.toBe(second.id);
        expect(course.lessons.length).toBeGreaterThan(1);
        const lessonIds = course.lessons.map(lesson => lesson.id);
        const lessonId = lessonIds.at(-1)!;
        for (const enrollment of [first, second]) {
          for (const previousId of lessonIds.slice(0, -1)) {
            await storage.markEnrollmentLessonCompleted(enrollment.id, previousId);
          }
        }
        const readEnrollment = async (id: string) => (await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, id)))[0];
        const beforeFirst = await readEnrollment(first.id);
        const beforeSecond = await readEnrollment(second.id);
        for (const before of [beforeFirst, beforeSecond]) {
          expect(before).toMatchObject({
            completedLessonIds: lessonIds.slice(0, -1),
            progress: Math.round((lessonIds.length - 1) / lessonIds.length * 100),
            status: "in_progress",
            completedAt: null,
          });
          expect(before.startedAt).toEqual(expect.any(String));
        }
        const complete = (id: string) => request(
          `/api/enrollments/${id}/lessons/${lessonId}/complete`,
          { method: "POST", body: "{}" },
        );
        let injectedFailures = 0;
        let secondRefreshes = 0;
        let firstReleased = false;
        refreshSpy = vi.spyOn(transactional, "refreshCourseEnrollmentProgressInTransaction")
          .mockImplementation(async (tx, id) => {
            if (id !== first.id) {
              expect(id).toBe(second.id);
              expect(firstReleased).toBe(false);
              secondRefreshes++;
              return refresh(tx, id);
            }
            // Inspect the real uncommitted lesson write on this transaction's
            // connection. Do not fail a global "next call": target enrollment.
            const [marked] = await tx.select().from(enrollmentsTable)
              .where(eq(enrollmentsTable.id, id));
            expect(marked).toEqual({ ...beforeFirst, completedLessonIds: lessonIds });
            if (mode === "pembaruan progres") {
              // Execute the real progress UPDATE as well, then roll it back.
              const updated = await refresh(tx, id);
              expect(updated).toMatchObject({
                completedLessonIds: lessonIds,
                progress: 100,
                status: "completed",
                completedAt: expect.any(String),
              });
            }
            firstMarked.resolve();
            await releaseFailure.promise;
            injectedFailures++;
            throw new Error(`Simulasi kegagalan ${mode} khusus peserta pertama`);
          });

        const started = Date.now();
        requests.push(complete(first.id));
        await waitFor(firstMarked.promise, "penandaan materi peserta pertama");
        requests.push(complete(second.id));
        // The second transaction must COMMIT while the first is still open.
        // A shared/course-wide lock would time out here instead of passing.
        const secondResponse = await waitFor(requests[1], "commit peserta kedua");
        expect(secondResponse.status).toBe(200);
        expect(firstReleased).toBe(false);
        expect(injectedFailures).toBe(0);
        expect(secondRefreshes).toBe(1);
        const storedSecond = await readEnrollment(second.id);
        expect(storedSecond).toMatchObject({
          participantId: otherParticipantId,
          courseId: course.id,
          completedLessonIds: lessonIds,
          progress: 100,
          status: "completed",
          startedAt: beforeSecond.startedAt,
          completedAt: expect.any(String),
          lastAccessedAt: expect.any(String),
        });
        const completedTime = Date.parse(storedSecond.completedAt!);
        expect(completedTime).toBeGreaterThanOrEqual(started);
        expect(completedTime).toBeLessThanOrEqual(Date.now());
        expect(storedSecond.lastAccessedAt).toBe(storedSecond.completedAt);
        expect(await secondResponse.json()).toMatchObject({
          id: second.id,
          participantId: otherParticipantId,
          completedLessonIds: storedSecond.completedLessonIds,
          progress: storedSecond.progress,
          status: storedSecond.status,
          startedAt: storedSecond.startedAt,
          completedAt: storedSecond.completedAt,
          lastAccessedAt: storedSecond.lastAccessedAt,
        });
        expect(await readEnrollment(first.id)).toEqual(beforeFirst);

        firstReleased = true;
        releaseFailure.resolve();
        expect((await waitFor(requests[0], "rollback peserta pertama")).status).toBe(500);
        expect(injectedFailures).toBe(1);
        refreshSpy.mockRestore();
        // Raw reads cannot silently refresh stale progress or conceal rollback.
        expect(await readEnrollment(first.id)).toEqual(beforeFirst);
        expect(await readEnrollment(second.id)).toEqual(storedSecond);

        const retryStarted = Date.now();
        const retry = await complete(first.id);
        expect(retry.status).toBe(200);
        const afterRetry = await readEnrollment(first.id);
        expect(afterRetry).toMatchObject({
          completedLessonIds: lessonIds,
          progress: 100,
          status: "completed",
          startedAt: beforeFirst.startedAt,
          completedAt: expect.any(String),
        });
        expect(Date.parse(afterRetry.completedAt!)).toBeGreaterThanOrEqual(retryStarted);
        expect(Date.parse(afterRetry.completedAt!)).toBeLessThanOrEqual(Date.now());
        expect(afterRetry.lastAccessedAt).toBe(afterRetry.completedAt);
        expect(await retry.json()).toMatchObject({
          id: first.id,
          participantId,
          completedLessonIds: afterRetry.completedLessonIds,
          progress: afterRetry.progress,
          status: afterRetry.status,
          startedAt: afterRetry.startedAt,
          completedAt: afterRetry.completedAt,
          lastAccessedAt: afterRetry.lastAccessedAt,
        });
        expect(await readEnrollment(second.id)).toEqual(storedSecond);
      } finally {
        releaseFailure.resolve();
        // Drain open requests before restoring instrumentation/deleting fixtures,
        // including assertion failures and barrier timeouts.
        await Promise.allSettled(requests);
        refreshSpy?.mockRestore();
        await storage.deleteCourse(course.id);
        if (otherParticipantId) await storage.deleteParticipant(otherParticipantId);
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

  it.each(
    (["pilihan ganda", "POST nilai akhir", "PATCH nilai per soal"] as const).flatMap(mode =>
      (["materi dahulu", "post-test dahulu"] as const).map(order => ({ mode, order })),
    ),
  )(
    "meluluskan kursus saat materi terakhir dan post-test bertumpang tindih: $mode, $order",
    async ({ mode, order }) => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus kelulusan paralel ${mode} ${order} ${Date.now()}`,
        description: "Materi terakhir dan post-test bertransaksi pada enrollment yang sama",
        duration: "1 jam",
      });
      const signal = () => {
        let resolve!: () => void;
        const promise = new Promise<void>(done => { resolve = done; });
        return { promise, resolve };
      };
      const firstRefreshed = signal();
      const secondLockRequested = signal();
      const releaseFirst = signal();
      const waitFor = async (promise: Promise<void>, label: string) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`Transaksi tidak mencapai ${label}`)), 5000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      const requests: Promise<Response>[] = [];
      let transactionSpy: ReturnType<typeof vi.spyOn> | undefined;
      try {
        expect(course.lessons.length).toBeGreaterThan(1);
        const isEssay = mode !== "pilihan ganda";
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test kelulusan paralel",
          description: "Kelulusan disimpan tanpa penyegaran tambahan",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: isEssay ? "essay" : "multiple_choice",
            text: "Jelaskan atau pilih tahapan yang tepat",
            points: 10,
            order: 1,
            ...(isEssay ? {} : {
              options: [{ id: "a", text: "Tepat", isCorrect: true }],
              correctAnswer: "Tepat",
            }),
          }],
        });
        await db.update(coursesTable).set({ postTestId: quiz.id })
          .where(eq(coursesTable.id, course.id));
        const enrollment = await storage.createEnrollment(participantId, course.id);
        const previousIds = course.lessons.slice(0, -1).map(lesson => lesson.id);
        for (const lessonId of previousIds) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lessonId);
        }
        let attemptId = "";
        if (isEssay) {
          const submission = await submitQuiz(quiz.id, "Jawaban peserta untuk dinilai");
          expect(submission.status).toBe(201);
          const pendingAttempt = await submission.json();
          expect(pendingAttempt).toMatchObject({ passed: false, gradingStatus: "awaiting_review" });
          attemptId = pendingAttempt.id;
        }
        const [before] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(before).toMatchObject({
          completedLessonIds: previousIds,
          progress: Math.round(previousIds.length / course.lessons.length * 100),
          status: "in_progress",
          completedAt: null,
        });

        const completeLesson = () => request(
          `/api/enrollments/${enrollment.id}/lessons/${course.lessons.at(-1)!.id}/complete`,
          { method: "POST", body: "{}" },
        );
        const finishPostTest = () => mode === "pilihan ganda"
          ? submitQuiz(quiz.id, "Tepat")
          : mode === "POST nilai akhir"
            ? request(`/api/quiz-attempts/${attemptId}/grade`, {
                method: "POST",
                body: JSON.stringify({ score: 90, feedback: "Jawaban sudah tepat." }),
              })
            : request(`/api/quizzes/${quiz.id}/attempts/${attemptId}/grade`, {
                method: "PATCH",
                body: JSON.stringify({ essayScores: { "question-1": 9 } }),
              });
        const operations = order === "materi dahulu"
          ? [completeLesson, finishPostTest]
          : [finishPostTest, completeLesson];
        const transaction = db.transaction.bind(db);
        const commitOrder: number[] = [];
        let transactionCount = 0;
        let firstReleased = false;
        let secondFinished = false;
        let observedSecondLock = false;
        transactionSpy = vi.spyOn(db, "transaction").mockImplementation(async (callback, config) => {
          const number = ++transactionCount;
          const result = await transaction(async tx => {
            // Observe the real driver's dispatch, not pg_stat_activity or a
            // sleep. The lesson path locks before calculating progress, whereas
            // the post-test path writes the attempt before locking enrollment.
            const { client } = (tx as unknown as {
              session: { client: {
                query: (query: string | { text: string }, values?: unknown[]) => Promise<unknown>;
              } };
            }).session;
            const query = client.query.bind(client);
            const querySpy = vi.spyOn(client, "query").mockImplementation((sql, values) => {
              const text = typeof sql === "string" ? sql : sql.text;
              const isSecondLock = number === 2 && !observedSecondLock &&
                text.includes('from "enrollments"') && text.includes("for update");
              const pending = query(sql, values);
              if (isSecondLock) {
                expect(values).toContain(enrollment.id);
                expect(firstReleased).toBe(false);
                observedSecondLock = true;
                secondLockRequested.resolve();
              }
              return pending;
            });
            try {
              const updated = await callback(tx);
              if (number === 1) {
                // All writes and progress calculation have run, but none are
                // committed; keep the lock until the other path requests it.
                firstRefreshed.resolve();
                await releaseFirst.promise;
              } else {
                expect(firstReleased).toBe(true);
                secondFinished = true;
              }
              return updated;
            } finally {
              querySpy.mockRestore();
            }
          }, config);
          commitOrder.push(number);
          return result;
        });

        requests.push(operations[0]());
        await waitFor(firstRefreshed.promise, "perhitungan progres pertama");
        requests.push(operations[1]());
        await waitFor(secondLockRequested.promise, "penguncian enrollment kedua");
        expect(transactionCount).toBe(2);
        expect(commitOrder).toEqual([]);
        expect(secondFinished).toBe(false);
        firstReleased = true;
        releaseFirst.resolve();
        const responses = await Promise.all(requests);
        expect(responses.map(response => response.status)).toEqual(
          order === "materi dahulu"
            ? [200, isEssay ? 200 : 201]
            : [isEssay ? 200 : 201, 200],
        );
        expect(commitOrder).toEqual([1, 2]);
        expect(secondFinished).toBe(true);
        expect(observedSecondLock).toBe(true);
        transactionSpy.mockRestore();

        // Inspect raw persisted fields and DBStorage's read-only accessor before
        // learning-state (or any explicit refresh) can mask a stale enrollment.
        const [stored] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(stored).toMatchObject({
          completedLessonIds: course.lessons.map(lesson => lesson.id),
          progress: 100,
          status: "completed",
          startedAt: before.startedAt,
          completedAt: expect.any(String),
        });
        const persisted = (await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)!;
        expect(persisted).toMatchObject({
          completedLessonIds: stored.completedLessonIds,
          progress: 100,
          status: "completed",
          completedAt: stored.completedAt,
        });
        const attempts = await storage.getQuizAttempts(quiz.id);
        expect(attempts).toHaveLength(1);
        expect(attempts[0]).toMatchObject({
          passed: true,
          gradingStatus: "graded",
          score: isEssay ? 90 : 100,
        });
        const state = await request(
          `/api/courses/${course.id}/learning-state?participantId=${participantId}`,
        );
        expect(state.status).toBe(200);
        expect(await state.json()).toMatchObject({
          enrollment: {
            id: persisted.id,
            completedLessonIds: stored.completedLessonIds,
            progress: 100,
            status: "completed",
            completedAt: stored.completedAt,
          },
          completion: {
            progress: 100,
            lessonsCompleted: true,
            postTestPassed: true,
            isComplete: true,
          },
        });
        expect((await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id)))[0]).toEqual(stored);
      } finally {
        releaseFirst.resolve();
        // Drain real transactions before restoring spies or deleting fixtures,
        // including when a barrier times out or an assertion fails.
        await Promise.allSettled(requests);
        transactionSpy?.mockRestore();
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(
    (["kirim pilihan ganda", "kirim esai", "POST nilai akhir", "PATCH nilai per soal"] as const)
      .flatMap(mode => (["materi dahulu", "post-test dahulu"] as const)
        .map(order => ({ mode, order }))),
  )(
    "mempertahankan materi terakhir saat post-test paralel rollback: $mode, $order",
    async ({ mode, order }) => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus rollback paralel ${mode} ${order} ${Date.now()}`,
        description: "Rollback post-test tidak membatalkan materi pada enrollment yang sama",
        duration: "1 jam",
      });
      const signal = () => {
        let resolve!: () => void;
        const promise = new Promise<void>(done => { resolve = done; });
        return { promise, resolve };
      };
      const firstReady = signal();
      const secondLockRequested = signal();
      const releaseFirst = signal();
      const waitFor = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`Transaksi tidak mencapai ${label}`)), 5000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      const requests: Promise<Response>[] = [];
      let transactionSpy: ReturnType<typeof vi.spyOn> | undefined;
      try {
        const isSubmission = mode.startsWith("kirim");
        const isEssay = mode !== "kirim pilihan ganda";
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test rollback paralel",
          description: "Jatah tunggal harus tetap tersedia setelah rollback",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: isEssay ? "essay" : "multiple_choice",
            text: "Jelaskan atau pilih tahapan yang tepat",
            points: 10,
            order: 1,
            ...(isEssay ? {} : {
              options: [{ id: "a", text: "Tepat", isCorrect: true }],
              correctAnswer: "Tepat",
            }),
          }],
        });
        await db.update(coursesTable).set({ postTestId: quiz.id })
          .where(eq(coursesTable.id, course.id));
        const enrollment = await storage.createEnrollment(participantId, course.id);
        const lessonIds = course.lessons.map(lesson => lesson.id);
        expect(lessonIds.length).toBeGreaterThan(1);
        for (const id of lessonIds.slice(0, -1)) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, id);
        }
        let attemptId = "";
        if (!isSubmission) {
          const submission = await submitQuiz(quiz.id, "Jawaban peserta untuk dinilai");
          expect(submission.status).toBe(201);
          attemptId = (await submission.json()).id;
        }
        const rawEnrollment = async () => (await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id)))[0];
        const rawAttempts = () => db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.quizId, quiz.id));
        const before = await rawEnrollment();
        const attemptsBefore = await rawAttempts();
        const accessorAttemptsBefore = await storage.getQuizAttempts(quiz.id);
        expect(before).toMatchObject({
          completedLessonIds: lessonIds.slice(0, -1),
          progress: Math.round((lessonIds.length - 1) / lessonIds.length * 100),
          status: "in_progress",
          completedAt: null,
        });
        expect(attemptsBefore).toHaveLength(isSubmission ? 0 : 1);
        if (!isSubmission) {
          expect(accessorAttemptsBefore[0]).toMatchObject({
            id: attemptId, passed: false, gradingStatus: "awaiting_review",
          });
        }
        const completeLesson = () => request(
          `/api/enrollments/${enrollment.id}/lessons/${lessonIds.at(-1)!}/complete`,
          { method: "POST", body: "{}" },
        );
        const grade = () => mode === "PATCH nilai per soal"
          ? request(`/api/quizzes/${quiz.id}/attempts/${attemptId}/grade`, {
              method: "PATCH",
              body: JSON.stringify({ essayScores: { "question-1": 9 } }),
            })
          : request(`/api/quiz-attempts/${attemptId}/grade`, {
              method: "POST",
              body: JSON.stringify({ score: 90, feedback: "Jawaban sudah tepat." }),
            });
        const finishPostTest = () => isSubmission ? submitQuiz(quiz.id, "Tepat") : grade();
        const operations = order === "materi dahulu"
          ? [completeLesson, finishPostTest] : [finishPostTest, completeLesson];
        const postTestNumber = order === "materi dahulu" ? 2 : 1;
        const transaction = db.transaction.bind(db);
        const outcomes: string[] = [];
        let transactionCount = 0;
        let injectedFailures = 0;
        let observedSecondLock = false;
        let firstReleased = false;
        transactionSpy = vi.spyOn(db, "transaction").mockImplementation(async (callback, config) => {
          const number = ++transactionCount;
          try {
            const result = await transaction(async tx => {
              const { client } = (tx as unknown as {
                session: { client: {
                  query: (query: string | { text: string }, values?: unknown[]) => Promise<unknown>;
                } };
              }).session;
              const query = client.query.bind(client);
              let enrollmentLocked = false;
              let attemptWritten = false;
              const querySpy = vi.spyOn(client, "query").mockImplementation(async (sql, values) => {
                const text = typeof sql === "string" ? sql : sql.text;
                const isLock = text.includes('from "enrollments"') && text.includes("for update");
                const pending = query(sql, values);
                if (isLock && number === 2 && !observedSecondLock) {
                  expect(values).toContain(enrollment.id);
                  expect(firstReleased).toBe(false);
                  observedSecondLock = true;
                  secondLockRequested.resolve();
                }
                const result = await pending;
                if (isLock) {
                  expect(values).toContain(enrollment.id);
                  enrollmentLocked = true;
                }
                if (text.startsWith('insert into "quiz_attempts"') ||
                    text.startsWith('update "quiz_attempts"')) {
                  attemptWritten = true;
                }
                if (number === postTestNumber && enrollmentLocked &&
                    text.startsWith("select ") && text.includes('from "quiz_attempts"')) {
                  // Fail the real progress calculation only after the INSERT or
                  // grade UPDATE and the shared enrollment lock have executed.
                  expect(attemptWritten).toBe(true);
                  expect(values).toContain(quiz.id);
                  expect(values).toContain(participantId);
                  if (number === 1) {
                    firstReady.resolve();
                    await releaseFirst.promise;
                  }
                  injectedFailures++;
                  throw new Error("Simulasi kegagalan perhitungan progres post-test paralel");
                }
                return result;
              });
              try {
                const updated = await callback(tx);
                if (number === 1) {
                  firstReady.resolve();
                  await releaseFirst.promise;
                }
                return updated;
              } finally {
                querySpy.mockRestore();
              }
            }, config);
            outcomes.push(`${number}:commit`);
            return result;
          } catch (error) {
            outcomes.push(`${number}:rollback`);
            throw error;
          }
        });
        requests.push(operations[0]());
        await waitFor(firstReady.promise, "transaksi pertama menahan lock");
        requests.push(operations[1]());
        await waitFor(secondLockRequested.promise, "permintaan lock enrollment kedua");
        expect(transactionCount).toBe(2);
        expect(outcomes).toEqual([]);
        firstReleased = true;
        releaseFirst.resolve();
        const responses = await waitFor(Promise.all(requests), "hasil kedua transaksi");
        expect(responses.map(response => response.status))
          .toEqual(order === "materi dahulu" ? [200, 500] : [500, 200]);
        expect(outcomes).toEqual(order === "materi dahulu"
          ? ["1:commit", "2:rollback"] : ["1:rollback", "2:commit"]);
        expect(observedSecondLock).toBe(true);
        expect(injectedFailures).toBe(1);
        transactionSpy.mockRestore();

        // Raw rows and read-only DBStorage accessors must agree BEFORE any
        // learning-state request can recalculate or repair enrollment progress.
        const stored = await rawEnrollment();
        expect(stored).toMatchObject({
          completedLessonIds: lessonIds,
          progress: 100,
          status: "in_progress",
          startedAt: before.startedAt,
          completedAt: null,
        });
        expect(new Set(stored.completedLessonIds as string[]).size).toBe(lessonIds.length);
        expect(await rawAttempts()).toEqual(attemptsBefore);
        const persisted = (await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)!;
        expect(persisted).toMatchObject({
          completedLessonIds: lessonIds, progress: 100, status: "in_progress",
          startedAt: before.startedAt,
        });
        expect(persisted.completedAt).toBeUndefined();
        expect(await storage.getQuizAttempts(quiz.id)).toEqual(accessorAttemptsBefore);
        const statePath = `/api/courses/${course.id}/learning-state?participantId=${participantId}`;
        const failedState = await request(statePath);
        expect(failedState.status).toBe(200);
        expect(await failedState.json()).toMatchObject({
          enrollment: { id: enrollment.id, completedLessonIds: lessonIds, status: "in_progress" },
          completion: { progress: 100, lessonsCompleted: true, postTestPassed: false, isComplete: false },
        });
        expect(await rawEnrollment()).toEqual(stored);

        const retry = await finishPostTest();
        expect(retry.status).toBe(isSubmission ? 201 : 200);
        if (mode === "kirim esai") {
          attemptId = (await retry.json()).id;
          expect(await storage.getQuizAttempts(quiz.id)).toEqual([
            expect.objectContaining({ id: attemptId, passed: false, gradingStatus: "awaiting_review" }),
          ]);
          expect(await rawEnrollment()).toMatchObject({
            completedLessonIds: lessonIds, status: "in_progress", completedAt: null,
          });
          expect((await grade()).status).toBe(200);
        }
        const afterRetry = await rawEnrollment();
        expect(afterRetry).toMatchObject({
          completedLessonIds: lessonIds, progress: 100, status: "completed",
          startedAt: before.startedAt, completedAt: expect.any(String),
        });
        const attemptsAfter = await rawAttempts();
        expect(attemptsAfter).toHaveLength(1);
        expect(attemptsAfter[0]).toMatchObject({
          ...(isSubmission ? {} : { id: attemptId }),
          passed: 1, gradingStatus: "graded", score: isEssay ? 90 : 100,
        });
        expect((await storage.getEnrollmentsByParticipant(participantId))
          .find(item => item.id === enrollment.id)).toMatchObject({
            completedLessonIds: lessonIds, progress: 100, status: "completed",
            completedAt: afterRetry.completedAt,
          });
        expect(await storage.getQuizAttempts(quiz.id)).toEqual([
          expect.objectContaining({
            id: attemptsAfter[0].id, passed: true, gradingStatus: "graded",
            score: isEssay ? 90 : 100,
          }),
        ]);
        const completedState = await request(statePath);
        expect(completedState.status).toBe(200);
        expect(await completedState.json()).toMatchObject({
          enrollment: {
            completedLessonIds: lessonIds, status: "completed", completedAt: afterRetry.completedAt,
          },
          completion: { progress: 100, lessonsCompleted: true, postTestPassed: true, isComplete: true },
        });
        expect((await finishPostTest()).status).toBe(409);
        expect(await rawAttempts()).toEqual(attemptsAfter);
        expect(await rawEnrollment()).toEqual(afterRetry);
      } finally {
        releaseFirst.resolve();
        await Promise.allSettled(requests);
        transactionSpy?.mockRestore();
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["POST nilai akhir", "PATCH nilai per soal"] as const)(
    "menyimpan nilai esai setelah enrollment dihapus tanpa membuatnya ulang atau mengubah kursus lain: %s",
    async mode => {
      const courseIds: string[] = [];
      try {
        const course = await storage.createCourse({
          unitId: "tender-01",
          targetLevel: "L2",
          title: `Kursus esai enrollment dihapus ${mode} ${Date.now()}`,
          description: "Penilaian tetap tersimpan meskipun pendaftaran telah dihapus",
          duration: "1 jam",
        });
        courseIds.push(course.id);
        const otherCourse = await storage.createCourse({
          unitId: "tender-01",
          targetLevel: "L2",
          title: `Kursus lain peserta ${mode} ${Date.now()}`,
          description: "Progres kursus lain tidak boleh terpengaruh penilaian",
          duration: "1 jam",
        });
        courseIds.push(otherCourse.id);
        const otherEnrollment = await storage.createEnrollment(participantId, otherCourse.id);
        expect(otherCourse.lessons.length).toBeGreaterThan(1);
        await storage.markEnrollmentLessonCompleted(otherEnrollment.id, otherCourse.lessons[0].id);

        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test esai tanpa enrollment",
          description: "Esai dikirim sebelum pendaftaran dihapus",
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
        const attempt = await submission.json();
        expect(attempt).toMatchObject({ gradingStatus: "awaiting_review", passed: false });

        await db.delete(enrollmentsTable).where(eq(enrollmentsTable.id, enrollment.id));
        const [pendingAttempt] = await db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.id, attempt.id));
        expect(pendingAttempt).toMatchObject({
          quizId: quiz.id,
          participantId,
          score: 0,
          passed: 0,
          gradingStatus: "awaiting_review",
          gradedAt: null,
          gradedBy: null,
        });
        const readEnrollments = () => db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.participantId, participantId))
          .orderBy(enrollmentsTable.id);
        const enrollmentsBefore = await readEnrollments();
        expect(enrollmentsBefore.some(item => item.courseId === course.id)).toBe(false);
        expect(enrollmentsBefore.find(item => item.id === otherEnrollment.id)).toMatchObject({
          courseId: otherCourse.id,
          status: "in_progress",
          completedLessonIds: [otherCourse.lessons[0].id],
          completedAt: null,
        });

        const response = mode === "POST nilai akhir"
          ? await request(`/api/quiz-attempts/${attempt.id}/grade`, {
              method: "POST",
              body: JSON.stringify({ score: 90, feedback: "Jawaban sudah tepat." }),
            })
          : await request(`/api/quizzes/${quiz.id}/attempts/${attempt.id}/grade`, {
              method: "PATCH",
              body: JSON.stringify({ essayScores: { "question-1": 9 } }),
            });
        expect(response.status).toBe(200);
        const body = await response.json();
        const gradedAttempt = mode === "POST nilai akhir" ? body.attempt : body;
        expect(gradedAttempt).toMatchObject({
          id: attempt.id,
          quizId: quiz.id,
          participantId,
          score: 90,
          passed: true,
          gradingStatus: "graded",
          gradedBy: userId,
          gradedAt: expect.any(String),
        });
        if (mode === "POST nilai akhir") {
          expect(gradedAttempt.gradingFeedback).toBe("Jawaban sudah tepat.");
        } else {
          expect(gradedAttempt.answers).toEqual([
            expect.objectContaining({ questionId: "question-1", points: 9 }),
          ]);
        }

        // Read persisted rows before any learning-state/progress refresh can mask a write.
        const [storedAttempt] = await db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.id, attempt.id));
        expect(storedAttempt).toEqual({
          ...pendingAttempt,
          answers: gradedAttempt.answers,
          score: 90,
          maxScore: mode === "POST nilai akhir" ? 100 : pendingAttempt.maxScore,
          passed: 1,
          gradingStatus: "graded",
          gradingFeedback: mode === "POST nilai akhir" ? "Jawaban sudah tepat." : null,
          gradedBy: userId,
          gradedAt: gradedAttempt.gradedAt,
        });
        // Compare every enrollment to also catch recreation with a new ID.
        expect(await readEnrollments()).toEqual(enrollmentsBefore);
        expect(await storage.getQuizAttempts(quiz.id)).toEqual([gradedAttempt]);
      } finally {
        for (const id of courseIds) await storage.deleteCourse(id);
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

  it.each(
    (["POST nilai akhir", "PATCH nilai per soal"] as const).flatMap(mode =>
      [90, 40].flatMap(score =>
        [false, true].map(courseCompleted => ({ mode, score, courseCompleted })),
      ),
    ),
  )(
    "menyimpan nilai pre-test tanpa mengubah enrollment: $mode, nilai $score, kursus lulus $courseCompleted",
    async ({ mode, score, courseCompleted }) => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus isolasi pre-test ${mode} ${score} ${courseCompleted} ${Date.now()}`,
        description: "Penilaian diagnostik tidak mengubah kelulusan kursus",
        duration: "1 jam",
      });
      try {
        const preTest = await storage.createQuiz({
          courseId: course.id,
          title: "Pre-test esai diagnostik",
          description: "Bukan syarat kelulusan kursus",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: "essay",
            text: "Jelaskan pengetahuan awal Anda",
            points: 10,
            order: 1,
          }],
        });
        const postTest = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test syarat kelulusan terpisah",
          description: "Hanya post-test ini menentukan kelulusan",
          passingScore: 80,
          maxAttempts: 1,
          shuffleQuestions: false,
          showResults: true,
          questions: [{
            id: "question-1",
            type: "multiple_choice",
            text: "Pilih jawaban benar",
            points: 10,
            options: [{ id: "a", text: "Tepat", isCorrect: true }],
            correctAnswer: "Tepat",
            order: 1,
          }],
        });
        expect(preTest.id).not.toBe(postTest.id);
        await db.update(coursesTable)
          .set({ preTestId: preTest.id, postTestId: postTest.id })
          .where(eq(coursesTable.id, course.id));
        const enrollment = await storage.createEnrollment(participantId, course.id);
        expect(course.lessons.length).toBeGreaterThan(0);
        for (const lesson of course.lessons) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        if (courseCompleted) {
          const submission = await submitQuiz(postTest.id, "Tepat");
          expect(submission.status).toBe(201);
          expect(await submission.json()).toMatchObject({ passed: true });
        }
        const submission = await submitQuiz(preTest.id, "Jawaban diagnostik peserta");
        expect(submission.status).toBe(201);
        const attempt = await submission.json();
        expect(attempt).toMatchObject({ gradingStatus: "awaiting_review", passed: false });

        // Use historical timestamps so an unwanted refresh cannot look unchanged.
        await db.update(enrollmentsTable).set({
          lastAccessedAt: "2025-01-02T03:04:05.000Z",
          completedAt: courseCompleted ? "2025-01-01T03:04:05.000Z" : null,
        }).where(eq(enrollmentsTable.id, enrollment.id));
        const [before] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(before).toMatchObject({
          progress: 100,
          status: courseCompleted ? "completed" : "in_progress",
          completedAt: courseCompleted ? "2025-01-01T03:04:05.000Z" : null,
          lastAccessedAt: "2025-01-02T03:04:05.000Z",
        });
        const postTestAttemptsBefore = await storage.getQuizAttempts(postTest.id);

        const grade = mode === "POST nilai akhir"
          ? await request(`/api/quiz-attempts/${attempt.id}/grade`, {
              method: "POST",
              body: JSON.stringify({ score, feedback: "Hasil penilaian diagnostik." }),
            })
          : await request(`/api/quizzes/${preTest.id}/attempts/${attempt.id}/grade`, {
              method: "PATCH",
              body: JSON.stringify({ essayScores: { "question-1": score / 10 } }),
            });
        expect(grade.status).toBe(200);
        const body = await grade.json();
        const gradedAttempt = mode === "POST nilai akhir" ? body.attempt : body;
        expect(gradedAttempt).toMatchObject({
          id: attempt.id,
          quizId: preTest.id,
          score,
          passed: score >= preTest.passingScore,
          gradingStatus: "graded",
          gradedBy: userId,
          gradedAt: expect.any(String),
        });
        expect(await storage.getQuizAttempts(preTest.id)).toEqual([gradedAttempt]);
        const [after] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        // Includes progress, status, completedAt and lastAccessedAt, not just API output.
        expect(after).toEqual(before);
        expect(await storage.getQuizAttempts(postTest.id)).toEqual(postTestAttemptsBefore);
      } finally {
        await storage.deleteCourse(course.id);
      }
    },
  );

  it.each(["POST nilai akhir", "PATCH nilai per soal"] as const)(
    "menyimpan nilai esai lulus tanpa meluluskan kursus sebelum materi terakhir selesai: %s",
    async mode => {
      const course = await storage.createCourse({
        unitId: "tender-01",
        targetLevel: "L2",
        title: `Kursus esai sebelum materi selesai ${mode} ${Date.now()}`,
        description: "Nilai post-test tidak menggantikan kewajiban menyelesaikan materi",
        duration: "1 jam",
      });
      try {
        expect(course.lessons.length).toBeGreaterThan(1);
        const quiz = await storage.createQuiz({
          courseId: course.id,
          title: "Post-test esai sebelum materi selesai",
          description: "Lulus esai saat masih ada satu materi tersisa",
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
        for (const lesson of course.lessons.slice(0, -1)) {
          await storage.markEnrollmentLessonCompleted(enrollment.id, lesson.id);
        }
        const submission = await submitQuiz(quiz.id, "Jawaban peserta untuk dinilai");
        expect(submission.status).toBe(201);
        const attempt = await submission.json();
        expect(attempt).toMatchObject({ gradingStatus: "awaiting_review", passed: false });

        const grade = mode === "POST nilai akhir"
          ? await request(`/api/quiz-attempts/${attempt.id}/grade`, {
              method: "POST",
              body: JSON.stringify({ score: 90, feedback: "Jawaban sudah tepat." }),
            })
          : await request(`/api/quizzes/${quiz.id}/attempts/${attempt.id}/grade`, {
              method: "PATCH",
              body: JSON.stringify({ essayScores: { "question-1": 9 } }),
            });
        expect(grade.status).toBe(200);
        const body = await grade.json();
        const gradedAttempt = mode === "POST nilai akhir" ? body.attempt : body;
        expect(gradedAttempt).toMatchObject({
          id: attempt.id,
          score: 90,
          passed: true,
          gradingStatus: "graded",
          gradedBy: userId,
          gradedAt: expect.any(String),
        });
        expect(await storage.getQuizAttempts(quiz.id)).toEqual([gradedAttempt]);

        const expectedProgress = Math.round((course.lessons.length - 1) / course.lessons.length * 100);
        const [beforeLastLesson] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(beforeLastLesson).toMatchObject({
          status: "in_progress",
          progress: expectedProgress,
          completedLessonIds: course.lessons.slice(0, -1).map(lesson => lesson.id),
          completedAt: null,
        });
        const statePath = `/api/courses/${course.id}/learning-state?participantId=${participantId}`;
        expect(await (await request(statePath)).json()).toMatchObject({
          completion: {
            progress: expectedProgress,
            lessonsCompleted: false,
            postTestPassed: true,
            isComplete: false,
          },
        });
        const certificateData = {
          participantId,
          courseId: course.id,
          title: "Sertifikat Penyelesaian Kursus",
          description: "Sertifikat uji esai sebelum materi selesai",
        };
        const earlyCertificate = await request("/api/certificates", {
          method: "POST",
          body: JSON.stringify(certificateData),
        });
        expect(earlyCertificate.status).toBe(409);
        expect(await db.select().from(certificatesTable)
          .where(eq(certificatesTable.courseId, course.id))).toEqual([]);

        const completion = await request(
          `/api/enrollments/${enrollment.id}/lessons/${course.lessons.at(-1)!.id}/complete`,
          { method: "POST", body: JSON.stringify({}) },
        );
        expect(completion.status).toBe(200);
        expect(await completion.json()).toMatchObject({
          status: "completed",
          progress: 100,
          completedAt: expect.any(String),
          completedLessonIds: course.lessons.map(lesson => lesson.id),
        });
        const [completedEnrollment] = await db.select().from(enrollmentsTable)
          .where(eq(enrollmentsTable.id, enrollment.id));
        expect(completedEnrollment).toMatchObject({
          status: "completed",
          progress: 100,
          completedAt: expect.any(String),
        });
        expect(await (await request(statePath)).json()).toMatchObject({
          completion: {
            progress: 100,
            lessonsCompleted: true,
            postTestPassed: true,
            isComplete: true,
          },
        });
        expect(await storage.getQuizAttempts(quiz.id)).toEqual([gradedAttempt]);
        const certificate = await request("/api/certificates", {
          method: "POST",
          body: JSON.stringify(certificateData),
        });
        expect(certificate.status).toBe(201);
      } finally {
        await db.delete(certificatesTable).where(eq(certificatesTable.courseId, course.id));
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
