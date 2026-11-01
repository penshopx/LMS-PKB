import { afterEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_REQUEST_TIMEOUT_MS, PASSWORD_RESULT_UNCONFIRMED, requestPasswordChange } from "@/lib/change-password-request";

const body = { currentPassword: "old-password", newPassword: "replacement-password" };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("password change network outcomes", () => {
  it.each(["headers", "body"])("bounds a hanging %s even if fetch ignores abort", async stage => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const fetch = vi.fn(() => stage === "headers" ? never : Promise.resolve({ json: () => never }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = expect(requestPasswordChange(body, controller)).rejects.toThrow(PASSWORD_RESULT_UNCONFIRMED);
    await vi.advanceTimersByTimeAsync(PASSWORD_REQUEST_TIMEOUT_MS);
    await result;
    expect(controller.signal.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([400, 401, 403, 404, 429])("preserves confirmed %s rejection messages", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Penolakan pasti" }), { status })));
    await expect(requestPasswordChange(body, new AbortController())).rejects.toThrow("Penolakan pasti");
  });

  it.each(["network", "500", "malformed", "unexpected-success"])("treats %s as unconfirmed without retry", async kind => {
    const fetch = vi.fn();
    if (kind === "network") fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    else fetch.mockResolvedValue(new Response(kind === "malformed" ? "proxy" : JSON.stringify({
      message: kind === "500" ? "Gagal mengubah password" : "unexpected",
    }), { status: kind === "500" ? 500 : 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestPasswordChange(body, new AbortController())).rejects.toThrow(PASSWORD_RESULT_UNCONFIRMED);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not turn a late committed response into a confirmed result", async () => {
    vi.useFakeTimers();
    let release!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
    const result = expect(requestPasswordChange(body, new AbortController())).rejects.toThrow(PASSWORD_RESULT_UNCONFIRMED);
    await vi.advanceTimersByTimeAsync(PASSWORD_REQUEST_TIMEOUT_MS);
    await result;
    release(new Response(JSON.stringify({ message: "Password berhasil diubah" })));
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts the normal success response and clears the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Password berhasil diubah" }))));
    await expect(requestPasswordChange(body, new AbortController())).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
