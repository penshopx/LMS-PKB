import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, ClipboardList, Plus, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ECourse } from "@shared/schema";
import type { MissionSubmission, PracticeMission } from "@shared/practice-missions";
import { MissionCreateDialog, MissionReviewDialog, MissionSubmitDialog } from "@/components/missions/mission-forms";
import { PracticeReminders, PRACTICE_REMINDERS_KEY } from "@/components/missions/practice-reminders";
import { DurationLabel, MissionEmpty, MissionNotice, MissionRound, MissionSkeleton, MissionStatus } from "@/components/missions/mission-ui";

const MISSIONS_KEY = ["/api/practice-missions"];
const SUBMISSIONS_KEY = ["/api/practice-missions/submissions"];
const COURSES_KEY = ["/api/courses"];
type CourseOption = Pick<ECourse, "id" | "title">;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Terjadi kendala. Silakan coba lagi.";
}

function makeSubmissionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const random = Math.random() * 16 | 0;
    return (character === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-7 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p></div>{action}
  </header>;
}

function MissionCard({ mission, role, latest, onSubmit, onArchive, onReview, pendingReview }: {
  mission: PracticeMission;
  role: "admin" | "participant" | "bujk_pic";
  latest?: MissionSubmission;
  pendingReview: boolean;
  onSubmit?: () => void;
  onArchive?: () => void;
  onReview?: () => void;
}) {
  return <article className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${!mission.active ? "opacity-80" : ""}`}>
    <div className="border-l-4 border-l-primary p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><DurationLabel minutes={mission.durationMinutes} />{mission.courseTitle && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{mission.courseTitle}</span>}{role === "admin" && !mission.active && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Diarsipkan</span>}</div>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">{mission.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mission.objective}</p>
      <div className="mt-5 rounded-xl bg-muted/45 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skenario kerja</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{mission.scenario}</p></div>
      {mission.sourceText && <details className="mt-4 rounded-lg border border-border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Konteks sumber SOP</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{mission.sourceText}</p></details>}
      <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Langkah praktik</p><ol className="mt-2 grid gap-2 sm:grid-cols-2">{mission.checklist.map((item, index) => <li key={`${index}-${item}`} className="flex gap-2.5 rounded-lg bg-background p-3 text-sm leading-relaxed"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{index + 1}</span><span>{item}</span></li>)}</ol></div>
      {latest && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3.5"><div className="flex flex-wrap items-center gap-2"><MissionStatus status={latest.status} /><span className="text-xs text-muted-foreground">Putaran {latest.round}</span></div>{latest.nextPracticeAt && <span className="text-xs font-medium text-amber-800">Latihan berikutnya {new Date(latest.nextPracticeAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>}</div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {role === "participant" && mission.active && latest?.status !== "pending_review" && <button onClick={onSubmit} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><span>{latest ? "Mulai putaran berikutnya" : "Mulai misi"}</span><ArrowRight className="h-4 w-4" /></button>}
        {role === "participant" && latest?.status === "pending_review" && <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"><ShieldCheck className="h-4 w-4" />Tunggu tinjauan sebelum mengulang</span>}
        {role === "admin" && <><button onClick={onArchive} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"><Archive className="h-4 w-4" />{mission.active ? "Arsipkan" : "Aktifkan kembali"}</button>{pendingReview && <button onClick={onReview} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><ClipboardList className="h-4 w-4" />Tinjau bukti</button>}</>}
      </div>
    </div>
  </article>;
}

export default function PracticeMissions() {
  const { data: user } = useCurrentUser();
  const { toast } = useToast();
  const role = user?.role === "admin" || user?.role === "bujk_pic" ? user.role : "participant";
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<PracticeMission | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<MissionSubmission | null>(null);
  const [submissionKeys, setSubmissionKeys] = useState<Record<string, string>>({});
  const missionsQuery = useQuery<PracticeMission[]>({ queryKey: MISSIONS_KEY });
  const submissionsQuery = useQuery<MissionSubmission[]>({ queryKey: SUBMISSIONS_KEY });
  const coursesQuery = useQuery<CourseOption[]>({ queryKey: COURSES_KEY, enabled: role === "admin", staleTime: 5 * 60_000 });
  const missions = missionsQuery.data ?? [];
  const submissions = submissionsQuery.data ?? [];
  const sortedSubs = useMemo(() => [...submissions].sort((a, b) => b.round - a.round || new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()), [submissions]);
  const latestByMission = useMemo(() => {
    const map = new Map<string, MissionSubmission>();
    sortedSubs.forEach(submission => { if (!map.has(submission.missionId)) map.set(submission.missionId, submission); });
    return map;
  }, [sortedSubs]);
  const pendingByMission = useMemo(() => {
    const map = new Map<string, MissionSubmission>();
    sortedSubs.filter(submission => submission.status === "pending_review").forEach(submission => { if (!map.has(submission.missionId)) map.set(submission.missionId, submission); });
    return map;
  }, [sortedSubs]);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: MISSIONS_KEY }),
    queryClient.invalidateQueries({ queryKey: SUBMISSIONS_KEY }),
    queryClient.invalidateQueries({ queryKey: PRACTICE_REMINDERS_KEY }),
  ]);

  const createMutation = useMutation({
    mutationFn: async (payload: { courseId: string; title: string; objective: string; scenario: string; sourceText: string; durationMinutes: number; checklist: string[] }) => (await apiRequest("POST", "/api/practice-missions", payload)).json(),
    onSuccess: async () => { await invalidate(); setCreateOpen(false); toast({ title: "Misi praktik diterbitkan" }); },
  });
  const archiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => (await apiRequest("PATCH", `/api/practice-missions/${id}`, { active })).json(),
    onSuccess: async (_, variables) => { await invalidate(); toast({ title: variables.active ? "Misi diaktifkan kembali" : "Misi diarsipkan" }); },
  });
  const submitMutation = useMutation({
    mutationFn: async ({ mission, data, submissionKey }: { mission: PracticeMission; submissionKey: string; data: { completedChecklist: string[]; evidenceText: string; evidenceUrl: string; privateReflection: string } }) =>
      (await apiRequest("POST", `/api/practice-missions/${mission.id}/submissions`, { ...data, submissionKey })).json(),
    onSuccess: async (_, variables) => {
      await invalidate();
      setSubmissionKeys(current => { const next = { ...current }; delete next[variables.mission.id]; return next; });
      setSelectedMission(null);
      toast({ title: "Bukti praktik terkirim", description: "Anda dapat melihat status dan umpan balik di riwayat misi." });
    },
  });
  const reviewMutation = useMutation({
    mutationFn: async ({ submission, review }: { submission: MissionSubmission; review: { status: "accepted" | "repeat_requested"; feedback: string; nextPracticeAt: string | null } }) =>
      (await apiRequest("POST", `/api/practice-missions/submissions/${submission.id}/review`, review)).json(),
    onSuccess: async () => { await invalidate(); setSelectedSubmission(null); toast({ title: "Tinjauan tersimpan" }); },
  });

  const pageError = missionsQuery.error || submissionsQuery.error;
  const loading = missionsQuery.isLoading || submissionsQuery.isLoading;
  const reviewQueue = sortedSubs.filter(submission => submission.status === "pending_review");
  const visibleMissions = role === "participant" ? missions.filter(mission => mission.active) : missions;
  const ownHistory = sortedSubs;
  const pendingById = pendingByMission;

  return <div className="min-h-[100dvh] bg-background">
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
      <PageHeader eyebrow="Praktik kerja · 5–15 menit" title="Misi praktik" description={role === "admin" ? "Bangun latihan singkat berbasis skenario, lalu tinjau bukti praktik dan beri arahan." : role === "bujk_pic" ? "Pantau praktik kerja peserta di tim BUJK Anda. Data yang tampil hanya untuk tim Anda." : "Latih satu keterampilan kerja, kirim bukti, lalu terapkan umpan balik pada putaran berikutnya."}
        action={role === "admin" ? <button onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"><Plus className="h-4 w-4" />Buat misi</button> : undefined} />

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Satu keterampilan</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Fokus pada tindakan kerja yang spesifik dan terukur.</p></div></div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><ClipboardList className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Bukti dan umpan balik</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Dokumentasikan praktik; administrator memberi arahan.</p></div></div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><RotateCcw className="h-4 w-4" /></div><div><p className="text-sm font-semibold">Latihan berulang</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Lihat jadwal pengulangan setelah tinjauan.</p></div></div>
      </div>
      <MissionNotice><strong>Praktik pendamping, bukan sertifikasi kompetensi atau syarat kelulusan tambahan.</strong> Misi tidak menandai pelajaran selesai, mengubah kuota kuis, atau menerbitkan sertifikat.</MissionNotice>

      {role === "participant" && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Bukti dan refleksi dikirim untuk ditinjau administrator. Refleksi pribadi hanya terlihat oleh Anda dan administrator, bukan PIC BUJK.</p>}
      {role === "participant" && <div className="mt-6"><PracticeReminders /></div>}
      {role === "bujk_pic" && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Tampilan PIC bersifat baca-saja. Refleksi pribadi peserta tidak ditampilkan di sini.</p>}
      {role === "admin" && <div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Misi tersedia" value={missions.filter(item => item.active).length} /><Metric label="Perlu tinjauan" value={reviewQueue.length} /><Metric label="Bukti masuk" value={submissions.length} /></div>}

      {pageError && <div className="mt-6"><MissionNotice tone="error"><div><p className="font-semibold">Data misi belum dapat dimuat.</p><p className="mt-1">{errorMessage(pageError)}</p><button onClick={() => { missionsQuery.refetch(); submissionsQuery.refetch(); }} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"><RotateCcw className="h-3.5 w-3.5" />Coba lagi</button></div></MissionNotice></div>}
      {archiveMutation.error && <div className="mt-4"><MissionNotice tone="error">Perubahan status misi gagal disimpan: {errorMessage(archiveMutation.error)}</MissionNotice></div>}
      {loading && !pageError && <div className="mt-6"><MissionSkeleton /></div>}

      {!loading && !pageError && role === "admin" && <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Tinjauan</p><h2 className="mt-1 text-xl font-semibold">Bukti menunggu</h2></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{reviewQueue.length} antrean</span></div>
        {reviewQueue.length === 0 ? <MissionEmpty title="Semua bukti sudah ditinjau" description="Bukti praktik baru akan muncul di sini setelah peserta mengirimkan putaran." /> : <div className="grid gap-3">{reviewQueue.map(submission => <div key={submission.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{submission.participantName} · Putaran {submission.round}</p><h3 className="mt-1 font-semibold">{submission.missionTitle}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{submission.evidenceText}</p></div><button onClick={() => setSelectedSubmission(submission)} className="min-h-10 shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Buka tinjauan</button></div>)}</div>}
      </section>}

      {!loading && !pageError && <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{role === "bujk_pic" ? "Pemantauan tim" : role === "admin" ? "Katalog" : "Untuk Anda"}</p><h2 className="mt-1 text-xl font-semibold">{role === "admin" ? "Semua misi" : role === "bujk_pic" ? "Misi tim BUJK" : "Misi yang dapat dikerjakan"}</h2></div>{role === "admin" && <span className="text-xs text-muted-foreground">{missions.length} misi</span>}</div>
        {visibleMissions.length === 0 ? <MissionEmpty title={role === "participant" ? "Belum ada misi untuk Anda" : "Belum ada misi praktik"} description={role === "participant" ? "Misi aktif akan tersedia setelah Anda terdaftar pada kursus terkait. Buka halaman Pembelajaran Saya untuk melihat kursus dan status pendaftaran." : "Buat misi pertama berbasis kursus, skenario kerja, dan konteks sumber SOP."} /> :
          <div className="grid gap-4">{visibleMissions.map(mission => <MissionCard key={mission.id} mission={mission} role={role} latest={role === "participant" ? latestByMission.get(mission.id) : undefined} pendingReview={pendingById.has(mission.id)} onSubmit={() => {
            setSubmissionKeys(current => current[mission.id] ? current : { ...current, [mission.id]: makeSubmissionKey() });
            setSelectedMission(mission);
          }} onArchive={() => archiveMutation.mutate({ id: mission.id, active: !mission.active })} onReview={() => {
            const submission = pendingById.get(mission.id);
            if (submission) setSelectedSubmission(submission);
          }} />)}</div>}
      </section>}

      {!loading && !pageError && role !== "admin" && <section className="mt-10">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{role === "participant" ? "Riwayat pribadi" : "Aktivitas peserta"}</p><h2 className="mt-1 text-xl font-semibold">Riwayat putaran</h2></div>
        {ownHistory.length === 0 ? <MissionEmpty title="Belum ada pengiriman bukti" description={role === "participant" ? "Setelah menyelesaikan misi dan mengirim bukti, status serta umpan balik akan tercatat di sini." : "Riwayat bukti praktik peserta BUJK Anda akan muncul di sini."} /> : <div className="space-y-3">{ownHistory.map(submission => <details key={submission.id} className="group rounded-xl border border-border bg-card p-4 sm:p-5"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{submission.missionTitle}</h3><p className="mt-1 text-xs text-muted-foreground">{role === "bujk_pic" ? `${submission.participantName} · ` : ""}Putaran {submission.round} · {new Date(submission.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p></div><MissionStatus status={submission.status} /></summary><div className="mt-4 border-t border-border pt-4"><MissionRound submission={submission} showParticipant={role === "bujk_pic"} showPrivateReflection={role === "participant"} /></div></details>)}</div>}
      </section>}

      {role === "admin" && coursesQuery.error && <div className="mt-4"><MissionNotice tone="error">Daftar kursus gagal dimuat: {errorMessage(coursesQuery.error)} <button onClick={() => coursesQuery.refetch()} className="ml-1 font-semibold underline">Coba lagi</button></MissionNotice></div>}
      {role === "admin" && missions.length > 0 && <p className="mt-8 text-xs text-muted-foreground">Misi yang diarsipkan tidak lagi muncul untuk peserta. Tinjauan yang sudah disimpan bersifat final dan tidak dapat ditimpa.</p>}
    </div>
    {createOpen && <MissionCreateDialog courses={(coursesQuery.data ?? []) as CourseOption[]} pending={createMutation.isPending} error={createMutation.error ? errorMessage(createMutation.error) : ""} onClose={() => setCreateOpen(false)} onSubmit={payload => createMutation.mutate(payload)} />}
    {selectedMission && <MissionSubmitDialog mission={selectedMission} pending={submitMutation.isPending} error={submitMutation.error ? errorMessage(submitMutation.error) : ""} onClose={() => setSelectedMission(null)} onSubmit={data => {
      const key = submissionKeys[selectedMission.id] ?? makeSubmissionKey();
      if (!submissionKeys[selectedMission.id]) setSubmissionKeys(current => ({ ...current, [selectedMission.id]: key }));
      submitMutation.mutate({ mission: selectedMission, data, submissionKey: key });
    }} />}
    {selectedSubmission && <MissionReviewDialog submission={selectedSubmission} pending={reviewMutation.isPending} error={reviewMutation.error ? errorMessage(reviewMutation.error) : ""} onClose={() => setSelectedSubmission(null)} onSubmit={review => reviewMutation.mutate({ submission: selectedSubmission, review })} />}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p></div>;
}
