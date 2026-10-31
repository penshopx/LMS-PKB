import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AcceptInvitation({ token }: { token: string }) {
  const [error, setError] = useState("");
  const accept = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/invitations/accept", { token, password });
      return response.json() as Promise<{ username: string }>;
    },
    onError: (failure: Error) => setError(failure.message),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{accept.isSuccess ? "Akun berhasil dibuat" : "Terima undangan LMS"}</CardTitle>
          <CardDescription>{accept.isSuccess ? "Gunakan email dan kata sandi yang baru Anda buat untuk masuk." : "Tetapkan kata sandi pribadi. Jangan bagikan kata sandi kepada PIC atau orang lain."}</CardDescription>
        </CardHeader>
        <CardContent>
          {accept.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm">Username: <strong>{accept.data.username}</strong></p>
              <Button asChild className="w-full"><Link href="/login">Masuk ke aplikasi</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const password = String(form.get("password") ?? "");
              if (password !== form.get("confirmation")) return setError("Kedua kata sandi harus sama.");
              setError("");
              accept.mutate(password);
            }}>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Kata sandi baru</Label>
                <Input id="invite-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
                <p className="text-xs text-muted-foreground">Minimal 12 karakter.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirmation">Ulangi kata sandi</Label>
                <Input id="invite-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={accept.isPending}>{accept.isPending ? "Membuat akun..." : "Aktifkan akun"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
