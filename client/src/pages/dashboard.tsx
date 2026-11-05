import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Route,
  FileQuestion,
  Award,
  ClipboardCheck,
  ArrowRight
} from "lucide-react";
import { 
  getLevelColor,
  CompetencyLevelNames
} from "@/lib/data";
import type { DashboardStats, HeatmapData, CompetencyCluster, CompetencyLevelType, LearningPath, Quiz, Certificate } from "@shared/schema";
import { GustaftaEcosystem } from "@/components/gustafta-ecosystem";

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  isLoading
}: { 
  title: string; 
  value: string | number; 
  description: string; 
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  isLoading?: boolean;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs mt-2 ${trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <TrendingUp className={`h-3 w-3 ${!trend.positive && 'rotate-180'}`} />
                <span>{trend.positive ? '+' : ''}{trend.value}% dari bulan lalu</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? (value / max) : 0;
  const bgOpacity = Math.max(0.1, intensity);
  
  return (
    <div 
      className="h-8 w-8 rounded flex items-center justify-center text-xs font-medium transition-colors"
      style={{ 
        backgroundColor: `hsl(199 89% 48% / ${bgOpacity})`,
        color: intensity > 0.5 ? 'white' : 'inherit'
      }}
    >
      {value}
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats']
  });

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery<HeatmapData[]>({
    queryKey: ['/api/dashboard/heatmap']
  });

  const { data: clusters } = useQuery<CompetencyCluster[]>({
    queryKey: ['/api/clusters']
  });

  const { data: learningPaths, isLoading: learningPathsLoading } = useQuery<LearningPath[]>({
    queryKey: ['/api/learning-paths']
  });

  const { data: quizzes, isLoading: quizzesLoading } = useQuery<Quiz[]>({
    queryKey: ['/api/quizzes']
  });

  const { data: certificates, isLoading: certificatesLoading } = useQuery<Certificate[]>({
    queryKey: ['/api/certificates']
  });

  const maxCount = heatmapData ? Math.max(...heatmapData.map(h => Math.max(h.l1Count, h.l2Count, h.l3Count, h.l4Count))) : 0;

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Kompetensi</h1>
        <p className="text-muted-foreground">Pantau perkembangan kompetensi teknik konstruksi di PKB ASDAMKINDO</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Peserta"
          value={stats?.totalParticipants || 0}
          description="Peserta aktif dalam ekosistem"
          icon={Users}
          trend={{ value: 12, positive: true }}
          isLoading={statsLoading}
        />
        <StatCard
          title="E-Course Tersedia"
          value={stats?.totalCourses || 0}
          description="Kursus berbasis kompetensi"
          icon={BookOpen}
          isLoading={statsLoading}
        />
        <StatCard
          title="Tingkat Penyelesaian"
          value={`${stats?.completionRate || 0}%`}
          description="Kursus yang diselesaikan"
          icon={Target}
          trend={{ value: 8, positive: true }}
          isLoading={statsLoading}
        />
        <StatCard
          title="Rata-rata Level"
          value={stats?.averageLevel?.toFixed(1) || "0"}
          description="Level kompetensi rata-rata"
          icon={TrendingUp}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-heatmap">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Heatmap Kompetensi
            </CardTitle>
            <CardDescription>Distribusi level per unit kompetensi</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapLoading ? (
              <HeatmapSkeleton />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4">Unit</th>
                      <th className="text-center px-2">L1</th>
                      <th className="text-center px-2">L2</th>
                      <th className="text-center px-2">L3</th>
                      <th className="text-center px-2">L4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {heatmapData?.map((row) => (
                      <tr key={row.unitId} className="text-sm">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="border-primary/50 text-primary"
                            >
                              {row.unitCode}
                            </Badge>
                            <span className="text-muted-foreground hidden sm:inline">{row.unitName}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center">
                            <HeatmapCell value={row.l1Count} max={maxCount} />
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center">
                            <HeatmapCell value={row.l2Count} max={maxCount} />
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center">
                            <HeatmapCell value={row.l3Count} max={maxCount} />
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center">
                            <HeatmapCell value={row.l4Count} max={maxCount} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-gaps">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Gap Kompetensi Kritis
            </CardTitle>
            <CardDescription>Unit kompetensi dengan gap terbesar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : stats?.competencyGaps?.length ? (
              stats.competencyGaps.map((gap, index) => (
                <div key={gap.unitId} className="space-y-2" data-testid={`gap-item-${index}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className="border-primary/50 text-primary"
                      >
                        {gap.clusterCode}
                      </Badge>
                      <span className="text-sm font-medium">{gap.unitName}</span>
                    </div>
                    <Badge variant="secondary">{gap.gapCount} orang</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">
                      L{gap.avgCurrentLevel.toFixed(1)} → L{gap.avgTargetLevel.toFixed(1)}
                    </span>
                    <Progress 
                      value={(gap.avgCurrentLevel / gap.avgTargetLevel) * 100} 
                      className="flex-1 h-2"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada gap kritis</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-level-distribution">
          <CardHeader>
            <CardTitle>Distribusi Level Kompetensi</CardTitle>
            <CardDescription>Sebaran peserta berdasarkan level</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {stats?.levelDistribution?.map((dist) => (
                  <div key={dist.level} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getLevelColor(dist.level)}>
                          {dist.level}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {CompetencyLevelNames[dist.level as CompetencyLevelType]}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{dist.count} ({dist.percentage}%)</span>
                    </div>
                    <Progress value={dist.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-clusters">
          <CardHeader>
            <CardTitle>Klaster Kompetensi</CardTitle>
            <CardDescription>Overview klaster yang tersedia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {clusters?.map((cluster) => (
              <div 
                key={cluster.id} 
                className="p-4 rounded-lg border border-border hover-elevate"
                data-testid={`cluster-${cluster.code.toLowerCase()}`}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: cluster.color }}
                  >
                    {cluster.code.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{cluster.name}</h3>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{cluster.fullName}</p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{cluster.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="hover-elevate" data-testid="card-quick-learning-paths">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Route className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {learningPathsLoading ? (
              <Skeleton className="h-8 w-12 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{learningPaths?.length || 0}</div>
            )}
            <p className="text-sm text-muted-foreground">Jalur Pembelajaran</p>
            <Link href="/app/learning-paths">
              <Button variant="ghost" className="p-0 h-auto mt-2" data-testid="link-learning-paths">
                Lihat Semua <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-quick-quizzes">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileQuestion className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            {quizzesLoading ? (
              <Skeleton className="h-8 w-12 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{quizzes?.length || 0}</div>
            )}
            <p className="text-sm text-muted-foreground">Kuis Tersedia</p>
            <Link href="/app/quizzes">
              <Button variant="ghost" className="p-0 h-auto mt-2" data-testid="link-quizzes">
                Kelola Kuis <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-quick-assessment">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-teal-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LSP</div>
            <p className="text-sm text-muted-foreground">Sertifikasi Profesi</p>
            <Link href="/app/assessment">
              <Button variant="ghost" className="p-0 h-auto mt-2" data-testid="link-assessment">
                Kelola Asesmen <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-quick-certificates">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            {certificatesLoading ? (
              <Skeleton className="h-8 w-12 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{certificates?.length || 0}</div>
            )}
            <p className="text-sm text-muted-foreground">Sertifikat Diterbitkan</p>
            <Link href="/app/certificates">
              <Button variant="ghost" className="p-0 h-auto mt-2" data-testid="link-certificates">
                Kelola Sertifikat <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <GustaftaEcosystem compact location="dashboard" />
    </div>
  );
}
