import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Award,
  Briefcase,
  Building,
  Mail,
  Target,
  TrendingUp,
  BookOpen,
  FileText,
  Video,
  Presentation,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Download
} from "lucide-react";
import { getLevelColor, getStatusColor, CompetencyLevelNames } from "@/lib/data";
import type { Participant, CompetencyLevelType, UnitCompetency, ECourse, CompetencyCluster } from "@shared/schema";

const evidenceTypeIcons: Record<string, React.ElementType> = {
  document: FileText,
  video: Video,
  presentation: Presentation,
  reflection: MessageSquare
};

function CompetencyRadar({ participant, units, clusters }: { participant: Participant; units?: UnitCompetency[]; clusters?: CompetencyCluster[] }) {
  const getUnit = (unitId: string) => units?.find(u => u.id === unitId);
  const getLevelNum = (level: string) => parseInt(level.replace("L", ""));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {clusters?.map(cluster => {
        const competencies = participant.competencies.filter(
          competency => getUnit(competency.unitId)?.clusterId === cluster.id,
        );

        return (
          <Card key={cluster.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: cluster.color }}
                  aria-hidden="true"
                />
                {cluster.name}
              </CardTitle>
              <CardDescription className="text-xs">{cluster.fullName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {competencies.length > 0 ? competencies.map(comp => {
                const unit = getUnit(comp.unitId);
                const currentNum = getLevelNum(comp.currentLevel);
                const progress = (currentNum / 4) * 100;

                return (
                  <div key={comp.unitId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{unit?.code}</span>
                      <div className="flex items-center gap-1">
                        <Badge className={`${getLevelColor(comp.currentLevel)} text-xs`}>
                          {comp.currentLevel}
                        </Badge>
                        {comp.status !== "achieved" && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">
                              {comp.targetLevel}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada asesmen pada klaster ini
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecommendedLearning({ participant, units, courses }: { participant: Participant; units?: UnitCompetency[]; courses?: ECourse[] }) {
  const gapCompetencies = participant.competencies.filter(c => c.status === "gap");
  
  const getUnit = (unitId: string) => units?.find(u => u.id === unitId);
  const getCourse = (unitId: string) => courses?.find(c => c.unitId === unitId);
  
  const recommendations = gapCompetencies.slice(0, 3).map(gap => {
    const unit = getUnit(gap.unitId);
    const course = getCourse(gap.unitId);
    return { gap, unit, course };
  });

  return (
    <Card data-testid="card-recommendations">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Rekomendasi Pembelajaran
        </CardTitle>
        <CardDescription>Berdasarkan gap kompetensi</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map(({ gap, unit, course }) => (
              <div 
                key={gap.unitId}
                className="p-3 rounded-lg border border-border hover-elevate"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{unit?.code}</Badge>
                      <Badge className={getLevelColor(gap.targetLevel)} variant="secondary">
                        Target: {gap.targetLevel}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm">{unit?.name}</p>
                    {course && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Kursus tersedia: {course.title}
                      </p>
                    )}
                  </div>
                  <Button size="sm" data-testid={`button-start-learning-${gap.unitId}`}>
                    <BookOpen className="h-3 w-3 mr-1" />
                    Mulai
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="font-medium">Semua Kompetensi Tercapai</p>
            <p className="text-sm text-muted-foreground">Tidak ada gap yang perlu ditutup</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BadgesSection({ participant, units, clusters }: { participant: Participant; units?: UnitCompetency[]; clusters?: CompetencyCluster[] }) {
  const achievedComps = participant.competencies.filter(c => c.status === "achieved");
  
  const getUnit = (unitId: string) => units?.find(u => u.id === unitId);
  const getCluster = (clusterId: string) => clusters?.find(c => c.id === clusterId);
  
  return (
    <Card data-testid="card-badges">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4" />
          Badge & Micro-Credential
        </CardTitle>
        <CardDescription>Pengakuan kompetensi yang telah dicapai</CardDescription>
      </CardHeader>
      <CardContent>
        {achievedComps.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {achievedComps.map((comp) => {
              const unit = getUnit(comp.unitId);
              const cluster = getCluster(unit?.clusterId || '');
              
              return (
                <div 
                  key={comp.unitId}
                  className="p-4 rounded-lg border border-border text-center"
                >
                  <div 
                    className="h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: cluster?.color || '#888' }}
                  >
                    {comp.currentLevel}
                  </div>
                  <p className="font-medium text-sm">{unit?.code}</p>
                  <p className="text-xs text-muted-foreground">{unit?.name}</p>
                  <Badge className="mt-2 text-xs" variant="secondary">
                    {CompetencyLevelNames[comp.currentLevel as CompetencyLevelType]}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto opacity-30 mb-3" />
            <p className="text-sm">Belum ada badge yang diperoleh</p>
            <p className="text-xs">Selesaikan e-course dan asesmen untuk mendapatkan badge</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceBank({ participant, units }: { participant: Participant; units?: UnitCompetency[] }) {
  const getUnit = (unitId: string) => units?.find(u => u.id === unitId);
  
  return (
    <Card data-testid="card-evidence-bank">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Bank Evidensi
        </CardTitle>
        <CardDescription>Bukti kompetensi yang telah dikumpulkan</CardDescription>
      </CardHeader>
      <CardContent>
        {participant.evidences.length > 0 ? (
          <div className="space-y-3">
            {participant.evidences.map((evidence) => {
              const unit = getUnit(evidence.unitId);
              const Icon = evidenceTypeIcons[evidence.type] || FileText;
              
              return (
                <div 
                  key={evidence.id}
                  className="p-3 rounded-lg border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{evidence.title}</p>
                        <Badge className={getStatusColor(evidence.status === "approved" ? "achieved" : evidence.status)}>
                          {evidence.status === "approved" ? "Disetujui" : evidence.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{unit?.code} | {evidence.type}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {evidence.submittedAt}
                        </span>
                        {evidence.score && (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            Skor: {evidence.score}
                          </span>
                        )}
                      </div>
                      {evidence.feedback && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          "{evidence.feedback}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto opacity-30 mb-3" />
            <p className="text-sm">Belum ada evidensi</p>
            <p className="text-xs">Upload dokumen, video, atau presentasi sebagai bukti kompetensi</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PassportSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="h-24 bg-gradient-to-r from-blue-500 to-teal-500" />
        <CardContent className="relative pt-0">
          <div className="flex flex-col sm:flex-row items-start gap-4 -mt-12">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 pt-4 sm:pt-14 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Separator className="my-6" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Passport() {
  const { data: participants, isLoading: participantsLoading } = useQuery<Participant[]>({
    queryKey: ['/api/participants']
  });

  const { data: units } = useQuery<UnitCompetency[]>({
    queryKey: ['/api/units?includeArchived=true']
  });

  const { data: courses } = useQuery<ECourse[]>({
    queryKey: ['/api/courses?includeArchived=true']
  });

  const { data: clusters } = useQuery<CompetencyCluster[]>({
    queryKey: ['/api/clusters?includeArchived=true']
  });

  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  
  const participant = participants?.find(p => p.id === selectedParticipant) || participants?.[0];
  
  if (participantsLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-passport">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Paspor Kompetensi Konstruksi</h1>
            <p className="text-muted-foreground">Profil dan arsip pembelajaran individu. Kurikulum lama tidak dikonversi menjadi SKPK; L1–L4 bukan jenjang jabatan atau penetapan Angka Kredit resmi.</p>
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PassportSkeleton />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="p-6 text-center" data-testid="page-passport">
        <div className="py-12">
          <Award className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Tidak ada data peserta</h2>
          <p className="text-muted-foreground">Tambahkan peserta terlebih dahulu untuk melihat passport</p>
        </div>
      </div>
    );
  }

  const gapCount = participant.competencies.filter(c => c.status === "gap").length;
  const achievedCount = participant.competencies.filter(c => c.status === "achieved").length;
  const onTrackCount = participant.competencies.filter(c => c.status === "on_track").length;

  return (
    <div className="p-6 space-y-6" data-testid="page-passport">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Paspor Kompetensi Konstruksi</h1>
          <p className="text-muted-foreground">Profil dan arsip pembelajaran individu. Kurikulum lama tidak dikonversi menjadi SKPK; L1–L4 bukan jenjang jabatan atau penetapan Angka Kredit resmi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedParticipant || participant.id} onValueChange={setSelectedParticipant}>
            <SelectTrigger className="w-64" data-testid="select-participant">
              <SelectValue placeholder="Pilih peserta" />
            </SelectTrigger>
            <SelectContent>
              {participants?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} - {p.position}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-download-passport">
            <Download className="h-4 w-4 mr-1" />
            Unduh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden" data-testid="card-profile">
            <div className="h-24 bg-gradient-to-r from-blue-500 to-teal-500" />
            <CardContent className="relative pt-0">
              <div className="flex flex-col sm:flex-row items-start gap-4 -mt-12">
                <Avatar className="h-24 w-24 border-4 border-background">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {participant.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pt-4 sm:pt-14">
                  <h2 className="text-xl font-bold">{participant.name}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {participant.position}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {participant.unit}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {participant.email}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <AlertCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{gapCount}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">Gap</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{onTrackCount}</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">On Track</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{achievedCount}</p>
                  <p className="text-xs text-green-700 dark:text-green-300">Tercapai</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <CompetencyRadar participant={participant} units={units} clusters={clusters} />

          <Tabs defaultValue="evidence">
            <TabsList data-testid="tabs-passport-detail">
              <TabsTrigger value="evidence" data-testid="tab-evidence">Evidensi</TabsTrigger>
              <TabsTrigger value="badges" data-testid="tab-badges">Badge</TabsTrigger>
            </TabsList>
            <TabsContent value="evidence" className="mt-4">
              <EvidenceBank participant={participant} units={units} />
            </TabsContent>
            <TabsContent value="badges" className="mt-4">
              <BadgesSection participant={participant} units={units} clusters={clusters} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <RecommendedLearning participant={participant} units={units} courses={courses} />
          
          <Card data-testid="card-learning-history">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Riwayat Pembelajaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participant.learningHistory.length > 0 ? (
                <div className="space-y-3">
                  {participant.learningHistory.map((record) => {
                    const course = courses?.find(c => c.id === record.courseId);
                    
                    return (
                      <div key={record.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium truncate">
                            {course?.title || record.courseId}
                          </span>
                          <Badge variant={record.status === "completed" ? "default" : "secondary"}>
                            {record.status === "completed" ? "Selesai" : "Berjalan"}
                          </Badge>
                        </div>
                        {record.status !== "completed" && (
                          <div className="flex items-center gap-2">
                            <Progress value={record.progress} className="flex-1 h-1" />
                            <span className="text-xs text-muted-foreground">{record.progress}%</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Mulai: {record.startedAt}
                          {record.completedAt && ` | Selesai: ${record.completedAt}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">Belum ada riwayat pembelajaran</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
