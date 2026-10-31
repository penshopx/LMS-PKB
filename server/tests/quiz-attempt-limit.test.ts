import { describe, expect, it } from "vitest";
import { MemStorage } from "../storage";

describe("batas percobaan kuis", () => {
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
