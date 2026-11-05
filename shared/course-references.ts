import { z } from "zod";

export const referenceDocuments = [
  {
    id: "PKB-12-2021",
    title: "Permen PUPR No. 12 Tahun 2021 — Pelaksanaan Pengembangan Keprofesian Berkelanjutan",
    kind: "Salinan peraturan",
    pages: 42,
    caution: "Salinan PDF terlampir. Periksa naskah resmi dan status perubahan terbaru sebelum menjadikan ketentuan sebagai validasi otomatis.",
  },
  {
    id: "PU-6-2025",
    title: "Implementasi Permen PU No. 6 Tahun 2025",
    kind: "Materi diskusi",
    pages: 91,
    caution: "Bukan naskah peraturan primer. Banyak halaman berupa gambar; terdapat perbedaan tahun pada slide 76. Ketentuan dan angka harus diperiksa pada naskah resmi.",
  },
  {
    id: "DAGRI-7-2024",
    title: "Permendagri No. 7 Tahun 2024 — Barang Milik Daerah",
    kind: "Salinan peraturan",
    pages: 140,
    caution: "Mengatur Barang Milik Daerah, bukan Pengembangan Keprofesian Berkelanjutan. Baca bersama aturan induk dan perubahan terbaru; teks OCR dapat keliru.",
  },
] as const;

export const lessonReferenceSchema = z.object({
  sourceId: z.enum(["PKB-12-2021", "PU-6-2025", "DAGRI-7-2024"]),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1).optional(),
  section: z.string().trim().max(200).optional(),
  note: z.string().trim().min(1, "Jelaskan relevansi sumber.").max(1500),
}).strict().superRefine((reference, ctx) => {
  const document = referenceDocuments.find(item => item.id === reference.sourceId)!;
  const end = reference.pageEnd ?? reference.pageStart;
  if (end < reference.pageStart || end > document.pages || reference.pageStart > document.pages) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pageEnd"], message: `Rentang halaman harus berurutan dalam 1–${document.pages}.` });
  }
});

export type LessonReference = z.infer<typeof lessonReferenceSchema>;
export const lessonReferencesSchema = z.array(lessonReferenceSchema).max(12);
export const updateLessonReferencesSchema = z.object({
  references: lessonReferencesSchema,
  expectedReferences: lessonReferencesSchema,
}).strict();

export const referenceUseDisclaimer =
  "Rujukan ini untuk pembelajaran, bukan keputusan kepatuhan atau sertifikasi formal. Catatan relevansi adalah interpretasi pembelajaran. Naskah resmi dan status berlaku terkini belum diverifikasi melalui sumber resmi daring.";

export function baselineLessonReferences(unitId: string): LessonReference[] {
  if (unitId.startsWith("pkb-degree") || unitId.startsWith("pkb-short-course") || unitId.startsWith("pkb-formal-training")) return [{
    sourceId: "PKB-12-2021", pageStart: 30, pageEnd: 31,
    note: "Lampiran nilai dasar dan kelengkapan bukti pendidikan/pelatihan formal; angka resmi tidak dihitung oleh kursus.",
  }];
  if (unitId.startsWith("pkb-self-learning") || unitId.startsWith("pkb-work-assignment")) return [{
    sourceId: "PKB-12-2021", pageStart: 31, pageEnd: 32,
    note: "Lampiran pembelajaran nonformal dan contoh bukti; penilaian Angka Kredit mengikuti proses resmi.",
  }];
  if (unitId.startsWith("pkb-meeting")) return [{
    sourceId: "PKB-12-2021", pageStart: 32, pageEnd: 33,
    note: "Lampiran nilai dasar partisipasi dan kepanitiaan pertemuan profesi.",
  }];
  if (unitId.startsWith("pkb-competition") || unitId.startsWith("pkb-presentation") || unitId.startsWith("pkb-teaching")) return [{
    sourceId: "PKB-12-2021", pageStart: 33, pageEnd: 35,
    note: "Lampiran kegiatan kompetisi, paparan, karya, dan pengajaran; bukti perlu ditelaah sesuai jenis kegiatan.",
  }];
  if (unitId.startsWith("pkb-film") || unitId.startsWith("pkb-product")) return [{
    sourceId: "PKB-12-2021", pageStart: 36, pageEnd: 37,
    note: "Lampiran paparan film, gelar karya, pengenalan produk, dan ziarah arsitektur.",
  }];
  if (unitId.startsWith("pkb-expert") || unitId.startsWith("pkb-association") || unitId.startsWith("pkb-award") || unitId.startsWith("pkb-other")) return [{
    sourceId: "PKB-12-2021", pageStart: 38, pageEnd: 39,
    note: "Lampiran unsur penunjang dan kegiatan utama lainnya; jangan menyamakan pencatatan belajar dengan penetapan resmi.",
  }];
  if (unitId.startsWith("legal-")) return [{
    sourceId: "PU-6-2025", pageStart: 11, pageEnd: 26,
    note: "Konteks standar kegiatan usaha dan pengawasan. LKUT hanya konteks kebutuhan belajar, bukan layanan pelaporan dalam LMS.",
  }];
  if (unitId.startsWith("sert-")) return [{
    sourceId: "PU-6-2025", pageStart: 46, pageEnd: 74,
    note: "Konteks kesiapan SBU dan substansi BUJK. Kursus tidak menerbitkan atau mengonversi SBU/SKK; angka harus diverifikasi pada naskah resmi.",
  }];
  if (unitId.startsWith("tender-")) return [{
    sourceId: "PU-6-2025", pageStart: 75, pageEnd: 77,
    note: "Konteks segmentasi pasar, bukan persyaratan paket tender. Slide 76 memuat perbedaan tahun; jangan memakai nilai pagunya sebelum verifikasi naskah resmi.",
  }];
  if (unitId.startsWith("proyek-")) return [{
    sourceId: "DAGRI-7-2024", pageStart: 118, pageEnd: 119,
    section: "Format pemantauan konstruksi dalam pengerjaan",
    note: "Referensi kontekstual proyek terkait Barang Milik Daerah. Bukan ketentuan semua proyek atau fitur pelaporan aset pemerintah.",
  }];
  if (unitId.startsWith("smap-")) return [{
    sourceId: "PU-6-2025", pageStart: 74,
    note: "Pengantar konteks komitmen SMAP. Penyelesaian kursus tidak otomatis memenuhi seluruh kewajiban hukum atau sertifikasi SMAP.",
  }];
  return []; // Neither supplied document explicitly mandates the PANCEK method.
}
