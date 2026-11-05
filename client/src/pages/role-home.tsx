import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Certificate, ECourse, Enrollment, Participant, Quiz, QuizAttempt } from "@shared/schema";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CoursePlayerDialog } from "@/components/course-player-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PracticeReminders } from "@/components/missions/practice-reminders";

function evidenceLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function AttemptResults({ attempts, quizzes, showAnswers = false }: {
  attempts: QuizAttempt[];
  quizzes: Quiz[];
  showAnswers?: boolean;
}) {
  if (attempts.length === 0) return <p className="text-sm text-muted-foreground">Belum ada hasil kuis.</p>;
  return (
    <div className="space-y-3">
      {[...attempts].sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt)).map(attempt => {
        const quiz = quizzes.find(item => item.id === attempt.quizId);
        const pending = attempt.gradingStatus === "awaiting_review";
        return (
          <div className="rounded-lg border p-4" key={attempt.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{quiz?.title ?? "Kuis"}</p>
              <Badge variant={pending ? "outline" : attempt.passed ? "default" : "secondary"}>
                {pending ? "Menunggu penilaian" : attempt.passed ? "Lulus" : "Belum lulus"}
              </Badge>
            </div>
            {!pending && <p className="mt-2 text-sm">Nilai akhir: {attempt.score}%</p>}
            {attempt.gradingFeedback && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">Feedback: {attempt.gradingFeedback}</p>}
            {!pending && !attempt.passed && <p className="mt-1 text-xs text-muted-foreground">Ulangi seluruh post-test jika percobaan masih tersedia.</p>}
            {showAnswers && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">Rincian jawaban</summary>
                <div className="mt-3 space-y-3">
                  {attempt.answers.map((answer, index) => (
                    <div key={answer.questionId} className="rounded-md bg-muted p-3">
                      <p className="font-medium">{index + 1}. {quiz?.questions.find(question => question.id === answer.questionId)?.text ?? "Pertanyaan"}</p>
                      <p className="mt-1 whitespace-pre-wrap">{Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer || "Tidak dijawab"}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ParticipantHome() {
  const { data: user } = useCurrentUser();
  const [activeCourse, setActiveCourse] = useState<ECourse | null>(null);
  const { data: courses = [], isLoading, isError } = useQuery<ECourse[]>({ queryKey: ["/api/courses?includeArchived=true"] });
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const { data: quizzes = [] } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes?includeArchived=true"] });
  const { data: certificates = [] } = useQuery<Certificate[]>({ queryKey: ["/api/certificates"] });
  const { data: attempts = [] } = useQuery<QuizAttempt[]>({
    queryKey: [`/api/participants/${user?.participantId}/quiz-attempts`],
    enabled: Boolean(user?.participantId),
  });
  const { data: profile } = useQuery<Participant>({
    queryKey: [`/api/participants/${user?.participantId}`],
    enabled: Boolean(user?.participantId),
  });
  const historicCourseIds = new Set([
    ...enrollments.map(item => item.courseId),
    ...(profile?.learningHistory.map(item => item.courseId) ?? []),
  ]);
  const archivedCourses = courses.filter(course => course.archived && historicCourseIds.has(course.id));

  useEffect(() => {
    const courseId = new URLSearchParams(window.location.search).get("course");
    if (!courseId || !enrollments.some(item => item.courseId === courseId)) return;
    const course = courses.find(item => item.id === courseId);
    if (!course) return;
    setActiveCourse(course);
    const url = new URL(window.location.href);
    url.searchParams.delete("course");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [courses, enrollments]);

  if (!user?.participantId) return <p role="alert" className="p-6">Akun belum terhubung dengan data peserta. Hubungi admin.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div><h1 className="text-2xl font-bold">PKB Saya</h1><p className="mt-1 text-muted-foreground">Kembangkan kompetensi teknik melalui pembelajaran dan pencatatan kegiatan. Hasil kursus bukan penetapan Angka Kredit resmi.</p><Button asChild variant="ghost" className="px-0"><Link href="/app/assessment">Baca panduan Permen PUPR No. 12 Tahun 2021</Link></Button></div>
      {isError && <p role="alert" className="text-destructive">Kursus gagal dimuat. Muat ulang halaman untuk mencoba kembali.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Kursus diikuti", enrollments.filter(item => item.courseId).length], ["Selesai", enrollments.filter(item => item.status === "completed").length], ["Sertifikat", certificates.length]].map(([label, value]) => (
          <Card key={label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>
      <section className="space-y-3">
        <PracticeReminders />
        <h2 className="text-xl font-semibold">Katalog pembelajaran</h2>
        {isLoading && <p>Memuat kursus...</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {courses.filter(course => !course.archived).map(course => {
            const enrollment = enrollments.find(item => item.courseId === course.id);
            return (
              <Card key={course.id}>
                <CardHeader><CardTitle className="text-lg">{course.title}</CardTitle><CardDescription>{course.description}</CardDescription></CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{enrollment ? `${enrollment.progress}% selesai` : `${course.lessons.length} lesson`}</span>
                  <Button onClick={() => setActiveCourse(course)}>{enrollment ? "Lanjutkan" : "Mulai belajar"}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      {archivedCourses.length > 0 && <Card><CardHeader><CardTitle>Arsip pembelajaran lama</CardTitle><CardDescription>Riwayat kurikulum BUJK tetap utuh dan tidak dikonversi menjadi kredit PKB.</CardDescription></CardHeader><CardContent className="space-y-3">{archivedCourses.map(course => <div key={course.id} className="rounded-lg border p-3"><p className="font-medium">{course.title}</p><p className="text-sm text-muted-foreground">{enrollments.find(enrollment => enrollment.courseId === course.id)?.progress ?? profile?.learningHistory.find(record => record.courseId === course.id)?.progress ?? 0}% · Arsip</p></div>)}</CardContent></Card>}
      <Card><CardHeader><CardTitle>Hasil penilaian saya</CardTitle></CardHeader><CardContent><AttemptResults attempts={attempts} quizzes={quizzes} /></CardContent></Card>
      {certificates.length > 0 && <Card><CardHeader><CardTitle>Sertifikat saya</CardTitle></CardHeader><CardContent className="space-y-3">{certificates.map(certificate => <div key={certificate.id} className="rounded-lg border p-3"><p className="font-medium">{certificate.title}</p><p className="text-sm text-muted-foreground">{certificate.certificateNumber}</p></div>)}</CardContent></Card>}
      {activeCourse && <CoursePlayerDialog course={activeCourse} open onOpenChange={open => { if (!open) setActiveCourse(null); }} fixedParticipantId={user.participantId} />}
    </div>
  );
}

export function PicHome() {
  const [participantId, setParticipantId] = useState("");
  const { data: participants = [], isLoading, isError } = useQuery<Participant[]>({ queryKey: ["/api/participants"] });
  const { data: courses = [] } = useQuery<ECourse[]>({ queryKey: ["/api/courses?includeArchived=true"] });
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const { data: quizzes = [] } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes?includeArchived=true"] });
  const { data: participant } = useQuery<Participant>({
    queryKey: [`/api/participants/${participantId}`],
    enabled: Boolean(participantId),
  });
  const { data: attempts = [] } = useQuery<QuizAttempt[]>({
    queryKey: [`/api/participants/${participantId}/quiz-attempts`],
    enabled: Boolean(participantId),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Pemantauan Peserta PKB</h1><p className="mt-1 text-muted-foreground">Data hanya dari kelompok yang Anda koordinasikan. Jawaban dan evidensi bersifat baca-saja; refleksi pribadi tidak ditampilkan.</p></div>
        <Button asChild><Link href="/app/access">Undang peserta</Link></Button>
      </div>
      {isError && <p role="alert" className="text-destructive">Data peserta gagal dimuat. Muat ulang halaman untuk mencoba kembali.</p>}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-lg">Peserta ({participants.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p>Memuat peserta...</p>}
            {!isLoading && participants.length === 0 && <p className="text-sm text-muted-foreground">Belum ada peserta. Mulai dengan mengirim undangan.</p>}
            {participants.map(item => <button key={item.id} className={`w-full rounded-lg border p-3 text-left ${participantId === item.id ? "border-primary bg-primary/5" : ""}`} onClick={() => setParticipantId(item.id)}><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.position}</p><p className="mt-1 text-xs">{enrollments.filter(enrollment => enrollment.participantId === item.id).length} pendaftaran belajar</p></button>)}
          </CardContent>
        </Card>
        <div className="space-y-4">
          {!participant && <Card><CardContent className="py-12 text-center text-muted-foreground">Pilih peserta untuk melihat progres, jawaban, dan evidensi.</CardContent></Card>}
          {participant && <>
            <Card><CardHeader><CardTitle>{participant.name}</CardTitle><CardDescription>{participant.email} · {participant.unit}</CardDescription></CardHeader></Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Progres pembelajaran</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {enrollments.filter(item => item.participantId === participant.id).map(enrollment => (
                  <div key={enrollment.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3">
                    <p>{courses.find(course => course.id === enrollment.courseId)?.title ?? "Jalur pembelajaran"}</p>
                    <span className="text-sm font-medium">{enrollment.progress}% · {enrollment.status === "completed" ? "Selesai" : "Berjalan"}</span>
                  </div>
                ))}
                {!enrollments.some(item => item.participantId === participant.id) && <p className="text-sm text-muted-foreground">Belum mengikuti pembelajaran.</p>}
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">Hasil dan jawaban kuis</CardTitle></CardHeader><CardContent><AttemptResults attempts={attempts} quizzes={quizzes} showAnswers /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Evidensi peserta</CardTitle></CardHeader><CardContent className="space-y-3">{participant.evidences.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada evidensi yang dapat dilihat.</p> : participant.evidences.map(evidence => <div key={evidence.id} className="rounded-lg border p-3"><p className="font-medium">{evidence.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{evidence.description}</p><div className="mt-2 flex items-center gap-3"><Badge variant="outline">{evidence.status}</Badge>{evidenceLink(evidence.fileUrl) && <a className="text-sm text-primary underline" href={evidenceLink(evidence.fileUrl)!} target="_blank" rel="noopener noreferrer">Lihat dokumen</a>}</div></div>)}</CardContent></Card>
          </>}
        </div>
      </div>
    </div>
  );
}
