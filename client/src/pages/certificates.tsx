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
  Award,
  Search,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  FileText,
  Shield,
  ExternalLink
} from "lucide-react";
import type { Certificate, Participant, ECourse, LearningPath } from "@shared/schema";

export default function Certificates() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [verificationNumber, setVerificationNumber] = useState("");
  const [verificationResult, setVerificationResult] = useState<{ valid: boolean; certificate?: Certificate } | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  const { data: certificates = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"]
  });

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/participants"]
  });

  const { data: courses = [] } = useQuery<ECourse[]>({
    queryKey: ["/api/courses"]
  });

  const { data: learningPaths = [] } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths"]
  });

  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/certificates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Berhasil", description: "Sertifikat berhasil diterbitkan" });
      setIsCreateDialogOpen(false);
    }
  });

  const verifyCertificateMutation = useMutation({
    mutationFn: async (certNumber: string) => {
      const response = await fetch(`/api/certificates/verify/${certNumber}`);
      return response.json();
    },
    onSuccess: (data) => {
      setVerificationResult(data);
    },
    onError: () => {
      setVerificationResult({ valid: false });
    }
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCertificateMutation.mutate({
      participantId: formData.get("participantId"),
      courseId: formData.get("courseId") || undefined,
      learningPathId: formData.get("learningPathId") || undefined,
      title: formData.get("title"),
      description: formData.get("description")
    });
  };

  const handleVerify = () => {
    if (verificationNumber.trim()) {
      verifyCertificateMutation.mutate(verificationNumber.trim());
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      active: { variant: "default", label: "Aktif" },
      expired: { variant: "secondary", label: "Kedaluwarsa" },
      revoked: { variant: "destructive", label: "Dicabut" }
    };
    const { variant, label } = config[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getParticipantName = (id: string) => {
    return participants.find(p => p.id === id)?.name || "Unknown";
  };

  const getCourseName = (id?: string) => {
    if (!id) return "-";
    return courses.find(c => c.id === id)?.title || "-";
  };

  const getPathName = (id?: string) => {
    if (!id) return "-";
    return learningPaths.find(p => p.id === id)?.title || "-";
  };

  if (isLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">Sertifikat</h1>
          <p className="text-muted-foreground">Kelola penerbitan dan verifikasi sertifikat kompetensi</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-verify-cert">
                <Search className="h-4 w-4 mr-2" />
                Verifikasi
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Verifikasi Sertifikat</DialogTitle>
                <DialogDescription>Masukkan nomor sertifikat untuk memverifikasi keasliannya</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nomor Sertifikat (CERT-...)" 
                    value={verificationNumber}
                    onChange={(e) => setVerificationNumber(e.target.value)}
                    data-testid="input-verify-number"
                  />
                  <Button onClick={handleVerify} disabled={verifyCertificateMutation.isPending} data-testid="button-do-verify">
                    {verifyCertificateMutation.isPending ? "..." : "Cek"}
                  </Button>
                </div>

                {verificationResult && (
                  <div className={`p-4 rounded-lg ${verificationResult.valid ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"}`}>
                    {verificationResult.valid ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Sertifikat Valid</span>
                        </div>
                        {verificationResult.certificate && (
                          <div className="space-y-2 text-sm">
                            <p><strong>Judul:</strong> {verificationResult.certificate.title}</p>
                            <p><strong>Penerima:</strong> {getParticipantName(verificationResult.certificate.participantId)}</p>
                            <p><strong>Nomor:</strong> {verificationResult.certificate.certificateNumber}</p>
                            <p><strong>Diterbitkan:</strong> {new Date(verificationResult.certificate.issuedAt).toLocaleDateString("id-ID")}</p>
                            <p><strong>Status:</strong> {getStatusBadge(verificationResult.certificate.status)}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">Sertifikat Tidak Ditemukan</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsVerifyDialogOpen(false);
                  setVerificationResult(null);
                  setVerificationNumber("");
                }}>Tutup</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-cert">
                <Plus className="h-4 w-4 mr-2" />
                Terbitkan Sertifikat
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Terbitkan Sertifikat Baru</DialogTitle>
                  <DialogDescription>Buat sertifikat untuk peserta yang telah menyelesaikan pembelajaran</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="participantId">Peserta</Label>
                    <Select name="participantId" required>
                      <SelectTrigger data-testid="select-participant">
                        <SelectValue placeholder="Pilih peserta" />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="title">Judul Sertifikat</Label>
                    <Input id="title" name="title" placeholder="Contoh: Sertifikat Kompetensi Analisis Strategis" required data-testid="input-cert-title" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea id="description" name="description" placeholder="Deskripsi pencapaian" required data-testid="input-cert-description" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="courseId">Kursus (Opsional)</Label>
                    <Select name="courseId">
                      <SelectTrigger data-testid="select-course">
                        <SelectValue placeholder="Pilih kursus" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="learningPathId">Jalur Pembelajaran (Opsional)</Label>
                    <Select name="learningPathId">
                      <SelectTrigger data-testid="select-path">
                        <SelectValue placeholder="Pilih jalur" />
                      </SelectTrigger>
                      <SelectContent>
                        {learningPaths.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={createCertificateMutation.isPending} data-testid="button-submit-cert">
                    {createCertificateMutation.isPending ? "Menerbitkan..." : "Terbitkan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sertifikat</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificates.length}</div>
            <p className="text-xs text-muted-foreground">Sertifikat diterbitkan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sertifikat Aktif</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certificates.filter(c => c.status === "active").length}</div>
            <p className="text-xs text-muted-foreground">Masih berlaku</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penerima Unik</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(certificates.map(c => c.participantId)).size}
            </div>
            <p className="text-xs text-muted-foreground">Peserta tersertifikasi</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Sertifikat</CardTitle>
          <CardDescription>Semua sertifikat yang telah diterbitkan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Penerima</TableHead>
                <TableHead>Kursus/Jalur</TableHead>
                <TableHead>Diterbitkan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Belum ada sertifikat yang diterbitkan
                  </TableCell>
                </TableRow>
              ) : (
                certificates.map((cert) => (
                  <TableRow key={cert.id} data-testid={`row-cert-${cert.id}`}>
                    <TableCell className="font-mono text-xs">{cert.certificateNumber}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{cert.title}</TableCell>
                    <TableCell>{getParticipantName(cert.participantId)}</TableCell>
                    <TableCell>
                      {cert.courseId ? getCourseName(cert.courseId) : 
                       cert.learningPathId ? getPathName(cert.learningPathId) : "-"}
                    </TableCell>
                    <TableCell>{new Date(cert.issuedAt).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>{getStatusBadge(cert.status)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedCertificate(cert)}
                        data-testid={`button-view-cert-${cert.id}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCertificate && (
        <Dialog open={!!selectedCertificate} onOpenChange={() => setSelectedCertificate(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detail Sertifikat</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-full max-w-md p-8 border-4 border-double border-primary/20 rounded-lg bg-gradient-to-b from-background to-muted/20">
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <Award className="h-16 w-16 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Sertifikat Kompetensi</h3>
                      <p className="text-lg font-medium mt-2">{selectedCertificate.title}</p>
                    </div>
                    <div className="py-4">
                      <p className="text-muted-foreground">Diberikan kepada</p>
                      <p className="text-xl font-semibold">{getParticipantName(selectedCertificate.participantId)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedCertificate.description}</p>
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground">Nomor Sertifikat</p>
                      <p className="font-mono text-sm">{selectedCertificate.certificateNumber}</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedCertificate.issuedAt).toLocaleDateString("id-ID", { 
                        day: "numeric", 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      {getStatusBadge(selectedCertificate.status)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCertificate(null)}>Tutup</Button>
              <Button data-testid="button-download-cert">
                <Download className="h-4 w-4 mr-2" />
                Unduh PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
