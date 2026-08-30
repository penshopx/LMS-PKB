import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus,
  BookOpen,
  Clock,
  Target,
  Compass,
  Globe,
  PlayCircle,
  Edit3,
  CheckCircle,
  MessageCircle,
  ChevronRight,
  GraduationCap,
  FileQuestion,
  ClipboardCheck
} from "lucide-react";
import { 
  getLevelColor,
  getLessonTypeLabel,
} from "@/lib/data";
import type { ECourse, UnitCompetency, CompetencyLevelType, InsertCourse, Quiz } from "@shared/schema";

const lessonTypeIcons: Record<string, React.ElementType> = {
  orientation: Compass,
  context: Globe,
  microlearning: PlayCircle,
  practice: Edit3,
  assessment: CheckCircle,
  reflection: MessageCircle
};

function LessonTypeIcon({ type }: { type: string }) {
  const Icon = lessonTypeIcons[type] || BookOpen;
  return <Icon className="h-4 w-4" />;
}

function CourseCard({ course, units, quizzes }: { course: ECourse; units?: UnitCompetency[]; quizzes?: Quiz[] }) {
  const unit = units?.find(u => u.id === course.unitId);
  const preTest = quizzes?.find(q => q.id === course.preTestId);
  const postTest = quizzes?.find(q => q.id === course.postTestId);
  
  return (
    <Card className="hover-elevate" data-testid={`course-card-${course.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            {unit && (
              <Badge variant="outline" className="mb-2">
                {unit.code}
              </Badge>
            )}
            <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
          </div>
          <Badge className={getLevelColor(course.targetLevel)}>
            {course.targetLevel}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{course.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{course.duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            <span>{course.lessons.length} Lesson</span>
          </div>
        </div>

        {(preTest || postTest) && (
          <>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-2">
              {preTest && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-pretest-${course.id}`}>
                  <FileQuestion className="h-3 w-3 mr-1" />
                  Pre-Test
                </Badge>
              )}
              {postTest && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-posttest-${course.id}`}>
                  <ClipboardCheck className="h-3 w-3 mr-1" />
                  Post-Test
                </Badge>
              )}
            </div>
          </>
        )}
        
        <Separator className="my-4" />
        
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Struktur Kursus</p>
          <div className="grid grid-cols-2 gap-2">
            {course.lessons.slice(0, 6).map((lesson) => (
              <div 
                key={lesson.id} 
                className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/50"
              >
                <LessonTypeIcon type={lesson.type} />
                <span className="truncate">{getLessonTypeLabel(lesson.type)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1" data-testid={`button-view-course-${course.id}`}>
              Lihat Detail
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                {unit && <Badge variant="outline">{unit.code}</Badge>}
                <Badge className={getLevelColor(course.targetLevel)}>{course.targetLevel}</Badge>
              </div>
              <DialogTitle>{course.title}</DialogTitle>
              <DialogDescription>{course.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    <span>Target: Level {course.targetLevel}</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Struktur Lesson</h4>
                  {course.lessons.map((lesson, index) => (
                    <div 
                      key={lesson.id} 
                      className="flex items-start gap-4 p-4 rounded-lg border border-border"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <LessonTypeIcon type={lesson.type} />
                          <Badge variant="secondary" className="text-xs">
                            {getLessonTypeLabel(lesson.type)}
                          </Badge>
                        </div>
                        <h5 className="font-medium">{lesson.title}</h5>
                        <p className="text-sm text-muted-foreground">{lesson.description}</p>
                        <p className="text-xs text-muted-foreground italic">{lesson.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Button className="flex-1" data-testid={`button-start-course-${course.id}`}>
          <GraduationCap className="h-4 w-4 mr-1" />
          Mulai
        </Button>
      </CardFooter>
    </Card>
  );
}

const templateSteps = [
  { type: "orientation", title: "Orientasi Kompetensi", desc: "Standar, indikator, peran, dan evidensi", placeholder: "Jelaskan kompetensi bisnis konstruksi, indikator perilaku, peran, dan kriteria keberhasilan..." },
  { type: "context", title: "Konteks Usaha Konstruksi", desc: "Kasus badan usaha atau proyek aktual", placeholder: "Tambahkan studi kasus legalitas, sertifikasi, tender, proyek, atau kepatuhan. LKUT hanya boleh digunakan sebagai konteks kebutuhan belajar..." },
  { type: "microlearning", title: "Regulasi dan Praktik Utama", desc: "Regulasi, video, artikel, dan checklist", placeholder: "Masukkan ringkasan regulasi dan praktik konstruksi yang relevan..." },
  { type: "practice", title: "Praktik Berbasis Pekerjaan", desc: "Tugas pada skenario usaha atau proyek", placeholder: "Jelaskan tugas praktik konstruksi tanpa membuat proses penyusunan atau pelaporan LKUT..." },
  { type: "assessment", title: "Asesmen", desc: "Project, studi kasus, observasi", placeholder: "Tentukan metode asesmen: project, studi kasus, atau observasi..." },
  { type: "reflection", title: "Evidensi & Refleksi", desc: "Dokumentasi & portofolio kompetensi", placeholder: "Jelaskan jenis evidensi dan format refleksi yang diperlukan..." }
];

const NO_QUIZ_SELECTION = "__none__";

function CourseBuilderTemplate({ onStartBuild }: { onStartBuild?: () => void }) {
  const [selectedStep, setSelectedStep] = useState<typeof templateSteps[0] | null>(null);
  const [stepContent, setStepContent] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState("");

  const handleStepClick = (step: typeof templateSteps[0]) => {
    setSelectedStep(step);
    setCurrentContent(stepContent[step.type] || "");
    setDialogOpen(true);
  };

  const handleSaveStep = () => {
    if (selectedStep) {
      setStepContent(prev => ({ ...prev, [selectedStep.type]: currentContent }));
    }
    setDialogOpen(false);
    setSelectedStep(null);
  };

  const completedSteps = Object.keys(stepContent).filter(k => stepContent[k]?.trim()).length;

  return (
    <Card data-testid="card-course-template">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Template Pembelajaran
        </CardTitle>
        <CardDescription>
          Klik setiap langkah untuk menambahkan konten. {completedSteps}/6 langkah selesai.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {templateSteps.map((item, index) => {
            const isCompleted = stepContent[item.type]?.trim();
            return (
              <button 
                key={item.type}
                onClick={() => handleStepClick(item)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover-elevate active-elevate-2 text-left transition-colors"
                data-testid={`button-step-${item.type}`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted 
                    ? "bg-green-500 text-white" 
                    : "bg-primary text-primary-foreground"
                }`}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <LessonTypeIcon type={item.type} />
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        
        {completedSteps > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              onClick={onStartBuild} 
              className="w-full"
              disabled={completedSteps < 6}
              data-testid="button-generate-course"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              {completedSteps < 6 ? `Selesaikan ${6 - completedSteps} langkah lagi` : "Buat Pembelajaran dari Template"}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedStep && <LessonTypeIcon type={selectedStep.type} />}
              {selectedStep?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedStep?.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="step-content">Konten Lesson</Label>
              <Textarea
                id="step-content"
                placeholder={selectedStep?.placeholder}
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
                rows={6}
                className="resize-none"
                data-testid="textarea-step-content"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-step">
                Batal
              </Button>
              <Button onClick={handleSaveStep} data-testid="button-save-step">
                <CheckCircle className="h-4 w-4 mr-1" />
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateCourseForm({ units, quizzes, onClose }: { units?: UnitCompetency[]; quizzes?: Quiz[]; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    unitId: "",
    targetLevel: "L2" as CompetencyLevelType,
    title: "",
    description: "",
    duration: "",
    preTestId: NO_QUIZ_SELECTION,
    postTestId: NO_QUIZ_SELECTION
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCourse) => {
      const res = await apiRequest("POST", "/api/courses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({ title: "Berhasil", description: "E-Course berhasil dibuat" });
      onClose();
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal membuat e-course", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!formData.unitId || !formData.title || !formData.description || !formData.duration) {
      toast({ title: "Error", description: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    const submitData = {
      ...formData,
      preTestId: formData.preTestId === NO_QUIZ_SELECTION ? undefined : formData.preTestId,
      postTestId: formData.postTestId === NO_QUIZ_SELECTION ? undefined : formData.postTestId
    };
    createMutation.mutate(submitData);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="unit">Unit Kompetensi</Label>
        <Select value={formData.unitId} onValueChange={(v) => setFormData(prev => ({ ...prev, unitId: v }))}>
          <SelectTrigger id="unit" data-testid="select-unit">
            <SelectValue placeholder="Pilih unit kompetensi" />
          </SelectTrigger>
          <SelectContent>
            {units?.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.code} - {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="level">Target Level</Label>
        <Select 
          value={formData.targetLevel} 
          onValueChange={(v) => setFormData(prev => ({ ...prev, targetLevel: v as CompetencyLevelType }))}
        >
          <SelectTrigger id="level" data-testid="select-level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L1">L1 - Awareness</SelectItem>
            <SelectItem value="L2">L2 - Application</SelectItem>
            <SelectItem value="L3">L3 - Mastery</SelectItem>
            <SelectItem value="L4">L4 - Strategic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Judul Kursus</Label>
        <Input 
          id="title" 
          placeholder="Masukkan judul kursus" 
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          data-testid="input-title" 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea 
          id="description" 
          placeholder="Deskripsi singkat tentang kursus ini"
          className="resize-none"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          data-testid="textarea-description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Durasi</Label>
        <Input 
          id="duration" 
          placeholder="Contoh: 4 jam" 
          value={formData.duration}
          onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
          data-testid="input-duration" 
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="pretest">Pre-Test (Opsional)</Label>
        <Select value={formData.preTestId} onValueChange={(v) => setFormData(prev => ({ ...prev, preTestId: v }))}>
          <SelectTrigger id="pretest" data-testid="select-pretest">
            <SelectValue placeholder="Pilih kuis untuk pre-test" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_QUIZ_SELECTION}>Tidak ada pre-test</SelectItem>
            {quizzes?.map((quiz) => (
              <SelectItem key={quiz.id} value={quiz.id}>
                {quiz.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pre-test digunakan untuk mengukur pengetahuan awal peserta sebelum memulai kursus
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="posttest">Post-Test (Opsional)</Label>
        <Select value={formData.postTestId} onValueChange={(v) => setFormData(prev => ({ ...prev, postTestId: v }))}>
          <SelectTrigger id="posttest" data-testid="select-posttest">
            <SelectValue placeholder="Pilih kuis untuk post-test" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_QUIZ_SELECTION}>Tidak ada post-test</SelectItem>
            {quizzes?.map((quiz) => (
              <SelectItem key={quiz.id} value={quiz.id}>
                {quiz.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Post-test digunakan untuk mengukur peningkatan pengetahuan setelah menyelesaikan kursus
        </p>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel">
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-create-course">
          <Plus className="h-4 w-4 mr-1" />
          {createMutation.isPending ? "Membuat..." : "Buat E-Course"}
        </Button>
      </div>
    </div>
  );
}

function CourseSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-20 mb-2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </CardFooter>
    </Card>
  );
}

export default function Courses() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: courses, isLoading: coursesLoading } = useQuery<ECourse[]>({
    queryKey: ['/api/courses']
  });

  const { data: units } = useQuery<UnitCompetency[]>({
    queryKey: ['/api/units']
  });

  const { data: quizzes } = useQuery<Quiz[]>({
    queryKey: ['/api/quizzes']
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-courses">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">LMS PUB ASPEKINDO</h1>
          <p className="text-muted-foreground">LMS Bisnis Kontraktor · Bangun dan kelola pembelajaran berbasis kompetensi</p>
        </div>
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-course">
              <Plus className="h-4 w-4 mr-1" />
              Buat E-Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat E-Course Baru</DialogTitle>
              <DialogDescription>
                Buat kursus baru berdasarkan unit kompetensi
              </DialogDescription>
            </DialogHeader>
            <CreateCourseForm units={units} quizzes={quizzes} onClose={() => setShowCreateForm(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList data-testid="tabs-courses">
          <TabsTrigger value="courses" data-testid="tab-courses">E-Course Library</TabsTrigger>
          <TabsTrigger value="template" data-testid="tab-template">Template Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-6">
          {coursesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <CourseSkeleton key={i} />)}
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} units={units} quizzes={quizzes} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">Belum ada E-Course</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Buat e-course pertama Anda berdasarkan unit kompetensi
                  </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Buat E-Course Pertama
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="template" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <CourseBuilderTemplate onStartBuild={() => setShowCreateForm(true)} />
            
            <Card data-testid="card-principles">
              <CardHeader>
                <CardTitle>Prinsip Pembelajaran Berbasis Kompetensi</CardTitle>
                <CardDescription>
                  Panduan membangun kursus yang efektif
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">E-Course dibangun dari Kompetensi</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Bukan dari materi, tapi dari unit kompetensi yang terukur
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                  <h4 className="font-medium text-teal-900 dark:text-teal-100">1 Unit Kompetensi = 1 E-Course</h4>
                  <p className="text-sm text-teal-700 dark:text-teal-300 mt-1">
                    Setiap unit kompetensi memiliki paket e-course tersendiri
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100">Evidence-Based Learning</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Belajar tanpa evidensi bukan berarti kompeten
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">Level-Based Progression</h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Naik level = naik kompleksitas asesmen
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
