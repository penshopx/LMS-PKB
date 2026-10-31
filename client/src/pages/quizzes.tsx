import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  FileQuestion,
  Plus,
  Clock,
  Target,
  Play,
  Trash2,
  ListChecks,
  AlignLeft,
  Check
} from "lucide-react";
import type { Quiz, ECourse } from "@shared/schema";
import type { Participant } from "@shared/schema";

type LocalQuestionType = "multiple_choice" | "true_false" | "essay";

interface LocalQuestion {
  id: string;
  type: LocalQuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  order: number;
}

function transformQuestions(questions: unknown): LocalQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q: Record<string, unknown>, index: number) => ({
    id: String(q.id || `q-${index}`),
    type: (["multiple_choice", "true_false", "essay"].includes(String(q.type)) 
      ? String(q.type) : "multiple_choice") as LocalQuestionType,
    text: String(q.text || ""),
    options: Array.isArray(q.options) 
      ? q.options.map((o: unknown) => typeof o === "object" && o !== null && "text" in o ? String((o as {text: string}).text) : String(o))
      : [],
    correctAnswer: String(q.correctAnswer || ""),
    points: typeof q.points === "number" ? q.points : 10,
    order: typeof q.order === "number" ? q.order : index
  }));
}

export default function Quizzes() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [participantId, setParticipantId] = useState(
    new URLSearchParams(window.location.search).get("participantId") ?? "",
  );
  const requestedQuizId = new URLSearchParams(window.location.search).get("quizId");
  
  const [newQuestions, setNewQuestions] = useState<LocalQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<LocalQuestion>>({
    type: "multiple_choice",
    points: 10
  });
  const [tempOptions, setTempOptions] = useState<string[]>(["", "", "", ""]);

  const { data: quizzes = [], isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"]
  });

  const { data: courses = [] } = useQuery<ECourse[]>({
    queryKey: ["/api/courses"]
  });
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/participants"]
  });

  useEffect(() => {
    if (!requestedQuizId || quizzes.length === 0) return;
    const requestedQuiz = quizzes.find(quiz => quiz.id === requestedQuizId);
    if (!requestedQuiz) return;
    setSelectedQuiz(requestedQuiz);
    setIsTakingQuiz(true);
  }, [quizzes, requestedQuizId]);

  const createQuizMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/quizzes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: "Berhasil", description: "Kuis berhasil dibuat" });
      setIsCreateDialogOpen(false);
      setNewQuestions([]);
    }
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async (data: { quizId: string; participantId: string; answers: Record<string, string> }) => {
      const response = await apiRequest("POST", `/api/quizzes/${data.quizId}/attempts`, data);
      return response.json() as Promise<{ score: number; passed: boolean }>;
    },
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/participants/${participantId}/quiz-attempts`],
      });
      toast({
        title: attempt.passed ? "Lulus" : "Belum lulus",
        description: `Nilai ${attempt.score}%. ${attempt.passed ? "Syarat nilai terpenuhi." : "Anda dapat mengulang selama percobaan masih tersedia."}`,
      });
      setIsTakingQuiz(false);
      setSelectedQuiz(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
    }
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createQuizMutation.mutate({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      description: formData.get("description"),
      timeLimit: parseInt(formData.get("timeLimit") as string) || 30,
      passingScore: parseInt(formData.get("passingScore") as string) || 70,
      questions: newQuestions
    });
  };

  const addQuestion = () => {
    if (!currentQuestion.text) {
      toast({ title: "Error", description: "Masukkan pertanyaan", variant: "destructive" });
      return;
    }

    const newQuestion: LocalQuestion = {
      id: `q-${Date.now()}`,
      type: currentQuestion.type || "multiple_choice",
      text: currentQuestion.text,
      points: currentQuestion.points || 10,
      options: currentQuestion.type === "true_false" ? ["Benar", "Salah"] : tempOptions.filter(o => o.trim()),
      correctAnswer: currentQuestion.correctAnswer || "",
      order: newQuestions.length
    };

    setNewQuestions([...newQuestions, newQuestion]);
    setCurrentQuestion({ type: "multiple_choice", points: 10 });
    setTempOptions(["", "", "", ""]);
    setIsQuestionDialogOpen(false);
    toast({ title: "Berhasil", description: "Pertanyaan ditambahkan" });
  };

  const removeQuestion = (id: string) => {
    setNewQuestions(newQuestions.filter(q => q.id !== id));
  };

  const getQuestionTypeLabel = (type: LocalQuestionType) => {
    const labels: Record<LocalQuestionType, string> = {
      multiple_choice: "Pilihan Ganda",
      true_false: "Benar/Salah",
      essay: "Esai"
    };
    return labels[type];
  };

  const getQuestionTypeIcon = (type: LocalQuestionType) => {
    switch(type) {
      case "multiple_choice": return <ListChecks className="h-4 w-4" />;
      case "true_false": return <Check className="h-4 w-4" />;
      case "essay": return <AlignLeft className="h-4 w-4" />;
      default: return <ListChecks className="h-4 w-4" />;
    }
  };

  const handleSubmitQuiz = () => {
    if (!selectedQuiz || !participantId) return;
    submitAttemptMutation.mutate({
      quizId: selectedQuiz.id,
      participantId,
      answers,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isTakingQuiz && selectedQuiz) {
    const questions = transformQuestions(selectedQuiz.questions);
    const currentQ = questions[currentQuestionIndex];

    if (!currentQ) {
      return (
        <div className="p-6 text-center">
          <p>Kuis tidak memiliki pertanyaan.</p>
          <Button onClick={() => { setIsTakingQuiz(false); setSelectedQuiz(null); }} className="mt-4">
            Kembali
          </Button>
        </div>
      );
    }

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="quiz-participant">Peserta</Label>
          <Select value={participantId} onValueChange={setParticipantId}>
            <SelectTrigger id="quiz-participant" data-testid="select-quiz-participant">
              <SelectValue placeholder="Pilih peserta" />
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selectedQuiz.title}</h1>
            <p className="text-muted-foreground">Pertanyaan {currentQuestionIndex + 1} dari {questions.length}</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{selectedQuiz.timeLimit} menit</span>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {getQuestionTypeIcon(currentQ.type)}
              <Badge variant="outline">{getQuestionTypeLabel(currentQ.type)}</Badge>
              <Badge variant="secondary">{currentQ.points} poin</Badge>
            </div>
            <CardTitle className="text-lg mt-2">{currentQ.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQ.type === "multiple_choice" && currentQ.options && (
              <RadioGroup 
                value={answers[currentQ.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [currentQ.id]: value })}
              >
                {currentQ.options.map((option: string, idx: number) => (
                  <div key={idx} className="flex items-center space-x-2 p-3 border rounded-lg hover-elevate cursor-pointer">
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQ.type === "true_false" && (
              <RadioGroup 
                value={answers[currentQ.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [currentQ.id]: value })}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover-elevate cursor-pointer">
                  <RadioGroupItem value="Benar" id="true" />
                  <Label htmlFor="true" className="flex-1 cursor-pointer">Benar</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover-elevate cursor-pointer">
                  <RadioGroupItem value="Salah" id="false" />
                  <Label htmlFor="false" className="flex-1 cursor-pointer">Salah</Label>
                </div>
              </RadioGroup>
            )}

            {currentQ.type === "essay" && (
              <Textarea 
                placeholder="Tulis jawaban Anda di sini..."
                value={answers[currentQ.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                className="min-h-[150px]"
                data-testid="input-essay-answer"
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Sebelumnya
            </Button>
            
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>
                Selanjutnya
              </Button>
            ) : (
              <Button
                onClick={handleSubmitQuiz}
                disabled={submitAttemptMutation.isPending || !participantId}
                data-testid="button-submit-quiz"
              >
                {submitAttemptMutation.isPending ? "Mengirim..." : "Kirim Jawaban"}
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => (
            <Button
              key={q.id}
              size="sm"
              variant={idx === currentQuestionIndex ? "default" : answers[q.id] ? "secondary" : "outline"}
              onClick={() => setCurrentQuestionIndex(idx)}
              data-testid={`button-question-${idx}`}
            >
              {idx + 1}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quiz Engine</h1>
          <p className="text-muted-foreground">Buat dan kelola kuis untuk mengukur pemahaman peserta</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-quiz">
              <Plus className="h-4 w-4 mr-2" />
              Buat Kuis Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Buat Kuis Baru</DialogTitle>
                <DialogDescription>Buat kuis dengan berbagai tipe pertanyaan</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Judul Kuis</Label>
                  <Input id="title" name="title" placeholder="Contoh: Kuis Analisis SWOT" required data-testid="input-quiz-title" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea id="description" name="description" placeholder="Jelaskan tujuan kuis ini" data-testid="input-quiz-description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="courseId">Kursus</Label>
                    <Select name="courseId">
                      <SelectTrigger data-testid="select-quiz-course">
                        <SelectValue placeholder="Pilih kursus" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="timeLimit">Waktu (menit)</Label>
                      <Input id="timeLimit" name="timeLimit" type="number" defaultValue={30} data-testid="input-quiz-time" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="passingScore">Nilai Lulus (%)</Label>
                      <Input id="passingScore" name="passingScore" type="number" defaultValue={70} data-testid="input-quiz-passing" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Pertanyaan ({newQuestions.length})</Label>
                    <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm" data-testid="button-add-question">
                          <Plus className="h-4 w-4 mr-2" />
                          Tambah Pertanyaan
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Tambah Pertanyaan</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>Tipe Pertanyaan</Label>
                            <Select 
                              value={currentQuestion.type} 
                              onValueChange={(v: LocalQuestionType) => {
                                setCurrentQuestion({ ...currentQuestion, type: v });
                                if (v === "true_false") {
                                  setTempOptions(["Benar", "Salah"]);
                                }
                              }}
                            >
                              <SelectTrigger data-testid="select-question-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
                                <SelectItem value="true_false">Benar/Salah</SelectItem>
                                <SelectItem value="essay">Esai</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Pertanyaan</Label>
                            <Textarea 
                              value={currentQuestion.text || ""}
                              onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                              placeholder="Tulis pertanyaan di sini"
                              data-testid="input-question-text"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Poin</Label>
                            <Input 
                              type="number"
                              value={currentQuestion.points || 10}
                              onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) })}
                              data-testid="input-question-points"
                            />
                          </div>

                          {currentQuestion.type === "multiple_choice" && (
                            <div className="grid gap-2">
                              <Label>Pilihan Jawaban</Label>
                              {tempOptions.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input 
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...tempOptions];
                                      newOpts[idx] = e.target.value;
                                      setTempOptions(newOpts);
                                    }}
                                    placeholder={`Pilihan ${idx + 1}`}
                                    data-testid={`input-option-${idx}`}
                                  />
                                  <RadioGroup 
                                    value={currentQuestion.correctAnswer}
                                    onValueChange={(v) => setCurrentQuestion({ ...currentQuestion, correctAnswer: v })}
                                  >
                                    <RadioGroupItem value={opt} disabled={!opt} />
                                  </RadioGroup>
                                </div>
                              ))}
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setTempOptions([...tempOptions, ""])}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah Pilihan
                              </Button>
                            </div>
                          )}

                          {currentQuestion.type === "true_false" && (
                            <div className="grid gap-2">
                              <Label>Jawaban Benar</Label>
                              <RadioGroup 
                                value={currentQuestion.correctAnswer}
                                onValueChange={(v) => setCurrentQuestion({ ...currentQuestion, correctAnswer: v })}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Benar" id="correct-true" />
                                  <Label htmlFor="correct-true">Benar</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Salah" id="correct-false" />
                                  <Label htmlFor="correct-false">Salah</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>Batal</Button>
                          <Button type="button" onClick={addQuestion} data-testid="button-save-question">Simpan Pertanyaan</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {newQuestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      Belum ada pertanyaan. Klik "Tambah Pertanyaan" untuk mulai.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {newQuestions.map((q, idx) => (
                        <div key={q.id} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium line-clamp-1">{q.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{getQuestionTypeLabel(q.type)}</Badge>
                                <Badge variant="secondary" className="text-xs">{q.points} poin</Badge>
                              </div>
                            </div>
                          </div>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={createQuizMutation.isPending || newQuestions.length === 0} data-testid="button-submit-quiz-form">
                  {createQuizMutation.isPending ? "Menyimpan..." : "Simpan Kuis"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kuis</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizzes.length}</div>
            <p className="text-xs text-muted-foreground">Kuis tersedia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pertanyaan</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Di semua kuis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Nilai Lulus</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quizzes.length > 0 
                ? Math.round(quizzes.reduce((acc, q) => acc + q.passingScore, 0) / quizzes.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Standar kelulusan</p>
          </CardContent>
        </Card>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Belum Ada Kuis</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Buat kuis pertama Anda untuk mengukur pemahaman peserta
            </p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Kuis Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const course = courses.find(c => c.id === quiz.courseId);
            const questions = transformQuestions(quiz.questions);
            
            return (
              <Card key={quiz.id} className="hover-elevate" data-testid={`card-quiz-${quiz.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Kuis</Badge>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="h-3 w-3" />
                      {quiz.timeLimit} menit
                    </div>
                  </div>
                  <CardTitle className="mt-2">{quiz.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course && (
                    <div className="text-sm text-muted-foreground">
                      Kursus: {course.title}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <FileQuestion className="h-4 w-4 text-muted-foreground" />
                      {questions?.length || 0} soal
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      Lulus: {quiz.passingScore}%
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setSelectedQuiz(quiz);
                      setIsTakingQuiz(true);
                    }}
                    disabled={!questions?.length}
                    data-testid={`button-take-quiz-${quiz.id}`}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Mulai Kuis
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
