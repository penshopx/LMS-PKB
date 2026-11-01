import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { newPasswordSchema, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_UNCHANGED_MESSAGE } from "@shared/auth-validation";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const mutation = useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Gagal mengubah password" }));
        throw new Error(data.message || "Gagal mengubah password");
      }
      return res.json();
    },
    onSuccess: () => {
      // Reset and close after a brief moment so user sees success
      setTimeout(() => {
        handleClose();
      }, 1500);
    },
  });

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setValidationError("");
    mutation.reset();
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    setValidationError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setValidationError("Semua field wajib diisi");
      return;
    }
    const validation = newPasswordSchema.safeParse(newPassword);
    if (!validation.success) {
      setValidationError(validation.error.issues[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Konfirmasi password tidak cocok");
      return;
    }
    if (newPassword === currentPassword) {
      setValidationError(PASSWORD_UNCHANGED_MESSAGE);
      return;
    }

    mutation.mutate({ currentPassword, newPassword });
  }

  const isSuccess = mutation.isSuccess;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-change-password">
        <DialogHeader>
          <DialogTitle>Ganti Password</DialogTitle>
          <DialogDescription>
            Masukkan password saat ini dan password baru Anda.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-sm font-medium text-foreground">Password berhasil diubah!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={mutation.isPending}
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={mutation.isPending}
                data-testid="input-new-password"
                aria-describedby="new-password-help"
              />
              <p id="new-password-help" className="text-xs text-muted-foreground">
                {`Minimal ${PASSWORD_MIN_LENGTH} karakter, tidak termasuk spasi di awal dan akhir; maksimal ${PASSWORD_MAX_LENGTH} karakter. Jangan gunakan kata sandi bawaan lama atau kata sandi yang mudah ditebak.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={mutation.isPending}
                data-testid="input-confirm-password"
              />
            </div>

            {(validationError || mutation.isError) && (
              <div role="alert" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError || (mutation.error as Error)?.message}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-sky-500 hover:bg-sky-600 text-white"
                data-testid="button-submit-change-password"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
