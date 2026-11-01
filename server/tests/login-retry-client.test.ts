import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiRequestError } from "@/lib/queryClient";
import { formatLoginWait, parseRetryAfterSeconds } from "@/lib/retry-after";

afterEach(() => vi.unstubAllGlobals());

describe("login retry response metadata", () => {
  it("prefers positive JSON seconds and rounds up", () => {
    expect(parseRetryAfterSeconds(61.2, "90")).toBe(62);
  });

  it("falls back to seconds or an HTTP date header", () => {
    const now = Date.parse("Sun, 01 Nov 2026 00:00:00 GMT");
    expect(parseRetryAfterSeconds(undefined, " 65 ")).toBe(65);
    expect(parseRetryAfterSeconds(-1, "Sun, 01 Nov 2026 00:01:00 GMT", now)).toBe(60);
    for (const body of [undefined, null, 0, -1, Infinity, NaN, "20"]) {
      expect(parseRetryAfterSeconds(body, "3")).toBe(3);
    }
  });

  it("ignores missing, expired or malformed durations instead of locking indefinitely", () => {
    for (const header of [null, "", "bad", "-1", "0", "Infinity", "Sun, 01 Nov 2020 00:00:00 GMT"]) {
      expect(parseRetryAfterSeconds(undefined, header)).toBeUndefined();
    }
  });

  it("formats seconds and minutes in Indonesian", () => {
    expect(formatLoginWait(1)).toBe("1 detik");
    expect(formatLoginWait(60)).toBe("1 menit");
    expect(formatLoginWait(125)).toBe("2 menit 5 detik");
  });

  it("preserves 429 metadata without changing ordinary 401/503 messages", async () => {
    for (const status of [429, 401, 503]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
        { message: `Pesan ${status}`, retryAfterSeconds: 7 },
        { status, headers: { "Retry-After": "9" } },
      )));
      const err = await apiRequest("POST", "/api/login", {}).catch(error => error);
      expect(err).toBeInstanceOf(ApiRequestError);
      expect(err).toMatchObject({ message: `Pesan ${status}`, status });
      expect(err.retryAfterSeconds).toBe(status === 429 ? 7 : undefined);
    }
  });

  it("uses the header even if a proxy returns a non-JSON 429 body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too many requests", {
      status: 429, headers: { "Retry-After": "10" },
    })));
    await expect(apiRequest("POST", "/api/login", {})).rejects.toMatchObject({
      status: 429, retryAfterSeconds: 10,
    });
  });
});
