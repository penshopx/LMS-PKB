import { useEffect, useRef, useState } from "react";
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
import { requestPasswordChange, UnconfirmedPasswordChange } from "@/lib/change-password-request";
import { getSessionEpoch } from "@/lib/queryClient";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const requestEpoch = useRef<number | null>(null);
  const passwordValidation = newPasswordSchema.safeParse(newPassword);
  const passwordError = !passwordValidation.success
    ? passwordValidation.error.issues[0].message
    : currentPassword && newPassword === currentPassword ? PASSWORD_UNCHANGED_MESSAGE : "";
  const confirmationError = confirmPassword !== newPassword ? "Konfirmasi password tidak cocok" : "";
  const canSubmit = !!currentPassword && !passwordError && !!confirmPassword && !confirmationError;

  const mutation = useMutation({
    retry: false,
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const controller = new AbortController();
      activeRequest.current = controller;
      try {
        await requestPasswordChange(body, controller);
      } finally {
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    },
  });

  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  const ownsResult = requestEpoch.current === null || requestEpoch.current === getSessionEpoch();
  const unconfirmed = mutation.error instanceof UnconfirmedPasswordChange;
  useEffect(() => {
    if (!open || !mutation.isSuccess || !ownsResult) return;
    const timer = setTimeout(() => {
      if (requestEpoch.current === getSessionEpoch()) handleClose();
    }, 1500);
    return () => clearTimeout(timer);
  }, [open, mutation.isSuccess, ownsResult]);

  function handleClose() {
    if (mutation.isPending && ownsResult) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setValidationError("");
    setNewPasswordTouched(false);
    setConfirmationTouched(false);
    mutation.reset();
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || unconfirmed || !ownsResult) return;
    setValidationError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setValidationError("Semua field wajib diisi");
      return;
    }
    setNewPasswordTouched(true);
    setConfirmationTouched(true);
    if (!canSubmit) return;

    requestEpoch.current = getSessionEpoch();
    mutation.mutate({ currentPassword, newPassword });
  }

  const isSuccess = mutation.isSuccess && ownsResult;

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" data-testid="dialog-change-password">
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
          <form noValidate onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={e => {
                  setCurrentPassword(e.target.value);
                  setValidationError("");
                  if (!unconfirmed) mutation.reset();
                }}
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
                onChange={e => {
                  setNewPassword(e.target.value);
                  setNewPasswordTouched(true);
                  setValidationError("");
                  if (!unconfirmed) mutation.reset();
                }}
                onBlur={() => setNewPasswordTouched(true)}
                disabled={mutation.isPending}
                data-testid="input-new-password"
                aria-invalid={newPasswordTouched && !!passwordError}
                aria-describedby={`new-password-help${newPasswordTouched && passwordError ? " new-password-error" : ""}`}
              />
              {newPasswordTouched && passwordError && (
                <p id="new-password-error" role="alert" className="text-sm text-destructive">{passwordError}</p>
              )}
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
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setConfirmationTouched(true);
                  setValidationError("");
                  if (!unconfirmed) mutation.reset();
                }}
                onBlur={() => setConfirmationTouched(true)}
                aria-invalid={confirmationTouched && !!confirmationError}
                aria-describedby={confirmationTouched && confirmationError ? "confirm-password-error" : undefined}
                disabled={mutation.isPending}
                data-testid="input-confirm-password"
              />
              {confirmationTouched && confirmationError && (
                <p id="confirm-password-error" role="alert" className="text-sm text-destructive">{confirmationError}</p>
              )}
            </div>

            {(validationError || (mutation.isError && ownsResult) || !ownsResult) && (
              <div role="alert" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{!ownsResult ? "Sesi akun telah berubah. Tutup dialog dan periksa akun yang sedang masuk." : validationError || (mutation.error as Error)?.message}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending && ownsResult}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || !canSubmit || unconfirmed || !ownsResult}
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
