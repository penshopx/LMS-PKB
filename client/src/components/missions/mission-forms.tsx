import { useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ECourse } from "@shared/schema";
import type { MissionSubmission, PracticeMission } from "@shared/practice-missions";

type MissionPayload = { courseId: string; title: string; objective: string; scenario: string; sourceText: string; durationMinutes: number; checklist: string[] };
type CourseOption = Pick<ECourse, "id" | "title">;

function ModalFrame({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent aria-describedby={undefined} className={`z-[100] max-h-[92dvh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-2xl p-0 ${wide ? "max-w-2xl" : "max-w-xl"}`}>
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
        <DialogTitle className="pr-8 text-base font-semibold tracking-tight">{title}</DialogTitle>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </DialogContent>
  </Dialog>;
}

const fieldClass = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30";
const labelClass = "text-sm font-medium text-foreground";

export function MissionCreateDialog({ courses, pending, error, onClose, onSubmit }: { courses: CourseOption[]; pending: boolean; error: string; onClose: () => void; onSubmit: (payload: MissionPayload) => void }) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [scenario, setScenario] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [durationMinutes, setDuration] = useState(10);
  const [checklist, setChecklist] = useState<string[]>([""]);
  const addChecklist = () => setChecklist(items => [...items, ""]);
  const updateChecklist = (index: number, value: string) => setChecklist(items => items.map((item, i) => i === index ? value : item));
  const removeChecklist = (index: number) => setChecklist(items => items.filter((_, i) => i !== index));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ courseId, title: title.trim(), objective: objective.trim(), scenario: scenario.trim(), sourceText: sourceText.trim(), durationMinutes, checklist: checklist.map(item => item.trim()).filter(Boolean) });
  };
  return <ModalFrame title="Buat misi praktik" onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">Rancang satu praktik kerja yang dapat dituntaskan dalam 5–15 menit. Sertakan konteks SOP agar peserta tahu standar yang dirujuk. Misi tersedia bagi semua peserta kursus terkait; jangan memasukkan dokumen atau informasi rahasia BUJK.</p>
      <div><label className={labelClass} htmlFor="mission-course">Kursus</label><select id="mission-course" required value={courseId} onChange={e => setCourseId(e.target.value)} className={fieldClass}><option value="">Pilih kursus</option>{courses.map(course => <option key={course.id} value={String(course.id)}>{course.title}</option>)}</select></div>
      <div><label className={labelClass} htmlFor="mission-title">Judul misi</label><input id="mission-title" required minLength={5} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} placeholder="Contoh: Pemeriksaan APD sebelum kerja di ketinggian" /></div>
      <div><label className={labelClass} htmlFor="mission-objective">Keterampilan yang dilatih</label><textarea id="mission-objective" required minLength={15} maxLength={1200} rows={2} value={objective} onChange={e => setObjective(e.target.value)} className={fieldClass} /></div>
      <div><label className={labelClass} htmlFor="mission-scenario">Skenario di tempat kerja</label><textarea id="mission-scenario" required minLength={30} maxLength={6000} rows={4} value={scenario} onChange={e => setScenario(e.target.value)} className={fieldClass} placeholder="Berikan situasi spesifik yang perlu dihadapi peserta." /></div>
      <div><label className={labelClass} htmlFor="mission-source">Konteks sumber SOP <span className="font-normal text-muted-foreground">(opsional)</span></label><textarea id="mission-source" maxLength={12000} rows={3} value={sourceText} onChange={e => setSourceText(e.target.value)} className={fieldClass} placeholder="Kutip bagian SOP atau tuliskan referensi dokumen." /></div>
      <div><label className={labelClass} htmlFor="mission-duration">Durasi praktik</label><select id="mission-duration" value={durationMinutes} onChange={e => setDuration(Number(e.target.value))} className={fieldClass}>{Array.from({ length: 11 }, (_, i) => i + 5).map(value => <option key={value} value={value}>{value} menit</option>)}</select></div>
      <fieldset><legend className={labelClass}>Daftar periksa <span className="font-normal text-muted-foreground">(semua wajib diselesaikan)</span></legend>
        <div className="mt-2 space-y-2">{checklist.map((item, index) => <div className="flex gap-2" key={index}><label className="sr-only" htmlFor={`mission-check-${index}`}>Langkah {index + 1}</label><input id={`mission-check-${index}`} required minLength={3} maxLength={300} value={item} onChange={e => updateChecklist(index, e.target.value)} className={fieldClass.replace("mt-1.5 ", "")} placeholder={`Langkah ${index + 1}`} />{checklist.length > 1 && <button type="button" onClick={() => removeChecklist(index)} aria-label={`Hapus langkah ${index + 1}`} className="rounded-lg px-3 text-muted-foreground hover:bg-muted">×</button>}</div>)}</div>
        {checklist.length < 12 && <button type="button" onClick={addChecklist} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" />Tambah langkah</button>}
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted">Batal</button><button type="submit" disabled={pending || courses.length === 0} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Menyimpan…" : "Terbitkan misi"}</button></div>
    </form>
  </ModalFrame>;
}

export function MissionSubmitDialog({ mission, pending, error, onClose, onSubmit }: { mission: PracticeMission; pending: boolean; error: string; onClose: () => void; onSubmit: (data: { completedChecklist: string[]; evidenceText: string; evidenceUrl: string; privateReflection: string }) => void }) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [privateReflection, setPrivateReflection] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ completedChecklist: completed, evidenceText: evidenceText.trim(), evidenceUrl: evidenceUrl.trim(), privateReflection: privateReflection.trim() }); };
  return <ModalFrame title="Kirim bukti praktik" onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl bg-primary/[0.05] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Misi praktik</p><h3 className="mt-1 font-semibold">{mission.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mission.objective}</p></div>
      <fieldset><legend className={labelClass}>Konfirmasi setiap langkah</legend><div className="mt-2 space-y-2">{mission.checklist.map((item, index) => <label key={item} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed hover:bg-muted/50"><input type="checkbox" checked={completed.includes(item)} onChange={e => setCompleted(current => e.target.checked ? [...current, item] : current.filter(value => value !== item))} className="mt-0.5 h-4 w-4 accent-primary" /><span>{item}</span></label>)}</div></fieldset>
      <div><label className={labelClass} htmlFor="mission-evidence">Bukti praktik <span className="font-normal text-muted-foreground">(minimal 30 karakter)</span></label><textarea id="mission-evidence" required minLength={30} maxLength={6000} rows={5} value={evidenceText} onChange={e => setEvidenceText(e.target.value)} className={fieldClass} placeholder="Jelaskan apa yang Anda lakukan dan hasilnya." /><p className="mt-1 text-right text-xs text-muted-foreground">{evidenceText.length}/6000</p></div>
      <div><label className={labelClass} htmlFor="mission-url">Tautan bukti HTTPS <span className="font-normal text-muted-foreground">(opsional)</span></label><input id="mission-url" type="url" pattern="https://.*" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className={fieldClass} placeholder="https://…" /><p className="mt-1 text-xs text-muted-foreground">Tautkan dokumen atau foto yang dapat diakses oleh administrator.</p></div>
      <div><label className={labelClass} htmlFor="mission-reflection">Refleksi pribadi <span className="font-normal text-muted-foreground">(opsional)</span></label><textarea id="mission-reflection" maxLength={6000} rows={3} value={privateReflection} onChange={e => setPrivateReflection(e.target.value)} className={fieldClass} placeholder="Catatan ini hanya terlihat oleh Anda dan administrator, bukan PIC BUJK." /></div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted">Batal</button><button type="submit" disabled={pending || completed.length !== mission.checklist.length || evidenceText.trim().length < 30} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Mengirim…" : "Kirim untuk ditinjau"}</button></div>
    </form>
  </ModalFrame>;
}

export function MissionReviewDialog({ submission, pending, error, onClose, onSubmit }: { submission: MissionSubmission; pending: boolean; error: string; onClose: () => void; onSubmit: (review: { status: "accepted" | "repeat_requested"; feedback: string; nextPracticeAt: string | null }) => void }) {
  const [status, setStatus] = useState<"accepted" | "repeat_requested">("accepted");
  const [feedback, setFeedback] = useState("");
  const [nextPracticeAt, setNextPracticeAt] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit({ status, feedback: feedback.trim(), nextPracticeAt: status === "repeat_requested" ? nextPracticeAt : null }); };
  return <ModalFrame title="Tinjau bukti praktik" onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Peserta · {submission.participantName}</p><h3 className="mt-1 text-lg font-semibold">{submission.missionTitle}</h3><p className="mt-1 text-sm text-muted-foreground">Putaran {submission.round}</p></div>
      <div className="rounded-xl border border-border bg-muted/30 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bukti peserta</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{submission.evidenceText}</p>{submission.evidenceUrl && <a className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4" href={submission.evidenceUrl} target="_blank" rel="noreferrer">Buka tautan bukti</a>}</div>
      {submission.privateReflection && <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"><p className="font-semibold">Refleksi pribadi peserta</p><p className="mt-1 whitespace-pre-wrap">{submission.privateReflection}</p></div>}
      <div><label className={labelClass} htmlFor="review-status">Keputusan</label><select id="review-status" value={status} onChange={e => setStatus(e.target.value as typeof status)} className={fieldClass}><option value="accepted">Terima praktik</option><option value="repeat_requested">Minta praktik diulang</option></select></div>
      {status === "repeat_requested" && <div><label className={labelClass} htmlFor="review-date">Tanggal praktik ulang</label><input id="review-date" type="date" required value={nextPracticeAt} onChange={e => setNextPracticeAt(e.target.value)} className={fieldClass} /></div>}
      <div><label className={labelClass} htmlFor="review-feedback">Umpan balik <span className="font-normal text-muted-foreground">(minimal 10 karakter)</span></label><textarea id="review-feedback" required minLength={10} maxLength={6000} rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} className={fieldClass} placeholder="Berikan masukan yang jelas dan dapat diterapkan." /></div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-muted">Batal</button><button type="submit" disabled={pending || feedback.trim().length < 10 || (status === "repeat_requested" && !nextPracticeAt)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Menyimpan…" : "Simpan tinjauan"}</button></div>
    </form>
  </ModalFrame>;
}
