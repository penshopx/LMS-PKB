import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck } from "lucide-react";

interface ReviewAnswer {
  questionId: string;
  questionText: string;
  type: string;
  answer: string | string[];
  maxPoints: number;
  pointsAwarded: number;
  isCorrect?: boolean;
}

interface PendingEssayReview {
  id: string;
  participantId: string;
  participantName: string;
  quizId: string;
  quizTitle: string;
  courseTitle: string;
  passingScore: number;
  submittedAt: string;
  answers: ReviewAnswer[];
}

interface ReviewDraft {
  score: string;
  feedback: string;
}

export function EssayReviewQueue() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const { data: reviews = [], isLoading, isError } = useQuery<PendingEssayReview[]>({
    queryKey: ["/api/quiz-attempts/pending-review"],
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ attemptId, score, feedback }: {
      attemptId: string;
      score: number;
      feedback: string;
    }) => {
      const response = await apiRequest("POST", `/api/quiz-attempts/${attemptId}/grade`, { score, feedback });
      return response.json() as Promise<{ passed: boolean; passingScore: number }>;
    },
    onSuccess: result => {
      toast({
        title: result.passed ? "Penilaian tersimpan — lulus" : "Penilaian tersimpan — belum lulus",
        description: result.passed
          ? `Nilai memenuhi batas lulus ${result.passingScore}.`
          : "Peserta perlu mengulang seluruh post-test; jawaban esai tidak dapat diperbaiki sebagian.",
      });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Penilaian gagal disimpan", description: error.message, variant: "destructive" });
    },
  });

  const updateDraft = (attemptId: string, field: keyof ReviewDraft, value: string) => {
    setDrafts(current => ({
      ...current,
      [attemptId]: {
        score: current[attemptId]?.score ?? "",
        feedback: current[attemptId]?.feedback ?? "",
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return <p className="py-10 text-center text-muted-foreground">Memuat antrean penilaian...</p>;
  }

  if (isError) {
    return <p role="alert" className="py-10 text-center text-destructive">Antrean penilaian tidak dapat dimuat.</p>;
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <ClipboardCheck className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-semibold">Tidak ada esai menunggu penilaian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Jawaban esai peserta akan muncul di sini setelah post-test dikirim.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => {
        const draft = drafts[review.id] ?? { score: "", feedback: "" };
        const score = Number(draft.score);
        const canSubmit = draft.score !== "" &&
          Number.isInteger(score) &&
          score >= 0 &&
          score <= 100 &&
          draft.feedback.trim().length > 0;

        return (
          <Card key={review.id} data-testid={`essay-review-${review.id}`}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{review.participantName}</CardTitle>
                  <CardDescription className="mt-1">
                    {review.courseTitle} · {review.quizTitle}
                  </CardDescription>
                </div>
                <Badge variant="outline">Dikirim {new Date(review.submittedAt).toLocaleString("id-ID")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                {review.answers.map((answer, index) => (
                  <div key={answer.questionId} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="font-medium">{index + 1}. {answer.questionText}</p>
                      <Badge variant="secondary">{answer.maxPoints} poin</Badge>
                    </div>
                    {answer.type === "essay" ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                        {Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer || "Tidak ada jawaban"}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Jawaban objektif: {Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer || "—"}
                        {" · "}{answer.isCorrect ? "benar" : "belum tepat"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <form
                className="grid gap-4 border-t pt-4 md:grid-cols-[180px_1fr]"
                onSubmit={event => {
                  event.preventDefault();
                  if (!canSubmit) return;
                  gradeMutation.mutate({ attemptId: review.id, score, feedback: draft.feedback.trim() });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor={`score-${review.id}`}>Nilai akhir (0–100)</Label>
                  <Input
                    id={`score-${review.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    required
                    value={draft.score}
                    onChange={event => updateDraft(review.id, "score", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Lulus mulai {review.passingScore}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`feedback-${review.id}`}>Feedback untuk peserta</Label>
                  <Textarea
                    id={`feedback-${review.id}`}
                    required
                    maxLength={4000}
                    value={draft.feedback}
                    onChange={event => updateDraft(review.id, "feedback", event.target.value)}
                    placeholder="Jelaskan kekuatan jawaban dan hal yang perlu diperbaiki."
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!canSubmit || gradeMutation.isPending}>
                      {gradeMutation.isPending ? "Menyimpan..." : "Simpan penilaian"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
