import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ExternalLink, Flag, ShieldCheck } from "lucide-react";
import type { DiscussionReport } from "@shared/discussions";
import { reportStatusLabels } from "@shared/discussions";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";

type ReportStatus = "all" | "open" | "reviewing" | "resolved" | "dismissed";
type ReportsResponse = { reports: DiscussionReport[]; hasMore: boolean; isAdmin: boolean };
const statuses: ReportStatus[] = ["all", "open", "reviewing", "resolved", "dismissed"];

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Waktu tidak tersedia" : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ReportSkeleton() {
  return <div className="space-y-4" aria-label="Memuat laporan" aria-busy="true" role="status">
    {[0, 1, 2].map(item => <div key={item} className="h-44 animate-pulse rounded-2xl border bg-muted/60" />)}
  </div>;
}

function ReportCard({ report, isAdmin, onUpdated }: { report: DiscussionReport; isAdmin: boolean; onUpdated: () => void }) {
  const [nextStatus, setNextStatus] = useState<Exclude<ReportStatus, "all">>(
    report.status === "open" ? "reviewing" : report.status,
  );
  const [adminNote, setAdminNote] = useState(report.adminNote ?? "");
  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/discussion-reports/${encodeURIComponent(report.id)}`, {
      status: nextStatus,
      adminNote: adminNote.trim(),
    }),
    onSuccess: onUpdated,
  });
  const needsNote = nextStatus === "resolved" || nextStatus === "dismissed";

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="gap-3 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={report.status === "resolved" ? "secondary" : report.status === "dismissed" ? "outline" : "default"}>
              {reportStatusLabels[report.status]}
            </Badge>
            {isAdmin && report.reporterName && <span className="text-sm text-muted-foreground">Dilaporkan oleh {report.reporterName}</span>}
          </div>
          <CardTitle className="mt-2 text-base">
            {isAdmin ? (report.threadTitle || "Topik diskusi") : "Laporan diskusi"}
          </CardTitle>
          <CardDescription className="mt-1">Dikirim {dateLabel(report.createdAt)} · Diperbarui {dateLabel(report.updatedAt)}</CardDescription>
        </div>
        {isAdmin && report.courseId && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/app/discussions/${encodeURIComponent(report.courseId)}?thread=${encodeURIComponent(report.threadId)}`}>
              Buka diskusi <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alasan laporan · privat</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{report.reason}</p>
        </div>
        {isAdmin && report.targetBody && (
          <div className={`rounded-xl border p-3 ${report.targetHidden ? "border-destructive/20 bg-destructive/[0.035]" : "bg-muted/35"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Konten yang dilaporkan{report.replyId ? " · tanggapan" : " · pertanyaan"}{report.targetHidden ? " · disembunyikan" : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{report.targetBody}</p>
          </div>
        )}
        {report.adminNote && (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isAdmin ? "Catatan admin" : "Pembaruan dari admin"}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{report.adminNote}</p>
          </div>
        )}
        {!isAdmin && (
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Riwayat ini hanya terlihat oleh Anda dan admin. Konten diskusi tidak ditampilkan pada riwayat peserta.
          </p>
        )}
        {isAdmin && (
          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)]">
              <label className="space-y-1.5 text-sm font-medium">
                Status laporan
                <select
                  value={nextStatus}
                  onChange={event => setNextStatus(event.target.value as Exclude<ReportStatus, "all">)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  aria-label={`Status laporan ${report.id}`}
                >
                  {statuses.filter(status => status !== "all").map(status => <option key={status} value={status}>{reportStatusLabels[status]}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Catatan admin {needsNote ? <span className="text-destructive">(wajib, minimal 5 karakter)</span> : <span className="text-muted-foreground">(opsional)</span>}
                <Textarea
                  value={adminNote}
                  onChange={event => setAdminNote(event.target.value)}
                  maxLength={1000}
                  aria-label={`Catatan admin laporan ${report.id}`}
                  placeholder="Catatan untuk pelapor (maksimal 1.000 karakter)"
                  className="min-h-20 resize-y"
                />
                <span className="block text-right text-xs font-normal text-muted-foreground">{adminNote.length}/1.000</span>
              </label>
            </div>
            {updateMutation.isError && <p role="alert" className="text-sm text-destructive">{updateMutation.error instanceof Error ? updateMutation.error.message : "Perubahan gagal disimpan."}</p>}
            {updateMutation.isSuccess && <p role="status" className="text-sm text-primary">Perubahan laporan berhasil disimpan.</p>}
            <div className="flex justify-end">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || (needsNote && adminNote.trim().length < 5) || adminNote.length > 1000}
              >
                {updateMutation.isPending ? "Menyimpan..." : "Simpan peninjauan"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DiscussionReportsPage() {
  const [status, setStatus] = useState<ReportStatus>("all");
  const [page, setPage] = useState(1);
  const endpoint = `/api/discussion-reports?status=${status}&page=${page}`;
  const queryKey = useMemo(() => [endpoint], [endpoint]);
  const reportsQuery = useQuery<ReportsResponse>({
    queryKey,
    queryFn: getQueryFn<ReportsResponse>({ on401: "throw" }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const response = reportsQuery.data;
  const isAdmin = response?.isAdmin ?? false;
  const refreshReports = () => {
    void queryClient.invalidateQueries({
      predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/discussion-reports?"),
    });
  };

  if (reportsQuery.isLoading || reportsQuery.isFetching) {
    return <main className="mx-auto min-h-[70dvh] max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"><ReportSkeleton /></main>;
  }
  if (reportsQuery.isError || !response) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive"><AlertTriangle className="h-7 w-7" /></div>
        <h1 className="text-xl font-semibold">Laporan belum dapat dimuat</h1>
        <p role="alert" className="max-w-md text-sm text-muted-foreground">{reportsQuery.error instanceof Error ? reportsQuery.error.message : "Periksa koneksi dan akses Anda, lalu coba kembali."}</p>
        <Button onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>Coba lagi</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[70dvh] max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke beranda
      </Link>
      <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-primary/[0.045] p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[26px] border-primary/[0.06]" />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            {isAdmin ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Flag className="h-4 w-4 text-primary" />}
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{isAdmin ? "Ruang peninjauan privat" : "Riwayat laporan privat"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{isAdmin ? "Laporan diskusi" : "Laporan saya"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isAdmin
              ? "Tinjau laporan peserta dengan cermat. Alasan laporan bersifat privat; tindakan moderasi pada konten tetap dilakukan melalui kontrol diskusi."
              : "Laporan hanya dapat dibaca oleh Anda dan admin. Anda dapat melihat status serta catatan peninjauan tanpa menampilkan ulang konten diskusi."}
          </p>
        </div>
      </header>
      {isAdmin && (
        <section aria-label="Filter status laporan" className="flex flex-wrap gap-2">
          {statuses.map(item => (
            <Button key={item} variant={status === item ? "default" : "outline"} size="sm" onClick={() => { setStatus(item); setPage(1); }}>
              {item === "all" ? "Semua status" : reportStatusLabels[item]}
            </Button>
          ))}
        </section>
      )}
      {response.reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Flag className="h-6 w-6" /></div>
          <h2 className="mt-4 font-semibold">{isAdmin ? "Belum ada laporan pada filter ini" : "Belum ada laporan"}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{isAdmin ? "Laporan baru akan tampil di sini untuk ditinjau secara privat." : "Konten diskusi yang terlihat dapat dilaporkan melalui tombol Laporkan."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {response.reports.map(report => <ReportCard key={report.id} report={report} isAdmin={isAdmin} onUpdated={refreshReports} />)}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>Sebelumnya</Button>
        <span className="text-sm text-muted-foreground">Halaman {page} · maksimal 30 laporan</span>
        <Button variant="outline" onClick={() => setPage(current => current + 1)} disabled={!response.hasMore}>Berikutnya</Button>
      </div>
    </main>
  );
}
