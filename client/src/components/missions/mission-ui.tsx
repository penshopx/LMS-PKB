import type { ReactNode } from "react";
import { AlertCircle, Archive, BookOpenCheck, CalendarClock, Clock3, FileText, LockKeyhole } from "lucide-react";
import type { MissionSubmission } from "@shared/practice-missions";

export function MissionStatus({ status }: { status: MissionSubmission["status"] }) {
  const styles = {
    pending_review: "border-amber-300 bg-amber-50 text-amber-800",
    accepted: "border-emerald-300 bg-emerald-50 text-emerald-800",
    repeat_requested: "border-rose-300 bg-rose-50 text-rose-800",
  };
  const labels = {
    pending_review: "Menunggu tinjauan",
    accepted: "Diterima",
    repeat_requested: "Perlu diulang",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

export function MissionNotice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "error" | "success" }) {
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-4 text-sm leading-relaxed ${styles[tone]}`}>
    {tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0" />}
    <div>{children}</div>
  </div>;
}

export function MissionSkeleton() {
  return <div aria-label="Memuat misi" className="space-y-4">
    {[0, 1, 2].map(item => <div key={item} className="animate-pulse rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 h-4 w-28 rounded bg-muted" /><div className="mb-3 h-6 w-2/3 rounded bg-muted" /><div className="h-4 w-full rounded bg-muted" />
      <div className="mt-6 h-10 w-36 rounded-lg bg-muted" />
    </div>)}
  </div>;
}

export function MissionEmpty({ title, description, icon = "book" }: { title: string; description: string; icon?: "book" | "archive" }) {
  const Icon = icon === "archive" ? Archive : FileText;
  return <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
    <h3 className="font-semibold text-foreground">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>;
}

export function MissionRound({ submission, showParticipant = false, showPrivateReflection = true }: { submission: MissionSubmission; showParticipant?: boolean; showPrivateReflection?: boolean }) {
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;
  return <article className="rounded-xl border border-border bg-background p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Putaran {submission.round}</span><MissionStatus status={submission.status} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{showParticipant && <>{submission.participantName} · </>}Dikirim {date(submission.submittedAt)}</p>
      </div>
      {submission.nextPracticeAt && <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"><CalendarClock className="h-3.5 w-3.5" />Latihan berikutnya {date(submission.nextPracticeAt)}</span>}
    </div>
    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{submission.evidenceText}</p>
    {submission.evidenceUrl && <a href={submission.evidenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"><FileText className="h-4 w-4" />Buka tautan bukti</a>}
    {submission.feedback && <div className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.04] p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Umpan balik administrator</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{submission.feedback}</p>
    </div>}
    {showPrivateReflection && submission.privateReflection && <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold">Refleksi pribadi · hanya peserta dan administrator</span><p className="mt-1 whitespace-pre-wrap">{submission.privateReflection}</p></div></div>}
  </article>;
}

export function DurationLabel({ minutes }: { minutes: number }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{minutes} menit</span>;
}
