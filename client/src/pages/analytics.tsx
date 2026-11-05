import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  Users
} from "lucide-react";

interface AnalyticsData {
  monthlyTrend: { month: string; completions: number; enrollments: number }[];
  levelDistributionByCluster: { cluster: string; L1: number; L2: number; L3: number; L4: number }[];
  courseCompletionByLevel: { level: string; count: number }[];
  topGapUnits: { name: string; gap: number; code: string }[];
  participantsByUnit: { unit: string; count: number }[];
}

const LEVEL_COLORS = {
  L1: "#94a3b8",
  L2: "#60a5fa",
  L3: "#34d399",
  L4: "#a78bfa"
};

const PIE_COLORS = ["#94a3b8", "#60a5fa", "#34d399", "#a78bfa"];

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"]
  });

  const totalCourses = data?.courseCompletionByLevel?.reduce((s, c) => s + c.count, 0) || 0;

  const radarData = data?.levelDistributionByCluster?.flatMap(c =>
    ["L1", "L2", "L3", "L4"].map(l => ({
      subject: `${c.cluster}-${l}`,
      cluster: c.cluster,
      level: l,
      value: c[l as keyof typeof c] as number
    }))
  );

  const radarFormatted = data?.levelDistributionByCluster
    ? ["L1", "L2", "L3", "L4"].map(l => {
        const entry: Record<string, string | number> = { level: l };
        data.levelDistributionByCluster.forEach(c => {
          entry[c.cluster] = c[l as keyof typeof c] as number;
        });
        return entry;
      })
    : [];

  return (
    <div className="p-6 space-y-6" data-testid="page-analytics">
      <div>
        <h1 className="text-2xl font-bold">Analitik & Laporan</h1>
        <p className="text-muted-foreground">Visualisasi perkembangan pembelajaran kompetensi teknik konstruksi di PKB ASDAMKINDO</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Peserta Terdaftar", value: data?.participantsByUnit?.[0]?.count ?? "—", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Unit Paling Aktif", value: data?.participantsByUnit?.[0]?.unit ?? "—", icon: BarChart3, color: "text-teal-500", bg: "bg-teal-500/10" },
          { label: "Total Kursus", value: totalCourses, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Gap Tertinggi", value: data?.topGapUnits?.[0]?.code ?? "—", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((stat) => (
          <Card key={stat.label} data-testid={`analytics-stat-${stat.label}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="chart-monthly-trend">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Tren Pembelajaran Bulanan
            </CardTitle>
            <CardDescription>Jumlah pendaftaran dan penyelesaian kursus per bulan</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="enrollments" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Pendaftaran" />
                  <Line type="monotone" dataKey="completions" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} name="Penyelesaian" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-testid="chart-level-cluster">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Distribusi Level per Klaster
            </CardTitle>
            <CardDescription>Perbandingan tahap belajar internal pada kategori PKB, bukan perolehan SKPK atau jenjang jabatan</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.levelDistributionByCluster}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="cluster" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="L1" fill={LEVEL_COLORS.L1} name="L1 Awareness" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="L2" fill={LEVEL_COLORS.L2} name="L2 Application" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="L3" fill={LEVEL_COLORS.L3} name="L3 Mastery" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="L4" fill={LEVEL_COLORS.L4} name="L4 Strategic" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-testid="chart-course-by-level">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-teal-500" />
              Kursus per Level Target
            </CardTitle>
            <CardDescription>Distribusi kursus berdasarkan level target kompetensi</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {isLoading ? <ChartSkeleton height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data?.courseCompletionByLevel}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="level"
                    label={({ level, count }) => `${level}: ${count}`}
                    labelLine={false}
                  >
                    {data?.courseCompletionByLevel?.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-testid="chart-gap-units">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Top Unit dengan Gap
            </CardTitle>
            <CardDescription>Unit kompetensi dengan jumlah gap peserta terbanyak</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton height={200} /> : (
              <div className="space-y-3">
                {data?.topGapUnits?.map((unit, i) => (
                  <div key={unit.code} className="flex items-center gap-3" data-testid={`gap-unit-${unit.code}`}>
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant="outline" className="text-xs">{unit.code}</Badge>
                        <span className="text-xs font-semibold text-amber-500">{unit.gap} orang</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (unit.gap / (data.topGapUnits[0]?.gap || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(!data?.topGapUnits?.length) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada gap terdeteksi</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="chart-radar">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-500" />
              Radar Kompetensi Level
            </CardTitle>
            <CardDescription>Perbandingan level seluruh klaster kompetensi dalam format radar</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarFormatted}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="level" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  {data?.levelDistributionByCluster?.map((c, i) => (
                    <Radar
                      key={c.cluster}
                      name={c.cluster}
                      dataKey={c.cluster}
                      stroke={i === 0 ? "#60a5fa" : "#34d399"}
                      fill={i === 0 ? "#60a5fa" : "#34d399"}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="chart-participants-by-unit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Peserta per Unit Kompetensi
          </CardTitle>
          <CardDescription>Distribusi jumlah peserta yang memiliki kompetensi di setiap unit</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <ChartSkeleton height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.participantsByUnit} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="unit" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Peserta" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
