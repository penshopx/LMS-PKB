import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus,
  Search,
  Users,
  Mail,
  Briefcase,
  Building,
  TrendingUp,
  BookOpen,
  Award,
  Eye,
  Download
} from "lucide-react";
import { Link } from "wouter";
import { getLevelColor, getStatusColor, getStatusLabel } from "@/lib/data";
import type { Participant, UnitCompetency, InsertParticipant } from "@shared/schema";

function ParticipantDialog({ participant, units }: { participant: Participant; units?: UnitCompetency[] }) {
  const gapCount = participant.competencies.filter(c => c.status === "gap").length;
  const achievedCount = participant.competencies.filter(c => c.status === "achieved").length;
  const inProgressCount = participant.learningHistory.filter(l => l.status === "in_progress").length;

  const getUnit = (unitId: string) => units?.find(u => u.id === unitId);

  return (
    <DialogContent className="max-w-2xl max-h-[85vh]">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {participant.name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle className="text-xl">{participant.name}</DialogTitle>
            <DialogDescription className="flex flex-col gap-1">
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {participant.position}
              </span>
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {participant.unit}
              </span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{gapCount}</p>
              <p className="text-xs text-red-700 dark:text-red-300">Gap</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-center">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressCount}</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">Sedang Belajar</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{achievedCount}</p>
              <p className="text-xs text-green-700 dark:text-green-300">Tercapai</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profil Kompetensi
            </h4>
            <div className="space-y-3">
              {participant.competencies.length > 0 ? participant.competencies.map((comp) => {
                const unit = getUnit(comp.unitId);
                return (
                  <div key={comp.unitId} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{unit?.code}</Badge>
                        <span className="text-sm font-medium">{unit?.name}</span>
                      </div>
                      <Badge className={getStatusColor(comp.status)}>
                        {getStatusLabel(comp.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getLevelColor(comp.currentLevel)}>{comp.currentLevel}</Badge>
                      <div className="flex-1">
                        <Progress 
                          value={(parseInt(comp.currentLevel.replace("L", "")) / parseInt(comp.targetLevel.replace("L", ""))) * 100} 
                          className="h-2" 
                        />
                      </div>
                      <Badge className={getLevelColor(comp.targetLevel)}>{comp.targetLevel}</Badge>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada kompetensi yang ditetapkan
                </p>
              )}
            </div>
          </div>

          {participant.learningHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Riwayat Pembelajaran
                </h4>
                <div className="space-y-2">
                  {participant.learningHistory.map((record) => (
                    <div key={record.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{record.courseId}</span>
                        <Badge variant={record.status === "completed" ? "default" : "secondary"}>
                          {record.status === "completed" ? "Selesai" : `${record.progress}%`}
                        </Badge>
                      </div>
                      {record.status !== "completed" && (
                        <Progress value={record.progress} className="h-1 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {participant.evidences.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Evidensi
                </h4>
                <div className="space-y-2">
                  {participant.evidences.map((evidence) => {
                    const unit = getUnit(evidence.unitId);
                    return (
                      <div key={evidence.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{evidence.title}</p>
                            <p className="text-xs text-muted-foreground">{unit?.code} | {evidence.type}</p>
                          </div>
                          <div className="text-right">
                            {evidence.score && (
                              <p className="font-semibold text-green-600 dark:text-green-400">{evidence.score}</p>
                            )}
                            <Badge className={getStatusColor(evidence.status === "approved" ? "achieved" : evidence.status)}>
                              {evidence.status === "approved" ? "Disetujui" : evidence.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Link href={`/passport?id=${participant.id}`}>
          <Button data-testid={`button-view-passport-${participant.id}`}>
            <Award className="h-4 w-4 mr-1" />
            Lihat Passport
          </Button>
        </Link>
      </div>
    </DialogContent>
  );
}

function CreateParticipantForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<InsertParticipant>({
    nip: "",
    name: "",
    email: "",
    position: "",
    unit: ""
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertParticipant) => {
      const res = await apiRequest("POST", "/api/participants", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/participants'] });
      toast({ title: "Berhasil", description: "Peserta berhasil ditambahkan" });
      onClose();
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menambahkan peserta", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!formData.nip || !formData.name || !formData.email || !formData.position || !formData.unit) {
      toast({ title: "Error", description: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nip">NIP</Label>
        <Input 
          id="nip" 
          placeholder="Masukkan NIP" 
          value={formData.nip}
          onChange={(e) => setFormData(prev => ({ ...prev, nip: e.target.value }))}
          data-testid="input-nip" 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nama Lengkap</Label>
        <Input 
          id="name" 
          placeholder="Masukkan nama lengkap" 
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          data-testid="input-name" 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="email@org.go.id" 
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          data-testid="input-email" 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position">Jabatan</Label>
        <Input 
          id="position" 
          placeholder="Contoh: Staf Senior" 
          value={formData.position}
          onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
          data-testid="input-position" 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Unit Kerja</Label>
        <Input 
          id="unit" 
          placeholder="Contoh: Operasional" 
          value={formData.unit}
          onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
          data-testid="input-unit" 
        />
      </div>
      
      <Separator />
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel">
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-create-participant">
          <Plus className="h-4 w-4 mr-1" />
          {createMutation.isPending ? "Menambahkan..." : "Tambah Peserta"}
        </Button>
      </div>
    </div>
  );
}

function ParticipantRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

function exportParticipantsCSV(participants: Participant[]) {
  const headers = ["NIP", "Nama", "Email", "Jabatan", "Unit Kerja", "Total Kompetensi", "Gap", "Tercapai", "Rata-rata Level"];
  const rows = participants.map(p => {
    const gapCount = p.competencies.filter(c => c.status === "gap").length;
    const achievedCount = p.competencies.filter(c => c.status === "achieved").length;
    const avgLevel = p.competencies.length
      ? (p.competencies.reduce((s, c) => s + parseInt(c.currentLevel.replace("L", "")), 0) / p.competencies.length).toFixed(2)
      : "0";
    return [p.nip, p.name, p.email, p.position, p.unit, p.competencies.length, gapCount, achievedCount, avgLevel];
  });
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `peserta-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Participants() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: participants, isLoading } = useQuery<Participant[]>({
    queryKey: ['/api/participants']
  });

  const { data: units } = useQuery<UnitCompetency[]>({
    queryKey: ['/api/units']
  });

  const filteredParticipants = participants?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nip.includes(searchQuery) ||
    p.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-participants">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Peserta</h1>
          <p className="text-muted-foreground">Kelola peserta dalam ekosistem kompetensi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => participants && exportParticipantsCSV(participants)}
            disabled={!participants?.length}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-participant">
              <Plus className="h-4 w-4 mr-1" />
              Tambah Peserta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Peserta Baru</DialogTitle>
              <DialogDescription>
                Masukkan data peserta untuk didaftarkan ke ekosistem kompetensi
              </DialogDescription>
            </DialogHeader>
            <CreateParticipantForm onClose={() => setShowCreateForm(false)} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Daftar Peserta
              </CardTitle>
              <CardDescription>{filteredParticipants?.length || 0} peserta terdaftar</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari peserta..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peserta</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => <ParticipantRowSkeleton key={i} />)
              ) : filteredParticipants && filteredParticipants.length > 0 ? (
                filteredParticipants.map((participant) => {
                  const gapCount = participant.competencies.filter(c => c.status === "gap").length;
                  const achievedCount = participant.competencies.filter(c => c.status === "achieved").length;
                  const totalCount = participant.competencies.length;
                  const progressPercent = totalCount > 0 ? (achievedCount / totalCount) * 100 : 0;

                  return (
                    <TableRow key={participant.id} data-testid={`row-participant-${participant.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {participant.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {participant.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{participant.position}</TableCell>
                      <TableCell>{participant.unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progressPercent} className="w-20 h-2" />
                          <span className="text-xs text-muted-foreground">{achievedCount}/{totalCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {gapCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">{gapCount} Gap</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">On Track</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-view-${participant.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <ParticipantDialog participant={participant} units={units} />
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "Tidak ada peserta yang sesuai pencarian" : "Belum ada peserta terdaftar"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
