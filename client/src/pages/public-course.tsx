import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PublicCourse } from "@shared/public-catalog";
import { BrandMark, BRAND_NAME } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, LockKeyhole, RefreshCw, UserRound } from "lucide-react";

type EnrollmentSummary = { id: string; courseId?: string; status?: string };

const formatLabels: Record<PublicCourse["format"], string> = {
  self_paced: "Belajar mandiri",
  upcoming: "Kelas mendatang",
  recording: "Rekaman",
};

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date) + " WIB";
}

export default function PublicCourse() {
  const params = useParams<{ id: string }>();
  const courseId = params.id ?? "";
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const courseQuery = useQuery<PublicCourse>({
    queryKey: ["/api/public/courses", courseId],
    queryFn: async () => (await apiRequest("GET", `/api/public/courses/${encodeURIComponent(courseId)}`)).json(),
    enabled: !!courseId,
    retry: false,
  });
  const enrollmentsQuery = useQuery<EnrollmentSummary[]>({
    queryKey: ["/api/enrollments", user?.participantId],
    queryFn: async () => (await apiRequest("GET", `/api/enrollments?participantId=${encodeURIComponent(user?.participantId ?? "")}`)).json(),
    enabled: !!user?.participantId && user.role === "participant",
    retry: false,
  });
  const isEnrolled = useMemo(() => (enrollmentsQuery.data ?? []).some(item => item.courseId === courseId), [enrollmentsQuery.data, courseId]);
  const enrollMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/catalog/${encodeURIComponent(courseId)}/enroll`, {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] }),
  });

  const course = courseQuery.data;
  const next = `/courses/${encodeURIComponent(courseId)}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const registerHref = `/register?next=${encodeURIComponent(next)}`;
  const canParticipate = user?.role === "participant";

  return (
    <div className="min-h-[100dvh] bg-[#f4f8fc] text-[#142c45] dark:bg-[#081827] dark:text-slate-100">
      <header className="border-b border-slate-200 bg-[#f7fbff] dark:border-slate-700 dark:bg-[#0a1b2b]">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-3"><BrandMark size="md" /><span className="text-sm font-bold">{BRAND_NAME}</span></Link>
          <nav className="flex items-center gap-2"><ThemeToggle />{user ? <Link href="/app" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sky-100 dark:hover:bg-slate-800">Aplikasi</Link> : <><Link href={loginHref} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sky-100 dark:hover:bg-slate-800">Masuk</Link><Link href={registerHref} className="rounded-lg bg-[#123b63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a527f]">Daftar</Link></>}</nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7 sm:py-12">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-100"><ArrowLeft className="h-4 w-4" />Kembali ke katalog</Link>
        {courseQuery.isLoading ? <div className="grid gap-8 lg:grid-cols-[1fr_19rem]"><div className="space-y-4"><div className="h-8 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-16 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-36 animate-pulse rounded-2xl bg-sky-100 dark:bg-slate-800" /></div><div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /></div> : courseQuery.isError || !course ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-2xl font-bold">Kursus tidak dapat ditampilkan</h1><p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">{courseQuery.error instanceof Error ? courseQuery.error.message : "Kursus ini tidak tersedia untuk publik atau alamatnya sudah berubah."}</p>
            <Button variant="outline" className="mt-5" onClick={() => courseQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>
          </section>
        ) : (
          <>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <Badge className="border-0 bg-[#dbeeff] text-[#143958] hover:bg-[#dbeeff] dark:bg-sky-900 dark:text-sky-100">{formatLabels[course.format]}</Badge>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-300">{course.targetLevel || "Pembelajaran konstruksi"}</p>
                <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{course.title}</h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{course.description}</p>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-y border-slate-200 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-sky-700" />{course.lessonCount} bagian pembelajaran</span>
                  <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-sky-700" />{course.duration || "Durasi fleksibel"}</span>
                  {course.instructor && <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-sky-700" />{course.instructor}</span>}
                  {course.format === "upcoming" && course.startsAt && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sky-700" />{dateLabel(course.startsAt)}</span>}
                </div>
                <section className="mt-9">
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-300">Gambaran pembelajaran</p><h2 className="mt-1 text-2xl font-bold">Susunan materi</h2></div><span className="text-sm text-slate-500 dark:text-slate-400">{course.lessons.length} bagian</span></div>
                  <ol className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
                    {course.lessons.map((lesson, index) => <li key={`${index}-${lesson.title}`} className="flex items-center gap-4 px-4 py-4 sm:px-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 font-mono text-xs font-bold text-sky-900 dark:bg-sky-900 dark:text-sky-100">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 text-sm font-semibold">{lesson.title}</span><span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{lesson.type}</span></li>)}
                    {!course.lessons.length && <li className="px-5 py-6 text-sm text-slate-500">Rincian susunan materi belum tersedia.</li>}
                  </ol>
                  <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />Halaman publik hanya menampilkan judul dan tipe bagian. Materi pembelajaran tersedia setelah Anda terdaftar.</p>
                </section>
              </div>
              <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-6">
                <div className="mb-5 rounded-xl bg-[#e8f3fc] p-4 dark:bg-[#132c41]"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-900 dark:text-sky-200">Mulai belajar</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{course.format === "upcoming" ? "Daftarkan minat Anda untuk mengikuti kelas sesuai jadwal." : "Daftar untuk mengakses pembelajaran melalui aplikasi."}</p></div>
                {userLoading ? <div className="h-11 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" /> : !user ? <div className="space-y-3"><Link href={registerHref} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#123b63] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a527f]">Daftar dan lanjutkan <ArrowRight className="h-4 w-4" /></Link><Link href={loginHref} className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Sudah punya akun? Masuk</Link></div> : canParticipate ? (
                    (isEnrolled || enrollMutation.isSuccess) ? <div className="space-y-3"><div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{course.format === "upcoming" ? "Minat Anda tercatat. Informasi kelas selanjutnya mengikuti jadwal dan pemberitahuan resmi." : "Anda sudah terdaftar pada kursus ini."}</span></div>{course.format === "recording" ? <a href={`/api/catalog/${encodeURIComponent(course.id)}/recording`} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#123b63] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a527f]">Buka rekaman <ArrowRight className="h-4 w-4" /></a> : course.format === "self_paced" ? <Link href={`/app?course=${encodeURIComponent(course.id)}`} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#123b63] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a527f]">Buka ruang belajar <ArrowRight className="h-4 w-4" /></Link> : null}</div> :
                    <div className="space-y-3">{enrollmentsQuery.isError && <p role="status" className="text-xs leading-5 text-amber-800 dark:text-amber-200">Status pendaftaran belum dapat diperiksa. Pendaftaran ulang aman dan tidak membuat duplikat.</p>}<Button className="w-full bg-[#123b63] hover:bg-[#1a527f]" disabled={enrollMutation.isPending} onClick={() => enrollMutation.mutate()}>{enrollMutation.isPending ? "Memproses pendaftaran..." : course.format === "upcoming" ? "Daftar minat kelas" : "Daftar kursus"}</Button>{enrollMutation.isError && <p role="alert" className="text-sm text-destructive">{enrollMutation.error instanceof Error ? enrollMutation.error.message : "Pendaftaran belum berhasil. Silakan coba lagi."}</p>}</div>
                ) : <div className="space-y-3"><p className="rounded-lg bg-slate-100 p-3 text-sm leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Akun ini tidak memiliki akses peserta. Gunakan akun peserta atau hubungi admin organisasi.</p><Link href="/app" className="block text-center text-sm font-semibold text-sky-800 dark:text-sky-300">Kembali ke aplikasi</Link></div>}
                <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">Tidak ada biaya atau penilaian yang ditampilkan karena informasi tersebut tidak tersedia di katalog publik.</p>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">PKB ASDAMKINDO · Kompetensi Teknik Konstruksi</footer>
    </div>
  );
}
