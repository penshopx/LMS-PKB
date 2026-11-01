import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  accountStatusChangeSchema, ACCOUNT_STATUS_REASON_MAX_LENGTH,
  type AccountStatusHistoryEntry, type BujkInvitation, type BujkOrganization,
} from "@shared/schema";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AccountSummary {
  id: string;
  username: string;
  role: string;
  bujkName: string | null;
  participantName: string | null;
  isActive: boolean;
}

interface AccountStatusHistoryResponse {
  entries: AccountStatusHistoryEntry[];
  hasMore: boolean;
}

const STATUS_HISTORY_PAGE_SIZE = 50;

export default function AccessManagement() {
  const { data: user } = useCurrentUser();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [inviteLink, setInviteLink] = useState("");
  const [historyOffset, setHistoryOffset] = useState(0);
  const { data: organizations = [], isError: organizationError } = useQuery<BujkOrganization[]>({
    queryKey: ["/api/access/bujks"],
  });
  const { data: invitations = [], isError: invitationError } = useQuery<BujkInvitation[]>({
    queryKey: ["/api/access/invitations"],
  });
  const {
    data: accounts = [],
    isLoading: accountsLoading,
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery<AccountSummary[]>({
    queryKey: ["/api/access/users"],
    enabled: isAdmin,
  });
  const [accountToUpdate, setAccountToUpdate] = useState<AccountSummary | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const reasonIsValid = accountStatusChangeSchema.shape.reason.safeParse(statusChangeReason).success;
  const historyQueryKey = ["/api/access/status-history", user?.id, historyOffset] as const;
  const {
    data: statusHistory,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery<AccountStatusHistoryResponse>({
    queryKey: historyQueryKey,
    enabled: isAdmin && !!user?.id,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/access/status-history?offset=${historyOffset}`);
      return response.json() as Promise<AccountStatusHistoryResponse>;
    },
  });

  const createOrganization = useMutation({
    mutationFn: async (name: string) => apiRequest("POST", "/api/access/bujks", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/bujks"] });
      toast({ title: "BUJK berhasil ditambahkan" });
    },
    onError: (error: Error) => toast({ title: "BUJK gagal disimpan", description: error.message, variant: "destructive" }),
  });

  const createInvitation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiRequest("POST", "/api/access/invitations", data);
      return response.json() as Promise<{ invitePath: string }>;
    },
    onSuccess: result => {
      setInviteLink(new URL(result.invitePath, window.location.origin).href);
      queryClient.invalidateQueries({ queryKey: ["/api/access/invitations"] });
      toast({ title: "Undangan dibuat", description: "Salin tautan ini dan bagikan langsung kepada penerima." });
    },
    onError: (error: Error) => toast({ title: "Undangan gagal dibuat", description: error.message, variant: "destructive" }),
  });

  const revokeInvitation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/access/invitations/${id}/revoke`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/access/invitations"] }),
    onError: (error: Error) => toast({ title: "Undangan gagal dicabut", description: error.message, variant: "destructive" }),
  });

  const updateAccountStatus = useMutation({
    mutationFn: async ({ id, isActive, reason }: { id: string; isActive: boolean; reason: string }) => {
      const response = await apiRequest("PATCH", `/api/access/users/${id}/status`, { isActive, reason });
      return response.json() as Promise<{ id: string; isActive: boolean }>;
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access/status-history", user?.id] });
      setHistoryOffset(0);
      toast({
        title: result.isActive ? "Akun diaktifkan" : "Akun dinonaktifkan",
        description: result.isActive
          ? "Pengguna dapat kembali masuk ke LMS."
          : "Sesi pengguna telah dicabut. Riwayat belajar tetap tersimpan.",
      });
      setAccountToUpdate(null);
      setStatusChangeReason("");
    },
    onError: (error: Error) => toast({
      title: "Status akun gagal diperbarui",
      description: error.message,
      variant: "destructive",
    }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "Akun & Akses BUJK" : "Undang Peserta"}</h1>
        <p className="mt-1 text-muted-foreground">
          {isAdmin ? "Daftarkan BUJK dan undang PIC untuk mengelola undangan pesertanya." : `Undangan peserta untuk ${organizations[0]?.name ?? "BUJK Anda"}.`}
        </p>
      </div>
      {(organizationError || invitationError) && <p role="alert" className="text-destructive">Data akses gagal dimuat. Muat ulang halaman untuk mencoba kembali.</p>}

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Daftarkan BUJK</CardTitle></CardHeader>
          <CardContent>
            <form className="flex flex-wrap gap-3" onSubmit={event => {
              event.preventDefault();
              const form = event.currentTarget;
              const name = String(new FormData(form).get("name") ?? "");
              createOrganization.mutate(name, { onSuccess: () => form.reset() });
            }}>
              <Label className="sr-only" htmlFor="bujk-name">Nama BUJK</Label>
              <Input id="bujk-name" name="name" className="min-w-56 flex-1" placeholder="Nama badan usaha" required minLength={2} maxLength={200} />
              <Button disabled={createOrganization.isPending}>Tambah BUJK</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "Undang PIC BUJK" : "Undang peserta baru"}</CardTitle>
          <CardDescription>Tautan berlaku 7 hari dan hanya dapat digunakan sekali. Penerima membuat kata sandinya sendiri; belum ada pengiriman email otomatis.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={event => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
            createInvitation.mutate({ ...data, role: isAdmin ? "bujk_pic" : "participant" });
          }}>
            {isAdmin && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invite-bujk">BUJK</Label>
                <select id="invite-bujk" name="bujkId" required defaultValue="" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="" disabled>Pilih BUJK</option>
                  {organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invite-email">Email penerima</Label>
              <Input id="invite-email" name="email" type="email" required maxLength={254} placeholder="Email ini menjadi username saat masuk" />
            </div>
            {!isAdmin && [
              ["participantName", "Nama lengkap"],
              ["nip", "NIP / nomor anggota"],
              ["position", "Jabatan"],
              ["unit", "Unit kerja"],
            ].map(([name, label]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={`invite-${name}`}>{label}</Label>
                <Input id={`invite-${name}`} name={name} required maxLength={150} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button disabled={createInvitation.isPending || organizations.length === 0}>
                {createInvitation.isPending ? "Membuat..." : "Buat tautan undangan"}
              </Button>
            </div>
          </form>
          {inviteLink && (
            <div className="mt-5 space-y-2 rounded-lg border bg-muted/40 p-4" role="status">
              <p className="text-sm font-medium">Salin sekarang. Tautan rahasia ini tidak ditampilkan lagi setelah halaman dimuat ulang.</p>
              <Input aria-label="Tautan undangan" value={inviteLink} readOnly onFocus={event => event.target.select()} />
              <Button variant="outline" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  toast({ title: "Tautan disalin" });
                } catch {
                  toast({ title: "Pilih dan salin tautan secara manual" });
                }
              }}>Salin tautan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Riwayat undangan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invitations.length === 0 && <p className="text-sm text-muted-foreground">Belum ada undangan.</p>}
          {[...invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(invitation => {
            const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
            return (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.role === "bujk_pic" ? "PIC" : "Peserta"} · {organizations.find(item => item.id === invitation.bujkId)?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{invitation.acceptedAt ? "Digunakan" : expired ? "Tidak aktif" : "Menunggu"}</Badge>
                  {!invitation.acceptedAt && !expired && <Button size="sm" variant="outline" disabled={revokeInvitation.isPending} onClick={() => revokeInvitation.mutate(invitation.id)}>Cabut</Button>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Akun pengguna</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {accountsLoading ? (
              <div className="space-y-3 py-2" aria-label="Memuat daftar akun" aria-busy="true">
                {[1, 2, 3].map(item => <div key={item} className="h-12 animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : accountsError ? (
              <div className="space-y-3 py-2" role="alert">
                <p className="text-sm text-destructive">Daftar akun gagal dimuat.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => refetchAccounts()}>Coba lagi</Button>
              </div>
            ) : accounts.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Belum ada akun pengguna.</p>
            ) : accounts.map(account => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
                <div>
                  <p className="font-medium">{account.username}</p>
                  <p className="text-xs text-muted-foreground">{account.participantName ?? account.bujkName ?? "Pengelola aplikasi"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{account.role === "admin" ? "Admin" : account.role === "bujk_pic" ? "PIC BUJK" : "Peserta"}</Badge>
                  {account.role !== "admin" && (
                    <>
                      <Badge variant={account.isActive ? "outline" : "destructive"} aria-label={`Status akun ${account.username}: ${account.isActive ? "aktif" : "nonaktif"}`}>
                        {account.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updateAccountStatus.isPending}
                        onClick={() => {
                          setStatusChangeReason("");
                          updateAccountStatus.reset();
                          setAccountToUpdate(account);
                        }}
                        aria-label={`${account.isActive ? "Nonaktifkan" : "Aktifkan"} akun ${account.username}`}
                      >
                        {account.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat perubahan status akun</CardTitle>
            <CardDescription>Perubahan terbaru ditampilkan lebih dahulu. Waktu dicatat dalam WIB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? (
              <div className="space-y-3 py-2" aria-label="Memuat riwayat perubahan status" aria-busy="true">
                {[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : historyError ? (
              <div className="space-y-3 py-2" role="alert">
                <p className="text-sm text-destructive">Riwayat perubahan status gagal dimuat.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => refetchHistory()}>Coba lagi</Button>
              </div>
            ) : (statusHistory?.entries.length ?? 0) === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Belum ada riwayat perubahan status akun.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {statusHistory?.entries.map(entry => (
                    <div key={entry.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {entry.actorUsername} <span className="font-normal text-muted-foreground">mengubah status</span> {entry.targetUsername}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            Pelaku: {entry.actorUsername} (ID: {entry.actorId}) · Target: {entry.targetUsername} (ID: {entry.targetUserId})
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.changedAt}>
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Jakarta",
                          }).format(new Date(entry.changedAt))} WIB
                        </time>
                      </div>
                      <p className="mt-2 text-sm">
                        {entry.previousIsActive ? "Aktif" : "Nonaktif"} <span className="text-muted-foreground">→</span> {entry.newIsActive ? "Aktif" : "Nonaktif"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        <span className="font-medium">Alasan: </span>
                        {entry.reason ?? "Belum dicatat — riwayat sebelum alasan diwajibkan."}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan {historyOffset + 1}–{historyOffset + (statusHistory?.entries.length ?? 0)} dari riwayat
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={historyOffset === 0 || historyLoading}
                      onClick={() => setHistoryOffset(offset => Math.max(0, offset - STATUS_HISTORY_PAGE_SIZE))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!statusHistory?.hasMore || historyLoading}
                      onClick={() => setHistoryOffset(offset => offset + STATUS_HISTORY_PAGE_SIZE)}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!accountToUpdate} onOpenChange={open => {
        if (!open && !updateAccountStatus.isPending) {
          setAccountToUpdate(null);
          setStatusChangeReason("");
          updateAccountStatus.reset();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accountToUpdate?.isActive ? "Nonaktifkan akun ini?" : "Aktifkan kembali akun ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accountToUpdate?.isActive
                ? `Akun ${accountToUpdate.username} tidak dapat digunakan untuk masuk. Semua sesi aktif akan dicabut, tetapi riwayat belajar dan data akun tetap tersimpan.`
                : `Akun ${accountToUpdate?.username} akan dapat digunakan kembali untuk masuk ke LMS. Riwayat belajar tetap tersimpan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-status-reason">Alasan perubahan status (wajib)</Label>
            <Textarea
              id="account-status-reason"
              value={statusChangeReason}
              onChange={event => setStatusChangeReason(event.target.value)}
              required
              maxLength={ACCOUNT_STATUS_REASON_MAX_LENGTH}
              rows={3}
              disabled={updateAccountStatus.isPending}
              aria-describedby="account-status-reason-help"
              placeholder="Tuliskan alasan akun diaktifkan atau dinonaktifkan."
            />
            <p id="account-status-reason-help" className="text-xs text-muted-foreground">
              Maksimal {ACCOUNT_STATUS_REASON_MAX_LENGTH} karakter. Alasan tersimpan dalam riwayat admin. Jangan masukkan password atau data rahasia.
            </p>
          </div>
          {updateAccountStatus.isError && (
            <p className="text-sm text-destructive" role="alert">
              Perubahan status gagal. Silakan coba lagi.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateAccountStatus.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateAccountStatus.isPending || !reasonIsValid}
              onClick={event => {
                event.preventDefault();
                if (accountToUpdate && !updateAccountStatus.isPending) {
                  const change = accountStatusChangeSchema.safeParse({ isActive: !accountToUpdate.isActive, reason: statusChangeReason });
                  if (change.success) updateAccountStatus.mutate({ id: accountToUpdate.id, ...change.data });
                }
              }}
            >
              {updateAccountStatus.isPending ? "Menyimpan..." : accountToUpdate?.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
