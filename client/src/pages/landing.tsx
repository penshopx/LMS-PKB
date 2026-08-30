import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  GraduationCap,
  Target,
  BookOpen,
  Users,
  Award,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Compass,
  Globe,
  PlayCircle,
  Edit3,
  MessageCircle,
  Layers,
  Sparkles,
  Route,
  FileQuestion,
  ClipboardCheck,
  FileCheck,
  Shield
} from "lucide-react";
import { BrandMark, BRAND_NAME, BRAND_TAGLINE } from "@/components/brand-mark";
import { GustaftaEcosystem } from "@/components/gustafta-ecosystem";

const features = [
  {
    icon: Target,
    title: "Berbasis Kompetensi",
    description: "Bangun e-course dari unit kompetensi yang terukur, bukan sekadar materi pembelajaran"
  },
  {
    icon: Layers,
    title: "4 Level Progresi",
    description: "Struktur L1-L4 dari Awareness hingga Strategic untuk pengembangan bertahap"
  },
  {
    icon: BookOpen,
    title: "6 Langkah Terstruktur",
    description: "Template standar: Orientasi, Konteks, Microlearning, Praktik, Asesmen, Refleksi"
  },
  {
    icon: Route,
    title: "Jalur Pembelajaran",
    description: "Learning paths dengan prerequisite dan progress tracking otomatis"
  },
  {
    icon: FileQuestion,
    title: "Quiz Engine",
    description: "Kuis dengan berbagai tipe soal: pilihan ganda, benar/salah, dan esai"
  },
  {
    icon: Award,
    title: "Sertifikat Digital",
    description: "Generate dan verifikasi sertifikat dengan kode unik dan QR code"
  }
];

const pubDomains = [
  {
    icon: FileCheck,
    title: "SIAP Legalitas dan Perizinan",
    description: "Legalitas BUJK, perizinan berusaha, serta kepatuhan data dan pelaporan sektor jasa konstruksi."
  },
  {
    icon: Award,
    title: "SIAP Sertifikasi",
    description: "Kesiapan SBU dan pengelolaan SKK bagi tenaga kerja konstruksi sesuai kebutuhan badan usaha dan proyek."
  },
  {
    icon: ClipboardCheck,
    title: "SIAP Tender",
    description: "Kualifikasi, dokumen pemilihan, penawaran, klarifikasi, dan pengendalian risiko kontraktual."
  },
  {
    icon: Target,
    title: "SIAP Proyek",
    description: "Administrasi kontrak, pengendalian kinerja, mutu, keselamatan konstruksi, keuangan, dan pelaporan proyek."
  }
];

const heroDomainCards = [
  {
    icon: FileCheck,
    title: "SIAP Legalitas",
    description: "Legalitas dan perizinan BUJK"
  },
  {
    icon: Award,
    title: "SIAP Sertifikasi",
    description: "SBU dan kompetensi tenaga kerja"
  },
  {
    icon: ClipboardCheck,
    title: "SIAP Tender",
    description: "Kualifikasi dan dokumen penawaran"
  },
  {
    icon: Target,
    title: "SIAP Proyek",
    description: "Administrasi dan kendali proyek"
  }
];

const lspFeatures = [
  {
    icon: Shield,
    title: "LSP Terintegrasi",
    description: "Dukung proses sertifikasi SKK dengan standar BNSP dan SKKNI mapping"
  },
  {
    icon: ClipboardCheck,
    title: "Asesmen Komprehensif",
    description: "6 metode asesmen: APL, Observasi, Wawancara, Tes Tertulis, Portfolio, Simulasi"
  },
  {
    icon: Users,
    title: "Manajemen Asesor",
    description: "Kelola asesor dengan NRA (Nomor Registrasi Asesor) dan sertifikasi BNSP"
  },
  {
    icon: FileCheck,
    title: "Competency Passport",
    description: "Dokumentasi kompetensi lengkap untuk keputusan pengembangan talenta"
  },
  {
    icon: BarChart3,
    title: "Dashboard Analitik",
    description: "Heatmap visualisasi dan tracking progress peserta secara real-time"
  },
  {
    icon: Target,
    title: "SKKNI Mapping",
    description: "Petakan kompetensi ke standar SKKNI untuk persiapan ujian SKK"
  }
];

const lessonSteps = [
  { icon: Compass, title: "Orientasi", desc: "Standar & indikator" },
  { icon: Globe, title: "Konteks", desc: "Studi kasus nyata" },
  { icon: PlayCircle, title: "Microlearning", desc: "Video & artikel" },
  { icon: Edit3, title: "Praktik", desc: "Tugas berbasis kerja" },
  { icon: CheckCircle, title: "Asesmen", desc: "Project & observasi" },
  { icon: MessageCircle, title: "Refleksi", desc: "Evidensi & portofolio" }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
             <BrandMark size="sm" />
             <div className="flex flex-col">
               <span className="font-bold text-sm sm:text-lg lg:text-xl leading-tight">{BRAND_NAME}</span>
               <span className="hidden sm:block text-xs text-muted-foreground">{BRAND_TAGLINE}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/app">
              <Button data-testid="button-masuk-app">
                Masuk ke Aplikasi
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
               LMS PUB ASPEKINDO · Pembelajaran Bisnis Konstruksi
            </Badge>
            <h1 className="max-w-4xl mx-auto text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
               Kembangkan <span className="text-primary">Kompetensi Konstruksi</span>{" "}
               untuk Bisnis yang Lebih Tangguh
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
               Platform pembelajaran bisnis konstruksi untuk memperkuat kompetensi kontraktor,
               sekaligus mendukung pengembangan tenaga kerja konstruksi melalui pembelajaran
               yang terukur, praktis, dan berbasis evidensi.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/app">
                <Button size="lg" className="w-full sm:w-auto" data-testid="button-mulai-sekarang">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Mulai Sekarang
                </Button>
              </Link>
              <Link href="/app/courses">
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-lihat-template">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Lihat Template Builder
                </Button>
              </Link>
            </div>
           <div className="mt-10 w-full" aria-label="Empat domain utama pembelajaran">
             <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
               {heroDomainCards.map((domain) => (
                 <Card
                   key={domain.title}
                   className="h-full border-border/70 bg-background/85 text-left shadow-sm backdrop-blur-sm"
                   data-testid={`card-hero-domain-${domain.title.toLowerCase().replace(/\s+/g, "-")}`}
                 >
                   <CardContent className="flex min-h-[7rem] flex-col justify-between gap-3 p-4 md:min-h-[8rem] md:p-5">
                     <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                       <domain.icon className="h-4 w-4 text-primary md:h-5 md:w-5" aria-hidden="true" />
                     </div>
                     <div>
                       <p className="text-sm font-semibold leading-snug md:text-base">{domain.title}</p>
                       <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                         {domain.description}
                       </p>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Domain Pembelajaran PUB-ASPEKINDO</Badge>
            <h2 className="text-3xl font-bold mb-4">Empat Kesiapan Utama Kontraktor</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Materi mengacu pada konteks Pengembangan Usaha Berkelanjutan dalam Permen PUPR Nomor 7 Tahun 2024.
              SMAP dan PANCEK melengkapi keempat domain ini sebagai pembelajaran Kepatuhan.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pubDomains.map((domain) => (
              <Card key={domain.title} className="hover-elevate">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <domain.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{domain.title}</CardTitle>
                  <CardDescription>{domain.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center mt-8">
            LKUT digunakan sebagai konteks pemetaan kebutuhan belajar, bukan sebagai formulir, modul penyusunan, atau proses pelaporan di dalam LMS.
          </p>
        </div>
      </section>

      <GustaftaEcosystem />

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Struktur 6 Langkah E-Course</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Setiap e-course dibangun dengan template standar yang memastikan pembelajaran 
              terstruktur dan berbasis evidensi
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {lessonSteps.map((step, index) => (
              <Card key={step.title} className="text-center" data-testid={`card-step-${index + 1}`}>
                <CardContent className="pt-6 pb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Fitur LMS Lengkap</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Semua yang Anda butuhkan untuk membangun ekosistem pembelajaran berbasis kompetensi
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-950/30 dark:to-blue-950/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">
              <Shield className="h-3 w-3 mr-1" />
              Sertifikasi LSP
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Dukung Sertifikasi Profesi</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Platform terintegrasi untuk persiapan dan pelaksanaan sertifikasi SKK (Sertifikasi Kompetensi Kerja) berbasis SKKNI
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lspFeatures.map((feature) => (
              <Card key={feature.title} className="hover-elevate border-teal-200 dark:border-teal-800" data-testid={`card-lsp-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Prinsip Utama Pembelajaran Bisnis Konstruksi</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">E-Course dibangun dari Kompetensi</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Bukan dari materi, tapi dari unit kompetensi yang terukur</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                  <CheckCircle className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-teal-900 dark:text-teal-100">1 Unit Kompetensi = 1 E-Course</h4>
                    <p className="text-sm text-teal-700 dark:text-teal-300">Setiap unit kompetensi memiliki paket e-course tersendiri</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">Evidence-Based Learning</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">Belajar tanpa evidensi bukan berarti kompeten</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-purple-900 dark:text-purple-100">Level-Based Progression</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">Naik level = naik kompleksitas asesmen (L1-L4)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    4 Level Kompetensi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge className="bg-blue-500">L1</Badge>
                    <div>
                      <p className="font-medium text-sm">Awareness</p>
                      <p className="text-xs text-muted-foreground">Mengetahui dan memahami konsep dasar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge className="bg-green-500">L2</Badge>
                    <div>
                      <p className="font-medium text-sm">Application</p>
                      <p className="text-xs text-muted-foreground">Mampu menerapkan dengan bimbingan</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge className="bg-amber-500">L3</Badge>
                    <div>
                      <p className="font-medium text-sm">Mastery</p>
                      <p className="text-xs text-muted-foreground">Menguasai dan mandiri dalam penerapan</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge className="bg-purple-500">L4</Badge>
                    <div>
                      <p className="font-medium text-sm">Strategic</p>
                      <p className="text-xs text-muted-foreground">Mampu mengajarkan dan mengembangkan</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                 Siap Mengembangkan Kompetensi Konstruksi?
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                 Bangun kompetensi kontraktor dan tenaga kerja konstruksi melalui pembelajaran yang terukur
              </p>
              <Link href="/app">
                <Button size="lg" variant="secondary" data-testid="button-cta-mulai">
                  <GraduationCap className="h-5 w-5 mr-2" />
                  Mulai Membangun Sekarang
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <BrandMark size="sm" />
               <span className="font-semibold">{BRAND_NAME}</span>
            </div>
            <p className="text-sm text-muted-foreground">
               {BRAND_TAGLINE} · LMS PUB ASPEKINDO
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
