import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  FileText,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import type { Activity, ECourse, Participant } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CourseLearningState {
  enrollment: {
    id: string;
    progress: number;
    status: string;
    completedLessonIds: string[];
  } | null;
  completion: {
    progress: number;
    lessonsCompleted: boolean;
    requiresPostTest: boolean;
    postTestPassed: boolean;
    isComplete: boolean;
  };
  preTestAttempted: boolean;
  postTestPassed: boolean;
}

const activityIcon = (activity: Activity) => {
  if (activity.type === "video") return <PlayCircle className="h-4 w-4" />;
  if (activity.type === "worksheet" || activity.type === "project") {
    return <ClipboardList className="h-4 w-4" />;
  }
  if (activity.type === "quiz") return <FileText className="h-4 w-4" />;
  return <BookOpen className="h-4 w-4" />;
};

function downloadText(title: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "worksheet"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CoursePlayerDialog({
  course,
  open,
  onOpenChange,
  fixedParticipantId,
}: {
  course: ECourse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedParticipantId?: string;
}) {
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [participantId, setParticipantId] = useState("");
  const lessons = [...course.lessons].sort((a, b) => a.order - b.order);
  const activeLesson = lessons[activeLessonIndex];
  const learningStateKey = `/api/courses/${course.id}/learning-state?participantId=${encodeURIComponent(participantId)}`;
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/participants"],
  });
  const learningStateQuery = useQuery<CourseLearningState>({
    queryKey: [learningStateKey],
    enabled: Boolean(participantId),
  });
  const enrollment = learningStateQuery.data?.enrollment;
  const completedLessonIds = new Set(enrollment?.completedLessonIds ?? []);

  const createEnrollmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/enrollments", {
        participantId,
        courseId: course.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [learningStateKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!enrollment) throw new Error("Pendaftaran kursus belum tersedia");
      const response = await apiRequest(
        "POST",
        `/api/enrollments/${enrollment.id}/lessons/${encodeURIComponent(lessonId)}/complete`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [learningStateKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
    },
  });

  useEffect(() => {
    if (open) {
      setActiveLessonIndex(0);
      setParticipantId(fixedParticipantId ?? "");
    }
  }, [course.id, open, fixedParticipantId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] max-h-[900px] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0"
        data-testid={`dialog-course-player-${course.id}`}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Kursus Level {course.targetLevel}</Badge>
            <span className="text-sm text-muted-foreground">
              Lesson {activeLessonIndex + 1} dari {lessons.length}
            </span>
          </div>
          <DialogTitle className="text-xl">{course.title}</DialogTitle>
          <DialogDescription>{course.description}</DialogDescription>
        </DialogHeader>

        <section className="shrink-0 space-y-3 border-b px-5 py-4 md:flex md:items-end md:justify-between md:gap-4 md:space-y-0 md:px-6">
          <div className="w-full space-y-2 md:max-w-sm">
            <label className="text-sm font-medium" htmlFor={`player-participant-${course.id}`}>
              Progres peserta
            </label>
            <Select value={participantId} onValueChange={setParticipantId} disabled={Boolean(fixedParticipantId)}>
              <SelectTrigger id={`player-participant-${course.id}`} data-testid="select-player-participant">
                <SelectValue placeholder="Pilih peserta untuk menyimpan progres" />
              </SelectTrigger>
              <SelectContent>
                {participants.map(participant => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {participantId && (
            <div className="flex flex-wrap items-center gap-2">
              {enrollment ? (
                <>
                  <div className="min-w-36">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{learningStateQuery.data?.completion.progress ?? 0}% selesai</span>
                      <span>{completedLessonIds.size}/{lessons.length} lesson</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={learningStateQuery.data?.completion.progress ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progres kursus"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${learningStateQuery.data?.completion.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => learningStateQuery.refetch()}
                    disabled={learningStateQuery.isFetching}
                  >
                    Perbarui status
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => createEnrollmentMutation.mutate()}
                  disabled={createEnrollmentMutation.isPending || !learningStateQuery.isFetched}
                >
                  {createEnrollmentMutation.isPending ? "Memulai..." : "Mulai dan simpan progres"}
                </Button>
              )}
            </div>
          )}
        </section>

        {activeLesson ? (
          <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)]">
            <nav
              aria-label="Daftar lesson"
              className="max-h-40 space-y-1 overflow-y-auto border-b p-3 md:max-h-none md:border-b-0 md:border-r"
            >
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setActiveLessonIndex(index)}
                  aria-current={index === activeLessonIndex ? "step" : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    index === activeLessonIndex
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted"
                  }`}
                  data-testid={`button-player-lesson-${index + 1}`}
                >
                  <span className="block text-xs text-muted-foreground">
                    Lesson {index + 1}
                  </span>
                  <span className="mt-1 block text-sm font-medium">{lesson.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {completedLessonIds.has(lesson.id) && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                    {completedLessonIds.has(lesson.id) ? "Selesai" : "Belum selesai"}
                  </span>
                </button>
              ))}
            </nav>

            <main className="min-h-0 overflow-y-auto px-5 py-5 md:px-8">
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="space-y-2">
                  <Badge variant="outline">{activeLesson.type}</Badge>
                  <h2 className="text-2xl font-semibold">{activeLesson.title}</h2>
                  <p className="text-muted-foreground">{activeLesson.description}</p>
                </div>

                {activeLesson.type === "reflection" && (
                  <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                    Refleksi pribadi tidak dikumpulkan atau dibagikan ke PIC. Sistem hanya menyimpan status lesson selesai.
                  </p>
                )}

                {participantId && enrollment && (
                  <section className="space-y-3 rounded-xl border p-4">
                    <div>
                      <h3 className="font-semibold">Syarat penyelesaian kursus</h3>
                      <p className="text-sm text-muted-foreground">
                        Semua lesson wajib selesai. Pre-test bersifat diagnostik; post-test harus lulus jika tersedia.
                      </p>
                    </div>
                    {[
                      {
                        label: "Pre-test diagnostik",
                        quizId: course.preTestId,
                        status: learningStateQuery.data?.preTestAttempted ? "Sudah dikerjakan · tidak menghambat kelulusan" : "Opsional",
                      },
                      {
                        label: "Post-test",
                        quizId: course.postTestId,
                        status: !course.postTestId
                          ? "Tidak diwajibkan"
                          : learningStateQuery.data?.postTestPassed
                            ? "Lulus"
                            : "Belum lulus",
                      },
                    ].map(item => item.quizId && (
                      <div key={item.label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.status}</p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={`/app/quizzes?quizId=${encodeURIComponent(item.quizId)}&participantId=${encodeURIComponent(participantId)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.label === "Pre-test diagnostik" ? "Kerjakan pre-test" : "Kerjakan post-test"}
                          </a>
                        </Button>
                      </div>
                    ))}
                    {learningStateQuery.data?.completion.isComplete && (
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Kursus selesai. Syarat sertifikat telah terpenuhi.
                      </p>
                    )}
                  </section>
                )}

                <section className="rounded-xl border bg-card p-4 md:p-6">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Materi dan storyboard
                  </h3>
                  <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    Storyboard video ditampilkan sebagai naskah karena video final belum diunggah.
                    Kasus dan angka di lesson ini fiktif untuk latihan.
                  </p>
                  <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                    {activeLesson.content || "Materi lesson ini belum tersedia."}
                  </div>
                </section>

                {activeLesson.activities && activeLesson.activities.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="font-semibold">Aktivitas dan bahan</h3>
                    {activeLesson.activities.map((activity) => (
                      <article key={activity.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <span className="mt-0.5 text-primary">{activityIcon(activity)}</span>
                            <div className="space-y-1">
                              <h4 className="font-medium">{activity.title}</h4>
                              <p className="text-sm text-muted-foreground">{activity.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{activity.duration}</Badge>
                        </div>

                        {activity.content && (
                          <details className="mt-4 rounded-lg bg-muted/50 p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              Buka bahan latihan
                            </summary>
                            <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                              {activity.content}
                            </div>
                          </details>
                        )}

                        {activity.content && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => downloadText(activity.title, activity.content!)}
                            data-testid={`button-download-${activity.id}`}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Unduh bahan (.txt)
                          </Button>
                        )}

                        {activity.type === "quiz" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => window.location.assign("/app/quizzes")}
                          >
                            Buka Quiz Engine
                          </Button>
                        )}
                      </article>
                    ))}
                  </section>
                )}

                <div className="flex justify-between gap-3 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveLessonIndex(index => Math.max(0, index - 1))}
                    disabled={activeLessonIndex === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Sebelumnya
                  </Button>
                  <Button
                    onClick={() => setActiveLessonIndex(index => Math.min(lessons.length - 1, index + 1))}
                    disabled={activeLessonIndex === lessons.length - 1}
                  >
                    Lesson berikutnya
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {participantId && enrollment && !completedLessonIds.has(activeLesson.id) && (
                  <Button
                    className="w-full"
                    onClick={() => completeLessonMutation.mutate(activeLesson.id)}
                    disabled={completeLessonMutation.isPending}
                    data-testid={`button-complete-lesson-${activeLesson.id}`}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {completeLessonMutation.isPending ? "Menyimpan progres..." : "Tandai lesson selesai"}
                  </Button>
                )}
              </div>
            </main>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Materi lesson belum tersedia.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
