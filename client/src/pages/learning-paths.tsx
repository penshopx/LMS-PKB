import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Route, 
  BookOpen, 
  Clock, 
  Target, 
  Users, 
  Plus,
  ChevronRight,
  Award,
  Play,
  CheckCircle2,
  BarChart3
} from "lucide-react";
import type { LearningPath, ECourse, Enrollment, Participant } from "@shared/schema";

export default function LearningPaths() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  
  const { data: learningPaths = [], isLoading: pathsLoading } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths"]
  });

  const { data: courses = [] } = useQuery<ECourse[]>({
    queryKey: ["/api/courses"]
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/participants"]
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments"]
  });

  const createPathMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/learning-paths", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
      toast({ title: "Berhasil", description: "Jalur pembelajaran berhasil dibuat" });
      setIsDialogOpen(false);
    }
  });

  const enrollMutation = useMutation({
    mutationFn: async (data: { participantId: string; learningPathId: string }) => {
      return apiRequest("POST", "/api/enrollments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
      toast({ title: "Berhasil", description: "Peserta berhasil didaftarkan" });
    }
  });

  const getPathCourses = (path: LearningPath) => {
    return courses.filter(c => path.courseIds.includes(c.id));
  };

  const getPathEnrollments = (pathId: string) => {
    return enrollments.filter(e => e.learningPathId === pathId);
  };

  const getDifficultyBadge = (difficulty: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      beginner: "secondary",
      intermediate: "default",
      advanced: "destructive"
    };
    const labels: Record<string, string> = {
      beginner: "Pemula",
      intermediate: "Menengah",
      advanced: "Lanjutan"
    };
    return <Badge variant={variants[difficulty]}>{labels[difficulty]}</Badge>;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPathMutation.mutate({
      title: formData.get("title"),
      description: formData.get("description"),
      targetRole: formData.get("targetRole"),
      duration: formData.get("duration"),
      difficulty: formData.get("difficulty"),
      courseIds: [],
      prerequisites: [],
      skills: formData.get("skills")?.toString().split(",").map(s => s.trim()).filter(Boolean) || []
    });
  };

  if (pathsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jalur Pembelajaran</h1>
          <p className="text-muted-foreground">Kelola jalur SIAP dan Kepatuhan untuk pengembangan kompetensi konstruksi</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-path">
              <Plus className="h-4 w-4 mr-2" />
              Buat Jalur Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Buat Jalur Pembelajaran Baru</DialogTitle>
                <DialogDescription>Buat jalur pembelajaran terstruktur untuk peserta</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Judul Jalur</Label>
                    <Input id="title" name="title" placeholder="Contoh: SIAP Tender" required data-testid="input-path-title" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea id="description" name="description" placeholder="Jelaskan tujuan dan manfaat jalur ini" required data-testid="input-path-description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="targetRole">Target Role</Label>
                    <Input id="targetRole" name="targetRole" placeholder="Contoh: Tim Tender" required data-testid="input-path-role" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Durasi</Label>
                    <Input id="duration" name="duration" placeholder="Contoh: 3 bulan" required data-testid="input-path-duration" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="difficulty">Tingkat Kesulitan</Label>
                  <Select name="difficulty" defaultValue="intermediate">
                    <SelectTrigger data-testid="select-difficulty">
                      <SelectValue placeholder="Pilih tingkat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Pemula</SelectItem>
                      <SelectItem value="intermediate">Menengah</SelectItem>
                      <SelectItem value="advanced">Lanjutan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="skills">Keterampilan (pisahkan dengan koma)</Label>
                  <Input id="skills" name="skills" placeholder="Contoh: Kualifikasi, Dokumen Pemilihan" data-testid="input-path-skills" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={createPathMutation.isPending} data-testid="button-submit-path">
                  {createPathMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="paths" className="space-y-4">
        <TabsList>
          <TabsTrigger value="paths" data-testid="tab-paths">
            <Route className="h-4 w-4 mr-2" />
            Jalur Pembelajaran
          </TabsTrigger>
          <TabsTrigger value="enrollments" data-testid="tab-enrollments">
            <Users className="h-4 w-4 mr-2" />
            Pendaftaran
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analitik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paths" className="space-y-4">
          {learningPaths.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Route className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Belum Ada Jalur Pembelajaran</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-2">
                  Buat jalur pembelajaran untuk mengatur kursus dalam urutan yang terstruktur
                </p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Jalur Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {learningPaths.map((path) => {
                const pathCourses = getPathCourses(path);
                const pathEnrollments = getPathEnrollments(path.id);
                
                return (
                  <Card key={path.id} className="hover-elevate cursor-pointer" data-testid={`card-path-${path.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                            <Route className="h-5 w-5 text-primary" />
                          </div>
                          {getDifficultyBadge(path.difficulty)}
                        </div>
                        {path.isPublished && <Badge variant="secondary">Aktif</Badge>}
                      </div>
                      <CardTitle className="mt-2">{path.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{path.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {path.duration}
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {pathCourses.length} Kursus
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {pathEnrollments.length} Peserta
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Target: {path.targetRole}</span>
                      </div>
                      {path.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {path.skills.slice(0, 3).map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{skill}</Badge>
                          ))}
                          {path.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{path.skills.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => setSelectedPath(path)}
                        data-testid={`button-view-path-${path.id}`}
                      >
                        Lihat Detail
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pendaftaran Peserta</CardTitle>
              <CardDescription>Kelola pendaftaran peserta ke jalur pembelajaran</CardDescription>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada peserta yang terdaftar di jalur pembelajaran
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.filter(e => e.learningPathId).map((enrollment) => {
                    const participant = participants.find(p => p.id === enrollment.participantId);
                    const path = learningPaths.find(p => p.id === enrollment.learningPathId);
                    
                    return (
                      <div 
                        key={enrollment.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`enrollment-${enrollment.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{participant?.name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{path?.title || "Unknown Path"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{enrollment.progress}%</p>
                            <Progress value={enrollment.progress} className="w-24 h-2" />
                          </div>
                          <Badge variant={enrollment.status === "completed" ? "default" : "secondary"}>
                            {enrollment.status === "completed" ? "Selesai" : 
                             enrollment.status === "in_progress" ? "Berlangsung" : "Terdaftar"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jalur</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{learningPaths.length}</div>
                <p className="text-xs text-muted-foreground">Jalur pembelajaran aktif</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendaftaran</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{enrollments.filter(e => e.learningPathId).length}</div>
                <p className="text-xs text-muted-foreground">Peserta terdaftar</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tingkat Penyelesaian</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {enrollments.length > 0 
                    ? Math.round((enrollments.filter(e => e.status === "completed").length / enrollments.length) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Rata-rata penyelesaian</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {selectedPath && (
        <Dialog open={!!selectedPath} onOpenChange={() => setSelectedPath(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{selectedPath.title}</DialogTitle>
              <DialogDescription>{selectedPath.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedPath.duration}
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {selectedPath.targetRole}
                </div>
                {getDifficultyBadge(selectedPath.difficulty)}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Kursus dalam Jalur</h4>
                {getPathCourses(selectedPath).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada kursus yang ditambahkan</p>
                ) : (
                  <div className="space-y-2">
                    {getPathCourses(selectedPath).map((course, idx) => (
                      <div key={course.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{course.title}</p>
                          <p className="text-sm text-muted-foreground">{course.duration}</p>
                        </div>
                        <Badge variant="outline">{course.targetLevel}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPath.skills.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Keterampilan yang Dikembangkan</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPath.skills.map((skill, idx) => (
                      <Badge key={idx} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedPath(null)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
