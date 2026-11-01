import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareQuizSubmission, readPendingQuizSubmission, clearPendingQuizSubmission,
  postQuizSubmission, QuizSubmissionError,
} from "../../client/src/lib/quiz-submission";

function sessionStore() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("retry kuis pada browser", () => {
  it("menyimpan payload sebelum pengiriman dan mempertahankannya setelah reload atau perubahan jawaban lokal", () => {
    const store = sessionStore();
    const answers = { q: "Jawaban pertama" };
    const first = prepareQuizSubmission(store, "user-a", "participant-a", "quiz-a", answers);
    answers.q = "diubah kemudian";
    expect(readPendingQuizSubmission(store, "user-a", "participant-a", "quiz-a")).toEqual(first);
    expect(prepareQuizSubmission(store, "user-a", "participant-a", "quiz-a", answers)).toEqual(first);
    expect(first.answers.q).toBe("Jawaban pertama");
  });

  it("memisahkan pending milik akun, peserta, dan kuis berbeda", () => {
    const store = sessionStore();
    prepareQuizSubmission(store, "user-a", "participant-a", "quiz-a", { q: "rahasia" });
    expect(readPendingQuizSubmission(store, "user-b", "participant-a", "quiz-a")).toBeNull();
    expect(readPendingQuizSubmission(store, "user-a", "participant-b", "quiz-a")).toBeNull();
    expect(readPendingQuizSubmission(store, "user-a", "participant-a", "quiz-b")).toBeNull();
  });

  it("baru membuat kunci baru setelah pengiriman sebelumnya dikonfirmasi", () => {
    const store = sessionStore();
    const first = prepareQuizSubmission(store, "user", "participant", "quiz", { q: "satu" });
    clearPendingQuizSubmission(store, "user", first);
    expect(readPendingQuizSubmission(store, "user", "participant", "quiz")).toBeNull();
    const retake = prepareQuizSubmission(store, "user", "participant", "quiz", { q: "dua" });
    expect(retake.idempotencyKey).not.toBe(first.idempotencyKey);
    clearPendingQuizSubmission(store, "user", first);
    expect(readPendingQuizSubmission(store, "user", "participant", "quiz")).toEqual(retake);
  });

  it("tidak mengganti kunci diam-diam ketika data pending rusak atau penyimpanan gagal", () => {
    const store = sessionStore();
    prepareQuizSubmission(store, "user", "participant", "quiz", { q: "jawaban" });
    const key = [...store.entries.keys()][0];
    store.entries.set(key, "corrupt");
    expect(() => prepareQuizSubmission(store, "user", "participant", "quiz", {})).toThrow("tidak dapat dibaca");
    expect(store.entries.get(key)).toBe("corrupt");
    expect(() => prepareQuizSubmission({ ...sessionStore(), setItem: () => { throw new Error("storage blocked"); } }, "user", "participant", "quiz", {})).toThrow("storage blocked");
  });

  it("respons hilang tetap menyisakan payload yang sama untuk dikirim ulang", async () => {
    const store = sessionStore();
    const pending = prepareQuizSubmission(store, "user", "participant", "quiz", { q: "satu" });
    const network = vi.fn().mockRejectedValueOnce(new TypeError("network lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "attempt-1", score: 100 }), { status: 200 }));
    vi.stubGlobal("fetch", network);
    await expect(postQuizSubmission(pending)).rejects.toThrow("network lost");
    const restored = prepareQuizSubmission(store, "user", "participant", "quiz", { q: "jangan dipakai" });
    expect(await postQuizSubmission(restored)).toMatchObject({ id: "attempt-1" });
    expect(network.mock.calls[0][1].body).toBe(network.mock.calls[1][1].body);
    expect(readPendingQuizSubmission(store, "user", "participant", "quiz")).toEqual(pending);
  });

  it("kode konflik diteruskan tanpa menghapus pending secara otomatis", async () => {
    const store = sessionStore();
    const pending = prepareQuizSubmission(store, "user", "participant", "quiz", { q: "satu" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "idempotency_conflict", message: "Isi berbeda",
    }), { status: 409 })));
    await expect(postQuizSubmission(pending)).rejects.toBeInstanceOf(QuizSubmissionError);
    expect(readPendingQuizSubmission(store, "user", "participant", "quiz")).toEqual(pending);
  });
});
