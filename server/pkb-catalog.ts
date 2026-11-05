import type {
  BehaviorIndicator,
  CompetencyCluster,
  ECourse,
  LearningPath,
  Participant,
  UnitCompetency,
} from "@shared/schema";
import { baselineLessonReferences } from "../shared/course-references";
import { PKB_OVERVIEW_POSTTEST_ID, PKB_OVERVIEW_PRETEST_ID } from "../shared/pkb-course";

type Activity = {
  id: string;
  title: string;
  clusterId: string;
  code: string;
  regulation: string;
  evidence: string;
  practice: string;
};

const levels: BehaviorIndicator[] = [
  { level: "L1", indicators: ["Menjelaskan ketentuan dan tujuan kegiatan PKB.", "Mengenali bukti yang perlu disimpan."] },
  { level: "L2", indicators: ["Menyusun rencana kegiatan dan kelengkapan bukti.", "Mencatat pembelajaran secara runtut."] },
  { level: "L3", indicators: ["Menelaah relevansi, mutu, dan kelengkapan bukti.", "Memperbaiki rencana pengembangan profesional."] },
  { level: "L4", indicators: ["Membagikan pengetahuan dan membina praktik profesional.", "Mengevaluasi rencana belajar berkelanjutan."] },
];

export const PKB_CLUSTERS: CompetencyCluster[] = [
  {
    id: "pkb-cluster-formal",
    code: "FORMAL",
    name: "Pendidikan dan Pelatihan Formal",
    fullName: "Pendidikan dan Pelatihan Formal",
    description: "Kegiatan pendidikan lanjut, pendidikan singkat, dan pelatihan kerja formal untuk tenaga kerja konstruksi kualifikasi jabatan ahli.",
    color: "hsl(217 91% 60%)",
  },
  {
    id: "pkb-cluster-nonformal",
    code: "NONFORM",
    name: "Pendidikan Nonformal",
    fullName: "Pembelajaran Mandiri dan Sehubungan Penugasan Kerja",
    description: "Pembelajaran mandiri dan pembelajaran yang terkait penugasan kerja, dengan pencatatan dan bukti yang sesuai.",
    color: "hsl(173 80% 40%)",
  },
  {
    id: "pkb-cluster-meeting",
    code: "PROFESI",
    name: "Pertemuan Profesi",
    fullName: "Partisipasi dalam Pertemuan Profesi",
    description: "Keikutsertaan dan peran kepanitiaan dalam pertemuan profesi.",
    color: "hsl(38 92% 50%)",
  },
  {
    id: "pkb-cluster-contribution",
    code: "KARYA",
    name: "Karya dan Kontribusi Profesi",
    fullName: "Sayembara, Paparan, Kekayaan Intelektual, Karya Tulis, dan Pengajaran",
    description: "Kegiatan berbagi pengetahuan, menghasilkan karya, mengikuti kompetisi, dan mengajar sebagai bagian dari pengembangan profesi.",
    color: "hsl(262 83% 58%)",
  },
  {
    id: "pkb-cluster-exposure",
    code: "PAPARAN",
    name: "Paparan dan Apresiasi Karya",
    fullName: "Paparan Film, Gelar Karya, Pengenalan Produk, dan Ziarah Arsitektur",
    description: "Kegiatan untuk memperluas wawasan teknik melalui karya, produk, dan lingkungan binaan.",
    color: "hsl(199 89% 48%)",
  },
  {
    id: "pkb-cluster-support",
    code: "PENUNJANG",
    name: "Unsur Kegiatan Penunjang",
    fullName: "Narasumber, Peran Organisasi Profesi, Penghargaan, dan Kegiatan Lainnya",
    description: "Peran profesional dan pengakuan yang dicatat sebagai unsur penunjang, bukan pengganti kegiatan utama.",
    color: "hsl(346 77% 49%)",
  },
];

const activities: Activity[] = [
  {
    id: "pkb-degree", title: "Pendidikan Strata Lanjut", clusterId: "pkb-cluster-formal", code: "PKB-F-01",
    regulation: "Lampiran Permen PUPR No. 12 Tahun 2021 memuat pendidikan strata lanjut sebagai kegiatan utama.",
    evidence: "Ijazah, transkrip akademik, dan abstrak tugas akhir.",
    practice: "Susun daftar dokumen pendidikan dan refleksi hubungan studi dengan kompetensi keahlian.",
  },
  {
    id: "pkb-short-course", title: "Pendidikan Singkat (Courses)", clusterId: "pkb-cluster-formal", code: "PKB-F-02",
    regulation: "Lampiran mengelompokkan pendidikan singkat berdasarkan jumlah jam pelajaran dan kelengkapan penyelenggara.",
    evidence: "Bukti kelulusan, jadwal, silabus atau ringkasan materi, dan informasi penyelenggara.",
    practice: "Telaah satu kursus yang pernah diikuti dan tandai bukti yang tersedia serta yang masih perlu diminta.",
  },
  {
    id: "pkb-formal-training", title: "Pelatihan Kerja Formal", clusterId: "pkb-cluster-formal", code: "PKB-F-03",
    regulation: "Pelatihan kerja formal termasuk unsur utama; lampiran mencantumkan bukti kelulusan, program, dan silabus.",
    evidence: "Sertifikat atau surat tanda lulus, program pelatihan kerja, dan silabus.",
    practice: "Buat indeks berkas pelatihan yang mudah ditelusuri.",
  },
  {
    id: "pkb-self-learning", title: "Pembelajaran Mandiri", clusterId: "pkb-cluster-nonformal", code: "PKB-N-01",
    regulation: "Pembelajaran mandiri merupakan kegiatan PKB nonformal; lampiran memberi contoh produk pembelajaran dan bukti pendukung.",
    evidence: "Extended abstract atau executive summary, serta bukti sumber belajar yang relevan.",
    practice: "Tulis ringkasan pembelajaran dari sumber teknik yang telah dipelajari dan hubungkan dengan pekerjaan.",
  },
  {
    id: "pkb-work-assignment", title: "Pembelajaran Sehubungan Penugasan Kerja", clusterId: "pkb-cluster-nonformal", code: "PKB-N-02",
    regulation: "Pembelajaran sehubungan dengan penugasan kerja dicantumkan sebagai kegiatan nonformal.",
    evidence: "Extended abstract atau executive summary, kontrak kerja atau surat referensi sesuai konteks.",
    practice: "Dokumentasikan pembelajaran dari penugasan tanpa membuka data rahasia proyek atau pemberi kerja.",
  },
  {
    id: "pkb-meeting-participant", title: "Peserta Pertemuan Profesi", clusterId: "pkb-cluster-meeting", code: "PKB-P-01",
    regulation: "Partisipasi sebagai peserta pertemuan profesi termasuk unsur kegiatan utama.",
    evidence: "Sertifikat keikutsertaan dan ringkasan hasil pertemuan.",
    practice: "Buat ringkasan satu halaman tentang pengetahuan yang relevan untuk kompetensi keahlian.",
  },
  {
    id: "pkb-meeting-committee", title: "Kepanitiaan Pertemuan Profesi", clusterId: "pkb-cluster-meeting", code: "PKB-P-02",
    regulation: "Peran kepanitiaan pertemuan profesi termasuk kegiatan utama; peran dan bukti penugasan perlu dicatat.",
    evidence: "Surat keputusan, surat penugasan, sertifikat, atau bukti peran yang sesuai.",
    practice: "Petakan peran, periode, dan dokumen yang menunjukkan kontribusi dalam kepanitiaan.",
  },
  {
    id: "pkb-competition", title: "Sayembara dan Kompetisi", clusterId: "pkb-cluster-contribution", code: "PKB-K-01",
    regulation: "Sayembara dan kompetisi merupakan salah satu jenis kegiatan utama PKB.",
    evidence: "Bukti keikutsertaan atau hasil kompetisi sesuai ketentuan kegiatan.",
    practice: "Susun catatan kontribusi pribadi dan pelajaran teknik dari kompetisi.",
  },
  {
    id: "pkb-presentation-writing-ip", title: "Paparan, Paten, HKI, dan Karya Tulis", clusterId: "pkb-cluster-contribution", code: "PKB-K-02",
    regulation: "Paparan, paten, hak atas kekayaan intelektual, dan karya tulis dicantumkan sebagai kegiatan utama.",
    evidence: "Naskah atau karya, bukti penerimaan/publikasi/pendaftaran, dan keterangan peran.",
    practice: "Buat daftar karya teknik beserta status, kontribusi, dan dokumen pendukungnya.",
  },
  {
    id: "pkb-teaching", title: "Pengajaran sebagai Pengajar atau Instruktur", clusterId: "pkb-cluster-contribution", code: "PKB-K-03",
    regulation: "Pengajaran sebagai pengajar atau instruktur termasuk kegiatan utama PKB.",
    evidence: "Surat tugas, jadwal, bahan ajar, dan bukti pelaksanaan sesuai kegiatan.",
    practice: "Rancang sesi berbagi pengetahuan teknik yang memiliki tujuan belajar dan materi ringkas.",
  },
  {
    id: "pkb-film-exhibition", title: "Paparan Film dan Gelar Karya", clusterId: "pkb-cluster-exposure", code: "PKB-E-01",
    regulation: "Paparan film dan gelar karya termasuk kegiatan utama yang dijelaskan dalam peraturan.",
    evidence: "Bukti partisipasi dan ringkasan pembelajaran atau karya yang dipaparkan.",
    practice: "Catat temuan teknik, relevansi terhadap pekerjaan, dan tindak lanjut belajar.",
  },
  {
    id: "pkb-product-architecture", title: "Pengenalan Produk dan Ziarah Arsitektur", clusterId: "pkb-cluster-exposure", code: "PKB-E-02",
    regulation: "Pengenalan produk dan ziarah arsitektur termasuk kegiatan utama PKB.",
    evidence: "Bukti kegiatan dan ringkasan observasi atau pembelajaran.",
    practice: "Susun catatan observasi yang membedakan fakta, interpretasi, dan ide penerapan.",
  },
  {
    id: "pkb-expert", title: "Pakar, Narasumber, atau Pendamping Hukum", clusterId: "pkb-cluster-support", code: "PKB-S-01",
    regulation: "Peran pakar, narasumber, atau pendamping hukum dicantumkan sebagai unsur penunjang.",
    evidence: "Surat tugas atau sertifikat pemateri dan dokumentasi kegiatan bila tersedia.",
    practice: "Dokumentasikan ruang lingkup kontribusi dan bukti peran secara ringkas.",
  },
  {
    id: "pkb-association-role", title: "Pengurus Organisasi Profesi atau Pimpinan LPJK", clusterId: "pkb-cluster-support", code: "PKB-S-02",
    regulation: "Kepengurusan organisasi profesi atau peran pimpinan LPJK termasuk unsur penunjang.",
    evidence: "Surat keputusan atau keterangan dari pejabat/organisasi berwenang.",
    practice: "Catat masa tugas, peran, dan dokumen yang membuktikannya.",
  },
  {
    id: "pkb-award", title: "Tanda Jasa dan Penghargaan", clusterId: "pkb-cluster-support", code: "PKB-S-03",
    regulation: "Tanda jasa, penghargaan, dan sejenisnya dicantumkan sebagai unsur penunjang.",
    evidence: "Sertifikat penghargaan, dokumentasi penyerahan, atau bukti lain yang sah.",
    practice: "Buat indeks penghargaan dengan penerbit, tanggal, dan bukti pendukung.",
  },
  {
    id: "pkb-other", title: "Kegiatan Utama Lainnya", clusterId: "pkb-cluster-support", code: "PKB-S-04",
    regulation: "Kegiatan utama lainnya dikembangkan oleh asosiasi profesi terakreditasi dan ditetapkan sesuai ketentuan peraturan.",
    evidence: "Dokumen kegiatan dan dasar penetapan/keterangan penyelenggara yang relevan.",
    practice: "Periksa dasar pengakuan sebelum mencatat kegiatan sebagai kegiatan utama.",
  },
];

function indicatorsFor(activity: Activity): BehaviorIndicator[] {
  return levels.map(level => ({
    ...level,
    indicators: level.indicators.map(item => `${item} (${activity.title.toLocaleLowerCase("id")})`),
  }));
}

export const PKB_UNITS: UnitCompetency[] = activities.map(activity => ({
  id: activity.id,
  clusterId: activity.clusterId,
  code: activity.code,
  name: activity.title,
  description: `${activity.regulation} Fokus belajar: pencatatan kegiatan dan bukti pendukung, bukan penetapan Angka Kredit resmi.`,
  indicators: indicatorsFor(activity),
}));

function lessonsFor(activity: Activity): ECourse["lessons"] {
  const references = baselineLessonReferences(activity.id);
  return [
    {
      id: `${activity.id}-orientation`, order: 1, type: "orientation",
      title: "Orientasi Kegiatan PKB",
      description: `Tujuan dan posisi ${activity.title.toLocaleLowerCase("id")} dalam pengembangan profesi.`,
      content: `Pelajari tujuan kegiatan, kaitannya dengan kompetensi teknik, dan peran tenaga kerja kualifikasi jabatan ahli. Tingkat L1–L4 di aplikasi adalah tahapan belajar internal, bukan jenjang jabatan ahli atau keputusan sertifikasi.`,
    },
    {
      id: `${activity.id}-context`, order: 2, type: "context",
      title: "Konteks Praktik Profesional",
      description: activity.practice,
      content: `Gunakan contoh aktivitas profesional yang relevan dengan kompetensi keahlian. Jaga kerahasiaan informasi pemberi kerja, pengguna jasa, dan proyek.`,
    },
    {
      id: `${activity.id}-microlearning`, order: 3, type: "microlearning",
      title: "Ketentuan dan Bukti Kegiatan",
      description: activity.regulation,
      content: `${activity.regulation}\n\nBukti yang perlu dipahami: ${activity.evidence}\n\nPermen PUPR No. 12 Tahun 2021 membedakan kegiatan terverifikasi dan tidak terverifikasi, kegiatan umum dan khusus, serta metode dan tingkat kegiatan. Platform ini menyimpan materi pembelajaran; penyelesaian kursus tidak otomatis menjadi SKPK atau Angka Kredit resmi.`,
      references,
    },
    {
      id: `${activity.id}-practice`, order: 4, type: "practice",
      title: "Latihan Pencatatan Kegiatan PKB",
      description: `Latihan mengenali dokumen dan menyusun catatan untuk ${activity.title.toLocaleLowerCase("id")}.`,
      content: `Buat contoh catatan kegiatan dengan tanggal, tujuan belajar, peran pribadi, hasil, dan bukti pendukung. Tandai informasi yang belum dapat dipastikan; jangan menyatakan angka kredit resmi.`,
    },
    {
      id: `${activity.id}-assessment`, order: 5, type: "assessment",
      title: "Pemeriksaan Pemahaman",
      description: "Penilaian formatif untuk mengukur pemahaman materi kursus.",
      content: "Jawab pertanyaan pemahaman dan telaah kembali bukti kegiatan. Penilaian kursus bukan verifikasi oleh asesor PKB dan tidak menetapkan Angka Kredit.",
    },
    {
      id: `${activity.id}-reflection`, order: 6, type: "reflection",
      title: "Rencana Pengembangan Profesional",
      description: "Susun langkah belajar berkelanjutan yang relevan dengan kompetensi keahlian.",
      content: `Tentukan satu langkah berikutnya terkait ${activity.title.toLocaleLowerCase("id")}, waktu pelaksanaan, kebutuhan dukungan, dan cara menyimpan buktinya. Verifikasi tata cara resmi pada naskah dan sistem yang berwenang.`,
    },
  ];
}

export const PKB_COURSES: ECourse[] = activities.map(activity => ({
  id: `course-${activity.id}`,
  unitId: activity.id,
  targetLevel: "L2",
  title: activity.title,
  description: `${activity.regulation} Kursus membantu tenaga teknik konstruksi memahami kegiatan dan menata bukti pembelajaran.`,
  duration: "1–2 jam",
  lessons: lessonsFor(activity),
  ...(activity.id === "pkb-self-learning" ? {
    preTestId: PKB_OVERVIEW_PRETEST_ID,
    postTestId: PKB_OVERVIEW_POSTTEST_ID,
  } : {}),
  createdAt: "2026-11-05",
}));

export const PKB_LEARNING_PATHS: LearningPath[] = [
  {
    id: "path-pkb-formal",
    title: "Pendidikan dan Pelatihan Formal",
    description: "Pahami kategori pendidikan lanjut, pendidikan singkat, dan pelatihan kerja formal serta bukti pendukungnya.",
    targetRole: "Tenaga kerja konstruksi kualifikasi jabatan ahli",
    duration: "2 minggu",
    difficulty: "beginner",
    courseIds: PKB_COURSES.filter(course => course.unitId.startsWith("pkb-degree") || course.unitId.startsWith("pkb-short-course") || course.unitId.startsWith("pkb-formal-training")).map(course => course.id),
    prerequisites: [],
    skills: ["Pemetaan kegiatan PKB", "Dokumentasi pendidikan", "Indeks bukti"],
    isPublished: true,
    createdAt: "2026-11-05",
  },
  {
    id: "path-pkb-self-directed",
    title: "Belajar Mandiri dan Penugasan Kerja",
    description: "Rencanakan pembelajaran mandiri dan dokumentasikan hasil belajar dari penugasan kerja.",
    targetRole: "Tenaga kerja konstruksi kualifikasi jabatan ahli",
    duration: "2 minggu",
    difficulty: "beginner",
    courseIds: PKB_COURSES.filter(course => course.unitId === "pkb-self-learning" || course.unitId === "pkb-work-assignment").map(course => course.id),
    prerequisites: [],
    skills: ["Pembelajaran mandiri", "Refleksi", "Dokumentasi evidensi"],
    isPublished: true,
    createdAt: "2026-11-05",
  },
  {
    id: "path-pkb-profession",
    title: "Pertemuan Profesi dan Kontribusi Keilmuan",
    description: "Kenali partisipasi profesi, karya, pengajaran, paparan, dan unsur penunjang PKB.",
    targetRole: "Tenaga kerja konstruksi kualifikasi jabatan ahli",
    duration: "4 minggu",
    difficulty: "intermediate",
    courseIds: PKB_COURSES.filter(course => ["pkb-meeting-participant", "pkb-meeting-committee", "pkb-competition", "pkb-presentation-writing-ip", "pkb-teaching", "pkb-film-exhibition", "pkb-product-architecture", "pkb-expert", "pkb-association-role", "pkb-award", "pkb-other"].includes(course.unitId)).map(course => course.id),
    prerequisites: [],
    skills: ["Partisipasi profesi", "Berbagi pengetahuan", "Pencatatan bukti"],
    isPublished: true,
    createdAt: "2026-11-05",
  },
];

export const PKB_PARTICIPANTS: Participant[] = [
  {
    id: "pkb-participant-001", nip: "TTK-0001", name: "Andi Pratama",
    position: "Ahli Teknik Bangunan Gedung", unit: "Teknik Bangunan Gedung", email: "andi.pkb@example.id",
    competencies: [
      { unitId: "pkb-short-course", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-10-15", status: "on_track" },
      { unitId: "pkb-self-learning", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-10-15", status: "gap" },
      { unitId: "pkb-meeting-participant", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2026-10-15", status: "achieved" },
    ],
    learningHistory: [
      { id: "pkb-lr-001", courseId: "course-pkb-short-course", startedAt: "2026-10-20", progress: 60, status: "in_progress" },
    ],
    evidences: [],
  },
  {
    id: "pkb-participant-002", nip: "TTK-0002", name: "Citra Dewi",
    position: "Ahli Teknik Jalan", unit: "Teknik Jalan", email: "citra.pkb@example.id",
    competencies: [
      { unitId: "pkb-work-assignment", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-10-12", status: "on_track" },
      { unitId: "pkb-presentation-writing-ip", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-10-12", status: "gap" },
    ],
    learningHistory: [
      { id: "pkb-lr-002", courseId: "course-pkb-self-learning", startedAt: "2026-10-18", completedAt: "2026-10-26", progress: 100, status: "completed" },
    ],
    evidences: [],
  },
];

export const LEGACY_BUJK_CLUSTER_IDS = new Set([
  "cluster-legal", "cluster-sert", "cluster-tender", "cluster-proyek", "cluster-smap", "cluster-pancek",
]);

export const LEGACY_BUJK_UNIT_IDS = new Set([
  "legal-01", "legal-02", "sert-01", "sert-02", "tender-01", "tender-02",
  "proyek-01", "proyek-02", "smap-01", "smap-02", "smap-03", "smap-04",
  "pan-01", "pan-02", "pan-03", "pan-04",
]);

export const LEGACY_BUJK_COURSE_IDS = new Set([
  "course-legal01-l2", "course-legal02-l2", "course-sert01-l2", "course-sert02-l2",
  "course-tender01-l2", "course-tender02-l2", "course-proyek01-l2", "course-proyek02-l2",
  "course-smap01-l2", "course-smap02-l2", "course-smap03-l2", "course-smap04-l2",
  "course-pan01-l2", "course-pan02-l2", "course-pan03-l2", "course-pan04-l2",
]);

export const LEGACY_BUJK_PATH_IDS = new Set(["path-001", "path-002", "path-003", "path-004"]);
