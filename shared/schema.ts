import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, index, boolean, uniqueIndex, check } from "drizzle-orm/pg-core";
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
  archived?: boolean;
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
  references?: import("./course-references").LessonReference[];
}

export interface Activity {
  id: string;
  type: "video" | "reading" | "case_study" | "worksheet" | "project" | "discussion" | "quiz";
  title: string;
  description: string;
  duration: string;
  content?: string;
}

// Participant / Peserta
export interface Participant {
  id: string;
  nip: string;
  name: string;
  position: string;
  unit: string;
  email: string;
  bujkId?: string;
  competencies: ParticipantCompetency[];
  learningHistory: LearningRecord[];
  evidences: Evidence[];
}

export type ApplicationRole = "admin" | "participant" | "bujk_pic";

export interface BujkOrganization {
  id: string;
  name: string;
  createdAt: string;
}

export interface BujkInvitation {
  id: string;
  email: string;
  role: Exclude<ApplicationRole, "admin">;
  bujkId: string;
  participantName?: string;
  nip?: string;
  position?: string;
  unit?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
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
  email: z.string().email("Email tidak valid"),
  bujkId: z.string().optional(),
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

// --------------------------------------------
// LMS FEATURES - Learning Management System
// --------------------------------------------

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
  completedLessonIds: string[];
  status: "enrolled" | "in_progress" | "completed" | "dropped";
  lastAccessedAt?: string;
}

// Quiz and Questions
export type QuestionType = "multiple_choice" | "true_false" | "essay" | "matching" | "fill_blank";

export const DEFAULT_QUIZ_PASSING_SCORE = 60;

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
  gradingStatus: "awaiting_review" | "graded";
  gradingFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  startedAt: string;
  completedAt?: string;
  timeSpent?: number; // in seconds
}

export type NewQuizAttempt = Omit<QuizAttempt, "id" | "gradingStatus"> & {
  gradingStatus?: QuizAttempt["gradingStatus"];
};

export interface QuizSubmissionIdentity {
  key: string;
  fingerprint: string;
}

export type QuizAttemptCreationResult =
  | { attempt: QuizAttempt; replayed?: boolean }
  | { rejection: "awaiting_review" | "max_attempts" | "quiz_not_found" | "idempotency_conflict" };

export interface QuizAttemptGradeInput {
  score?: number;
  essayScores?: Record<string, number>;
  feedback?: string;
  gradedBy: string;
  gradedAt: string;
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
  passingScore: z.number().min(0).max(100).default(DEFAULT_QUIZ_PASSING_SCORE),
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

// --------------------------------------------
// LSP/SKK FEATURES - Sertifikasi Kompetensi
// --------------------------------------------

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
  // Account ID (users.id), not participantId: admins and PICs also receive alerts.
  userId: string;
  type: "info" | "warning" | "success" | "error";
  category: "course" | "assessment" | "certificate" | "schedule" | "system";
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const bujksTable = pgTable("bujks", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").$type<ApplicationRole>().notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(0),
  participantId: varchar("participant_id").references(() => participantsTable.id, { onDelete: "set null" }),
  bujkId: varchar("bujk_id").references(() => bujksTable.id, { onDelete: "set null" }),
});

// Identity snapshots deliberately survive account deletion; never store auth data.
export const ACCOUNT_STATUS_REASON_MAX_LENGTH = 1000;
export const ACCOUNT_STATUS_HISTORY_PAGE_SIZE = 50;
const historyDateSchema = z.string().regex(/^[1-9]\d{3}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.")
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid.");
const historyInteger = (min: number, max: number, fallback: string) =>
  z.string().regex(/^\d+$/).default(fallback).transform(Number).pipe(z.number().int().min(min).max(max));

export const accountStatusHistoryQuerySchema = z.object({
  offset: historyInteger(0, 2147483647, "0"),
  limit: historyInteger(1, ACCOUNT_STATUS_HISTORY_PAGE_SIZE, String(ACCOUNT_STATUS_HISTORY_PAGE_SIZE)),
  actor: z.string().trim().max(200).optional(),
  target: z.string().trim().max(200).optional(),
  from: historyDateSchema.optional(),
  to: historyDateSchema.optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {
  message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
  path: ["to"],
});

export const accountStatusChangeSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim()
    .min(1, "Alasan perubahan status wajib diisi.")
    .max(ACCOUNT_STATUS_REASON_MAX_LENGTH, "Alasan perubahan status maksimal 1000 karakter."),
}).strict();

export const accountStatusHistory = pgTable("account_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull(),
  actorUsername: text("actor_username").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  targetUsername: text("target_username").notNull(),
  previousIsActive: boolean("previous_is_active").notNull(),
  newIsActive: boolean("new_is_active").notNull(),
  // Null means the event predates mandatory reasons; never invent an explanation.
  reason: text("reason"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("account_status_history_chronology_idx").on(table.changedAt, table.id),
  index("account_status_history_actor_name_trgm_idx").using("gin", sql`lower(${table.actorUsername}) gin_trgm_ops`),
  index("account_status_history_target_name_trgm_idx").using("gin", sql`lower(${table.targetUsername}) gin_trgm_ops`),
  index("account_status_history_actor_id_time_idx").on(table.actorId, table.changedAt, table.id),
  index("account_status_history_target_id_time_idx").on(table.targetUserId, table.changedAt, table.id),
  check("account_status_history_actual_change", sql`${table.previousIsActive} <> ${table.newIsActive}`),
  check("account_status_history_reason_valid", sql`${table.reason} IS NULL OR (${table.reason} ~ '[^[:space:]]' AND char_length(${table.reason}) <= 1000)`),
]);

export type AccountStatusHistoryEntry = Omit<typeof accountStatusHistory.$inferSelect, "changedAt"> & {
  changedAt: string;
};

export const bujkInvitationsTable = pgTable("bujk_invitations", {
  id: varchar("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").$type<Exclude<ApplicationRole, "admin">>().notNull(),
  bujkId: varchar("bujk_id").notNull().references(() => bujksTable.id, { onDelete: "cascade" }),
  participantName: text("participant_name"),
  nip: text("nip"),
  position: text("position"),
  unit: text("unit"),
  invitedBy: varchar("invited_by").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull(),
});

export const passwordChangeAttempts = pgTable(
  "password_change_attempts",
  {
    attemptKey: text("attempt_key").primaryKey(),
    attemptCount: integer("attempt_count").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_password_change_attempts_window").on(t.windowStartedAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    attemptKey: text("attempt_key").primaryKey(),
    attemptCount: integer("attempt_count").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_login_attempts_window").on(t.windowStartedAt)],
);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// --------------------------------------------
// DATABASE TABLES
// --------------------------------------------

export const clustersTable = pgTable("clusters", {
  id: varchar("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull(),
});

export const unitsTable = pgTable("units", {
  id: varchar("id").primaryKey(),
  clusterId: varchar("cluster_id").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  indicators: jsonb("indicators").notNull().$type<BehaviorIndicator[]>(),
});

export const coursesTable = pgTable("courses", {
  id: varchar("id").primaryKey(),
  unitId: varchar("unit_id").notNull(),
  targetLevel: varchar("target_level", { length: 4 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  duration: text("duration").notNull(),
  lessons: jsonb("lessons").notNull().$type<Lesson[]>(),
  preTestId: varchar("pre_test_id"),
  postTestId: varchar("post_test_id"),
  createdAt: text("created_at").notNull(),
});

export const coursePublicationsTable = pgTable("course_publications", {
  courseId: varchar("course_id").primaryKey().references(() => coursesTable.id, { onDelete: "cascade" }),
  published: boolean("published").notNull().default(true),
  format: text("format").$type<"self_paced" | "upcoming" | "recording">().notNull().default("self_paced"),
  startsAt: text("starts_at"),
  instructor: text("instructor").notNull().default(""),
  recordingUrl: text("recording_url").notNull().default(""),
});

export const participantsTable = pgTable("participants", {
  id: varchar("id").primaryKey(),
  nip: text("nip").notNull(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  unit: text("unit").notNull(),
  email: text("email").notNull(),
  bujkId: varchar("bujk_id").references(() => bujksTable.id, { onDelete: "set null" }),
});

export const learningPathsTable = pgTable("learning_paths", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetRole: text("target_role").notNull(),
  duration: text("duration").notNull(),
  difficulty: text("difficulty").notNull(),
  courseIds: jsonb("course_ids").notNull().$type<string[]>(),
  prerequisites: jsonb("prerequisites").notNull().$type<string[]>(),
  skills: jsonb("skills").notNull().$type<string[]>(),
  isPublished: integer("is_published").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const enrollmentsTable = pgTable("enrollments", {
  id: varchar("id").primaryKey(),
  participantId: varchar("participant_id").notNull(),
  courseId: varchar("course_id"),
  learningPathId: varchar("learning_path_id"),
  enrolledAt: text("enrolled_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  progress: integer("progress").notNull().default(0),
  completedLessonIds: jsonb("completed_lesson_ids").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  status: text("status").notNull().default("enrolled"),
  lastAccessedAt: text("last_accessed_at"),
});

export const quizzesTable = pgTable("quizzes", {
  id: varchar("id").primaryKey(),
  courseId: varchar("course_id").notNull(),
  lessonId: varchar("lesson_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  passingScore: integer("passing_score").notNull().default(DEFAULT_QUIZ_PASSING_SCORE),
  timeLimit: integer("time_limit"),
  maxAttempts: integer("max_attempts").notNull().default(3),
  shuffleQuestions: integer("shuffle_questions").notNull().default(0),
  showResults: integer("show_results").notNull().default(1),
  questions: jsonb("questions").notNull().$type<Question[]>(),
  createdAt: text("created_at").notNull(),
});

export const quizAttemptsTable = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey(),
  quizId: varchar("quiz_id").notNull(),
  participantId: varchar("participant_id").notNull(),
  answers: jsonb("answers").notNull().$type<QuizAnswer[]>(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  passed: integer("passed").notNull().default(0),
  gradingStatus: text("grading_status").notNull().default("graded"),
  gradingFeedback: text("grading_feedback"),
  gradedBy: varchar("graded_by"),
  gradedAt: text("graded_at"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  timeSpent: integer("time_spent"),
  idempotencyKey: varchar("idempotency_key"),
  submissionFingerprint: text("submission_fingerprint"),
}, table => [
  uniqueIndex("quiz_attempts_submission_unique").on(table.participantId, table.quizId, table.idempotencyKey),
  check("quiz_attempts_submission_identity_pair", sql`(${table.idempotencyKey} IS NULL) = (${table.submissionFingerprint} IS NULL)`),
]);

export const certificatesTable = pgTable("certificates", {
  id: varchar("id").primaryKey(),
  participantId: varchar("participant_id").notNull(),
  courseId: varchar("course_id"),
  learningPathId: varchar("learning_path_id"),
  assessmentId: varchar("assessment_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  certificateNumber: text("certificate_number").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  expiresAt: text("expires_at"),
  status: text("status").notNull().default("active"),
  verificationUrl: text("verification_url").notNull(),
  metadata: jsonb("metadata").notNull().$type<Record<string, string>>(),
});

export const assessorsTable = pgTable("assessors", {
  id: varchar("id").primaryKey(),
  registrationNumber: text("registration_number").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  lspId: varchar("lsp_id").notNull(),
  competencySchemes: jsonb("competency_schemes").notNull().$type<string[]>(),
  specializations: jsonb("specializations").notNull().$type<string[]>(),
  status: text("status").notNull().default("active"),
  validUntil: text("valid_until").notNull(),
  totalAssessments: integer("total_assessments").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const assesseesTable = pgTable("assessees", {
  id: varchar("id").primaryKey(),
  participantId: varchar("participant_id").notNull(),
  nik: text("nik").notNull(),
  birthPlace: text("birth_place").notNull(),
  birthDate: text("birth_date").notNull(),
  gender: text("gender").notNull(),
  education: text("education").notNull(),
  workExperience: text("work_experience").notNull(),
  currentCompany: text("current_company").notNull(),
  currentPosition: text("current_position").notNull(),
  schemeId: varchar("scheme_id").notNull(),
  registrationDate: text("registration_date").notNull(),
  status: text("status").notNull().default("registered"),
});

export const schemesTable = pgTable("schemes", {
  id: varchar("id").primaryKey(),
  lspId: varchar("lsp_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  skkniCode: text("skkni_code"),
  unitIds: jsonb("unit_ids").notNull().$type<string[]>(),
  assessmentMethods: jsonb("assessment_methods").notNull().$type<string[]>(),
  duration: text("duration").notNull(),
  fee: integer("fee").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
});

export const schedulesTable = pgTable("schedules", {
  id: varchar("id").primaryKey(),
  schemeId: varchar("scheme_id").notNull(),
  assesseeId: varchar("assessee_id").notNull(),
  assessorId: varchar("assessor_id").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  location: text("location").notNull(),
  locationType: text("location_type").notNull(),
  methods: jsonb("methods").notNull().$type<string[]>(),
  duration: text("duration").notNull(),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const portfolioItemsTable = pgTable("portfolio_items", {
  id: varchar("id").primaryKey(),
  assesseeId: varchar("assessee_id").notNull(),
  unitId: varchar("unit_id").notNull(),
  elementId: varchar("element_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  fileUrl: text("file_url"),
  issuedDate: text("issued_date"),
  issuedBy: text("issued_by"),
  submittedAt: text("submitted_at").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  status: text("status").notNull().default("submitted"),
  feedback: text("feedback"),
});

export const certificationResultsTable = pgTable("certification_results", {
  id: varchar("id").primaryKey(),
  scheduleId: varchar("schedule_id").notNull(),
  assesseeId: varchar("assessee_id").notNull(),
  assessorId: varchar("assessor_id").notNull(),
  schemeId: varchar("scheme_id").notNull(),
  unitResults: jsonb("unit_results").notNull().$type<UnitAssessmentResult[]>(),
  overallResult: text("overall_result").notNull(),
  recommendations: text("recommendations"),
  assessedAt: text("assessed_at").notNull(),
  certificateId: varchar("certificate_id"),
});

export const lspOrganizationsTable = pgTable("lsp_organizations", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  licenseNumber: text("license_number").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  leadAssessorId: varchar("lead_assessor_id"),
  competencySchemes: jsonb("competency_schemes").notNull().$type<CompetencyScheme[]>(),
  status: text("status").notNull().default("active"),
  validUntil: text("valid_until").notNull(),
  createdAt: text("created_at").notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: varchar("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// --------------------------------------------
// RELATIONAL TABLES (replaces JSONB arrays in participantsTable)
// --------------------------------------------

export const participantCompetenciesTable = pgTable(
  "participant_competencies",
  {
    id: varchar("id").primaryKey(),
    participantId: varchar("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
    // RESTRICT: deleting a unit must not silently remove participant competency records
    unitId: varchar("unit_id").notNull().references(() => unitsTable.id, { onDelete: "restrict" }),
    currentLevel: varchar("current_level", { length: 4 }).notNull(),
    targetLevel: varchar("target_level", { length: 4 }).notNull(),
    lastAssessed: text("last_assessed").notNull(),
    status: text("status").notNull().default("gap"),
  },
  (t) => [index("idx_participant_competencies_participant_id").on(t.participantId)],
);

export const evidencesTable = pgTable(
  "evidences",
  {
    id: varchar("id").primaryKey(),
    participantId: varchar("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
    // RESTRICT: deleting a unit must not silently remove participant evidence records
    unitId: varchar("unit_id").notNull().references(() => unitsTable.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    fileUrl: text("file_url"),
    submittedAt: text("submitted_at").notNull(),
    assessedAt: text("assessed_at"),
    assessorId: varchar("assessor_id"),
    score: integer("score"),
    feedback: text("feedback"),
    status: text("status").notNull().default("pending"),
  },
  (t) => [index("idx_evidences_participant_id").on(t.participantId)],
);

export const learningRecordsTable = pgTable(
  "learning_records",
  {
    id: varchar("id").primaryKey(),
    participantId: varchar("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
    // RESTRICT: deleting a course must not silently remove participant learning records
    courseId: varchar("course_id").notNull().references(() => coursesTable.id, { onDelete: "restrict" }),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    progress: integer("progress").notNull().default(0),
    status: text("status").notNull().default("not_started"),
  },
  (t) => [index("idx_learning_records_participant_id").on(t.participantId)],
);

// Supplemental workplace practice. These records never change course/quiz completion.
export const practiceMissionsTable = pgTable("practice_missions", {
  id: varchar("id").primaryKey(),
  courseId: varchar("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  scenario: text("scenario").notNull(),
  sourceText: text("source_text").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(),
  checklist: jsonb("checklist").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
}, table => [
  index("practice_missions_course_idx").on(table.courseId),
  check("practice_missions_duration_check", sql`${table.durationMinutes} BETWEEN 5 AND 15`),
]);

export const missionSubmissionsTable = pgTable("mission_submissions", {
  id: varchar("id").primaryKey(),
  missionId: varchar("mission_id").notNull().references(() => practiceMissionsTable.id, { onDelete: "restrict" }),
  participantId: varchar("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
  submissionKey: varchar("submission_key").notNull(),
  round: integer("round").notNull(),
  completedChecklist: jsonb("completed_checklist").$type<string[]>().notNull(),
  evidenceText: text("evidence_text").notNull(),
  evidenceUrl: text("evidence_url").notNull().default(""),
  privateReflection: text("private_reflection").notNull().default(""),
  status: text("status").notNull().default("pending_review"),
  feedback: text("feedback"),
  nextPracticeAt: text("next_practice_at"),
  submittedAt: text("submitted_at").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
}, table => [
  uniqueIndex("mission_submissions_key_unique").on(table.missionId, table.participantId, table.submissionKey),
  uniqueIndex("mission_submissions_round_unique").on(table.missionId, table.participantId, table.round),
  index("mission_submissions_participant_idx").on(table.participantId),
  check("mission_submissions_status_check", sql`${table.status} IN ('pending_review', 'accepted', 'repeat_requested')`),
  check("mission_submissions_round_check", sql`${table.round} > 0`),
]);
