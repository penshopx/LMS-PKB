import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Competency Level enum
export const CompetencyLevel = {
  L1: "L1",
  L2: "L2", 
  L3: "L3",
  L4: "L4"
} as const;

export type CompetencyLevelType = keyof typeof CompetencyLevel;

export const CompetencyLevelNames: Record<CompetencyLevelType, string> = {
  L1: "Awareness",
  L2: "Application",
  L3: "Mastery",
  L4: "Strategic"
};

export const CompetencyLevelDescriptions: Record<CompetencyLevelType, string> = {
  L1: "Memahami konsep dasar",
  L2: "Menerapkan secara mandiri",
  L3: "Konsisten & optimal",
  L4: "Mengarahkan & membina"
};

// Competency Cluster - Generic (not limited to specific types)
export interface CompetencyCluster {
  id: string;
  code: string;
  name: string;
  fullName: string;
  description: string;
  color: string;
}

// Insert schema for cluster
export const insertClusterSchema = z.object({
  code: z.string().min(1, "Kode cluster wajib diisi").max(10, "Kode maksimal 10 karakter"),
  name: z.string().min(1, "Nama cluster wajib diisi"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  color: z.string().min(1, "Warna wajib diisi")
});

export type InsertCluster = z.infer<typeof insertClusterSchema>;

// Insert schema for unit competency
export const insertUnitSchema = z.object({
  clusterId: z.string().min(1, "Cluster wajib dipilih"),
  code: z.string().min(1, "Kode unit wajib diisi"),
  name: z.string().min(1, "Nama unit wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  indicators: z.array(z.object({
    level: z.enum(["L1", "L2", "L3", "L4"]),
    indicators: z.array(z.string())
  })).optional()
});

export type InsertUnit = z.infer<typeof insertUnitSchema>;

// Unit Competency
export interface UnitCompetency {
  id: string;
  clusterId: string;
  code: string;
  name: string;
  description: string;
  indicators: BehaviorIndicator[];
}

// Behavior Indicator per level
export interface BehaviorIndicator {
  level: CompetencyLevelType;
  indicators: string[];
}

// E-Course structure
export interface ECourse {
  id: string;
  unitId: string;
  targetLevel: CompetencyLevelType;
  title: string;
  description: string;
  duration: string;
  lessons: Lesson[];
  preTestId?: string;
  postTestId?: string;
  createdAt: string;
}

export interface Lesson {
  id: string;
  order: number;
  type: "orientation" | "context" | "microlearning" | "practice" | "assessment" | "reflection";
  title: string;
  description: string;
  content: string;
  activities?: Activity[];
}

export interface Activity {
  id: string;
  type: "video" | "reading" | "case_study" | "worksheet" | "project" | "discussion" | "quiz";
  title: string;
  description: string;
  duration: string;
}

// Participant / Peserta
export interface Participant {
  id: string;
  nip: string;
  name: string;
  position: string;
  unit: string;
  email: string;
  competencies: ParticipantCompetency[];
  learningHistory: LearningRecord[];
  evidences: Evidence[];
}

export interface ParticipantCompetency {
  unitId: string;
  currentLevel: CompetencyLevelType;
  targetLevel: CompetencyLevelType;
  lastAssessed: string;
  status: "gap" | "on_track" | "achieved";
}

export interface LearningRecord {
  id: string;
  courseId: string;
  startedAt: string;
  completedAt?: string;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
}

export interface Evidence {
  id: string;
  unitId: string;
  type: "document" | "video" | "presentation" | "reflection";
  title: string;
  description: string;
  fileUrl?: string;
  submittedAt: string;
  assessedAt?: string;
  assessorId?: string;
  score?: number;
  feedback?: string;
  status: "pending" | "reviewed" | "approved" | "needs_revision";
}

// Assessment
export interface Assessment {
  id: string;
  participantId: string;
  unitId: string;
  targetLevel: CompetencyLevelType;
  assessorId: string;
  assessorName: string;
  evidenceIds: string[];
  rubricScores: RubricScore[];
  overallScore: number;
  result: "pass" | "fail" | "pending";
  feedback: string;
  assessedAt: string;
}

export interface RubricScore {
  indicatorId: string;
  indicator: string;
  score: number;
  maxScore: number;
  notes: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalParticipants: number;
  totalCourses: number;
  completionRate: number;
  averageLevel: number;
  competencyGaps: CompetencyGap[];
  levelDistribution: LevelDistribution[];
}

export interface CompetencyGap {
  unitId: string;
  unitName: string;
  clusterCode: string;
  gapCount: number;
  avgCurrentLevel: number;
  avgTargetLevel: number;
}

export interface LevelDistribution {
  level: CompetencyLevelType;
  count: number;
  percentage: number;
}

// Heatmap data
export interface HeatmapData {
  unitId: string;
  unitCode: string;
  unitName: string;
  clusterCode: string;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l4Count: number;
  total: number;
}

// Insert schemas for forms
export const insertParticipantSchema = z.object({
  nip: z.string().min(1, "NIP wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  position: z.string().min(1, "Jabatan wajib diisi"),
  unit: z.string().min(1, "Unit kerja wajib diisi"),
  email: z.string().email("Email tidak valid")
});

export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export const insertEvidenceSchema = z.object({
  unitId: z.string().min(1, "Unit kompetensi wajib dipilih"),
  type: z.enum(["document", "video", "presentation", "reflection"]),
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi")
});

export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;

export const insertCourseSchema = z.object({
  unitId: z.string().min(1, "Unit kompetensi wajib dipilih"),
  targetLevel: z.enum(["L1", "L2", "L3", "L4"]),
  title: z.string().min(1, "Judul kursus wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  duration: z.string().min(1, "Durasi wajib diisi"),
  preTestId: z.string().optional(),
  postTestId: z.string().optional()
});

export type InsertCourse = z.infer<typeof insertCourseSchema>;

// ============================================
// LMS FEATURES - Learning Management System
// ============================================

// Learning Path - Jalur Pembelajaran
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetRole: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  courseIds: string[];
  prerequisites: string[];
  skills: string[];
  isPublished: boolean;
  createdAt: string;
}

export const insertLearningPathSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  targetRole: z.string().min(1, "Target role wajib diisi"),
  duration: z.string().min(1, "Durasi wajib diisi"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  courseIds: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([])
});

export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;

// Enrollment - Pendaftaran Kursus
export interface Enrollment {
  id: string;
  participantId: string;
  courseId?: string;
  learningPathId?: string;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  status: "enrolled" | "in_progress" | "completed" | "dropped";
  lastAccessedAt?: string;
}

// Quiz and Questions
export type QuestionType = "multiple_choice" | "true_false" | "essay" | "matching" | "fill_blank";

export interface Quiz {
  id: string;
  courseId: string;
  lessonId?: string;
  title: string;
  description: string;
  passingScore: number;
  timeLimit?: number; // in minutes
  maxAttempts: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  questions: Question[];
  createdAt: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: QuizOption[];
  correctAnswer?: string;
  correctAnswers?: string[];
  explanation?: string;
  order: number;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  participantId: string;
  answers: QuizAnswer[];
  score: number;
  maxScore: number;
  passed: boolean;
  startedAt: string;
  completedAt?: string;
  timeSpent?: number; // in seconds
}

export interface QuizAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  points: number;
}

export const insertQuizSchema = z.object({
  courseId: z.string().min(1, "Kursus wajib dipilih"),
  lessonId: z.string().optional(),
  title: z.string().min(1, "Judul quiz wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().optional(),
  maxAttempts: z.number().min(1).default(3),
  shuffleQuestions: z.boolean().default(false),
  showResults: z.boolean().default(true)
});

export type InsertQuiz = z.infer<typeof insertQuizSchema>;

// Certificate - Sertifikat
export interface Certificate {
  id: string;
  participantId: string;
  courseId?: string;
  learningPathId?: string;
  assessmentId?: string;
  title: string;
  description: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt?: string;
  status: "active" | "expired" | "revoked";
  verificationUrl: string;
  metadata: Record<string, string>;
}

export const insertCertificateSchema = z.object({
  participantId: z.string().min(1, "Peserta wajib dipilih"),
  courseId: z.string().optional(),
  learningPathId: z.string().optional(),
  assessmentId: z.string().optional(),
  title: z.string().min(1, "Judul sertifikat wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi")
});

export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

// Badge & Achievement - Lencana & Pencapaian
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "completion" | "skill" | "achievement" | "milestone";
  criteria: string;
  points: number;
}

export interface Achievement {
  id: string;
  participantId: string;
  badgeId: string;
  earnedAt: string;
}

// Resource Library - Perpustakaan Materi
export interface Resource {
  id: string;
  title: string;
  description: string;
  type: "document" | "video" | "audio" | "link" | "template";
  url: string;
  fileSize?: number;
  duration?: string;
  tags: string[];
  competencyUnitIds: string[];
  createdAt: string;
}

// Discussion Forum
export interface Discussion {
  id: string;
  courseId: string;
  lessonId?: string;
  participantId: string;
  participantName: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  replyCount: number;
  isPinned: boolean;
  isResolved: boolean;
}

export interface DiscussionReply {
  id: string;
  discussionId: string;
  participantId: string;
  participantName: string;
  content: string;
  createdAt: string;
  isAnswer: boolean;
}

// ============================================
// LSP/SKK FEATURES - Sertifikasi Kompetensi
// ============================================

// Assessor - Asesor LSP
export interface Assessor {
  id: string;
  registrationNumber: string; // Nomor Registrasi Asesor (NRA)
  name: string;
  email: string;
  phone: string;
  lspId: string;
  competencySchemes: string[]; // Skema kompetensi yang dikuasai
  specializations: string[];
  status: "active" | "inactive" | "suspended";
  validUntil: string;
  totalAssessments: number;
  createdAt: string;
}

export const insertAssessorSchema = z.object({
  registrationNumber: z.string().min(1, "Nomor registrasi wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phone: z.string().min(1, "Telepon wajib diisi"),
  lspId: z.string().min(1, "LSP wajib dipilih"),
  competencySchemes: z.array(z.string()).default([]),
  specializations: z.array(z.string()).default([]),
  validUntil: z.string().min(1, "Masa berlaku wajib diisi")
});

export type InsertAssessor = z.infer<typeof insertAssessorSchema>;

// Assessee - Asesi (Peserta Uji Kompetensi)
export interface Assessee {
  id: string;
  participantId: string; // Link to existing participant
  nik: string;
  birthPlace: string;
  birthDate: string;
  gender: "male" | "female";
  education: string;
  workExperience: string;
  currentCompany: string;
  currentPosition: string;
  schemeId: string; // Skema sertifikasi yang diambil
  registrationDate: string;
  status: "registered" | "self_assessment" | "portfolio_review" | "scheduled" | "assessed" | "certified" | "not_certified";
}

export const insertAssesseeSchema = z.object({
  participantId: z.string().min(1, "Peserta wajib dipilih"),
  nik: z.string().min(16, "NIK minimal 16 karakter"),
  birthPlace: z.string().min(1, "Tempat lahir wajib diisi"),
  birthDate: z.string().min(1, "Tanggal lahir wajib diisi"),
  gender: z.enum(["male", "female"]),
  education: z.string().min(1, "Pendidikan wajib diisi"),
  workExperience: z.string().min(1, "Pengalaman kerja wajib diisi"),
  currentCompany: z.string().min(1, "Perusahaan wajib diisi"),
  currentPosition: z.string().min(1, "Jabatan wajib diisi"),
  schemeId: z.string().min(1, "Skema sertifikasi wajib dipilih")
});

export type InsertAssessee = z.infer<typeof insertAssesseeSchema>;

// LSP Organization - Lembaga Sertifikasi Profesi
export interface LSPOrganization {
  id: string;
  name: string;
  licenseNumber: string; // Nomor Lisensi BNSP
  address: string;
  phone: string;
  email: string;
  website?: string;
  leadAssessorId?: string;
  competencySchemes: CompetencyScheme[];
  status: "active" | "suspended" | "revoked";
  validUntil: string;
  createdAt: string;
}

// Competency Scheme - Skema Sertifikasi Kompetensi
export interface CompetencyScheme {
  id: string;
  lspId: string;
  code: string;
  name: string;
  description: string;
  skkniCode?: string; // Kode SKKNI
  unitIds: string[]; // Unit kompetensi yang termasuk
  assessmentMethods: AssessmentMethod[];
  duration: string;
  fee: number;
  isActive: boolean;
}

export type AssessmentMethod = "written_test" | "practical_test" | "oral_interview" | "portfolio" | "observation" | "simulation" | "apl";

export const insertSchemeSchema = z.object({
  lspId: z.string().min(1, "LSP wajib dipilih"),
  code: z.string().min(1, "Kode skema wajib diisi"),
  name: z.string().min(1, "Nama skema wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  skkniCode: z.string().optional(),
  unitIds: z.array(z.string()).default([]),
  assessmentMethods: z.array(z.enum(["written_test", "practical_test", "oral_interview", "portfolio", "observation", "simulation", "apl"])),
  duration: z.string().min(1, "Durasi wajib diisi"),
  fee: z.number().min(0)
});

export type InsertScheme = z.infer<typeof insertSchemeSchema>;

// Self Assessment - Asesmen Mandiri
export interface SelfAssessment {
  id: string;
  assesseeId: string;
  schemeId: string;
  unitId: string;
  responses: SelfAssessmentResponse[];
  completedAt?: string;
  result: "competent" | "not_yet_competent" | "pending";
}

export interface SelfAssessmentResponse {
  elementId: string;
  criteriaId: string;
  isCompetent: boolean;
  evidence?: string;
}

// Portfolio Item - Bukti Portofolio
export interface PortfolioItem {
  id: string;
  assesseeId: string;
  unitId: string;
  elementId?: string;
  type: "certificate" | "work_sample" | "photo" | "video" | "document" | "testimonial";
  title: string;
  description: string;
  fileUrl?: string;
  issuedDate?: string;
  issuedBy?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: "submitted" | "reviewed" | "accepted" | "rejected";
  feedback?: string;
}

export const insertPortfolioSchema = z.object({
  assesseeId: z.string().min(1, "Asesi wajib dipilih"),
  unitId: z.string().min(1, "Unit kompetensi wajib dipilih"),
  elementId: z.string().optional(),
  type: z.enum(["certificate", "work_sample", "photo", "video", "document", "testimonial"]),
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  issuedDate: z.string().optional(),
  issuedBy: z.string().optional()
});

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;

// Assessment Schedule - Jadwal Asesmen
export interface AssessmentSchedule {
  id: string;
  schemeId: string;
  assesseeId: string;
  assessorId: string;
  scheduledDate: string;
  location: string;
  locationType: "online" | "onsite" | "hybrid";
  methods: AssessmentMethod[];
  duration: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled";
  notes?: string;
  createdAt: string;
}

export const insertScheduleSchema = z.object({
  schemeId: z.string().min(1, "Skema wajib dipilih"),
  assesseeId: z.string().min(1, "Asesi wajib dipilih"),
  assessorId: z.string().min(1, "Asesor wajib dipilih"),
  scheduledDate: z.string().min(1, "Tanggal wajib diisi"),
  location: z.string().min(1, "Lokasi wajib diisi"),
  locationType: z.enum(["online", "onsite", "hybrid"]),
  methods: z.array(z.enum(["written_test", "practical_test", "oral_interview", "portfolio", "observation", "simulation", "apl"])),
  duration: z.string().min(1, "Durasi wajib diisi"),
  notes: z.string().optional()
});

export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

// Assessment Result - Hasil Asesmen LSP
export interface CertificationResult {
  id: string;
  scheduleId: string;
  assesseeId: string;
  assessorId: string;
  schemeId: string;
  unitResults: UnitAssessmentResult[];
  overallResult: "competent" | "not_yet_competent";
  recommendations?: string;
  assessedAt: string;
  certificateId?: string;
}

export interface UnitAssessmentResult {
  unitId: string;
  elementResults: ElementResult[];
  isCompetent: boolean;
  notes?: string;
}

export interface ElementResult {
  elementId: string;
  criteriaResults: CriteriaResult[];
  isCompetent: boolean;
}

export interface CriteriaResult {
  criteriaId: string;
  isCompetent: boolean;
  evidence?: string;
  method: AssessmentMethod;
  notes?: string;
}

// SKKNI Mapping - Pemetaan ke SKKNI
export interface SKKNIUnit {
  id: string;
  code: string;
  title: string;
  description: string;
  sector: string;
  subSector: string;
  elements: SKKNIElement[];
}

export interface SKKNIElement {
  id: string;
  code: string;
  title: string;
  criteria: SKKNICriteria[];
}

export interface SKKNICriteria {
  id: string;
  code: string;
  description: string;
  evidence: string[];
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  type: "info" | "warning" | "success" | "error";
  category: "course" | "assessment" | "certificate" | "schedule" | "system";
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// Legacy user schema (keeping for compatibility)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
