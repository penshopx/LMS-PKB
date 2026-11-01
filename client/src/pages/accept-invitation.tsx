import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useLogout } from "@/hooks/use-logout";
import { invitationPasswordSchema, invitationTokenSchema, type InvitationPreview } from "@shared/auth-validation";

export default function AcceptInvitation({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { data: user, isLoading: userLoading, isError: userError, refetch: refetchUser } = useCurrentUser();
  const logout = useLogout(`/invite/${token}`);
  const accept = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/invitations/accept", { token, password });
      return response.json() as Promise<{ username: string }>;
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const tokenValid = invitationTokenSchema.safeParse(token).success;
  const preview = useQuery<InvitationPreview>({
    queryKey: ["/api/invitations/preview", token],
    enabled: tokenValid && !accept.isSuccess,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/invitations/preview", { token });
      return response.json();
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{accept.isSuccess ? "Akun berhasil dibuat" : "Terima undangan LMS"}</CardTitle>
          <CardDescription>{accept.isSuccess ? "Gunakan email dan kata sandi yang baru Anda buat untuk masuk." : "Pendaftaran peserta dan PIC dilakukan melalui undangan resmi BUJK."}</CardDescription>
        </CardHeader>
        <CardContent>
          {accept.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm">Username: <strong>{accept.data.username}</strong></p>
              <Button asChild className="w-full"><Link href={`/login?username=${encodeURIComponent(accept.data.username)}`}>Masuk ke aplikasi</Link></Button>
            </div>
          ) : user ? (
            <div className="space-y-4">
              <p role="alert" className="text-sm">Anda sedang masuk sebagai <strong>{user.username}</strong>. Keluar terlebih dahulu untuk melanjutkan pendaftaran akun undangan ini.</p>
              <Button onClick={() => logout.mutate()} disabled={logout.isPending}>{logout.isPending ? "Keluar..." : "Keluar dari akun saat ini"}</Button>
            </div>
          ) : userLoading || preview.isLoading ? (
            <p role="status" className="py-4 text-sm">Memeriksa sesi dan undangan...</p>
          ) : userError ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">Sesi belum dapat diperiksa. Periksa koneksi Anda.</p>
              <Button variant="outline" onClick={() => refetchUser()}>Periksa kembali</Button>
            </div>
          ) : !tokenValid || preview.isError || !preview.data ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">{preview.error?.message ?? "Tautan undangan tidak valid. Minta tautan baru kepada PIC BUJK."}</p>
              {tokenValid && <Button variant="outline" onClick={() => preview.refetch()}>Periksa undangan kembali</Button>}
              <Link href="/login" className="block text-sm underline">Sudah punya akun? Masuk</Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={event => {
              event.preventDefault();
              if (accept.isPending) return;
              const form = new FormData(event.currentTarget);
              const password = String(form.get("password") ?? "");
              const validation = invitationPasswordSchema.safeParse(password);
              if (!validation.success) return setError(validation.error.issues[0].message);
              if (password !== form.get("confirmation")) return setError("Kedua kata sandi harus sama.");
              setError("");
              accept.mutate(password);
            }}>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{preview.data.bujkName}</p>
                <p>{preview.data.participantName ?? "PIC BUJK"} · {preview.data.role === "bujk_pic" ? "PIC BUJK" : "Peserta"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Jangan bagikan kata sandi kepada PIC atau orang lain.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-username">Email / username akun</Label>
                <Input id="invite-username" name="username" autoComplete="username" value={preview.data.username} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Kata sandi baru</Label>
                <Input id="invite-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required disabled={accept.isPending} />
                <p className="text-xs text-muted-foreground">12–128 karakter. Gunakan kata sandi yang panjang dan unik.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirmation">Ulangi kata sandi</Label>
                <Input id="invite-confirmation" name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required disabled={accept.isPending} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
                Tampilkan kata sandi
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={accept.isPending}>{accept.isPending ? "Membuat akun..." : "Aktifkan akun"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
