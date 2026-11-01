import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { parseRetryAfterSeconds } from "./retry-after";

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let sessionEpoch = 0;
export function advanceSessionEpoch() { sessionEpoch++; }
export function getSessionEpoch() { return sessionEpoch; }
function assertCurrentSession(epoch: number, url: string) {
  if (epoch !== sessionEpoch && !/^\/api\/(?:login|logout|invitations)(?:\/|$)/.test(url)) {
    throw new Error("Sesi akun telah berubah. Muat ulang data untuk melanjutkan.");
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let details: { message?: string; code?: string; retryAfterSeconds?: unknown } = {};
    try { details = JSON.parse(text); } catch { /* A proxy can return plain text. */ }
    if (res.status === 401 && details?.code === "SESSION_EXPIRED") {
      void queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    }
    throw new ApiRequestError(
      details?.message || `Permintaan gagal (${res.status}). Silakan coba lagi.`,
      res.status,
      res.status === 429
        ? parseRetryAfterSeconds(details?.retryAfterSeconds, res.headers.get("Retry-After"))
        : undefined,
    );
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const epoch = sessionEpoch;
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  assertCurrentSession(epoch, url);
  // Fetch resolves on headers. Ownership must also hold after a slow body download.
  const readJson = res.json.bind(res);
  const readText = res.text.bind(res);
  res.json = async () => {
    const data = await readJson();
    assertCurrentSession(epoch, url);
    return data;
  };
  res.text = async () => {
    const text = await readText();
    assertCurrentSession(epoch, url);
    return text;
  };
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const epoch = sessionEpoch;
    const url = queryKey.join("/");
    const res = await fetch(url, {
      credentials: "include",
      signal,
    });

    assertCurrentSession(epoch, url);
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    assertCurrentSession(epoch, url);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
