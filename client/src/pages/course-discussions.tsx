import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, MessageSquareText, Send, ShieldCheck, ThumbsUp, UsersRound } from "lucide-react";
import type { DiscussionThread, DiscussionView } from "@shared/discussions";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { DiscussionReportDialog } from "@/components/discussion-report-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Link, useSearch } from "wouter";

type ModerationTarget =
  | { kind: "thread"; id: string; hidden: boolean; label: string }
  | { kind: "reply"; id: string; hidden: boolean; label: string };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function LoadingDiscussion() {
  return (
    <div className="mx-auto min-h-[70dvh] max-w-5xl space-y-6 p-4 sm:p-6" role="status" aria-label="Memuat diskusi" aria-busy="true">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-4">
        {[0, 1].map(item => <div key={item} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    </div>
  );
}

export default function CourseDiscussions({ courseId }: { courseId: string }) {
  const search = useSearch();
  const endpoint = `/api/courses/${encodeURIComponent(courseId)}/discussions`;
  const queryKey = useMemo(() => [endpoint, search], [endpoint, search]);
  const discussionQuery = useQuery<DiscussionView>({
    queryKey,
    // Route search belongs in cache identity, not in the REST path. Reuse the
    // session-epoch and abort protections of the normal authenticated query.
    queryFn: context => getQueryFn<DiscussionView>({ on401: "throw" })({ ...context, queryKey: [endpoint] }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const view = discussionQuery.data;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<{ threadId: string; replyId?: string; label: string } | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [formError, setFormError] = useState("");
  const requestedThread = new URLSearchParams(search).get("thread");

  useEffect(() => {
    if (discussionQuery.isFetching) setReportTarget(null);
  }, [discussionQuery.isFetching]);

  useEffect(() => {
    if (view) return;
    setTitle("");
    setBody("");
    setReplyDrafts({});
    setModerationTarget(null);
    setReportTarget(null);
    setModerationReason("");
    setFormError("");
  }, [view]);

  useEffect(() => {
    if (!view || !requestedThread) return;
    const target = document.getElementById(`thread-${requestedThread}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }, [view, requestedThread]);

  const refreshDiscussion = () => {
    void queryClient.invalidateQueries({ queryKey: [endpoint] });
    void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };
  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/courses/${encodeURIComponent(courseId)}/discussions`, { title, body }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setFormError("");
      refreshDiscussion();
    },
  });
  const replyMutation = useMutation({
    mutationFn: ({ threadId, replyBody }: { threadId: string; replyBody: string }) =>
      apiRequest("POST", `/api/discussions/${encodeURIComponent(threadId)}/replies`, { body: replyBody }),
    onSuccess: (_result, variables) => {
      setReplyDrafts(current => ({ ...current, [variables.threadId]: "" }));
      refreshDiscussion();
    },
  });
  const moderationMutation = useMutation({
    mutationFn: ({ target, reason }: { target: ModerationTarget; reason: string }) => {
      const path = target.kind === "thread"
        ? `/api/discussions/${encodeURIComponent(target.id)}/moderation`
        : `/api/discussion-replies/${encodeURIComponent(target.id)}/moderation`;
      return apiRequest("PATCH", path, { hidden: target.hidden, reason });
    },
    onSuccess: () => {
      setModerationTarget(null);
      setModerationReason("");
      setFormError("");
      refreshDiscussion();
    },
  });
  const helpfulMutation = useMutation({
    mutationFn: ({ replyId, helpful }: { replyId: string; helpful: boolean }) =>
      apiRequest("PATCH", `/api/discussion-replies/${encodeURIComponent(replyId)}/helpful`, { helpful }),
    onSuccess: refreshDiscussion,
  });

  // Previously authorized content is not evidence of current group membership.
  // Never expose cached discussion bodies while permission is being rechecked.
  if (discussionQuery.isLoading || discussionQuery.isFetching) return <LoadingDiscussion />;

  if (discussionQuery.isError || !view) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive"><MessageSquareText className="h-7 w-7" /></div>
        <h1 className="text-xl font-semibold">Diskusi belum dapat dimuat</h1>
        <p role="alert" className="max-w-md text-sm text-muted-foreground">
          {discussionQuery.error?.message || "Periksa koneksi atau akses kursus Anda, lalu coba lagi."}
        </p>
        <Button onClick={() => discussionQuery.refetch()} disabled={discussionQuery.isFetching}>
          {discussionQuery.isFetching ? "Memeriksa..." : "Coba lagi"}
        </Button>
      </div>
    );
  }

  const submitQuestion = () => {
    if (title.trim().length < 5 || body.trim().length < 10) {
      setFormError("Judul minimal 5 karakter dan pertanyaan minimal 10 karakter.");
      return;
    }
    setFormError("");
    createMutation.mutate();
  };
  const submitReply = (thread: DiscussionThread) => {
    const replyBody = replyDrafts[thread.id]?.trim() ?? "";
    if (!replyBody) return;
    replyMutation.mutate({ threadId: thread.id, replyBody });
  };
  const submitModeration = () => {
    if (!moderationTarget) return;
    if (moderationReason.trim().length < 5) {
      setFormError("Alasan moderasi minimal 5 karakter.");
      return;
    }
    setFormError("");
    moderationMutation.mutate({ target: moderationTarget, reason: moderationReason.trim() });
  };
  const focusThread = (thread: DiscussionThread) => requestedThread === thread.id;

  return (
    <div className="mx-auto min-h-[70dvh] max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke beranda
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-primary/[0.045] p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-primary/[0.06]" />
        <div className="relative max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/25 bg-background/70">Ruang belajar kelompok</Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UsersRound className="h-3.5 w-3.5" />{view.scopeLabel}</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Diskusi teknis kursus</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">{view.courseTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Ajukan persoalan lapangan dan diskusikan pendekatan teknis. Pertanyaan mandiri hanya terlihat oleh pengirim dan admin; diskusi kelompok hanya untuk kelompok terkait dan admin.
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <span>{view.threads.length} topik dalam ruang ini</span>
            {view.isAdmin && <Badge variant="secondary" className="ml-1 gap-1"><ShieldCheck className="h-3 w-3" />Admin</Badge>}
          </div>
          {(view.canPost || view.isAdmin) && (
            <Link href="/app/discussion-reports" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <Flag className="h-4 w-4" aria-hidden="true" />
              {view.isAdmin ? "Tinjau laporan diskusi" : "Lihat laporan saya"}
            </Link>
          )}
        </div>
      </header>

      {requestedThread && !view.threads.some(thread => thread.id === requestedThread) && (
        <p role="status" className="rounded-xl border bg-muted p-4 text-sm">
          Topik pada tautan tidak tersedia atau tidak termasuk dalam akses Anda.
        </p>
      )}

      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ajukan pertanyaan teknis</CardTitle>
          <CardDescription>
            Khusus peserta terdaftar. Jangan membagikan refleksi pribadi, jawaban atau hasil kuis, maupun data proyek rahasia. Diskusi tidak mengubah kelulusan kursus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!view.canPost ? (
            <div className="rounded-xl border border-dashed bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
              Akun Anda belum memiliki akses untuk membuat topik. Peserta terdaftar dapat mengajukan pertanyaan; koordinator kelompok dapat membaca diskusi.
            </div>
          ) : (
            <>
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Judul singkat, misalnya: Pemeriksaan mutu sambungan baja"
                aria-label="Judul pertanyaan"
                maxLength={160}
              />
              <Textarea
                value={body}
                onChange={event => setBody(event.target.value)}
                placeholder="Jelaskan konteks teknis, kondisi lapangan, dan hal yang ingin didiskusikan..."
                aria-label="Isi pertanyaan teknis"
                className="min-h-28 resize-y"
                maxLength={5000}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Judul 5–160 karakter · Isi 10–5.000 karakter</p>
                <Button onClick={submitQuestion} disabled={createMutation.isPending || !title.trim() || !body.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? "Mengirim..." : "Terbitkan pertanyaan"}
                </Button>
              </div>
              {createMutation.isError && <p role="alert" className="text-sm text-destructive">Pertanyaan gagal dikirim. Periksa kembali akses dan koneksi Anda.</p>}
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="thread-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ruang kerja bersama</p>
            <h2 id="thread-heading" className="mt-1 text-xl font-semibold">Topik diskusi</h2>
          </div>
          <span className="text-sm text-muted-foreground">{view.threads.length} topik</span>
        </div>

        {view.threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquareText className="h-6 w-6" /></div>
            <h3 className="mt-4 font-semibold">Belum ada topik diskusi</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Mulai dengan pertanyaan spesifik dari materi atau praktik pekerjaan konstruksi Anda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {view.threads.map(thread => (
              <article
                key={thread.id}
                id={`thread-${thread.id}`}
                tabIndex={-1}
                className={`scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm transition-colors sm:p-6 ${focusThread(thread) ? "border-primary/45 ring-2 ring-primary/10" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {thread.hidden && <Badge variant="destructive">Disembunyikan</Badge>}
                      <span className="text-xs text-muted-foreground">{thread.scopeLabel || view.scopeLabel}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold leading-snug">{thread.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{thread.authorName} · {formatDate(thread.createdAt)}</p>
                  </div>
                  {view.isAdmin && (
                    <Button
                      variant={thread.hidden ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setFormError("");
                        setModerationReason("");
                        setModerationTarget({ kind: "thread", id: thread.id, hidden: !thread.hidden, label: thread.title });
                      }}
                      aria-label={thread.hidden ? "Pulihkan pertanyaan" : "Sembunyikan pertanyaan"}
                    >
                      {thread.hidden ? "Pulihkan" : "Moderasi"}
                    </Button>
                  )}
                  {view.canPost && !thread.hidden && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportTarget({ threadId: thread.id, label: thread.title })}
                      aria-label={`Laporkan pertanyaan: ${thread.title}`}
                    >
                      <Flag className="mr-2 h-3.5 w-3.5" />Laporkan
                    </Button>
                  )}
                </div>
                {thread.hidden && thread.moderationReason && (
                  <p className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                    Catatan moderasi: {thread.moderationReason}
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{thread.body}</p>

                <div className="mt-5 border-t pt-4">
                  <h4 className="text-sm font-semibold">Tanggapan <span className="font-normal text-muted-foreground">({thread.replies.length})</span></h4>
                  {thread.replies.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {thread.replies.map(reply => (
                        <div key={reply.id} className={`rounded-xl border p-3 sm:p-4 ${reply.helpful ? "border-primary/25 bg-primary/[0.035]" : "bg-muted/20"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{reply.authorName}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(reply.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {reply.hidden && <Badge variant="outline">Tanggapan disembunyikan</Badge>}
                              {reply.helpful && <Badge variant="secondary" className="gap-1"><ThumbsUp className="h-3 w-3" />Membantu</Badge>}
                              {view.isAdmin && (
                                <>
                                  <Button
                                    variant={reply.helpful ? "secondary" : "ghost"}
                                    size="sm"
                                    aria-pressed={reply.helpful}
                                    aria-label={reply.helpful ? "Batalkan penanda membantu" : "Tandai sebagai membantu"}
                                    disabled={helpfulMutation.isPending}
                                    onClick={() => helpfulMutation.mutate({ replyId: reply.id, helpful: !reply.helpful })}
                                  >
                                    <ThumbsUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setFormError("");
                                      setModerationReason("");
                                      setModerationTarget({ kind: "reply", id: reply.id, hidden: !reply.hidden, label: "tanggapan" });
                                    }}
                                  >
                                    {reply.hidden ? "Pulihkan" : "Moderasi"}
                                  </Button>
                                </>
                              )}
                              {view.canPost && !thread.hidden && !reply.hidden && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReportTarget({ threadId: thread.id, replyId: reply.id, label: `${thread.title} — tanggapan` })}
                                  aria-label={`Laporkan tanggapan dari ${reply.authorName}`}
                                >
                                  <Flag className="mr-1.5 h-3.5 w-3.5" />Laporkan
                                </Button>
                              )}
                            </div>
                          </div>
                          {reply.hidden && reply.moderationReason && (
                            <p className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                              Catatan moderasi: {reply.moderationReason}
                            </p>
                          )}
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {helpfulMutation.isError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">Status tanggapan gagal diperbarui. Coba kembali.</p>
                  )}

                  {thread.hidden ? (
                    <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Tanggapan baru tidak dapat ditambahkan pada topik yang disembunyikan.</p>
                  ) : (view.canPost || view.isAdmin) ? (
                    <div className="mt-4 space-y-2">
                      <Textarea
                        value={replyDrafts[thread.id] ?? ""}
                        onChange={event => setReplyDrafts(current => ({ ...current, [thread.id]: event.target.value }))}
                        placeholder="Tambahkan tanggapan teknis..."
                        aria-label={`Tanggapan untuk ${thread.title}`}
                        className="min-h-20 resize-y"
                        maxLength={5000}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        {replyMutation.isError && <p role="alert" className="text-sm text-destructive">Tanggapan gagal dikirim. Coba lagi.</p>}
                        <span className="text-xs text-muted-foreground">Tanggapan harus relevan dan menghormati rekan.</span>
                        <Button
                          size="sm"
                          onClick={() => submitReply(thread)}
                          disabled={replyMutation.isPending || !(replyDrafts[thread.id] ?? "").trim()}
                        >
                          <Send className="mr-2 h-4 w-4" />{replyMutation.isPending ? "Mengirim..." : "Kirim tanggapan"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Akses tanggapan tersedia bagi peserta terdaftar dalam kelompok ini.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(moderationTarget)} onOpenChange={open => {
        if (!open && !moderationMutation.isPending) {
          setModerationTarget(null);
          setModerationReason("");
          setFormError("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderationTarget?.hidden ? "Sembunyikan konten" : "Pulihkan konten"}</DialogTitle>
            <DialogDescription>
              {moderationTarget?.hidden
                ? `Berikan alasan yang jelas sebelum menyembunyikan ${moderationTarget?.kind === "thread" ? "pertanyaan" : "tanggapan"} ini.`
                : `Berikan alasan pemulihan untuk ${moderationTarget?.kind === "thread" ? "pertanyaan" : "tanggapan"} ini.`}
              {" "}Alasan ini terlihat oleh pembaca diskusi. Jangan sertakan data pribadi atau kutipan konten rahasia.
            </DialogDescription>
          </DialogHeader>
          {moderationTarget?.label && <p className="line-clamp-2 rounded-lg bg-muted p-3 text-sm">{moderationTarget.label}</p>}
          <Textarea
            value={moderationReason}
            onChange={event => setModerationReason(event.target.value)}
            placeholder="Alasan moderasi (minimal 5 karakter)"
            aria-label="Alasan moderasi"
            maxLength={300}
            className="min-h-24"
          />
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          {moderationMutation.isError && <p role="alert" className="text-sm text-destructive">Perubahan moderasi gagal disimpan. Coba kembali.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerationTarget(null)} disabled={moderationMutation.isPending}>Batal</Button>
            <Button onClick={submitModeration} disabled={moderationMutation.isPending || moderationReason.trim().length < 5}>
              {moderationMutation.isPending ? "Menyimpan..." : "Simpan moderasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {view.canPost && (
        <DiscussionReportDialog
          target={reportTarget}
          onOpenChange={open => { if (!open) setReportTarget(null); }}
        />
      )}
    </div>
  );
}
