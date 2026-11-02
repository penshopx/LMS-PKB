import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { clearPrivateQueries, replaceSessionUser, subscribeToAuthChanges } from "@/lib/auth-session";
import { useCurrentUser } from "@/hooks/use-current-user";

vi.mock("@tanstack/react-query", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: (options: unknown) => options };
});

const firstUser = { id: "first", username: "first@example.test", role: "participant" as const, participantId: "p-first", bujkId: "b-first" };
const secondUser = { id: "second", username: "second@example.test", role: "bujk_pic" as const, participantId: null, bujkId: "b-second" };
const fetchMock = vi.fn();
let storage: { setItem: ReturnType<typeof vi.fn> };
let addListener: ReturnType<typeof vi.fn>;
let removeListener: ReturnType<typeof vi.fn>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function currentUserOptions(): any { return useCurrentUser(); }

beforeEach(() => {
  queryClient.clear();
  storage = { setItem: vi.fn() };
  addListener = vi.fn();
  removeListener = vi.fn();
  vi.stubGlobal("window", { localStorage: storage, addEventListener: addListener, removeEventListener: removeListener });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); queryClient.clear(); });

describe("authentication client state", () => {
  it("clears old private data before installing the new account and broadcasts no identity or credentials", async () => {
    queryClient.setQueryData(["/api/me"], firstUser);
    const observedSession = queryClient.getQueryCache().find({ queryKey: ["/api/me"] });
    queryClient.setQueryData(["/api/courses"], { private: "old-account-data" });
    await replaceSessionUser(secondUser);
    expect(queryClient.getQueryData(["/api/me"])).toEqual(secondUser);
    expect(queryClient.getQueryCache().find({ queryKey: ["/api/me"] })).toBe(observedSession);
    expect(queryClient.getQueryData(["/api/courses"])).toBeUndefined();
    expect(storage.setItem).toHaveBeenCalledWith("lms-auth-change", expect.any(String));
    const announcement = storage.setItem.mock.calls[0][1];
    expect(announcement).not.toContain(secondUser.id);
    expect(announcement).not.toContain(secondUser.username);
  });

  it("cancels old in-flight queries before logout so late results cannot repopulate private cache", async () => {
    const pending = deferred<string>();
    const query = queryClient.fetchQuery({ queryKey: ["/api/old-account"], queryFn: () => pending.promise }).catch(() => undefined);
    await replaceSessionUser(null);
    pending.resolve("old-private-data");
    await query;
    expect(queryClient.getQueryData(["/api/old-account"])).toBeUndefined();
    expect(queryClient.getQueryData(["/api/me"])).toBeNull();
  });

  it("discards late protected mutation responses from the previous authentication generation", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const response = apiRequest("POST", "/api/private-change", { value: "old" });
    await clearPrivateQueries();
    pending.resolve(Response.json({ success: true }));
    await expect(response).rejects.toThrow("Sesi akun telah berubah");
  });

  it("still completes logout when browser storage is unavailable", async () => {
    storage.setItem.mockImplementation(() => { throw new Error("Storage denied"); });
    await expect(replaceSessionUser(null)).resolves.toBeUndefined();
    expect(queryClient.getQueryData(["/api/me"])).toBeNull();
  });

  it("rejects an old response body even when its headers arrived before the account changed", async () => {
    const pending = deferred<unknown>();
    const response = Response.json({});
    vi.spyOn(response, "json").mockReturnValue(pending.promise);
    fetchMock.mockResolvedValueOnce(response);
    const received = await apiRequest("POST", "/api/private-change", {});
    const body = received.json();
    await replaceSessionUser(secondUser);
    pending.resolve({ privateData: "previous-account" });
    await expect(body).rejects.toThrow("Sesi akun telah berubah");
  });

  it("rejects a late query body from a previous account", async () => {
    const pending = deferred<unknown>();
    const response = Response.json({});
    const read = vi.spyOn(response, "json").mockReturnValue(pending.promise);
    fetchMock.mockResolvedValueOnce(response);
    const result = getQueryFn({ on401: "throw" })({ queryKey: ["/api/private"], signal: new AbortController().signal } as any);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    await clearPrivateQueries();
    pending.resolve({ privateData: "previous-account" });
    await expect(result).rejects.toThrow("Sesi akun telah berubah");
  });

  it("checks the session for an authentication failure, but not for an incorrect current password", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Sesi berakhir.", code: "SESSION_EXPIRED" }, { status: 401 }));
    await expect(apiRequest("POST", "/api/private")).rejects.toThrow("Sesi berakhir.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/me"] });
    invalidate.mockClear();
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Password saat ini tidak benar" }, { status: 401 }));
    await expect(apiRequest("POST", "/api/me/password")).rejects.toThrow("Password saat ini tidak benar");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("forwards abort signals to normal queries", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(Response.json([]));
    const query = getQueryFn({ on401: "throw" });
    await query({ queryKey: ["/api/courses"], signal: controller.signal } as any);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses", expect.objectContaining({ signal: controller.signal }));
  });

  it("removes private caches when the verified session expires or changes identity", async () => {
    for (const response of [Response.json({}, { status: 401 }), Response.json(secondUser)]) {
      queryClient.setQueryData(["/api/me"], firstUser);
      queryClient.setQueryData(["/api/private"], "old-account-data");
      fetchMock.mockResolvedValueOnce(response);
      const options = currentUserOptions();
      const current = await options.queryFn({ signal: new AbortController().signal });
      expect(current).toEqual(response.status === 401 ? null : secondUser);
      expect(queryClient.getQueryData(["/api/private"])).toBeUndefined();
    }
  });

  it("does not mistake a server outage for a confirmed logout and checks again on focus/reconnect", async () => {
    queryClient.setQueryData(["/api/me"], firstUser);
    queryClient.setQueryData(["/api/private"], "preserved-until-session-is-verified");
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    const options = currentUserOptions();
    await expect(options.queryFn({ signal: new AbortController().signal })).rejects.toThrow("Informasi akun tidak dapat dimuat");
    expect(queryClient.getQueryData(["/api/me"])).toEqual(firstUser);
    expect(queryClient.getQueryData(["/api/private"])).toBe("preserved-until-session-is-verified");
    expect(options).toMatchObject({ refetchInterval: 60_000, refetchOnWindowFocus: "always", refetchOnReconnect: "always" });
  });

  it("refreshes authentication on a cross-tab change and cleans up its event listener", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const reset = vi.spyOn(queryClient, "resetQueries");
    queryClient.setQueryData(["/api/me"], firstUser);
    const observedSession = queryClient.getQueryCache().find({ queryKey: ["/api/me"] });
    queryClient.setQueryData(["/api/practice-missions/reminders", firstUser.id], ["private reminder"]);
    queryClient.setQueryData(["/api/practice-missions/submissions"], ["private reflection"]);
    const unsubscribe = subscribeToAuthChanges();
    const callback = addListener.mock.calls[0][1];
    callback({ key: "unrelated-setting" });
    expect(invalidate).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["/api/me"])).toEqual(firstUser);
    callback({ key: "lms-auth-change" });
    expect(reset).toHaveBeenCalledWith({ queryKey: ["/api/me"], exact: true });
    expect(queryClient.getQueryCache().find({ queryKey: ["/api/me"] })).toBe(observedSession);
    expect(queryClient.getQueryState(["/api/me"])).toMatchObject({ status: "pending", data: undefined });
    expect(queryClient.getQueryData(["/api/practice-missions/reminders", firstUser.id])).toBeUndefined();
    expect(queryClient.getQueryData(["/api/practice-missions/submissions"])).toBeUndefined();
    const onPageShow = addListener.mock.calls.find(call => call[0] === "pageshow")![1];
    onPageShow({ persisted: false });
    expect(invalidate).not.toHaveBeenCalled();
    onPageShow({ persisted: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/me"] });
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith("storage", callback);
    expect(removeListener).toHaveBeenCalledWith("pageshow", onPageShow);
  });
});
