import { describe, expect, it } from "vitest";
import { MemStorage } from "../storage";

describe("batas percobaan kuis", () => {
  it("penyimpanan memori membedakan retry, konflik isi, dan peserta lain yang menunggu penilaian", async () => {
    const memory = new MemStorage();
    const quiz = await memory.createQuiz({
      courseId: "course-memory-retry", title: "Retry esai memori",
      description: "Uji kesetaraan dengan storage PostgreSQL", maxAttempts: 1, questions: [],
    });
    const attempt = {
      quizId: quiz.id, participantId: "a", answers: [], score: 0, maxScore: 100,
      passed: false, gradingStatus: "awaiting_review" as const, startedAt: new Date().toISOString(),
    };
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      memory.createQuizAttemptWithinLimit(attempt, { key: "same-key", fingerprint: "same-body" }),
    ));
    expect(results.filter(result => "attempt" in result)).toHaveLength(5);
    expect(new Set(results.map(result => "attempt" in result && result.attempt.id)).size).toBe(1);
    expect(await memory.createQuizAttemptWithinLimit(attempt, { key: "same-key", fingerprint: "different-body" }))
      .toEqual({ rejection: "idempotency_conflict" });
    expect(await memory.createQuizAttemptWithinLimit({ ...attempt, participantId: "b" }, { key: "same-key", fingerprint: "same-body" }))
      .toHaveProperty("attempt");
    expect(await memory.getQuizAttempts(quiz.id)).toHaveLength(2);
  });

  it("hanya menyimpan percobaan sampai batas saat beberapa permintaan tiba bersamaan", async () => {
    const memory = new MemStorage();
    const quiz = await memory.createQuiz({
      courseId: "course-quiz-attempt-limit",
      title: "Kuis uji batas percobaan",
      description: "Menguji permintaan percobaan paralel",
      maxAttempts: 2,
      questions: [],
    });

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => memory.createQuizAttemptWithinLimit({
        quizId: quiz.id,
        participantId: "participant-quiz-attempt-limit",
        answers: [],
        score: 0,
        maxScore: 100,
        passed: false,
        startedAt: new Date(1_800_000_000_000 + index).toISOString(),
      })),
    );

    expect(results.filter(result => "attempt" in result)).toHaveLength(quiz.maxAttempts);
    expect(results.filter(result => "rejection" in result && result.rejection === "max_attempts"))
      .toHaveLength(12 - quiz.maxAttempts);
    expect(await memory.getQuizAttempts(quiz.id)).toHaveLength(quiz.maxAttempts);
  });
});
