import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { replaceSessionUser } from "@/lib/auth-session";
import { useToast } from "./use-toast";

export function useLogout(redirectTo = "/login") {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
      await replaceSessionUser(null);
    },
    onSuccess: () => navigate(redirectTo),
    onError: (error: Error) => toast({
      title: "Belum berhasil keluar",
      description: `${error.message} Sesi belum dikonfirmasi berakhir. Coba lagi.`,
      variant: "destructive",
    }),
  });
}
