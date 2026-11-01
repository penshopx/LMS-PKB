import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { DEFAULT_QUIZ_PASSING_SCORE, insertQuizSchema } from "@shared/schema";
import { gradeQuizSubmission } from "@shared/lms-course-rules";
import { db } from "../db";
import { storage, MemStorage } from "../storage";

describe("batas kelulusan standar 60%", () => {
  it("memakai 60 sebagai default validasi dan memori tanpa mengganti pre-test diagnostik", async () => {
    const input = { courseId: "course-policy", title: "Kuis", description: "Uji", questions: [] };
    expect(DEFAULT_QUIZ_PASSING_SCORE).toBe(60);
    expect(insertQuizSchema.parse(input).passingScore).toBe(60);
    expect(insertQuizSchema.parse({ ...input, passingScore: 0 }).passingScore).toBe(0);
    const memory = new MemStorage();
    expect((await memory.createQuiz(input)).passingScore).toBe(60);
    expect((await memory.createQuiz({ ...input, passingScore: 0 })).passingScore).toBe(0);
  });

  it.each([[59, false], [60, true], [79, true]] as const)(
    "nilai %i menghasilkan lulus=%s untuk soal objektif dan esai",
    async (score, passed) => {
      const course = await storage.createCourse({
        unitId: "tender-01", targetLevel: "L2", title: `Batas nilai ${randomUUID()}`,
        description: "Fixture uji batas kelulusan", duration: "1 jam",
      });
      const participant = await storage.createParticipant({
        nip: `PASS${randomUUID().slice(0, 10)}`, name: "Peserta uji batas nilai",
        position: "Staf", unit: "Uji", email: `passing-${randomUUID()}@example.test`,
      });
      try {
        const quiz = await storage.createQuiz({
          courseId: course.id, title: "Esai batas nilai", description: "Uji skor standar", questions: [{
            id: "essay", type: "essay", text: "Jawab", points: 100, order: 1,
          }],
        });
        expect(quiz.passingScore).toBe(60);
        const attempt = await storage.createQuizAttempt({
          quizId: quiz.id, participantId: participant.id,
          answers: [{ questionId: "essay", answer: "Uraian peserta", isCorrect: false, points: 0 }],
          score: 0, maxScore: 100, passed: false, gradingStatus: "awaiting_review",
          startedAt: new Date().toISOString(),
        });
        const graded = await storage.gradeQuizAttempt(attempt.id, { essayScores: { essay: score } });
        expect(graded).toMatchObject({ score, passed, gradingStatus: "graded" });
        const objective = gradeQuizSubmission({
          ...quiz, questions: [
            { id: "a", type: "true_false", text: "Benar", correctAnswer: "Benar", points: score, order: 1 },
            { id: "b", type: "true_false", text: "Salah", correctAnswer: "Benar", points: 100 - score, order: 2 },
          ],
        }, { a: "Benar", b: "Salah" });
        expect(objective).toMatchObject({ score, passed });
      } finally {
        await storage.deleteCourse(course.id);
        await storage.deleteParticipant(participant.id);
      }
    },
  );

  it("migrasi menyelaraskan hasil lama dan kelulusan tanpa mengubah skor atau batas khusus", async () => {
    const migration = readFileSync(new URL("../migrations/011_quiz_passing_score_60.sql", import.meta.url), "utf8");
    const schemaName = `test_passing_${randomUUID().replaceAll("-", "")}`;
    // Isolate the migration from application data and concurrently running tests.
    await db.transaction(async tx => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schemaName}"; SET LOCAL search_path TO "${schemaName}";`));
      await tx.execute(sql.raw(`
        CREATE TABLE quizzes (id text PRIMARY KEY, passing_score integer DEFAULT 70);
        CREATE TABLE quiz_attempts (
          id text PRIMARY KEY, quiz_id text, participant_id text,
          score integer, passed integer, grading_status text
        );
        CREATE TABLE courses (id text PRIMARY KEY, post_test_id text, lessons jsonb);
        CREATE TABLE enrollments (
          id text PRIMARY KEY, course_id text, participant_id text,
          completed_lesson_ids jsonb, progress integer, status text,
          completed_at text, last_accessed_at text
        );
        INSERT INTO quizzes VALUES ('q80',80),('q0',0),('q70',70);
        INSERT INTO courses VALUES
          ('c80','q80','[{"id":"lesson"}]'),('c70','q70','[{"id":"lesson"}]');
        INSERT INTO quiz_attempts VALUES
          ('a60','q80','p60',60,0,'graded'),
          ('a79','q80','p79',79,0,'graded'),
          ('a59','q80','p59',59,0,'graded'),
          ('pending','q80','pending',100,0,'awaiting_review'),
          ('pre','q0','pre',100,1,'graded'),
          ('custom','q70','custom',65,0,'graded'),
          ('done','q80','done',90,1,'graded');
        INSERT INTO enrollments VALUES
          ('ready','c80','p60','["lesson"]',100,'in_progress',NULL,'before'),
          ('unfinished','c80','p79','[]',0,'enrolled',NULL,'before'),
          ('failed','c80','p59','["lesson"]',100,'in_progress',NULL,'before'),
          ('pending','c80','pending','["lesson"]',100,'in_progress',NULL,'before'),
          ('pre','c80','pre','["lesson"]',100,'in_progress',NULL,'before'),
          ('custom','c70','custom','["lesson"]',100,'in_progress',NULL,'before'),
          ('done','c80','done','["lesson"]',100,'completed','2026-10-01T00:00:00.000Z','before');
      `));
      await tx.execute(sql.raw(migration));
      const quizzes = (await tx.execute(sql`SELECT id, passing_score FROM quizzes ORDER BY id`)).rows;
      expect(quizzes).toEqual([
        { id: "q0", passing_score: 0 }, { id: "q70", passing_score: 70 }, { id: "q80", passing_score: 60 },
      ]);
      const attempts = Object.fromEntries((await tx.execute(sql`SELECT * FROM quiz_attempts`)).rows.map(row => [String(row.id), row]));
      expect(attempts.a60).toMatchObject({ score: 60, passed: 1 });
      expect(attempts.a79).toMatchObject({ score: 79, passed: 1 });
      expect(attempts.a59).toMatchObject({ score: 59, passed: 0 });
      expect(attempts.pending).toMatchObject({ score: 100, passed: 0, grading_status: "awaiting_review" });
      expect(attempts.custom).toMatchObject({ score: 65, passed: 0 });
      const beforeReplay = (await tx.execute(sql`SELECT * FROM enrollments ORDER BY id`)).rows;
      const states = Object.fromEntries(beforeReplay.map(row => [String(row.id), row]));
      expect(states.ready).toMatchObject({ progress: 100, status: "completed", last_accessed_at: "before" });
      expect(states.ready.completed_at).not.toBeNull();
      expect(states.unfinished).toMatchObject({ progress: 0, status: "enrolled", completed_at: null });
      for (const id of ["failed", "pending", "pre", "custom"]) {
        expect(states[id]).toMatchObject({ status: "in_progress", completed_at: null });
      }
      expect(states.done.completed_at).toBe("2026-10-01T00:00:00.000Z");
      await tx.execute(sql`INSERT INTO quizzes (id) VALUES ('new-default')`);
      expect((await tx.execute(sql`SELECT passing_score FROM quizzes WHERE id = 'new-default'`)).rows[0].passing_score).toBe(60);
      await tx.execute(sql.raw(migration));
      expect((await tx.execute(sql`SELECT * FROM enrollments ORDER BY id`)).rows).toEqual(beforeReplay);
      await tx.execute(sql.raw(`DROP SCHEMA "${schemaName}" CASCADE`));
    });
  });
});
