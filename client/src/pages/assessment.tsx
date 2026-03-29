import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ClipboardCheck,
  UserCheck,
  Users,
  Plus,
  Calendar,
  MapPin,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building
} from "lucide-react";
import type { Assessor, Assessee, CompetencyScheme, AssessmentSchedule, Participant } from "@shared/schema";

export default function Assessment() {
  const { toast } = useToast();
  const [isAssessorDialogOpen, setIsAssessorDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: assessors = [], isLoading: assessorsLoading } = useQuery<Assessor[]>({
    queryKey: ["/api/assessors"]
  });

  const { data: assessees = [] } = useQuery<Assessee[]>({
    queryKey: ["/api/assessees"]
  });

  const { data: schemes = [] } = useQuery<CompetencyScheme[]>({
    queryKey: ["/api/schemes"]
  });

  const { data: schedules = [] } = useQuery<AssessmentSchedule[]>({
    queryKey: ["/api/schedules"]
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/participants"]
  });

  const { data: lspOrgs = [] } = useQuery<any[]>({
    queryKey: ["/api/lsp-organizations"]
  });

  const createAssessorMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/assessors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessors"] });
      toast({ title: "Berhasil", description: "Asesor berhasil ditambahkan" });
      setIsAssessorDialogOpen(false);
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/schedules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({ title: "Berhasil", description: "Jadwal asesmen berhasil dibuat" });
      setIsScheduleDialogOpen(false);
    }
  });

  const handleAssessorSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAssessorMutation.mutate({
      registrationNumber: formData.get("registrationNumber"),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      lspId: formData.get("lspId") || "lsp-001",
      validUntil: formData.get("validUntil"),
      competencySchemes: [],
      specializations: formData.get("specializations")?.toString().split(",").map(s => s.trim()).filter(Boolean) || []
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      registered: { variant: "outline", label: "Terdaftar" },
      self_assessment: { variant: "secondary", label: "Asesmen Mandiri" },
      portfolio_review: { variant: "secondary", label: "Review Portfolio" },
      scheduled: { variant: "default", label: "Terjadwal" },
      assessed: { variant: "default", label: "Dinilai" },
      certified: { variant: "default", label: "Kompeten" },
      not_certified: { variant: "destructive", label: "Belum Kompeten" },
      active: { variant: "default", label: "Aktif" },
      inactive: { variant: "secondary", label: "Nonaktif" },
      completed: { variant: "default", label: "Selesai" },
      in_progress: { variant: "secondary", label: "Berlangsung" },
      cancelled: { variant: "destructive", label: "Dibatalkan" }
    };
    const { variant, label } = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      written_test: "Tes Tertulis",
      practical_test: "Tes Praktik",
      oral_interview: "Wawancara",
      portfolio: "Portfolio",
      observation: "Observasi",
      simulation: "Simulasi",
      apl: "APL"
    };
    return labels[method] || method;
  };

  if (assessorsLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">Asesmen & Sertifikasi LSP</h1>
          <p className="text-muted-foreground">Kelola proses asesmen dan sertifikasi kompetensi</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asesor</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessors.length}</div>
            <p className="text-xs text-muted-foreground">
              {assessors.filter(a => a.status === "active").length} aktif
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asesi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessees.length}</div>
            <p className="text-xs text-muted-foreground">
              {assessees.filter(a => a.status === "certified").length} tersertifikasi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skema Aktif</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schemes.filter(s => s.isActive).length}</div>
            <p className="text-xs text-muted-foreground">Skema sertifikasi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jadwal Asesmen</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.filter(s => s.status === "scheduled").length}</div>
            <p className="text-xs text-muted-foreground">Terjadwal</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger value="assessors" data-testid="tab-assessors">
            <UserCheck className="h-4 w-4 mr-2" />
            Asesor
          </TabsTrigger>
          <TabsTrigger value="schemes" data-testid="tab-schemes">
            <FileCheck className="h-4 w-4 mr-2" />
            Skema
          </TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">
            <Calendar className="h-4 w-4 mr-2" />
            Jadwal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Skema Sertifikasi Tersedia</CardTitle>
                <CardDescription>Daftar skema yang dapat diikuti peserta</CardDescription>
              </CardHeader>
              <CardContent>
                {schemes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada skema sertifikasi
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schemes.map((scheme) => (
                      <div key={scheme.id} className="flex items-start justify-between p-3 border rounded-lg" data-testid={`scheme-${scheme.id}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{scheme.name}</p>
                            {scheme.isActive && <Badge variant="secondary">Aktif</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{scheme.code}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {scheme.assessmentMethods.slice(0, 3).map((method) => (
                              <Badge key={method} variant="outline" className="text-xs">
                                {getMethodLabel(method)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">Rp {scheme.fee.toLocaleString("id-ID")}</p>
                          <p className="text-sm text-muted-foreground">{scheme.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Jadwal Asesmen Mendatang</CardTitle>
                <CardDescription>Asesmen yang akan dilaksanakan</CardDescription>
              </CardHeader>
              <CardContent>
                {schedules.filter(s => s.status === "scheduled").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Tidak ada jadwal asesmen
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.filter(s => s.status === "scheduled").slice(0, 5).map((schedule) => {
                      const scheme = schemes.find(s => s.id === schedule.schemeId);
                      const assessor = assessors.find(a => a.id === schedule.assessorId);
                      
                      return (
                        <div key={schedule.id} className="flex items-start justify-between p-3 border rounded-lg" data-testid={`schedule-${schedule.id}`}>
                          <div className="space-y-1">
                            <p className="font-medium">{scheme?.name || "Unknown Scheme"}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(schedule.scheduledDate).toLocaleDateString("id-ID")}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {schedule.location}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{assessor?.name || "TBA"}</p>
                            {getStatusBadge(schedule.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assessors" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAssessorDialogOpen} onOpenChange={setIsAssessorDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-assessor">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Asesor
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleAssessorSubmit}>
                  <DialogHeader>
                    <DialogTitle>Tambah Asesor Baru</DialogTitle>
                    <DialogDescription>Daftarkan asesor baru untuk melakukan asesmen</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="registrationNumber">Nomor Registrasi Asesor (NRA)</Label>
                      <Input id="registrationNumber" name="registrationNumber" placeholder="Contoh: NRA-2024-0001" required data-testid="input-assessor-nra" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nama Lengkap</Label>
                      <Input id="name" name="name" placeholder="Nama asesor" required data-testid="input-assessor-name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="email@domain.com" required data-testid="input-assessor-email" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Telepon</Label>
                        <Input id="phone" name="phone" placeholder="+62..." required data-testid="input-assessor-phone" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="validUntil">Masa Berlaku</Label>
                      <Input id="validUntil" name="validUntil" type="date" required data-testid="input-assessor-valid" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="specializations">Spesialisasi (pisahkan dengan koma)</Label>
                      <Input id="specializations" name="specializations" placeholder="Strategic Management, Leadership" data-testid="input-assessor-spec" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAssessorDialogOpen(false)}>Batal</Button>
                    <Button type="submit" disabled={createAssessorMutation.isPending} data-testid="button-submit-assessor">
                      {createAssessorMutation.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NRA</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Spesialisasi</TableHead>
                    <TableHead>Asesmen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada asesor terdaftar
                      </TableCell>
                    </TableRow>
                  ) : (
                    assessors.map((assessor) => (
                      <TableRow key={assessor.id} data-testid={`row-assessor-${assessor.id}`}>
                        <TableCell className="font-mono text-sm">{assessor.registrationNumber}</TableCell>
                        <TableCell className="font-medium">{assessor.name}</TableCell>
                        <TableCell>{assessor.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assessor.specializations.slice(0, 2).map((spec, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{spec}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{assessor.totalAssessments}</TableCell>
                        <TableCell>{getStatusBadge(assessor.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schemes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skema Sertifikasi Kompetensi</CardTitle>
              <CardDescription>Daftar skema sertifikasi yang tersedia</CardDescription>
            </CardHeader>
            <CardContent>
              {schemes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada skema sertifikasi
                </div>
              ) : (
                <div className="space-y-4">
                  {schemes.map((scheme) => (
                    <Card key={scheme.id} data-testid={`card-scheme-${scheme.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{scheme.name}</CardTitle>
                            <CardDescription>{scheme.code}</CardDescription>
                          </div>
                          {scheme.isActive && <Badge>Aktif</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{scheme.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Durasi:</span>
                            <span className="ml-2 font-medium">{scheme.duration}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Biaya:</span>
                            <span className="ml-2 font-medium">Rp {scheme.fee.toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Metode Asesmen:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {scheme.assessmentMethods.map((method) => (
                              <Badge key={method} variant="secondary">{getMethodLabel(method)}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Unit Kompetensi:</span>
                          <span className="ml-2 font-medium">{scheme.unitIds.length} unit</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Skema</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada jadwal asesmen
                      </TableCell>
                    </TableRow>
                  ) : (
                    schedules.map((schedule) => {
                      const scheme = schemes.find(s => s.id === schedule.schemeId);
                      const assessor = assessors.find(a => a.id === schedule.assessorId);
                      
                      return (
                        <TableRow key={schedule.id} data-testid={`row-schedule-${schedule.id}`}>
                          <TableCell>{new Date(schedule.scheduledDate).toLocaleDateString("id-ID")}</TableCell>
                          <TableCell className="font-medium">{scheme?.name || "-"}</TableCell>
                          <TableCell>{assessor?.name || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {schedule.location}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {schedule.methods.slice(0, 2).map((method) => (
                                <Badge key={method} variant="outline" className="text-xs">
                                  {getMethodLabel(method)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
