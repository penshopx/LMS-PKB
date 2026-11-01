export const PASSWORD_REQUEST_TIMEOUT_MS = 20_000;
export const PASSWORD_RESULT_UNCONFIRMED = "Hasil perubahan password belum terkonfirmasi. Password mungkin sudah berubah. Tidak ada pengiriman ulang otomatis. Tutup dialog, periksa koneksi, lalu keluar dan coba masuk dengan password baru. Jika tidak berhasil, coba password lama atau hubungi admin.";

export class UnconfirmedPasswordChange extends Error {
  constructor() {
    super(PASSWORD_RESULT_UNCONFIRMED);
  }
}

class RejectedPasswordChange extends Error {}

// The deadline covers headers AND body. Aborting a fetch does not roll back
// the server transaction; even a 500 may follow a committed password update.
export async function requestPasswordChange(
  body: { currentPassword: string; newPassword: string },
  controller: AbortController,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new UnconfirmedPasswordChange());
    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
    timer = setTimeout(() => controller.abort(), PASSWORD_REQUEST_TIMEOUT_MS);
  });
  try {
    await Promise.race([
      aborted,
      (async () => {
        const res = await fetch("/api/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        if ([400, 401, 403, 404, 429].includes(res.status) && typeof data?.message === "string") {
          throw new RejectedPasswordChange(data.message);
        }
        if (!res.ok || data?.message !== "Password berhasil diubah") {
          throw new UnconfirmedPasswordChange();
        }
      })(),
    ]);
  } catch (error) {
    if (error instanceof RejectedPasswordChange) throw error;
    throw new UnconfirmedPasswordChange();
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
