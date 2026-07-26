/**
 * Seeds the database with initial data if it's empty.
 * Only runs inserts when tables are empty to avoid duplicates.
 */
import { db } from "./db";
import {
  clustersTable,
  unitsTable,
  coursesTable,
  participantsTable,
  assessorsTable,
  schemesTable,
  learningPathsTable,
  lspOrganizationsTable,
  notificationsTable,
  users,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";
import type {
  BehaviorIndicator,
  ParticipantCompetency,
  LearningRecord,
  Evidence,
  Lesson,
} from "@shared/schema";

export async function seedDatabase() {
  // Ensure default admin user exists
  const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
  if (existingAdmin.length === 0) {
    const hashed = await hashPassword("admin123");
    await db.insert(users).values({ username: "admin", password: hashed });
    console.log("[seed] Default admin user created (username: admin, password: admin123)");
  }

  // Check if data already exists
  const existingClusters = await db.select().from(clustersTable);
  if (existingClusters.length > 0) {
    console.log("[seed] Database already seeded, skipping.");
    return;
  }

  console.log("[seed] Seeding database with initial data...");

  // Clusters
  await db.insert(clustersTable).values([
    {
      id: "cluster-smap",
      code: "SMAP",
      name: "SMAP",
      fullName: "Strategic Management & Analytical Planning",
      description: "Mengembangkan kemampuan berpikir strategis, analisis, dan pengambilan keputusan berbasis data.",
      color: "hsl(199 89% 48%)",
    },
    {
      id: "cluster-pancek",
      code: "PANCEK",
      name: "PANCEK",
      fullName: "Planning, Action, Negotiation, Communication, Execution",
      description: "Membangun kompetensi eksekusi, komunikasi, dan kolaborasi kerja.",
      color: "hsl(172 66% 50%)",
    },
  ]);

  // Units
  const smapIndicators: BehaviorIndicator[][] = [
    [
      { level: "L1", indicators: ["Mengenali jenis-jenis masalah organisasi", "Memahami perbedaan isu strategis dan operasional"] },
      { level: "L2", indicators: ["Mengidentifikasi akar masalah dengan metode standar", "Menganalisis dampak masalah pada unit kerja"] },
      { level: "L3", indicators: ["Mensintesis masalah dari berbagai perspektif", "Menggunakan multi-metode analisis"] },
      { level: "L4", indicators: ["Menentukan prioritas isu strategis organisasi", "Mengarahkan tim dalam analisis sistemik"] },
    ],
    [
      { level: "L1", indicators: ["Memahami konsep strategi dan opsi", "Mengenali contoh strategi yang ada"] },
      { level: "L2", indicators: ["Membuat alternatif solusi sederhana", "Mengevaluasi kelebihan dan kekurangan opsi"] },
      { level: "L3", indicators: ["Merumuskan opsi strategis berbasis analisis", "Menilai risiko dan dampak setiap opsi"] },
      { level: "L4", indicators: ["Menetapkan strategi organisasi", "Mengintegrasikan strategi lintas unit"] },
    ],
    [
      { level: "L1", indicators: ["Membaca dan memahami data dasar", "Mengenali jenis-jenis data yang relevan"] },
      { level: "L2", indicators: ["Menggunakan data untuk mendukung keputusan", "Membuat analisis data sederhana"] },
      { level: "L3", indicators: ["Menghasilkan insight dari data kompleks", "Menghubungkan data dengan konteks strategis"] },
      { level: "L4", indicators: ["Membangun governance keputusan berbasis data", "Mengarahkan kebijakan data-driven"] },
    ],
    [
      { level: "L1", indicators: ["Memahami indikator kinerja", "Mengenali proses monitoring dasar"] },
      { level: "L2", indicators: ["Melakukan monitoring rutin", "Membuat laporan progress"] },
      { level: "L3", indicators: ["Mengevaluasi dampak strategi", "Mengidentifikasi area perbaikan"] },
      { level: "L4", indicators: ["Melakukan re-design strategi", "Membangun sistem evaluasi berkelanjutan"] },
    ],
  ];

  await db.insert(unitsTable).values([
    { id: "smap-01", clusterId: "cluster-smap", code: "SMAP-01", name: "Analisis Masalah Strategis", description: "Kemampuan mengidentifikasi, menganalisis, dan memilah masalah strategis vs operasional.", indicators: smapIndicators[0] },
    { id: "smap-02", clusterId: "cluster-smap", code: "SMAP-02", name: "Perumusan Opsi Strategi", description: "Kemampuan merumuskan dan mengevaluasi alternatif strategi yang relevan.", indicators: smapIndicators[1] },
    { id: "smap-03", clusterId: "cluster-smap", code: "SMAP-03", name: "Pengambilan Keputusan Berbasis Data", description: "Kemampuan menggunakan data dan fakta untuk pengambilan keputusan yang tepat.", indicators: smapIndicators[2] },
    { id: "smap-04", clusterId: "cluster-smap", code: "SMAP-04", name: "Monitoring & Evaluasi Strategi", description: "Kemampuan memantau pelaksanaan strategi dan mengevaluasi efektivitasnya.", indicators: smapIndicators[3] },
  ]);

  const pancekIndicators: BehaviorIndicator[][] = [
    [
      { level: "L1", indicators: ["Mengikuti rencana yang diberikan", "Memahami komponen rencana kerja"] },
      { level: "L2", indicators: ["Menyusun rencana kerja mandiri", "Mengidentifikasi sumber daya yang dibutuhkan"] },
      { level: "L3", indicators: ["Mengoptimasi rencana untuk efisiensi", "Mengantisipasi hambatan dan risiko"] },
      { level: "L4", indicators: ["Mensinkronisasi rencana lintas tim", "Membangun sistem perencanaan terintegrasi"] },
    ],
    [
      { level: "L1", indicators: ["Menyampaikan informasi dengan jelas", "Mendengarkan dengan baik"] },
      { level: "L2", indicators: ["Melakukan negosiasi dasar", "Menyesuaikan gaya komunikasi"] },
      { level: "L3", indicators: ["Mempengaruhi pemangku kepentingan", "Mengelola konflik secara efektif"] },
      { level: "L4", indicators: ["Mengelola stakeholder strategis", "Membangun komunikasi organisasi"] },
    ],
    [
      { level: "L1", indicators: ["Menjalankan tugas sesuai instruksi", "Melaporkan hambatan yang ditemui"] },
      { level: "L2", indicators: ["Menyelesaikan masalah operasional", "Mencari solusi alternatif"] },
      { level: "L3", indicators: ["Mencapai delivery excellence", "Mengelola prioritas kompleks"] },
      { level: "L4", indicators: ["Mengambil keputusan dalam krisis", "Membangun kapasitas problem solving tim"] },
    ],
    [
      { level: "L1", indicators: ["Bekerja dalam tim dengan baik", "Memenuhi tanggung jawab individu"] },
      { level: "L2", indicators: ["Berkoordinasi dengan unit lain", "Mengelola tanggung jawab bersama"] },
      { level: "L3", indicators: ["Membangun sinergi lintas fungsi", "Mendorong akuntabilitas tim"] },
      { level: "L4", indicators: ["Membangun budaya kinerja", "Menciptakan sistem kolaborasi organisasi"] },
    ],
  ];

  await db.insert(unitsTable).values([
    { id: "pan-01", clusterId: "cluster-pancek", code: "PAN-01", name: "Perencanaan Kerja Efektif", description: "Kemampuan menyusun dan mengoptimalkan rencana kerja yang realistis dan terukur.", indicators: pancekIndicators[0] },
    { id: "pan-02", clusterId: "cluster-pancek", code: "PAN-02", name: "Komunikasi & Negosiasi", description: "Kemampuan berkomunikasi efektif dan melakukan negosiasi untuk mencapai kesepakatan.", indicators: pancekIndicators[1] },
    { id: "pan-03", clusterId: "cluster-pancek", code: "PAN-03", name: "Eksekusi & Problem Solving", description: "Kemampuan menjalankan rencana dan menyelesaikan masalah yang muncul dalam proses kerja.", indicators: pancekIndicators[2] },
    { id: "pan-04", clusterId: "cluster-pancek", code: "PAN-04", name: "Kolaborasi & Akuntabilitas", description: "Kemampuan bekerja sama dalam tim dan bertanggung jawab atas hasil kerja.", indicators: pancekIndicators[3] },
  ]);

  // Courses
  const course1Lessons: Lesson[] = [
    { id: "lesson-1", order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Memahami standar kompetensi", content: "Video pengantar" },
    { id: "lesson-2", order: 2, type: "context", title: "Konteks Dunia Nyata", description: "Studi kasus", content: "Case study" },
    { id: "lesson-3", order: 3, type: "microlearning", title: "Tools Analisis", description: "Tools analisis masalah", content: "SWOT, Fishbone, 5 Why" },
    { id: "lesson-4", order: 4, type: "practice", title: "Aktivitas Praktik", description: "Analisis kasus nyata", content: "Worksheet" },
    { id: "lesson-5", order: 5, type: "assessment", title: "Asesmen", description: "Project mini", content: "Upload evidensi" },
    { id: "lesson-6", order: 6, type: "reflection", title: "Refleksi", description: "Dokumentasi pembelajaran", content: "Refleksi terstruktur" },
  ];

  const course2Lessons: Lesson[] = [
    { id: "lesson-p1", order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Eksekusi vs kesibukan", content: "Video pengantar" },
    { id: "lesson-p2", order: 2, type: "context", title: "Studi Kasus", description: "Kasus eksekusi", content: "Case study" },
    { id: "lesson-p3", order: 3, type: "microlearning", title: "Execution Loop", description: "PDCA", content: "Framework" },
    { id: "lesson-p4", order: 4, type: "practice", title: "Real Work Assignment", description: "Masalah nyata", content: "Tugas praktik" },
    { id: "lesson-p5", order: 5, type: "assessment", title: "Review Evidensi", description: "Penilaian", content: "Upload" },
    { id: "lesson-p6", order: 6, type: "reflection", title: "Refleksi", description: "Apa yang berhasil", content: "Refleksi" },
  ];

  await db.insert(coursesTable).values([
    {
      id: "course-smap01-l2",
      unitId: "smap-01",
      targetLevel: "L2",
      title: "Analisis Masalah Strategis - Level Application",
      description: "Kursus untuk mengembangkan kemampuan menganalisis masalah strategis dengan metode standar.",
      duration: "4 jam",
      lessons: course1Lessons,
      preTestId: null,
      postTestId: null,
      createdAt: "2025-01-15",
    },
    {
      id: "course-pan03-l2",
      unitId: "pan-03",
      targetLevel: "L2",
      title: "Eksekusi & Problem Solving - Level Application",
      description: "Kursus untuk mengembangkan kemampuan eksekusi dan pemecahan masalah operasional.",
      duration: "3 jam",
      lessons: course2Lessons,
      preTestId: null,
      postTestId: null,
      createdAt: "2025-01-18",
    },
  ]);

  // Participants
  const p1Competencies: ParticipantCompetency[] = [
    { unitId: "smap-01", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" },
    { unitId: "smap-02", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" },
    { unitId: "pan-01", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2025-01-10", status: "achieved" },
    { unitId: "pan-03", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" },
  ];
  const p1LearningHistory: LearningRecord[] = [
    { id: "lr-1", courseId: "course-pan03-l2", startedAt: "2025-01-15", progress: 60, status: "in_progress" },
  ];

  const p2Competencies: ParticipantCompetency[] = [
    { unitId: "smap-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
    { unitId: "smap-02", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
    { unitId: "pan-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
    { unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "on_track" },
  ];
  const p2LearningHistory: LearningRecord[] = [
    { id: "lr-2", courseId: "course-smap01-l2", startedAt: "2025-01-12", completedAt: "2025-01-18", progress: 100, status: "completed" },
  ];
  const p2Evidences: Evidence[] = [
    { id: "ev-1", unitId: "smap-01", type: "document", title: "Analisis Kasus Unit", description: "Analisis masalah strategis unit operasional", submittedAt: "2025-01-18", status: "approved", score: 85, feedback: "Analisis komprehensif" },
  ];

  await db.insert(participantsTable).values([
    {
      id: "p-001",
      nip: "198501012010011001",
      name: "Andi Pratama",
      position: "Staf Senior",
      unit: "Operasional",
      email: "andi.pratama@org.go.id",
      competencies: p1Competencies,
      learningHistory: p1LearningHistory,
      evidences: [],
    },
    {
      id: "p-002",
      nip: "198702152012012002",
      name: "Budi Santoso",
      position: "Supervisor",
      unit: "Operasional",
      email: "budi.santoso@org.go.id",
      competencies: p2Competencies,
      learningHistory: p2LearningHistory,
      evidences: p2Evidences,
    },
    {
      id: "p-003",
      nip: "198303032008032003",
      name: "Citra Dewi",
      position: "Manager",
      unit: "Support",
      email: "citra.dewi@org.go.id",
      competencies: [
        { unitId: "smap-01", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2025-01-05", status: "achieved" },
        { unitId: "smap-02", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-05", status: "gap" },
        { unitId: "smap-03", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2025-01-05", status: "achieved" },
        { unitId: "pan-02", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2025-01-05", status: "achieved" },
      ],
      learningHistory: [],
      evidences: [
        { id: "ev-2", unitId: "smap-01", type: "presentation", title: "Strategic Analysis Presentation", description: "Presentasi analisis strategis Q4", submittedAt: "2025-01-05", status: "approved", score: 90 },
      ],
    },
    {
      id: "p-004",
      nip: "198004042005041004",
      name: "Dedi Kurniawan",
      position: "Manager",
      unit: "Operasional",
      email: "dedi.kurniawan@org.go.id",
      competencies: [
        { unitId: "smap-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-12", status: "on_track" },
        { unitId: "smap-02", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-12", status: "gap" },
        { unitId: "pan-01", currentLevel: "L1", targetLevel: "L3", lastAssessed: "2025-01-12", status: "gap" },
        { unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-12", status: "gap" },
      ],
      learningHistory: [
        { id: "lr-3", courseId: "course-smap01-l2", startedAt: "2025-01-14", progress: 80, status: "in_progress" },
      ],
      evidences: [],
    },
    {
      id: "p-005",
      nip: "197505052000051005",
      name: "Eka Putra",
      position: "Senior Manager",
      unit: "Strategi",
      email: "eka.putra@org.go.id",
      competencies: [
        { unitId: "smap-01", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2025-01-01", status: "achieved" },
        { unitId: "smap-02", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2025-01-01", status: "achieved" },
        { unitId: "smap-03", currentLevel: "L3", targetLevel: "L4", lastAssessed: "2025-01-01", status: "on_track" },
        { unitId: "smap-04", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2025-01-01", status: "achieved" },
      ],
      learningHistory: [],
      evidences: [
        { id: "ev-3", unitId: "smap-01", type: "document", title: "Strategic Brief 2025", description: "Dokumen strategi organisasi 2025", submittedAt: "2025-01-01", status: "approved", score: 95 },
      ],
    },
  ]);

  // LSP Organization
  await db.insert(lspOrganizationsTable).values([
    {
      id: "lsp-001",
      name: "LSP Training Indonesia",
      licenseNumber: "BNSP-LSP-2024-001",
      address: "Jakarta, Indonesia",
      phone: "+62-21-12345678",
      email: "info@lsp-training.id",
      website: null,
      leadAssessorId: null,
      competencySchemes: [],
      status: "active",
      validUntil: "2027-12-31",
      createdAt: "2024-01-01",
    },
  ]);

  // Schemes
  await db.insert(schemesTable).values([
    {
      id: "scheme-001",
      lspId: "lsp-001",
      code: "SKM-SMAP-01",
      name: "Skema Sertifikasi Manajer Strategis",
      description: "Sertifikasi untuk kompetensi manajemen strategis dan analisis",
      skkniCode: "SKKNI-2024-001",
      unitIds: ["smap-01", "smap-02", "smap-03", "smap-04"],
      assessmentMethods: ["written_test", "portfolio", "oral_interview", "observation"],
      duration: "2 hari",
      fee: 2500000,
      isActive: 1,
    },
  ]);

  // Assessors
  await db.insert(assessorsTable).values([
    {
      id: "assessor-001",
      registrationNumber: "NRA-2024-0001",
      name: "Dr. Ahmad Wijaya",
      email: "ahmad.wijaya@lsp.id",
      phone: "+62-812-3456789",
      lspId: "lsp-001",
      competencySchemes: ["scheme-001"],
      specializations: ["Strategic Management", "Leadership"],
      status: "active",
      validUntil: "2026-12-31",
      totalAssessments: 45,
      createdAt: "2024-01-15",
    },
  ]);

  // Learning Paths
  await db.insert(learningPathsTable).values([
    {
      id: "path-001",
      title: "Jalur Manajer Strategis",
      description: "Jalur pembelajaran lengkap untuk menjadi manajer strategis yang kompeten",
      targetRole: "Strategic Manager",
      duration: "3 bulan",
      difficulty: "advanced",
      courseIds: ["course-smap01-l2", "course-pan03-l2"],
      prerequisites: [],
      skills: ["Strategic Analysis", "Decision Making", "Problem Solving"],
      isPublished: 1,
      createdAt: "2025-01-01",
    },
  ]);

  // Notifications
  const now = Date.now();
  await db.insert(notificationsTable).values([
    {
      id: "notif-001",
      userId: "system",
      type: "warning",
      category: "assessment",
      title: "Gap Kompetensi Terdeteksi",
      message: "3 peserta memiliki gap kompetensi kritis di unit SMAP-01. Segera jadwalkan pelatihan.",
      link: "/app/competencies",
      isRead: 0,
      createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "notif-002",
      userId: "system",
      type: "success",
      category: "certificate",
      title: "Sertifikat Baru Diterbitkan",
      message: "Sertifikat kompetensi berhasil diterbitkan untuk Budi Santoso pada skema SMAP.",
      link: "/app/certificates",
      isRead: 0,
      createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "notif-003",
      userId: "system",
      type: "info",
      category: "schedule",
      title: "Jadwal Asesmen Mendatang",
      message: "Asesmen dijadwalkan besok pukul 09:00 WIB untuk 2 asesi. Pastikan asesor siap.",
      link: "/app/assessment",
      isRead: 0,
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: "notif-004",
      userId: "system",
      type: "info",
      category: "course",
      title: "E-Course Baru Ditambahkan",
      message: "Kursus 'Pengambilan Keputusan Berbasis Data L2' telah dipublikasikan dan siap diakses peserta.",
      link: "/app/courses",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: "notif-005",
      userId: "system",
      type: "warning",
      category: "certificate",
      title: "Sertifikat Hampir Kadaluarsa",
      message: "2 sertifikat asesor akan kadaluarsa dalam 30 hari. Segera perbarui masa berlaku.",
      link: "/app/assessment",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: "notif-006",
      userId: "system",
      type: "success",
      category: "assessment",
      title: "Asesi Lulus Uji Kompetensi",
      message: "Siti Rahayu dinyatakan KOMPETEN pada skema SKM-SMAP-01. Sertifikat dapat diterbitkan.",
      link: "/app/assessment",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
    },
  ]);

  console.log("[seed] Database seeded successfully.");
}
