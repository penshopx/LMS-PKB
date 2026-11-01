import { eq } from "drizzle-orm";
import { db } from "./db";
import { coursesTable, practiceMissionsTable } from "@shared/schema";

/** Run after the catalog seed so a fresh database also receives the pilot exercises. */
export async function seedPracticeMissions() {
  const courseId = "course-tender01-l2";
  const [course] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) return;
  const examples = [
    {
      id: "mission-tender-go-no-go",
      title: "Memo keputusan Go/No-Go dalam 10 menit",
      objective: "Memisahkan fakta, asumsi, dan informasi yang perlu dikonfirmasi sebelum mengikuti tender.",
      scenario: "Simulasi: tenggat penawaran tinggal tiga hari. Pengalaman sejenis tersedia, tetapi personel utama belum mengonfirmasi ketersediaan dan satu dokumen pendukung belum diperbarui. Tulis memo keputusan sementara: Go, No-Go, atau perlu konfirmasi. Cantumkan dasar keputusan, risiko, penanggung jawab tindak lanjut, dan tenggat. Jangan mengunggah data rahasia perusahaan.",
      sourceText: "Diadaptasi dari materi Telaah Peluang dan Keputusan Go/No-Go pada kursus SIAP Tender. Kasus ini adalah latihan, bukan interpretasi hukum atau keputusan pengadaan resmi.",
      durationMinutes: 10,
      checklist: [
        "Pisahkan fakta, asumsi, dan informasi yang belum diketahui",
        "Periksa kecocokan bukti pengalaman serta ketersediaan personel",
        "Tulis keputusan sementara beserta alasannya",
        "Tetapkan tindak lanjut, penanggung jawab, dan tenggat",
      ],
    },
    {
      id: "mission-tender-document-check",
      title: "Pemeriksaan silang dokumen tender",
      objective: "Mencatat ketidaksesuaian dokumen dan menetapkan langkah verifikasi yang dapat ditelusuri.",
      scenario: "Simulasi: lembar daftar personel dan lampiran pengalaman memakai ejaan nama yang berbeda; tanggal pada satu dokumen pendukung belum dapat dibaca; daftar peralatan belum diberi penanggung jawab verifikasi. Buat catatan temuan singkat untuk ketiga kondisi tersebut: dokumen yang perlu dibandingkan, informasi yang belum pasti, dan tindak lanjut. Gunakan data simulasi, bukan dokumen tender rahasia.",
      sourceText: "Diadaptasi dari materi Pemeriksaan Kualifikasi dan Dokumen Administrasi pada kursus SIAP Tender. Rujuk dokumen pemilihan dan ketentuan resmi yang berlaku untuk pekerjaan nyata.",
      durationMinutes: 15,
      checklist: [
        "Catat tiga temuan tanpa menganggap asumsi sebagai fakta",
        "Tentukan dokumen pembanding atau sumber konfirmasi",
        "Tetapkan penanggung jawab dan batas waktu verifikasi",
        "Tulis ringkasan bukti serta tindak lanjut yang masih terbuka",
      ],
    },
  ];
  await db.insert(practiceMissionsTable).values(examples.map(example => ({
    ...example, courseId, createdAt: new Date().toISOString(),
  }))).onConflictDoNothing(); // Never reactivate an example that an admin archived.
}
