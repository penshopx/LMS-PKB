import { BookOpen, FileCheck, GraduationCap, Info, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const composition = [
  ["Unsur utama", "Paling sedikit 75%"],
  ["Unsur penunjang", "Paling banyak 25%"],
  ["Pendidikan nonformal", "Paling banyak 25%"],
  ["Kegiatan terverifikasi / tidak terverifikasi", "Paling sedikit 60% / paling banyak 40%"],
  ["Kegiatan khusus / umum", "Paling sedikit 60% / paling banyak 40%"],
];

export default function PkbGuidance() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" data-testid="page-pkb-guidance">
      <header className="space-y-3">
        <Badge variant="secondary">Permen PUPR No. 12 Tahun 2021</Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">Panduan Pengembangan Keprofesian Berkelanjutan</h1>
        <p className="max-w-3xl text-muted-foreground">Rencanakan pembelajaran, kenali jenis kegiatan, dan siapkan bukti pengembangan kompetensi teknik konstruksi.</p>
      </header>
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-6">Peraturan ini mengatur PKB untuk tenaga kerja konstruksi kualifikasi jabatan ahli. PKB ASDAMKINDO adalah sarana pembelajaran dan dokumentasi, bukan penerbit SKK, sistem penetapan Angka Kredit, atau pengganti proses resmi perpanjangan SKK.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: BookOpen, title: "Rencanakan kegiatan", text: "Pilih pembelajaran yang relevan dengan kompetensi keahlian. Bedakan unsur utama dan penunjang, kegiatan umum dan khusus, serta status verifikasinya." },
          { icon: FileCheck, title: "Simpan bukti", text: "Catat identitas kegiatan, waktu, peran, hasil belajar, dan dokumen pendukung. Jenis bukti bergantung pada jenis kegiatan dalam Lampiran." },
          { icon: ShieldCheck, title: "Ikuti proses resmi", text: "Penilaian dilakukan melalui mekanisme asesor dan penetapan pihak berwenang sesuai peraturan. Persetujuan bukti atau nilai kuis di aplikasi bukan penetapan Angka Kredit." },
        ].map(item => <Card key={item.title}><CardHeader><item.icon className="h-6 w-6 text-primary" /><CardTitle className="text-lg">{item.title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{item.text}</CardContent></Card>)}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Jenis kegiatan PKB</CardTitle><CardDescription>Pasal 4 dan Lampiran</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm leading-6">
            <div><h3 className="font-semibold">Unsur utama</h3><p className="mt-1 text-muted-foreground">Pendidikan/pelatihan formal; pembelajaran mandiri dan penugasan kerja; pertemuan profesi; sayembara, kompetisi, paparan, paten, HKI, karya tulis dan pengajaran; paparan film, gelar karya, pengenalan produk dan ziarah arsitektur; serta kegiatan utama lainnya sesuai ketentuan.</p></div>
            <div><h3 className="font-semibold">Unsur penunjang</h3><p className="mt-1 text-muted-foreground">Peran pakar, narasumber atau pendamping hukum; pengurus organisasi profesi atau pimpinan LPJK; serta tanda jasa dan penghargaan.</p></div>
            <p className="text-xs text-muted-foreground">Jenis kegiatan tidak dengan sendirinya menentukan status terverifikasi, sifat umum/khusus, ataupun besaran kredit. Periksa ketentuan kegiatan dan bukti yang berlaku.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Komposisi Angka Kredit</CardTitle><CardDescription>Ringkasan Pasal 20, bukan kalkulator atau hasil verifikasi</CardDescription></CardHeader>
          <CardContent className="space-y-3">{composition.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b pb-3 text-sm last:border-0"><span>{label}</span><span className="font-semibold">{value}</span></div>)}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Nilai kredit minimum</CardTitle><CardDescription>Pasal 21 · satuan kredit pengembangan keprofesian (SKPK)</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">{[["Ahli muda / jenjang 7", "100 SKPK"], ["Ahli madya / jenjang 8", "150 SKPK"], ["Ahli utama / jenjang 9", "200 SKPK"]].map(([title, value]) => <div className="rounded-lg border p-4" key={title}><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Angka di atas adalah ketentuan minimum, bukan saldo kredit peserta. Aplikasi tidak mengonversi durasi, bukti, atau nilai kuis menjadi SKPK dan tidak mengirim pengajuan ke sistem resmi.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><GraduationCap className="h-6 w-6 text-primary" /><CardTitle>Batas hasil pembelajaran di aplikasi</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Sertifikat yang diterbitkan aplikasi adalah sertifikat penyelesaian kursus, bukan SKK atau bukti penetapan Angka Kredit. L1–L4 adalah tahapan belajar internal, bukan jenjang jabatan ahli 7–9.</p>
          <p>Kurikulum BUJK terdahulu diarsipkan. Riwayat, hasil penilaian, dan sertifikatnya tetap utuh serta tidak otomatis dialihkan menjadi kredit PKB.</p>
          <p>Ringkasan mengacu pada salinan PDF yang diberikan. Periksa naskah resmi beserta status perubahan dan prosedur terbaru sebelum pengajuan resmi.</p>
          <Button asChild variant="outline"><Link href="/app">Kembali ke pembelajaran</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
