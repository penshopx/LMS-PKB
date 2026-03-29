import { randomUUID } from "crypto";
import type { 
  CompetencyCluster, 
  UnitCompetency, 
  ECourse, 
  Participant, 
  Evidence,
  Assessment,
  DashboardStats,
  HeatmapData,
  InsertParticipant,
  InsertEvidence,
  InsertCourse,
  InsertCluster,
  InsertUnit,
  Lesson,
  ParticipantCompetency,
  LearningRecord,
  BehaviorIndicator,
  LearningPath,
  InsertLearningPath,
  Enrollment,
  Quiz,
  QuizAttempt,
  InsertQuiz,
  Question,
  Certificate,
  InsertCertificate,
  Assessor,
  InsertAssessor,
  Assessee,
  InsertAssessee,
  LSPOrganization,
  CompetencyScheme,
  InsertScheme,
  AssessmentSchedule,
  InsertSchedule,
  PortfolioItem,
  InsertPortfolio,
  CertificationResult,
  Badge,
  Achievement,
  Notification
} from "@shared/schema";

// Sample data imports (replicated from client for server use)
const competencyClusters: CompetencyCluster[] = [
  {
    id: "cluster-smap",
    code: "SMAP",
    name: "SMAP",
    fullName: "Strategic Management & Analytical Planning",
    description: "Mengembangkan kemampuan berpikir strategis, analisis, dan pengambilan keputusan berbasis data.",
    color: "hsl(199 89% 48%)"
  },
  {
    id: "cluster-pancek",
    code: "PANCEK",
    name: "PANCEK",
    fullName: "Planning, Action, Negotiation, Communication, Execution",
    description: "Membangun kompetensi eksekusi, komunikasi, dan kolaborasi kerja.",
    color: "hsl(172 66% 50%)"
  }
];

const smapUnits: UnitCompetency[] = [
  {
    id: "smap-01",
    clusterId: "cluster-smap",
    code: "SMAP-01",
    name: "Analisis Masalah Strategis",
    description: "Kemampuan mengidentifikasi, menganalisis, dan memilah masalah strategis vs operasional.",
    indicators: [
      { level: "L1", indicators: ["Mengenali jenis-jenis masalah organisasi", "Memahami perbedaan isu strategis dan operasional"] },
      { level: "L2", indicators: ["Mengidentifikasi akar masalah dengan metode standar", "Menganalisis dampak masalah pada unit kerja"] },
      { level: "L3", indicators: ["Mensintesis masalah dari berbagai perspektif", "Menggunakan multi-metode analisis"] },
      { level: "L4", indicators: ["Menentukan prioritas isu strategis organisasi", "Mengarahkan tim dalam analisis sistemik"] }
    ]
  },
  {
    id: "smap-02",
    clusterId: "cluster-smap",
    code: "SMAP-02",
    name: "Perumusan Opsi Strategi",
    description: "Kemampuan merumuskan dan mengevaluasi alternatif strategi yang relevan.",
    indicators: [
      { level: "L1", indicators: ["Memahami konsep strategi dan opsi", "Mengenali contoh strategi yang ada"] },
      { level: "L2", indicators: ["Membuat alternatif solusi sederhana", "Mengevaluasi kelebihan dan kekurangan opsi"] },
      { level: "L3", indicators: ["Merumuskan opsi strategis berbasis analisis", "Menilai risiko dan dampak setiap opsi"] },
      { level: "L4", indicators: ["Menetapkan strategi organisasi", "Mengintegrasikan strategi lintas unit"] }
    ]
  },
  {
    id: "smap-03",
    clusterId: "cluster-smap",
    code: "SMAP-03",
    name: "Pengambilan Keputusan Berbasis Data",
    description: "Kemampuan menggunakan data dan fakta untuk pengambilan keputusan yang tepat.",
    indicators: [
      { level: "L1", indicators: ["Membaca dan memahami data dasar", "Mengenali jenis-jenis data yang relevan"] },
      { level: "L2", indicators: ["Menggunakan data untuk mendukung keputusan", "Membuat analisis data sederhana"] },
      { level: "L3", indicators: ["Menghasilkan insight dari data kompleks", "Menghubungkan data dengan konteks strategis"] },
      { level: "L4", indicators: ["Membangun governance keputusan berbasis data", "Mengarahkan kebijakan data-driven"] }
    ]
  },
  {
    id: "smap-04",
    clusterId: "cluster-smap",
    code: "SMAP-04",
    name: "Monitoring & Evaluasi Strategi",
    description: "Kemampuan memantau pelaksanaan strategi dan mengevaluasi efektivitasnya.",
    indicators: [
      { level: "L1", indicators: ["Memahami indikator kinerja", "Mengenali proses monitoring dasar"] },
      { level: "L2", indicators: ["Melakukan monitoring rutin", "Membuat laporan progress"] },
      { level: "L3", indicators: ["Mengevaluasi dampak strategi", "Mengidentifikasi area perbaikan"] },
      { level: "L4", indicators: ["Melakukan re-design strategi", "Membangun sistem evaluasi berkelanjutan"] }
    ]
  }
];

const pancekUnits: UnitCompetency[] = [
  {
    id: "pan-01",
    clusterId: "cluster-pancek",
    code: "PAN-01",
    name: "Perencanaan Kerja Efektif",
    description: "Kemampuan menyusun dan mengoptimalkan rencana kerja yang realistis dan terukur.",
    indicators: [
      { level: "L1", indicators: ["Mengikuti rencana yang diberikan", "Memahami komponen rencana kerja"] },
      { level: "L2", indicators: ["Menyusun rencana kerja mandiri", "Mengidentifikasi sumber daya yang dibutuhkan"] },
      { level: "L3", indicators: ["Mengoptimasi rencana untuk efisiensi", "Mengantisipasi hambatan dan risiko"] },
      { level: "L4", indicators: ["Mensinkronisasi rencana lintas tim", "Membangun sistem perencanaan terintegrasi"] }
    ]
  },
  {
    id: "pan-02",
    clusterId: "cluster-pancek",
    code: "PAN-02",
    name: "Komunikasi & Negosiasi",
    description: "Kemampuan berkomunikasi efektif dan melakukan negosiasi untuk mencapai kesepakatan.",
    indicators: [
      { level: "L1", indicators: ["Menyampaikan informasi dengan jelas", "Mendengarkan dengan baik"] },
      { level: "L2", indicators: ["Melakukan negosiasi dasar", "Menyesuaikan gaya komunikasi"] },
      { level: "L3", indicators: ["Mempengaruhi pemangku kepentingan", "Mengelola konflik secara efektif"] },
      { level: "L4", indicators: ["Mengelola stakeholder strategis", "Membangun komunikasi organisasi"] }
    ]
  },
  {
    id: "pan-03",
    clusterId: "cluster-pancek",
    code: "PAN-03",
    name: "Eksekusi & Problem Solving",
    description: "Kemampuan menjalankan rencana dan menyelesaikan masalah yang muncul dalam proses kerja.",
    indicators: [
      { level: "L1", indicators: ["Menjalankan tugas sesuai instruksi", "Melaporkan hambatan yang ditemui"] },
      { level: "L2", indicators: ["Menyelesaikan masalah operasional", "Mencari solusi alternatif"] },
      { level: "L3", indicators: ["Mencapai delivery excellence", "Mengelola prioritas kompleks"] },
      { level: "L4", indicators: ["Mengambil keputusan dalam krisis", "Membangun kapasitas problem solving tim"] }
    ]
  },
  {
    id: "pan-04",
    clusterId: "cluster-pancek",
    code: "PAN-04",
    name: "Kolaborasi & Akuntabilitas",
    description: "Kemampuan bekerja sama dalam tim dan bertanggung jawab atas hasil kerja.",
    indicators: [
      { level: "L1", indicators: ["Bekerja dalam tim dengan baik", "Memenuhi tanggung jawab individu"] },
      { level: "L2", indicators: ["Berkoordinasi dengan unit lain", "Mengelola tanggung jawab bersama"] },
      { level: "L3", indicators: ["Membangun sinergi lintas fungsi", "Mendorong akuntabilitas tim"] },
      { level: "L4", indicators: ["Membangun budaya kinerja", "Menciptakan sistem kolaborasi organisasi"] }
    ]
  }
];

const initialParticipants: Participant[] = [
  {
    id: "p-001",
    nip: "198501012010011001",
    name: "Andi Pratama",
    position: "Staf Senior",
    unit: "Operasional",
    email: "andi.pratama@org.go.id",
    competencies: [
      { unitId: "smap-01", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" },
      { unitId: "smap-02", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" },
      { unitId: "pan-01", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2025-01-10", status: "achieved" },
      { unitId: "pan-03", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2025-01-10", status: "gap" }
    ],
    learningHistory: [
      { id: "lr-1", courseId: "course-pan03-l2", startedAt: "2025-01-15", progress: 60, status: "in_progress" }
    ],
    evidences: []
  },
  {
    id: "p-002",
    nip: "198702152012012002",
    name: "Budi Santoso",
    position: "Supervisor",
    unit: "Operasional",
    email: "budi.santoso@org.go.id",
    competencies: [
      { unitId: "smap-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
      { unitId: "smap-02", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
      { unitId: "pan-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "gap" },
      { unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-08", status: "on_track" }
    ],
    learningHistory: [
      { id: "lr-2", courseId: "course-smap01-l2", startedAt: "2025-01-12", completedAt: "2025-01-18", progress: 100, status: "completed" }
    ],
    evidences: [
      { id: "ev-1", unitId: "smap-01", type: "document", title: "Analisis Kasus Unit", description: "Analisis masalah strategis unit operasional", submittedAt: "2025-01-18", status: "approved", score: 85, feedback: "Analisis komprehensif" }
    ]
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
      { unitId: "pan-02", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2025-01-05", status: "achieved" }
    ],
    learningHistory: [],
    evidences: [
      { id: "ev-2", unitId: "smap-01", type: "presentation", title: "Strategic Analysis Presentation", description: "Presentasi analisis strategis Q4", submittedAt: "2025-01-05", status: "approved", score: 90 }
    ]
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
      { unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2025-01-12", status: "gap" }
    ],
    learningHistory: [
      { id: "lr-3", courseId: "course-smap01-l2", startedAt: "2025-01-14", progress: 80, status: "in_progress" }
    ],
    evidences: []
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
      { unitId: "smap-04", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2025-01-01", status: "achieved" }
    ],
    learningHistory: [],
    evidences: [
      { id: "ev-3", unitId: "smap-01", type: "document", title: "Strategic Brief 2025", description: "Dokumen strategi organisasi 2025", submittedAt: "2025-01-01", status: "approved", score: 95 }
    ]
  }
];

const initialCourses: ECourse[] = [
  {
    id: "course-smap01-l2",
    unitId: "smap-01",
    targetLevel: "L2",
    title: "Analisis Masalah Strategis - Level Application",
    description: "Kursus untuk mengembangkan kemampuan menganalisis masalah strategis dengan metode standar.",
    duration: "4 jam",
    lessons: [
      { id: "lesson-1", order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Memahami standar kompetensi", content: "Video pengantar" },
      { id: "lesson-2", order: 2, type: "context", title: "Konteks Dunia Nyata", description: "Studi kasus", content: "Case study" },
      { id: "lesson-3", order: 3, type: "microlearning", title: "Tools Analisis", description: "Tools analisis masalah", content: "SWOT, Fishbone, 5 Why" },
      { id: "lesson-4", order: 4, type: "practice", title: "Aktivitas Praktik", description: "Analisis kasus nyata", content: "Worksheet" },
      { id: "lesson-5", order: 5, type: "assessment", title: "Asesmen", description: "Project mini", content: "Upload evidensi" },
      { id: "lesson-6", order: 6, type: "reflection", title: "Refleksi", description: "Dokumentasi pembelajaran", content: "Refleksi terstruktur" }
    ],
    createdAt: "2025-01-15"
  },
  {
    id: "course-pan03-l2",
    unitId: "pan-03",
    targetLevel: "L2",
    title: "Eksekusi & Problem Solving - Level Application",
    description: "Kursus untuk mengembangkan kemampuan eksekusi dan pemecahan masalah operasional.",
    duration: "3 jam",
    lessons: [
      { id: "lesson-p1", order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Eksekusi vs kesibukan", content: "Video pengantar" },
      { id: "lesson-p2", order: 2, type: "context", title: "Studi Kasus", description: "Kasus eksekusi", content: "Case study" },
      { id: "lesson-p3", order: 3, type: "microlearning", title: "Execution Loop", description: "PDCA", content: "Framework" },
      { id: "lesson-p4", order: 4, type: "practice", title: "Real Work Assignment", description: "Masalah nyata", content: "Tugas praktik" },
      { id: "lesson-p5", order: 5, type: "assessment", title: "Review Evidensi", description: "Penilaian", content: "Upload" },
      { id: "lesson-p6", order: 6, type: "reflection", title: "Refleksi", description: "Apa yang berhasil", content: "Refleksi" }
    ],
    createdAt: "2025-01-18"
  }
];

export interface IStorage {
  // Clusters
  getClusters(): Promise<CompetencyCluster[]>;
  getCluster(id: string): Promise<CompetencyCluster | undefined>;
  createCluster(data: InsertCluster): Promise<CompetencyCluster>;
  updateCluster(id: string, data: Partial<InsertCluster>): Promise<CompetencyCluster | undefined>;
  deleteCluster(id: string): Promise<boolean>;
  
  // Units
  getUnits(): Promise<UnitCompetency[]>;
  getUnit(id: string): Promise<UnitCompetency | undefined>;
  getUnitsByCluster(clusterId: string): Promise<UnitCompetency[]>;
  createUnit(data: InsertUnit): Promise<UnitCompetency>;
  updateUnit(id: string, data: Partial<InsertUnit>): Promise<UnitCompetency | undefined>;
  deleteUnit(id: string): Promise<boolean>;
  
  // Courses
  getCourses(): Promise<ECourse[]>;
  getCourse(id: string): Promise<ECourse | undefined>;
  getCoursesByUnit(unitId: string): Promise<ECourse[]>;
  createCourse(data: InsertCourse): Promise<ECourse>;
  deleteCourse(id: string): Promise<boolean>;
  
  // Participants
  getParticipants(): Promise<Participant[]>;
  getParticipant(id: string): Promise<Participant | undefined>;
  createParticipant(data: InsertParticipant): Promise<Participant>;
  updateParticipantCompetencies(id: string, competencies: ParticipantCompetency[]): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<boolean>;
  
  // Evidences
  addEvidence(participantId: string, data: InsertEvidence): Promise<Evidence>;
  updateEvidenceStatus(participantId: string, evidenceId: string, status: Evidence['status'], score?: number, feedback?: string): Promise<Evidence | undefined>;
  
  // Dashboard
  getDashboardStats(): Promise<DashboardStats>;
  getHeatmapData(): Promise<HeatmapData[]>;

  // LMS - Learning Paths
  getLearningPaths(): Promise<LearningPath[]>;
  getLearningPath(id: string): Promise<LearningPath | undefined>;
  createLearningPath(data: InsertLearningPath): Promise<LearningPath>;
  updateLearningPath(id: string, data: Partial<InsertLearningPath>): Promise<LearningPath | undefined>;
  deleteLearningPath(id: string): Promise<boolean>;

  // LMS - Enrollments
  getEnrollments(): Promise<Enrollment[]>;
  getEnrollmentsByParticipant(participantId: string): Promise<Enrollment[]>;
  createEnrollment(participantId: string, courseId?: string, learningPathId?: string): Promise<Enrollment>;
  updateEnrollmentProgress(id: string, progress: number, status?: Enrollment['status']): Promise<Enrollment | undefined>;

  // LMS - Quizzes
  getQuizzes(): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizzesByCourse(courseId: string): Promise<Quiz[]>;
  createQuiz(data: InsertQuiz & { questions: Question[] }): Promise<Quiz>;
  deleteQuiz(id: string): Promise<boolean>;

  // LMS - Quiz Attempts
  getQuizAttempts(quizId: string): Promise<QuizAttempt[]>;
  getQuizAttemptsByParticipant(participantId: string): Promise<QuizAttempt[]>;
  createQuizAttempt(attempt: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt>;

  // LMS - Certificates
  getCertificates(): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  getCertificatesByParticipant(participantId: string): Promise<Certificate[]>;
  createCertificate(data: InsertCertificate): Promise<Certificate>;
  verifyCertificate(certificateNumber: string): Promise<Certificate | undefined>;

  // LSP - Assessors
  getAssessors(): Promise<Assessor[]>;
  getAssessor(id: string): Promise<Assessor | undefined>;
  createAssessor(data: InsertAssessor): Promise<Assessor>;
  updateAssessor(id: string, data: Partial<InsertAssessor>): Promise<Assessor | undefined>;
  deleteAssessor(id: string): Promise<boolean>;

  // LSP - Assessees
  getAssessees(): Promise<Assessee[]>;
  getAssessee(id: string): Promise<Assessee | undefined>;
  createAssessee(data: InsertAssessee): Promise<Assessee>;
  updateAssesseeStatus(id: string, status: Assessee['status']): Promise<Assessee | undefined>;

  // LSP - Schemes
  getSchemes(): Promise<CompetencyScheme[]>;
  getScheme(id: string): Promise<CompetencyScheme | undefined>;
  createScheme(data: InsertScheme): Promise<CompetencyScheme>;
  
  // LSP - Schedules
  getSchedules(): Promise<AssessmentSchedule[]>;
  getSchedule(id: string): Promise<AssessmentSchedule | undefined>;
  createSchedule(data: InsertSchedule): Promise<AssessmentSchedule>;
  updateScheduleStatus(id: string, status: AssessmentSchedule['status']): Promise<AssessmentSchedule | undefined>;

  // LSP - Portfolio
  getPortfolioItems(assesseeId: string): Promise<PortfolioItem[]>;
  createPortfolioItem(data: InsertPortfolio): Promise<PortfolioItem>;
  updatePortfolioStatus(id: string, status: PortfolioItem['status'], feedback?: string): Promise<PortfolioItem | undefined>;

  // LSP - Certification Results
  getCertificationResults(): Promise<CertificationResult[]>;
  createCertificationResult(result: Omit<CertificationResult, 'id'>): Promise<CertificationResult>;

  // LSP - Organizations
  getLSPOrganizations(): Promise<LSPOrganization[]>;
  getLSPOrganization(id: string): Promise<LSPOrganization | undefined>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(): Promise<void>;

  // Search
  searchAll(query: string): Promise<{ participants: Participant[]; courses: ECourse[]; units: UnitCompetency[] }>;

  // Analytics
  getAnalyticsData(): Promise<{
    monthlyTrend: { month: string; completions: number; enrollments: number }[];
    levelDistributionByCluster: { cluster: string; L1: number; L2: number; L3: number; L4: number }[];
    courseCompletionByLevel: { level: string; count: number }[];
    topGapUnits: { name: string; gap: number; code: string }[];
    participantsByUnit: { unit: string; count: number }[];
  }>;
}

export class MemStorage implements IStorage {
  private clusters: Map<string, CompetencyCluster>;
  private units: Map<string, UnitCompetency>;
  private courses: Map<string, ECourse>;
  private participants: Map<string, Participant>;
  private learningPaths: Map<string, LearningPath>;
  private enrollments: Map<string, Enrollment>;
  private quizzes: Map<string, Quiz>;
  private quizAttempts: Map<string, QuizAttempt>;
  private certificates: Map<string, Certificate>;
  private assessors: Map<string, Assessor>;
  private assessees: Map<string, Assessee>;
  private schemes: Map<string, CompetencyScheme>;
  private schedules: Map<string, AssessmentSchedule>;
  private portfolioItems: Map<string, PortfolioItem>;
  private certificationResults: Map<string, CertificationResult>;
  private lspOrganizations: Map<string, LSPOrganization>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.clusters = new Map(competencyClusters.map(c => [c.id, c]));
    this.units = new Map([...smapUnits, ...pancekUnits].map(u => [u.id, u]));
    this.courses = new Map(initialCourses.map(c => [c.id, c]));
    this.participants = new Map(initialParticipants.map(p => [p.id, p]));
    this.learningPaths = new Map();
    this.enrollments = new Map();
    this.quizzes = new Map();
    this.quizAttempts = new Map();
    this.certificates = new Map();
    this.assessors = new Map();
    this.assessees = new Map();
    this.schemes = new Map();
    this.schedules = new Map();
    this.portfolioItems = new Map();
    this.certificationResults = new Map();
    this.lspOrganizations = new Map();
    this.notifications = new Map();
    
    this.initializeSampleLMSData();
    this.initializeSampleNotifications();
  }

  private initializeSampleNotifications() {
    const sampleNotifications: Notification[] = [
      {
        id: "notif-001",
        userId: "system",
        type: "warning",
        category: "assessment",
        title: "Gap Kompetensi Terdeteksi",
        message: "3 peserta memiliki gap kompetensi kritis di unit SMAP-01. Segera jadwalkan pelatihan.",
        link: "/app/competencies",
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: "notif-002",
        userId: "system",
        type: "success",
        category: "certificate",
        title: "Sertifikat Baru Diterbitkan",
        message: "Sertifikat kompetensi berhasil diterbitkan untuk Budi Santoso pada skema SMAP.",
        link: "/app/certificates",
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: "notif-003",
        userId: "system",
        type: "info",
        category: "schedule",
        title: "Jadwal Asesmen Mendatang",
        message: "Asesmen dijadwalkan besok pukul 09:00 WIB untuk 2 asesi. Pastikan asesor siap.",
        link: "/app/assessment",
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
      },
      {
        id: "notif-004",
        userId: "system",
        type: "info",
        category: "course",
        title: "E-Course Baru Ditambahkan",
        message: "Kursus 'Pengambilan Keputusan Berbasis Data L2' telah dipublikasikan dan siap diakses peserta.",
        link: "/app/courses",
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      },
      {
        id: "notif-005",
        userId: "system",
        type: "warning",
        category: "certificate",
        title: "Sertifikat Hampir Kadaluarsa",
        message: "2 sertifikat asesor akan kadaluarsa dalam 30 hari. Segera perbarui masa berlaku.",
        link: "/app/assessment",
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
      },
      {
        id: "notif-006",
        userId: "system",
        type: "success",
        category: "assessment",
        title: "Asesi Lulus Uji Kompetensi",
        message: "Siti Rahayu dinyatakan KOMPETEN pada skema SKM-SMAP-01. Sertifikat dapat diterbitkan.",
        link: "/app/assessment",
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
      }
    ];
    sampleNotifications.forEach(n => this.notifications.set(n.id, n));
  }

  private initializeSampleLMSData() {
    const sampleLSP: LSPOrganization = {
      id: "lsp-001",
      name: "LSP Training Indonesia",
      licenseNumber: "BNSP-LSP-2024-001",
      address: "Jakarta, Indonesia",
      phone: "+62-21-12345678",
      email: "info@lsp-training.id",
      competencySchemes: [],
      status: "active",
      validUntil: "2027-12-31",
      createdAt: "2024-01-01"
    };
    this.lspOrganizations.set(sampleLSP.id, sampleLSP);

    const sampleScheme: CompetencyScheme = {
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
      isActive: true
    };
    this.schemes.set(sampleScheme.id, sampleScheme);

    const sampleAssessor: Assessor = {
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
      createdAt: "2024-01-15"
    };
    this.assessors.set(sampleAssessor.id, sampleAssessor);

    const samplePath: LearningPath = {
      id: "path-001",
      title: "Jalur Manajer Strategis",
      description: "Jalur pembelajaran lengkap untuk menjadi manajer strategis yang kompeten",
      targetRole: "Strategic Manager",
      duration: "3 bulan",
      difficulty: "advanced",
      courseIds: ["course-smap01-l2", "course-pan03-l2"],
      prerequisites: [],
      skills: ["Strategic Analysis", "Decision Making", "Problem Solving"],
      isPublished: true,
      createdAt: "2025-01-01"
    };
    this.learningPaths.set(samplePath.id, samplePath);
  }

  // Clusters
  async getClusters(): Promise<CompetencyCluster[]> {
    return Array.from(this.clusters.values());
  }

  async getCluster(id: string): Promise<CompetencyCluster | undefined> {
    return this.clusters.get(id);
  }

  async createCluster(data: InsertCluster): Promise<CompetencyCluster> {
    const id = `cluster-${randomUUID()}`;
    const cluster: CompetencyCluster = {
      id,
      code: data.code.toUpperCase(),
      name: data.name,
      fullName: data.fullName,
      description: data.description,
      color: data.color
    };
    this.clusters.set(id, cluster);
    return cluster;
  }

  async updateCluster(id: string, data: Partial<InsertCluster>): Promise<CompetencyCluster | undefined> {
    const cluster = this.clusters.get(id);
    if (!cluster) return undefined;
    
    const updated: CompetencyCluster = {
      ...cluster,
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.name && { name: data.name }),
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.description && { description: data.description }),
      ...(data.color && { color: data.color })
    };
    this.clusters.set(id, updated);
    return updated;
  }

  async deleteCluster(id: string): Promise<boolean> {
    if (!this.clusters.has(id)) return false;
    // Also delete associated units
    const unitsToDelete = Array.from(this.units.values()).filter(u => u.clusterId === id);
    for (const unit of unitsToDelete) {
      this.units.delete(unit.id);
    }
    return this.clusters.delete(id);
  }

  // Units
  async getUnits(): Promise<UnitCompetency[]> {
    return Array.from(this.units.values());
  }

  async getUnit(id: string): Promise<UnitCompetency | undefined> {
    return this.units.get(id);
  }

  async getUnitsByCluster(clusterId: string): Promise<UnitCompetency[]> {
    return Array.from(this.units.values()).filter(u => u.clusterId === clusterId);
  }

  async createUnit(data: InsertUnit): Promise<UnitCompetency> {
    const id = `unit-${randomUUID()}`;
    const defaultIndicators: BehaviorIndicator[] = data.indicators || [
      { level: "L1", indicators: ["Indikator L1 belum didefinisikan"] },
      { level: "L2", indicators: ["Indikator L2 belum didefinisikan"] },
      { level: "L3", indicators: ["Indikator L3 belum didefinisikan"] },
      { level: "L4", indicators: ["Indikator L4 belum didefinisikan"] }
    ];
    
    const unit: UnitCompetency = {
      id,
      clusterId: data.clusterId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      indicators: defaultIndicators
    };
    this.units.set(id, unit);
    return unit;
  }

  async updateUnit(id: string, data: Partial<InsertUnit>): Promise<UnitCompetency | undefined> {
    const unit = this.units.get(id);
    if (!unit) return undefined;
    
    const updated: UnitCompetency = {
      ...unit,
      ...(data.clusterId && { clusterId: data.clusterId }),
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.indicators && { indicators: data.indicators })
    };
    this.units.set(id, updated);
    return updated;
  }

  async deleteUnit(id: string): Promise<boolean> {
    if (!this.units.has(id)) return false;
    return this.units.delete(id);
  }

  // Courses
  async getCourses(): Promise<ECourse[]> {
    return Array.from(this.courses.values());
  }

  async getCourse(id: string): Promise<ECourse | undefined> {
    return this.courses.get(id);
  }

  async getCoursesByUnit(unitId: string): Promise<ECourse[]> {
    return Array.from(this.courses.values()).filter(c => c.unitId === unitId);
  }

  async createCourse(data: InsertCourse): Promise<ECourse> {
    const id = `course-${randomUUID()}`;
    const unit = this.units.get(data.unitId);
    
    const defaultLessons: Lesson[] = [
      { id: `${id}-l1`, order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Memahami standar dan indikator", content: "" },
      { id: `${id}-l2`, order: 2, type: "context", title: "Konteks Dunia Nyata", description: "Studi kasus dan tantangan", content: "" },
      { id: `${id}-l3`, order: 3, type: "microlearning", title: "Micro Learning", description: "Materi ringkas dan modular", content: "" },
      { id: `${id}-l4`, order: 4, type: "practice", title: "Aktivitas Praktik", description: "Tugas berbasis kerja nyata", content: "" },
      { id: `${id}-l5`, order: 5, type: "assessment", title: "Asesmen Kompetensi", description: "Penilaian berbasis evidensi", content: "" },
      { id: `${id}-l6`, order: 6, type: "reflection", title: "Refleksi & Evidensi", description: "Dokumentasi pembelajaran", content: "" }
    ];

    const course: ECourse = {
      id,
      unitId: data.unitId,
      targetLevel: data.targetLevel,
      title: data.title,
      description: data.description,
      duration: data.duration,
      lessons: defaultLessons,
      preTestId: data.preTestId,
      postTestId: data.postTestId,
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.courses.set(id, course);
    return course;
  }

  async deleteCourse(id: string): Promise<boolean> {
    if (!this.courses.has(id)) return false;
    return this.courses.delete(id);
  }

  // Participants
  async getParticipants(): Promise<Participant[]> {
    return Array.from(this.participants.values());
  }

  async getParticipant(id: string): Promise<Participant | undefined> {
    return this.participants.get(id);
  }

  async createParticipant(data: InsertParticipant): Promise<Participant> {
    const id = `p-${randomUUID()}`;
    const participant: Participant = {
      id,
      nip: data.nip,
      name: data.name,
      position: data.position,
      unit: data.unit,
      email: data.email,
      competencies: [],
      learningHistory: [],
      evidences: []
    };

    this.participants.set(id, participant);
    return participant;
  }

  async updateParticipantCompetencies(id: string, competencies: ParticipantCompetency[]): Promise<Participant | undefined> {
    const participant = this.participants.get(id);
    if (!participant) return undefined;

    participant.competencies = competencies;
    this.participants.set(id, participant);
    return participant;
  }

  async deleteParticipant(id: string): Promise<boolean> {
    if (!this.participants.has(id)) return false;
    return this.participants.delete(id);
  }

  // Evidences
  async addEvidence(participantId: string, data: InsertEvidence): Promise<Evidence> {
    const participant = this.participants.get(participantId);
    if (!participant) throw new Error("Participant not found");

    const evidence: Evidence = {
      id: `ev-${randomUUID()}`,
      unitId: data.unitId,
      type: data.type,
      title: data.title,
      description: data.description,
      submittedAt: new Date().toISOString().split('T')[0],
      status: "pending"
    };

    participant.evidences.push(evidence);
    this.participants.set(participantId, participant);
    return evidence;
  }

  async updateEvidenceStatus(participantId: string, evidenceId: string, status: Evidence['status'], score?: number, feedback?: string): Promise<Evidence | undefined> {
    const participant = this.participants.get(participantId);
    if (!participant) return undefined;

    const evidence = participant.evidences.find(e => e.id === evidenceId);
    if (!evidence) return undefined;

    evidence.status = status;
    evidence.assessedAt = new Date().toISOString().split('T')[0];
    if (score !== undefined) evidence.score = score;
    if (feedback) evidence.feedback = feedback;

    this.participants.set(participantId, participant);
    return evidence;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const participants = Array.from(this.participants.values());
    const courses = Array.from(this.courses.values());
    
    // Calculate stats
    const allCompetencies = participants.flatMap(p => p.competencies);
    const completedLearning = participants.flatMap(p => p.learningHistory.filter(l => l.status === 'completed'));
    const totalLearning = participants.flatMap(p => p.learningHistory);
    
    // Level distribution
    const levelCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
    allCompetencies.forEach(c => {
      levelCounts[c.currentLevel]++;
    });
    const totalComps = allCompetencies.length || 1;
    
    // Gap analysis
    const gapsByUnit: Record<string, { count: number; currentSum: number; targetSum: number }> = {};
    allCompetencies.filter(c => c.status === 'gap').forEach(c => {
      if (!gapsByUnit[c.unitId]) {
        gapsByUnit[c.unitId] = { count: 0, currentSum: 0, targetSum: 0 };
      }
      gapsByUnit[c.unitId].count++;
      gapsByUnit[c.unitId].currentSum += parseInt(c.currentLevel.replace('L', ''));
      gapsByUnit[c.unitId].targetSum += parseInt(c.targetLevel.replace('L', ''));
    });

    const competencyGaps = Object.entries(gapsByUnit)
      .map(([unitId, data]) => {
        const unit = this.units.get(unitId);
        const cluster = unit ? this.clusters.get(unit.clusterId) : undefined;
        return {
          unitId,
          unitName: unit?.name || unitId,
          clusterCode: (cluster?.code || 'SMAP') as 'SMAP' | 'PANCEK',
          gapCount: data.count,
          avgCurrentLevel: data.currentSum / data.count,
          avgTargetLevel: data.targetSum / data.count
        };
      })
      .sort((a, b) => b.gapCount - a.gapCount)
      .slice(0, 5);

    // Average level
    const avgLevel = allCompetencies.reduce((sum, c) => sum + parseInt(c.currentLevel.replace('L', '')), 0) / totalComps;

    return {
      totalParticipants: participants.length,
      totalCourses: courses.length,
      completionRate: totalLearning.length > 0 ? Math.round((completedLearning.length / totalLearning.length) * 100) : 0,
      averageLevel: Math.round(avgLevel * 10) / 10,
      competencyGaps,
      levelDistribution: [
        { level: 'L1', count: levelCounts.L1, percentage: Math.round((levelCounts.L1 / totalComps) * 100) },
        { level: 'L2', count: levelCounts.L2, percentage: Math.round((levelCounts.L2 / totalComps) * 100) },
        { level: 'L3', count: levelCounts.L3, percentage: Math.round((levelCounts.L3 / totalComps) * 100) },
        { level: 'L4', count: levelCounts.L4, percentage: Math.round((levelCounts.L4 / totalComps) * 100) }
      ]
    };
  }

  async getHeatmapData(): Promise<HeatmapData[]> {
    const participants = Array.from(this.participants.values());
    const units = Array.from(this.units.values());
    
    return units.map(unit => {
      const cluster = this.clusters.get(unit.clusterId);
      const competencies = participants.flatMap(p => p.competencies.filter(c => c.unitId === unit.id));
      
      return {
        unitId: unit.id,
        unitCode: unit.code,
        unitName: unit.name,
        clusterCode: (cluster?.code || 'SMAP') as 'SMAP' | 'PANCEK',
        l1Count: competencies.filter(c => c.currentLevel === 'L1').length,
        l2Count: competencies.filter(c => c.currentLevel === 'L2').length,
        l3Count: competencies.filter(c => c.currentLevel === 'L3').length,
        l4Count: competencies.filter(c => c.currentLevel === 'L4').length,
        total: competencies.length
      };
    });
  }

  // LMS - Learning Paths
  async getLearningPaths(): Promise<LearningPath[]> {
    return Array.from(this.learningPaths.values());
  }

  async getLearningPath(id: string): Promise<LearningPath | undefined> {
    return this.learningPaths.get(id);
  }

  async createLearningPath(data: InsertLearningPath): Promise<LearningPath> {
    const id = `path-${randomUUID()}`;
    const path: LearningPath = {
      id,
      title: data.title,
      description: data.description,
      targetRole: data.targetRole,
      duration: data.duration,
      difficulty: data.difficulty,
      courseIds: data.courseIds || [],
      prerequisites: data.prerequisites || [],
      skills: data.skills || [],
      isPublished: false,
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.learningPaths.set(id, path);
    return path;
  }

  async updateLearningPath(id: string, data: Partial<InsertLearningPath>): Promise<LearningPath | undefined> {
    const path = this.learningPaths.get(id);
    if (!path) return undefined;
    const updated = { ...path, ...data };
    this.learningPaths.set(id, updated);
    return updated;
  }

  async deleteLearningPath(id: string): Promise<boolean> {
    return this.learningPaths.delete(id);
  }

  // LMS - Enrollments
  async getEnrollments(): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values());
  }

  async getEnrollmentsByParticipant(participantId: string): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values()).filter(e => e.participantId === participantId);
  }

  async createEnrollment(participantId: string, courseId?: string, learningPathId?: string): Promise<Enrollment> {
    const id = `enroll-${randomUUID()}`;
    const enrollment: Enrollment = {
      id,
      participantId,
      courseId,
      learningPathId,
      enrolledAt: new Date().toISOString(),
      progress: 0,
      status: "enrolled"
    };
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  async updateEnrollmentProgress(id: string, progress: number, status?: Enrollment['status']): Promise<Enrollment | undefined> {
    const enrollment = this.enrollments.get(id);
    if (!enrollment) return undefined;
    enrollment.progress = progress;
    if (status) enrollment.status = status;
    if (progress > 0 && !enrollment.startedAt) {
      enrollment.startedAt = new Date().toISOString();
    }
    if (progress >= 100) {
      enrollment.completedAt = new Date().toISOString();
      enrollment.status = "completed";
    }
    enrollment.lastAccessedAt = new Date().toISOString();
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  // LMS - Quizzes
  async getQuizzes(): Promise<Quiz[]> {
    return Array.from(this.quizzes.values());
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }

  async getQuizzesByCourse(courseId: string): Promise<Quiz[]> {
    return Array.from(this.quizzes.values()).filter(q => q.courseId === courseId);
  }

  async createQuiz(data: InsertQuiz & { questions: Question[] }): Promise<Quiz> {
    const id = `quiz-${randomUUID()}`;
    const quiz: Quiz = {
      id,
      courseId: data.courseId,
      lessonId: data.lessonId,
      title: data.title,
      description: data.description,
      passingScore: data.passingScore ?? 70,
      timeLimit: data.timeLimit,
      maxAttempts: data.maxAttempts ?? 3,
      shuffleQuestions: data.shuffleQuestions ?? false,
      showResults: data.showResults ?? true,
      questions: data.questions,
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.quizzes.set(id, quiz);
    return quiz;
  }

  async deleteQuiz(id: string): Promise<boolean> {
    return this.quizzes.delete(id);
  }

  // LMS - Quiz Attempts
  async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values()).filter(a => a.quizId === quizId);
  }

  async getQuizAttemptsByParticipant(participantId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values()).filter(a => a.participantId === participantId);
  }

  async createQuizAttempt(attempt: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt> {
    const id = `attempt-${randomUUID()}`;
    const newAttempt: QuizAttempt = { id, ...attempt };
    this.quizAttempts.set(id, newAttempt);
    return newAttempt;
  }

  // LMS - Certificates
  async getCertificates(): Promise<Certificate[]> {
    return Array.from(this.certificates.values());
  }

  async getCertificate(id: string): Promise<Certificate | undefined> {
    return this.certificates.get(id);
  }

  async getCertificatesByParticipant(participantId: string): Promise<Certificate[]> {
    return Array.from(this.certificates.values()).filter(c => c.participantId === participantId);
  }

  async createCertificate(data: InsertCertificate): Promise<Certificate> {
    const id = `cert-${randomUUID()}`;
    const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const certificate: Certificate = {
      id,
      participantId: data.participantId,
      courseId: data.courseId,
      learningPathId: data.learningPathId,
      assessmentId: data.assessmentId,
      title: data.title,
      description: data.description,
      certificateNumber: certNumber,
      issuedAt: new Date().toISOString(),
      status: "active",
      verificationUrl: `/verify/${certNumber}`,
      metadata: {}
    };
    this.certificates.set(id, certificate);
    return certificate;
  }

  async verifyCertificate(certificateNumber: string): Promise<Certificate | undefined> {
    return Array.from(this.certificates.values()).find(c => c.certificateNumber === certificateNumber);
  }

  // LSP - Assessors
  async getAssessors(): Promise<Assessor[]> {
    return Array.from(this.assessors.values());
  }

  async getAssessor(id: string): Promise<Assessor | undefined> {
    return this.assessors.get(id);
  }

  async createAssessor(data: InsertAssessor): Promise<Assessor> {
    const id = `assessor-${randomUUID()}`;
    const assessor: Assessor = {
      id,
      registrationNumber: data.registrationNumber,
      name: data.name,
      email: data.email,
      phone: data.phone,
      lspId: data.lspId,
      competencySchemes: data.competencySchemes || [],
      specializations: data.specializations || [],
      status: "active",
      validUntil: data.validUntil,
      totalAssessments: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.assessors.set(id, assessor);
    return assessor;
  }

  async updateAssessor(id: string, data: Partial<InsertAssessor>): Promise<Assessor | undefined> {
    const assessor = this.assessors.get(id);
    if (!assessor) return undefined;
    const updated = { ...assessor, ...data };
    this.assessors.set(id, updated);
    return updated;
  }

  async deleteAssessor(id: string): Promise<boolean> {
    return this.assessors.delete(id);
  }

  // LSP - Assessees
  async getAssessees(): Promise<Assessee[]> {
    return Array.from(this.assessees.values());
  }

  async getAssessee(id: string): Promise<Assessee | undefined> {
    return this.assessees.get(id);
  }

  async createAssessee(data: InsertAssessee): Promise<Assessee> {
    const id = `assessee-${randomUUID()}`;
    const assessee: Assessee = {
      id,
      participantId: data.participantId,
      nik: data.nik,
      birthPlace: data.birthPlace,
      birthDate: data.birthDate,
      gender: data.gender,
      education: data.education,
      workExperience: data.workExperience,
      currentCompany: data.currentCompany,
      currentPosition: data.currentPosition,
      schemeId: data.schemeId,
      registrationDate: new Date().toISOString().split('T')[0],
      status: "registered"
    };
    this.assessees.set(id, assessee);
    return assessee;
  }

  async updateAssesseeStatus(id: string, status: Assessee['status']): Promise<Assessee | undefined> {
    const assessee = this.assessees.get(id);
    if (!assessee) return undefined;
    assessee.status = status;
    this.assessees.set(id, assessee);
    return assessee;
  }

  // LSP - Schemes
  async getSchemes(): Promise<CompetencyScheme[]> {
    return Array.from(this.schemes.values());
  }

  async getScheme(id: string): Promise<CompetencyScheme | undefined> {
    return this.schemes.get(id);
  }

  async createScheme(data: InsertScheme): Promise<CompetencyScheme> {
    const id = `scheme-${randomUUID()}`;
    const scheme: CompetencyScheme = {
      id,
      lspId: data.lspId,
      code: data.code,
      name: data.name,
      description: data.description,
      skkniCode: data.skkniCode,
      unitIds: data.unitIds || [],
      assessmentMethods: data.assessmentMethods,
      duration: data.duration,
      fee: data.fee,
      isActive: true
    };
    this.schemes.set(id, scheme);
    return scheme;
  }

  // LSP - Schedules
  async getSchedules(): Promise<AssessmentSchedule[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedule(id: string): Promise<AssessmentSchedule | undefined> {
    return this.schedules.get(id);
  }

  async createSchedule(data: InsertSchedule): Promise<AssessmentSchedule> {
    const id = `schedule-${randomUUID()}`;
    const schedule: AssessmentSchedule = {
      id,
      schemeId: data.schemeId,
      assesseeId: data.assesseeId,
      assessorId: data.assessorId,
      scheduledDate: data.scheduledDate,
      location: data.location,
      locationType: data.locationType,
      methods: data.methods,
      duration: data.duration,
      status: "scheduled",
      notes: data.notes,
      createdAt: new Date().toISOString()
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateScheduleStatus(id: string, status: AssessmentSchedule['status']): Promise<AssessmentSchedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    schedule.status = status;
    this.schedules.set(id, schedule);
    return schedule;
  }

  // LSP - Portfolio
  async getPortfolioItems(assesseeId: string): Promise<PortfolioItem[]> {
    return Array.from(this.portfolioItems.values()).filter(p => p.assesseeId === assesseeId);
  }

  async createPortfolioItem(data: InsertPortfolio): Promise<PortfolioItem> {
    const id = `portfolio-${randomUUID()}`;
    const item: PortfolioItem = {
      id,
      assesseeId: data.assesseeId,
      unitId: data.unitId,
      elementId: data.elementId,
      type: data.type,
      title: data.title,
      description: data.description,
      issuedDate: data.issuedDate,
      issuedBy: data.issuedBy,
      submittedAt: new Date().toISOString(),
      status: "submitted"
    };
    this.portfolioItems.set(id, item);
    return item;
  }

  async updatePortfolioStatus(id: string, status: PortfolioItem['status'], feedback?: string): Promise<PortfolioItem | undefined> {
    const item = this.portfolioItems.get(id);
    if (!item) return undefined;
    item.status = status;
    if (feedback) item.feedback = feedback;
    item.reviewedAt = new Date().toISOString();
    this.portfolioItems.set(id, item);
    return item;
  }

  // LSP - Certification Results
  async getCertificationResults(): Promise<CertificationResult[]> {
    return Array.from(this.certificationResults.values());
  }

  async createCertificationResult(result: Omit<CertificationResult, 'id'>): Promise<CertificationResult> {
    const id = `result-${randomUUID()}`;
    const newResult: CertificationResult = { id, ...result };
    this.certificationResults.set(id, newResult);
    return newResult;
  }

  // LSP - Organizations
  async getLSPOrganizations(): Promise<LSPOrganization[]> {
    return Array.from(this.lspOrganizations.values());
  }

  async getLSPOrganization(id: string): Promise<LSPOrganization | undefined> {
    return this.lspOrganizations.get(id);
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const notif = this.notifications.get(id);
    if (!notif) return undefined;
    notif.isRead = true;
    this.notifications.set(id, notif);
    return notif;
  }

  async markAllNotificationsRead(): Promise<void> {
    for (const [id, notif] of this.notifications.entries()) {
      notif.isRead = true;
      this.notifications.set(id, notif);
    }
  }

  // Search
  async searchAll(query: string): Promise<{ participants: Participant[]; courses: ECourse[]; units: UnitCompetency[] }> {
    const q = query.toLowerCase().trim();
    if (!q) return { participants: [], courses: [], units: [] };

    const participants = Array.from(this.participants.values()).filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nip.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    ).slice(0, 5);

    const courses = Array.from(this.courses.values()).filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    ).slice(0, 5);

    const units = Array.from(this.units.values()).filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.code.toLowerCase().includes(q) ||
      u.description.toLowerCase().includes(q)
    ).slice(0, 5);

    return { participants, courses, units };
  }

  // Analytics
  async getAnalyticsData() {
    const participants = Array.from(this.participants.values());
    const courses = Array.from(this.courses.values());
    const units = Array.from(this.units.values());
    const clusters = Array.from(this.clusters.values());

    // Monthly trend (last 6 months, simulated)
    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const monthName = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      const baseCompleted = Math.floor(participants.length * 0.3) + i * 2;
      const baseEnrolled = Math.floor(participants.length * 0.5) + i * 3;
      return { month: monthName, completions: baseCompleted, enrollments: baseEnrolled };
    });

    // Level distribution by cluster
    const levelDistributionByCluster = clusters.map(cluster => {
      const clusterUnits = units.filter(u => u.clusterId === cluster.id);
      const allComps = participants.flatMap(p =>
        p.competencies.filter(c => clusterUnits.some(u => u.id === c.unitId))
      );
      return {
        cluster: cluster.code,
        L1: allComps.filter(c => c.currentLevel === 'L1').length,
        L2: allComps.filter(c => c.currentLevel === 'L2').length,
        L3: allComps.filter(c => c.currentLevel === 'L3').length,
        L4: allComps.filter(c => c.currentLevel === 'L4').length,
      };
    });

    // Course completion by target level
    const courseCompletionByLevel = ['L1', 'L2', 'L3', 'L4'].map(level => ({
      level,
      count: courses.filter(c => c.targetLevel === level).length
    }));

    // Top gap units
    const topGapUnits = units.map(unit => {
      const gaps = participants.flatMap(p =>
        p.competencies.filter(c => c.unitId === unit.id && c.status === 'gap')
      ).length;
      return { name: unit.name, gap: gaps, code: unit.code };
    }).sort((a, b) => b.gap - a.gap).slice(0, 5);

    // Participants by unit (top 6)
    const participantsByUnit = units.map(unit => ({
      unit: unit.code,
      count: participants.flatMap(p => p.competencies.filter(c => c.unitId === unit.id)).length
    })).sort((a, b) => b.count - a.count).slice(0, 6);

    return { monthlyTrend, levelDistributionByCluster, courseCompletionByLevel, topGapUnits, participantsByUnit };
  }
}

export const storage = new MemStorage();
