import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, BookOpenCheck, CalendarDays, ChevronRight, Clock3, Plus, Search } from "lucide-react";
import type { LearningProgramView, LearningProgramMember, LearningStatus } from "@shared/learning-program";
import { LEARNING_STATUS_LABELS, learningDay } from "@shared/learning-program";
import type { ECourse, Participant } from "@shared/schema";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiRequest, getSessionEpoch, queryClient } from "@/lib/queryClient";
import { CoursePlayerDialog } from "@/components/course-player-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Bujk = { id: string; name: string };
type FormState = { id?: string; title: string; description: string; courseId: string; dueDate: string };
type PendingAction = { type: "cancel" | "remind"; program: LearningProgramView } | null;

const EMPTY_FORM: FormState = { title: "", description: "", courseId: "", dueDate: "" };
const statusStyles: Record<LearningStatus, string> = {
  not_started: "border-slate-300 bg-slate-100 text-slate-700",
  in_progress: "border-sky-200 bg-sky-100 text-sky-800",
  due_soon: "border-amber-200 bg-amber-100 text-amber-900",
  overdue: "border-rose-200 bg-rose-100 text-rose-800",
  completed: "border-teal-200 bg-teal-100 text-teal-800",
  canceled: "border-slate-300 bg-slate-200 text-slate-600",
};

function readableDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Permintaan gagal. Silakan coba kembali.";
}

function ProgramFormDialog({ open, onOpenChange, initial, courses, admin, participants, groups, onSave, pending, error }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FormState;
  courses: ECourse[];
  admin: boolean;
  participants: Participant[];
  groups: Bujk[];
  onSave: (form: FormState, participantIds: string[], groupIds: string[]) => void;
  pending: boolean;
  error: string;
}) {
  const [form, setForm] = useState(initial);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  useEffect(() => {
    if (open) { setForm(initial); setParticipantIds([]); setGroupIds([]); setRosterSearch(""); }
  }, [open, initial]);
  const matchedParticipants = participants.filter(person =>
    `${person.name} ${person.unit}`.toLowerCase().includes(rosterSearch.toLowerCase()),
  );
  const toggle = (values: string[], value: string, setter: (next: string[]) => void) =>
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  const isEdit = Boolean(initial.id);
  const canSubmit = form.title.trim().length >= 3 && Boolean(form.courseId || isEdit) && Boolean(form.dueDate) &&
    (isEdit || !admin || participantIds.length + groupIds.length > 0);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Ubah target belajar" : admin ? "Buat program belajar" : "Target belajar pribadi"}</DialogTitle>
        <DialogDescription>{admin ? "Satu program terhubung ke satu kursus. Peserta memulai kursus melalui alur belajar biasa." : "Susun sasaran kursus untuk diri sendiri. Target pribadi hanya terlihat oleh Anda."}</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="program-title">Judul target</Label><Input id="program-title" maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Contoh: Memahami inspeksi struktur beton" /></div>
        <div className="space-y-2"><Label htmlFor="program-description">Catatan / deskripsi</Label><Textarea id="program-description" maxLength={2000} rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Apa yang ingin dicapai dari kursus ini?" /></div>
        {!isEdit && <div className="space-y-2"><Label htmlFor="program-course">Kursus aktif</Label><Select value={form.courseId} onValueChange={courseId => setForm({ ...form, courseId })}><SelectTrigger id="program-course"><SelectValue placeholder="Pilih satu kursus" /></SelectTrigger><SelectContent>{courses.map(course => <SelectItem value={course.id} key={course.id}>{course.title}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-2"><Label htmlFor="program-deadline">Batas waktu</Label><Input id="program-deadline" type="date" min={!isEdit ? learningDay() : undefined} value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /><p className="text-xs text-muted-foreground">Tanggal mengikuti WIB (Asia/Jakarta). Target belajar tidak mengubah aturan sertifikasi, kelulusan, atau kredit resmi PKB.</p></div>
        {admin && !isEdit && <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
          <div><h3 className="font-semibold text-slate-900">Penerima program</h3><p className="text-sm text-slate-600">Pilih peserta dan/atau kelompok. Pilihan digabung tanpa duplikasi.</p></div>
          <div className="space-y-2"><Label>Kelompok PKB</Label><div className="grid gap-2 sm:grid-cols-2">{groups.map(group => <label key={group.id} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background p-2.5 text-sm"><Checkbox checked={groupIds.includes(group.id)} onCheckedChange={() => toggle(groupIds, group.id, setGroupIds)} />{group.name}</label>)}</div>{groups.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kelompok yang dapat dipilih.</p>}</div>
          <div className="space-y-2"><Label htmlFor="target-search">Peserta tertentu</Label><Input id="target-search" value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} placeholder="Cari nama atau unit" /><div className="max-h-48 space-y-1 overflow-auto rounded-lg border bg-background p-2">{matchedParticipants.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={participantIds.includes(person.id)} onCheckedChange={() => toggle(participantIds, person.id, setParticipantIds)} /><span className="min-w-0 flex-1 truncate">{person.name}</span><span className="truncate text-xs text-muted-foreground">{person.unit}</span></label>)}{matchedParticipants.length === 0 && <p className="p-2 text-sm text-muted-foreground">Tidak ada peserta yang cocok.</p>}</div><p className="text-xs text-muted-foreground">{participantIds.length + groupIds.length} pilihan · maksimal 500 target</p></div>
        </section>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kembali</Button><Button disabled={!canSubmit || pending} onClick={() => onSave(form, participantIds, groupIds)}>{pending ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Buat target"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ProgramStatus({ status }: { status: LearningStatus }) {
  return <Badge variant="outline" className={`whitespace-nowrap ${statusStyles[status]}`}>{LEARNING_STATUS_LABELS[status]}</Badge>;
}

function ProgressBar({ progress }: { progress: number }) {
  const bounded = Math.min(100, Math.max(0, progress || 0));
  return <div className="h-2 overflow-hidden rounded-full bg-sky-100" role="progressbar" aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${bounded}%`}><div className="h-full rounded-full bg-sky-600 transition-[width] duration-500" style={{ width: `${bounded}%` }} /></div>;
}

export default function LearningProgramsPage() {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const isParticipant = user?.role === "participant";
  const isPic = user?.role === "bujk_pic";
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<FormState>(EMPTY_FORM);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [activeCourse, setActiveCourse] = useState<ECourse | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [actionError, setActionError] = useState("");
  const programsQuery = useQuery<LearningProgramView[]>({
    queryKey: ["/api/learning-programs"],
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });
  const coursesQuery = useQuery<ECourse[]>({ queryKey: ["/api/courses"], enabled: Boolean(user) });
  const participantsQuery = useQuery<Participant[]>({ queryKey: ["/api/participants"], enabled: Boolean(isAdmin) });
  const groupsQuery = useQuery<Bujk[]>({ queryKey: ["/api/access/bujks"], enabled: Boolean(isAdmin) });
  const programs = programsQuery.data ?? [];
  const courses = (coursesQuery.data ?? []).filter(course => !course.archived);
  const members = useMemo(() => programs.filter(program => !program.canceledAt).flatMap(program => program.members), [programs]);
  const activePrograms = programs.filter(program => !program.canceledAt && program.members.some(member => member.status !== "completed"));
  const completedCount = members.filter(member => member.status === "completed").length;
  const attentionCount = members.filter(member => member.status === "overdue" || member.status === "due_soon").length;
  const overallProgress = members.length ? Math.round(members.reduce((sum, member) => sum + member.progress, 0) / members.length) : 0;
  const visiblePrograms = programs.filter(program => {
    const haystack = `${program.title} ${program.courseTitle} ${program.description} ${program.members.map(member => member.participantName).join(" ")}`.toLowerCase();
    const statusMatch = statusFilter === "all" || programStatus(program, user?.participantId ?? undefined) === statusFilter ||
      program.members.some(member => member.status === statusFilter);
    return haystack.includes(search.toLowerCase()) && statusMatch && (sourceFilter === "all" || program.source === sourceFilter);
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/learning-programs"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    ]);
  };
  const saveMutation = useMutation({
    mutationFn: async ({ form, participantIds, groupIds }: { form: FormState; participantIds: string[]; groupIds: string[] }) => {
      const epoch = getSessionEpoch();
      const body: Record<string, unknown> = { title: form.title.trim(), description: form.description.trim(), dueDate: form.dueDate };
      let response: Response;
      if (form.id) {
        response = await apiRequest("PATCH", `/api/learning-programs/${encodeURIComponent(form.id)}`, body);
      } else {
        body.courseId = form.courseId;
        if (isAdmin) { body.participantIds = participantIds; body.groupIds = groupIds; }
        response = await apiRequest("POST", "/api/learning-programs", body);
      }
      const result = await response.json();
      if (getSessionEpoch() !== epoch) throw new Error("Sesi akun telah berubah. Hasil tindakan tidak diterapkan.");
      return result;
    },
    onSuccess: async () => { setActionError(""); setFormOpen(false); await invalidate(); },
    onError: error => setActionError(messageFrom(error)),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ type, program }: { type: "cancel" | "remind"; program: LearningProgramView }) => {
      const epoch = getSessionEpoch();
      const response = await apiRequest("POST", `/api/learning-programs/${encodeURIComponent(program.id)}/${type}`);
      const result = await response.json();
      if (getSessionEpoch() !== epoch) throw new Error("Sesi akun telah berubah. Hasil tindakan tidak diterapkan.");
      return { type, result };
    },
    onSuccess: async ({ type, result }) => {
      setActionError("");
      if (type === "remind") setActionError(result.sent
        ? `Pengingat dalam aplikasi dikirim kepada ${result.sent} akun peserta yang belum selesai.`
        : "Tidak ada pengingat baru: pengingat hari ini sudah ada, atau tidak ada akun aktif yang perlu diingatkan.");
      setPendingAction(null);
      await invalidate();
    },
    onError: error => { setPendingAction(null); setActionError(messageFrom(error)); },
  });

  function openCreate() {
    setActionError("");
    saveMutation.reset();
    setFormInitial({ ...EMPTY_FORM, dueDate: "" });
    setFormOpen(true);
  }
  function openEdit(program: LearningProgramView) {
    setActionError("");
    saveMutation.reset();
    setFormInitial({ id: program.id, title: program.title, description: program.description, courseId: program.courseId, dueDate: program.dueDate });
    setFormOpen(true);
  }
  function save(form: FormState, participantIds: string[], groupIds: string[]) {
    setActionError("");
    saveMutation.mutate({ form, participantIds, groupIds });
  }
  function confirmPending() {
    if (pendingAction) actionMutation.mutate(pendingAction);
  }

  return <div className="min-h-[100dvh] bg-[#edf5fa]">
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-2xl bg-[#102b46] px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-sky-300/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-sky-200"><BookOpenCheck className="h-4 w-4" /> Ruang belajar PKB</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{isPic ? "Pantau target kelompok Anda" : isAdmin ? "Program belajar peserta" : "Rencana belajar saya"}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sky-100/90">{isPic ? "Lihat kemajuan program belajar peserta dalam kelompok yang Anda koordinasikan." : isAdmin ? "Tetapkan sasaran kursus yang jelas, lalu ikuti progresnya dari satu tempat." : "Ubah kursus menjadi sasaran yang realistis—dan lanjutkan belajar tepat dari titik terakhir."}</p>
          </div>
          {(isAdmin || isParticipant) && <Button onClick={openCreate} className="bg-sky-200 text-[#102b46] hover:bg-sky-100"><Plus className="mr-2 h-4 w-4" />{isAdmin ? "Buat program" : "Tambah target pribadi"}</Button>}
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs text-sky-100"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Batas waktu menggunakan WIB</span><span>Target belajar tidak mengubah aturan sertifikasi, kelulusan, atau kredit resmi PKB.</span></div>
      </header>

      {actionError && <div role={saveMutation.isError || actionMutation.isError ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${saveMutation.isError || actionMutation.isError ? "border-rose-200 bg-rose-50 text-rose-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1">{actionError}</div><button type="button" onClick={() => setActionError("")} className="text-xs underline">Tutup</button></div>}

      {programsQuery.isLoading && <div aria-label="Memuat program belajar" className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-sky-100" /><div className="h-48 animate-pulse rounded-xl bg-sky-100" /></div>}
      {programsQuery.isError && <Card className="border-rose-200 bg-rose-50"><CardContent className="flex flex-col items-start gap-3 py-8 sm:flex-row sm:items-center"><AlertCircle className="h-5 w-5 text-rose-700" /><div className="flex-1"><h2 className="font-semibold">Program belajar belum dapat dimuat</h2><p className="mt-1 text-sm text-rose-800">{messageFrom(programsQuery.error)}</p></div><Button variant="outline" onClick={() => programsQuery.refetch()} disabled={programsQuery.isFetching}>Coba lagi</Button></CardContent></Card>}

      {!programsQuery.isLoading && !programsQuery.isError && <>
        <section aria-label="Ringkasan kemajuan" className="grid gap-3 sm:grid-cols-3">
          <Summary label={isPic ? "Program aktif" : "Target aktif"} value={activePrograms.length} note={isPic ? "dalam lingkup kelompok" : "sedang berjalan"} tone="blue" />
          <Summary label="Perlu perhatian" value={attentionCount} note="terlambat atau segera jatuh tempo" tone="amber" />
          <Summary label={isParticipant ? "Progres belajar" : "Selesai"} value={isParticipant ? `${overallProgress}%` : completedCount} note={isParticipant ? "rata-rata target saya" : `${overallProgress}% progres rata-rata`} tone="teal" />
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-lg font-bold text-[#142e47]">Daftar target</h2><p className="text-sm text-slate-600">Progres diperbarui otomatis dan saat halaman kembali dibuka.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Cari target" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari target, kursus, peserta…" className="pl-9" /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="Filter status" className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{Object.entries(LEARNING_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
              {isParticipant && <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger aria-label="Filter jenis target" className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua jenis</SelectItem><SelectItem value="assigned">Program ditugaskan</SelectItem><SelectItem value="personal">Target pribadi</SelectItem></SelectContent></Select>}
            </div>
          </div>
          {visiblePrograms.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-800"><BookOpenCheck className="h-5 w-5" /></div><h3 className="mt-4 font-semibold text-slate-900">{programs.length ? "Tidak ada target yang cocok" : "Belum ada rencana belajar"}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{programs.length ? "Coba ubah kata pencarian atau filter yang dipilih." : isParticipant ? "Pilih satu kursus aktif dan tetapkan kapan Anda ingin menyelesaikannya." : isAdmin ? "Buat program pertama untuk memberi peserta arah belajar yang terukur." : "Program belajar kelompok akan muncul di sini setelah ditetapkan."}</p>{programs.length === 0 && (isParticipant || isAdmin) && <Button className="mt-5" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{isAdmin ? "Buat program" : "Buat target pribadi"}</Button>}</div>
            : <div className="divide-y divide-slate-100">{visiblePrograms.map(program => <ProgramRow key={program.id} program={program} role={user?.role ?? "participant"} participantId={user?.participantId ?? undefined} courses={courses} onEdit={openEdit} onCancel={item => setPendingAction({ type: "cancel", program: item })} onRemind={item => setPendingAction({ type: "remind", program: item })} onStart={setActiveCourse} />)}</div>}
        </section>
      </>}

        {(participantsQuery.isError || groupsQuery.isError || coursesQuery.isError) && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {isAdmin ? "Pilihan penerima atau kursus belum lengkap." : "Kursus aktif belum dapat dimuat, jadi Anda belum dapat membuka atau membuat target."}{" "}
          <button className="font-semibold underline" onClick={() => { void coursesQuery.refetch(); if (isAdmin) { void participantsQuery.refetch(); void groupsQuery.refetch(); } }}>Muat ulang pilihan</button>
        </div>}
    </div>
    <ProgramFormDialog open={formOpen} onOpenChange={setFormOpen} initial={formInitial} courses={courses} admin={Boolean(isAdmin)} participants={participantsQuery.data ?? []} groups={groupsQuery.data ?? []} onSave={save} pending={saveMutation.isPending} error={saveMutation.isError ? actionError : ""} />
    <Dialog open={Boolean(pendingAction)} onOpenChange={open => !open && setPendingAction(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>{pendingAction?.type === "cancel" ? "Batalkan target ini?" : "Kirim pengingat belajar?"}</DialogTitle><DialogDescription>{pendingAction?.type === "cancel" ? "Hanya target belajar yang dibatalkan. Riwayat belajar, pendaftaran kursus, progres, dan sertifikat tetap tersimpan." : "Pengingat berupa notifikasi di dalam aplikasi, bukan email. Maksimal satu pengingat per akun per hari (WIB). Peserta yang selesai dan akun tidak aktif tidak diberi notifikasi."}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setPendingAction(null)}>Kembali</Button><Button variant={pendingAction?.type === "cancel" ? "destructive" : "default"} onClick={confirmPending} disabled={actionMutation.isPending}>{actionMutation.isPending ? "Memproses…" : pendingAction?.type === "cancel" ? "Batalkan target" : "Kirim pengingat"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {activeCourse && <CoursePlayerDialog course={activeCourse} open onOpenChange={open => {
      if (!open) { setActiveCourse(null); void invalidate(); }
    }} fixedParticipantId={user?.participantId ?? undefined} />}
  </div>;
}

function Summary({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: "blue" | "amber" | "teal" }) {
  const color = tone === "blue" ? "bg-sky-100 text-sky-900" : tone === "amber" ? "bg-amber-100 text-amber-950" : "bg-teal-100 text-teal-900";
  return <Card className="border-sky-100 bg-white shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-[#142e47]">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div><span className={`rounded-xl px-3 py-2 text-xs font-bold ${color}`}>{tone === "amber" ? "Periksa" : tone === "teal" ? "Progres" : "PKB"}</span></CardContent></Card>;
}

function programStatus(program: LearningProgramView, participantId?: string): LearningStatus {
  const ownMember = program.members.find(member => member.participantId === participantId);
  if (program.canceledAt) return "canceled";
  if (ownMember) return ownMember.status;
  const priority: LearningStatus[] = ["overdue", "due_soon", "in_progress", "not_started", "completed", "canceled"];
  return priority.find(status => program.members.some(member => member.status === status)) ?? "not_started";
}

function ProgramRow({ program, role, participantId, courses, onEdit, onCancel, onRemind, onStart }: {
  program: LearningProgramView;
  role: string;
  participantId?: string;
  courses: ECourse[];
  onEdit: (program: LearningProgramView) => void;
  onCancel: (program: LearningProgramView) => void;
  onRemind: (program: LearningProgramView) => void;
  onStart: (course: ECourse) => void;
}) {
  const status = programStatus(program, participantId);
  const isEditable = !program.canceledAt && role === "participant" && program.source === "personal";
  const isAdminAssigned = role === "admin" && program.source === "assigned" && !program.canceledAt;
  const course = courses.find(item => item.id === program.courseId);
  const courseUnavailable = program.courseArchived || !course;
  const programMembers: LearningProgramMember[] = program.members;
  const avg = programMembers.length ? Math.round(programMembers.reduce((sum, item) => sum + item.progress, 0) / programMembers.length) : 0;
  return <article className="px-4 py-5 transition-colors hover:bg-sky-50/40 sm:px-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><ProgramStatus status={status} /><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900">{program.source === "personal" ? "Pribadi" : "Ditugaskan"}</Badge></div>
        <h3 className="mt-2 truncate text-base font-bold text-[#142e47]">{program.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><BookOpenCheck className="h-4 w-4 shrink-0 text-sky-700" /><span className="truncate">{program.courseTitle}</span>{courseUnavailable && <span className="text-xs text-slate-500">(kursus tidak aktif)</span>}</p>
        {program.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{program.description}</p>}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Batas {readableDate(program.dueDate)} WIB</p>
      </div>
      <div className="w-full lg:w-60">
        {programMembers.length > 1 && <p className="mb-1 flex justify-between text-xs text-slate-600"><span>{programMembers.length} peserta</span><span>{avg}% rata-rata</span></p>}
        {programMembers.length === 1 && <p className="mb-1 flex justify-between text-xs text-slate-600"><span>{programMembers[0].participantName}</span><span>{programMembers[0].progress}%</span></p>}
        <ProgressBar progress={programMembers.length > 1 ? avg : programMembers[0]?.progress ?? 0} />
        {programMembers.length > 1 && <p className="mt-1.5 text-xs text-slate-500">{programMembers.filter(member => member.status === "completed").length} selesai · {programMembers.filter(member => member.status === "overdue" || member.status === "due_soon").length} perlu perhatian</p>}
        {programMembers.length === 1 && <p className="mt-1.5 text-xs text-slate-500">Akses terakhir: {programMembers[0].lastAccessedAt ? new Date(programMembers[0].lastAccessedAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "Belum mulai"}</p>}
        {programMembers.length > 1 && <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-sky-800">Lihat peserta dan status</summary>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
            {programMembers.map(member => <div key={member.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{member.participantName}<span className="text-slate-400"> · {member.unit}</span></span><span className="shrink-0">{member.progress}% · {LEARNING_STATUS_LABELS[member.status]}</span></div>)}
          </div>
        </details>}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {role === "participant" && program.source === "assigned" && !program.canceledAt && <Button size="sm" onClick={() => course && !courseUnavailable && onStart(course)} disabled={!course || courseUnavailable}><ChevronRight className="mr-1 h-4 w-4" />Lanjutkan</Button>}
        {role === "participant" && program.source === "personal" && !program.canceledAt && <Button size="sm" onClick={() => course && !courseUnavailable && onStart(course)} disabled={!course || courseUnavailable}><ChevronRight className="mr-1 h-4 w-4" />{status === "not_started" ? "Mulai belajar" : "Lanjutkan"}</Button>}
        {isEditable && <><Button size="sm" variant="outline" onClick={() => onEdit(program)}>Ubah</Button><Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => onCancel(program)}>Batalkan</Button></>}
        {isAdminAssigned && <><Button size="sm" variant="outline" onClick={() => onEdit(program)}>Ubah</Button><Button size="sm" variant="outline" onClick={() => onRemind(program)}><Bell className="mr-1 h-4 w-4" />Ingatkan</Button><Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => onCancel(program)}>Batalkan</Button></>}
      </div>
    </div>
  </article>;
}
