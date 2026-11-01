/** Prefer the API duration, falling back to either standard Retry-After form. */
export function parseRetryAfterSeconds(bodySeconds: unknown, header: string | null, now = Date.now()): number | undefined {
  if (typeof bodySeconds === "number" && Number.isFinite(bodySeconds) && bodySeconds > 0) {
    return Math.ceil(bodySeconds);
  }
  if (!header?.trim()) return undefined;
  const value = header.trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
  }
  // Do not let Date.parse interpret invalid numeric values as calendar dates.
  if (!/^[A-Za-z]{3}, /.test(value)) return undefined;
  const seconds = Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function formatLoginWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0
    ? `${minutes} menit${remainder > 0 ? ` ${remainder} detik` : ""}`
    : `${remainder} detik`;
}
