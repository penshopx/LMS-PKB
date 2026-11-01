import { advanceSessionEpoch, queryClient } from "./queryClient";
import type { AuthenticatedUser } from "@shared/auth-validation";

const AUTH_CHANGE_EVENT = "lms-auth-change";

// Keep the active /api/me observer alive while removing data owned by an old account.
export async function clearPrivateQueries() {
  advanceSessionEpoch();
  const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== "/api/me";
  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });
}

export async function replaceSessionUser(user: AuthenticatedUser | null) {
  advanceSessionEpoch();
  await queryClient.cancelQueries();
  // Do not detach /api/me observers: invitation logout can stay on the same URL.
  queryClient.removeQueries({ predicate: query => query.queryKey[0] !== "/api/me" });
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(["/api/me"], user);
  try {
    // A notification only: never store an identity, credential, or session token.
    window.localStorage.setItem(AUTH_CHANGE_EVENT, `${Date.now()}-${Math.random()}`);
  } catch { /* Login/logout must work when browser storage is unavailable. */ }
}

export function subscribeToAuthChanges() {
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTH_CHANGE_EVENT) {
      void queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    }
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) void queryClient.invalidateQueries({ queryKey: ["/api/me"] });
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", onPageShow);
  };
}
