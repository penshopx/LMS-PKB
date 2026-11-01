import { createHash } from "node:crypto";
import type { SubmittedQuizAnswers } from "@shared/lms-course-rules";

// Hash the original payload, not its score: an essay can be graded later.
// Object-key order does not change identity; answer text and timing do.
export function quizSubmissionFingerprint(answers: SubmittedQuizAnswers, timeSpent?: number): string {
  const canonical = {
    answers: Object.keys(answers).sort().map(key => [key, answers[key]]),
    timeSpent: timeSpent ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
