import { useQuery } from "@tanstack/react-query";
import type { ApplicationRole } from "@shared/schema";

export interface CurrentUser {
  id: string;
  username: string;
  role: ApplicationRole;
  participantId: string | null;
  bujkId: string | null;
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await fetch("/api/me", { credentials: "include" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Informasi akun tidak dapat dimuat.");
      return response.json();
    },
    retry: false,
    staleTime: 60_000,
  });
}
