import { useQuery } from "@tanstack/react-query";
import { currentUserSchema, type AuthenticatedUser } from "@shared/auth-validation";
import { queryClient } from "@/lib/queryClient";
import { clearPrivateQueries } from "@/lib/auth-session";

export type CurrentUser = AuthenticatedUser;

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["/api/me"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/me", { credentials: "include", cache: "no-store", signal });
      if (response.status !== 401 && !response.ok) throw new Error("Informasi akun tidak dapat dimuat.");
      const current = response.status === 401 ? null : currentUserSchema.parse(await response.json());
      const previous = queryClient.getQueryData<CurrentUser | null>(["/api/me"]);
      if (previous?.id !== current?.id || previous?.role !== current?.role ||
          previous?.participantId !== current?.participantId || previous?.bujkId !== current?.bujkId) {
        await clearPrivateQueries();
      }
      return current;
    },
    retry: false,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchOnMount: "always",
  });
}
