import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ChevronRight,
  Target,
  CheckCircle2,
  BookOpen,
  Layers,
  Plus,
  Pencil,
  Trash2,
  FolderPlus
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getLevelColor, CompetencyLevelNames, CompetencyLevelDescriptions } from "@/lib/data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UnitCompetency, CompetencyCluster, CompetencyLevelType } from "@shared/schema";

const colorOptions = [
  { value: "hsl(199 89% 48%)", label: "Biru", preview: "bg-blue-500" },
  { value: "hsl(172 66% 50%)", label: "Teal", preview: "bg-teal-500" },
  { value: "hsl(142 76% 36%)", label: "Hijau", preview: "bg-green-600" },
  { value: "hsl(262 83% 58%)", label: "Ungu", preview: "bg-purple-500" },
  { value: "hsl(25 95% 53%)", label: "Oranye", preview: "bg-orange-500" },
  { value: "hsl(346 77% 49%)", label: "Merah", preview: "bg-rose-500" },
];

function AddClusterDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    fullName: "",
    description: "",
    color: colorOptions[0].value
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/clusters', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clusters'] });
      setOpen(false);
      setFormData({ code: "", name: "", fullName: "", description: "", color: colorOptions[0].value });
      toast({ title: "Berhasil", description: "Cluster kompetensi berhasil ditambahkan" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menambahkan cluster", variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-cluster">
          <FolderPlus className="h-4 w-4 mr-1" />
          Tambah Cluster
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Cluster Kompetensi</DialogTitle>
          <DialogDescription>Buat cluster baru untuk mengelompokkan unit kompetensi</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cluster-code">Kode Cluster</Label>
              <Input 
                id="cluster-code"
                data-testid="input-cluster-code"
                placeholder="contoh: LEAD"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-name">Nama Singkat</Label>
              <Input 
                id="cluster-name"
                data-testid="input-cluster-name"
                placeholder="contoh: Leadership"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cluster-fullname">Nama Lengkap</Label>
            <Input 
              id="cluster-fullname"
              data-testid="input-cluster-fullname"
              placeholder="contoh: Leadership & Team Development"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cluster-desc">Deskripsi</Label>
            <Textarea 
              id="cluster-desc"
              data-testid="input-cluster-description"
              placeholder="Deskripsi cluster kompetensi..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Warna</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  data-testid={`button-color-${color.label.toLowerCase()}`}
                  className={`h-8 w-8 rounded-full ${color.preview} ${formData.color === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                />
              ))}
            </div>
          </div>
          <Button 
            className="w-full" 
            data-testid="button-submit-cluster"
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isPending || !formData.code || !formData.name || !formData.fullName || !formData.description}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan Cluster"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddUnitDialog({ clusters, onSuccess }: { clusters: CompetencyCluster[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    clusterId: "",
    code: "",
    name: "",
    description: ""
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/units', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      setOpen(false);
      setFormData({ clusterId: "", code: "", name: "", description: "" });
      toast({ title: "Berhasil", description: "Unit kompetensi berhasil ditambahkan" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menambahkan unit", variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-add-unit">
          <Plus className="h-4 w-4 mr-1" />
          Tambah Unit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Unit Kompetensi</DialogTitle>
          <DialogDescription>Buat unit kompetensi baru dalam cluster</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="unit-cluster">Cluster</Label>
            <Select 
              value={formData.clusterId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, clusterId: value }))}
            >
              <SelectTrigger data-testid="select-unit-cluster">
                <SelectValue placeholder="Pilih cluster" />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((cluster) => (
                  <SelectItem key={cluster.id} value={cluster.id} data-testid={`option-cluster-${cluster.code.toLowerCase()}`}>
                    {cluster.code} - {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit-code">Kode Unit</Label>
              <Input 
                id="unit-code"
                data-testid="input-unit-code"
                placeholder="contoh: LEAD-01"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-name">Nama Unit</Label>
              <Input 
                id="unit-name"
                data-testid="input-unit-name"
                placeholder="contoh: Kepemimpinan Tim"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-desc">Deskripsi</Label>
            <Textarea 
              id="unit-desc"
              data-testid="input-unit-description"
              placeholder="Deskripsi unit kompetensi..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <Button 
            className="w-full" 
            data-testid="button-submit-unit"
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isPending || !formData.clusterId || !formData.code || !formData.name || !formData.description}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan Unit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnitCard({ unit, clusters, onDelete }: { unit: UnitCompetency; clusters?: CompetencyCluster[]; onDelete: (id: string) => void }) {
  const cluster = clusters?.find(c => c.id === unit.clusterId);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/units/${unit.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      toast({ title: "Berhasil", description: "Unit kompetensi berhasil dihapus" });
      onDelete(unit.id);
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menghapus unit", variant: "destructive" });
    }
  });
  
  return (
    <Card className="hover-elevate" data-testid={`unit-card-${unit.code.toLowerCase()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge 
              variant="outline"
              style={cluster ? { borderColor: cluster.color, color: cluster.color } : undefined}
              className="mb-2"
            >
              {unit.code}
            </Badge>
            <CardTitle className="text-lg">{unit.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              data-testid={`button-delete-unit-${unit.code.toLowerCase()}`}
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
        <CardDescription>{unit.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="indicators" className="border-none">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span>Indikator Perilaku</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {unit.indicators.map((indicator) => (
                  <div key={indicator.level} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getLevelColor(indicator.level)}>
                        {indicator.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {CompetencyLevelNames[indicator.level as CompetencyLevelType]}
                      </span>
                    </div>
                    <ul className="space-y-1 pl-4">
                      {indicator.indicators.map((ind, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Link href={`/courses?unit=${unit.id}`}>
            <Button variant="outline" size="sm" data-testid={`button-view-courses-${unit.code.toLowerCase()}`}>
              <BookOpen className="h-4 w-4 mr-1" />
              Lihat E-Course
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LevelGuide() {
  return (
    <Card data-testid="card-level-guide">
      <CardHeader>
        <CardTitle className="text-lg">Panduan Level Kompetensi</CardTitle>
        <CardDescription>Framework 4 level untuk pengembangan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {(["L1", "L2", "L3", "L4"] as CompetencyLevelType[]).map((level) => (
            <div 
              key={level} 
              className="flex items-start gap-3 p-3 rounded-lg border border-border"
            >
              <Badge className={`${getLevelColor(level)} shrink-0`}>
                {level}
              </Badge>
              <div>
                <p className="font-medium text-sm">{CompetencyLevelNames[level]}</p>
                <p className="text-xs text-muted-foreground">{CompetencyLevelDescriptions[level]}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UnitCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-20 mb-2" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
        <div className="mt-4 pt-4 border-t border-border">
          <Skeleton className="h-8 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Competencies() {
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  const { data: clusters, isLoading: clustersLoading, isError: clustersError } = useQuery<CompetencyCluster[]>({
    queryKey: ['/api/clusters']
  });

  const { data: units, isLoading: unitsLoading, isError: unitsError } = useQuery<UnitCompetency[]>({
    queryKey: ['/api/units']
  });

  const deleteClusterMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/clusters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clusters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      toast({ title: "Berhasil", description: "Cluster berhasil dihapus" });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal menghapus cluster", variant: "destructive" });
    }
  });

  const isLoading = clustersLoading || unitsLoading;
  const isError = clustersError || unitsError;

  // Group units by cluster
  const getUnitsByCluster = (clusterId: string) => {
    return units?.filter(u => u.clusterId === clusterId) || [];
  };

  // Get units for active tab
  const displayUnits = activeTab === "all" 
    ? units || []
    : units?.filter(u => {
        const cluster = clusters?.find(c => c.id === u.clusterId);
        return cluster?.code.toLowerCase() === activeTab;
      }) || [];

  if (isError) {
    return (
      <div className="p-6" data-testid="page-competencies-error">
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Gagal memuat data kompetensi. Silakan coba lagi.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/clusters'] });
                queryClient.invalidateQueries({ queryKey: ['/api/units'] });
              }}
            >
              Muat Ulang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-competencies">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kompetensi PUB-ASPEKINDO</h1>
          <p className="text-muted-foreground">Kelola domain SIAP dan Kepatuhan untuk bisnis serta tenaga kerja konstruksi</p>
        </div>
        <div className="flex items-center gap-2">
          <AddClusterDialog onSuccess={() => {}} />
          {clusters && clusters.length > 0 && (
            <AddUnitDialog clusters={clusters} onSuccess={() => {}} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1" data-testid="tabs-cluster">
              <TabsTrigger value="all" data-testid="tab-all">Semua</TabsTrigger>
              {clusters?.map((cluster) => (
                <TabsTrigger 
                  key={cluster.id} 
                  value={cluster.code.toLowerCase()} 
                  data-testid={`tab-${cluster.code.toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    {cluster.code}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => <UnitCardSkeleton key={i} />)}
                </div>
              ) : displayUnits.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Belum ada unit kompetensi</p>
                    <p className="text-sm text-muted-foreground">Klik "Tambah Unit" untuk membuat unit kompetensi baru</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {displayUnits.map((unit) => (
                    <UnitCard 
                      key={unit.id} 
                      unit={unit} 
                      clusters={clusters} 
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <LevelGuide />
          
          <Card data-testid="card-cluster-summary">
            <CardHeader>
              <CardTitle className="text-lg">Klaster Kompetensi</CardTitle>
              <CardDescription>Kelola cluster kompetensi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {clustersLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : clusters?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada cluster
                </p>
              ) : (
                clusters?.map((cluster) => (
                  <div key={cluster.id} className="space-y-2 p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <span className="font-medium text-sm">{cluster.code}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        data-testid={`button-delete-cluster-${cluster.code.toLowerCase()}`}
                        onClick={() => deleteClusterMutation.mutate(cluster.id)}
                        disabled={deleteClusterMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cluster.fullName}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ChevronRight className="h-3 w-3" />
                      {getUnitsByCluster(cluster.id).length} Unit Kompetensi
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
