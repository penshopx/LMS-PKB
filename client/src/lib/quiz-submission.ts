import { z } from "zod";
import type { QuizAttempt } from "@shared/schema";

const pendingSchema = z.object({
  quizId: z.string().min(1),
  participantId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  answers: z.record(z.string()),
});
export type PendingQuizSubmission = z.infer<typeof pendingSchema>;
type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storageKey(ownerId: string, participantId: string, quizId: string) {
  return `quiz-pending:${JSON.stringify([ownerId, participantId, quizId])}`;
}

export function readPendingQuizSubmission(
  store: SessionStore, ownerId: string, participantId: string, quizId: string,
): PendingQuizSubmission | null {
  const value = store.getItem(storageKey(ownerId, participantId, quizId));
  if (value === null) return null;
  try {
    const pending = pendingSchema.parse(JSON.parse(value));
    if (pending.participantId !== participantId || pending.quizId !== quizId) throw new Error();
    return pending;
  } catch {
    // Do not discard an uncertain request and silently spend another attempt.
    throw new Error("Data pengiriman tersimpan tidak dapat dibaca. Periksa riwayat percobaan atau hubungi admin sebelum mengirim lagi.");
  }
}

export function prepareQuizSubmission(
  store: SessionStore, ownerId: string, participantId: string, quizId: string, answers: Record<string, string>,
): PendingQuizSubmission {
  const existing = readPendingQuizSubmission(store, ownerId, participantId, quizId);
  if (existing) return existing;
  const pending = { quizId, participantId, idempotencyKey: crypto.randomUUID(), answers: { ...answers } };
  // Save before sending, so a reload after a lost response uses the same body.
  store.setItem(storageKey(ownerId, participantId, quizId), JSON.stringify(pending));
  return pending;
}

export function clearPendingQuizSubmission(store: SessionStore, ownerId: string, submission: PendingQuizSubmission) {
  const key = storageKey(ownerId, submission.participantId, submission.quizId);
  const current = readPendingQuizSubmission(store, ownerId, submission.participantId, submission.quizId);
  if (current?.idempotencyKey === submission.idempotencyKey) store.removeItem(key);
}

export class QuizSubmissionError extends Error {
  constructor(message: string, public readonly code?: string) { super(message); }
}

export async function postQuizSubmission(submission: PendingQuizSubmission): Promise<QuizAttempt> {
  const response = await fetch(`/api/quizzes/${encodeURIComponent(submission.quizId)}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(submission),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new QuizSubmissionError(body?.message ?? "Status pengiriman belum dapat dipastikan. Coba kirim ulang jawaban yang sama.", body?.code);
  }
  return response.json();
}
