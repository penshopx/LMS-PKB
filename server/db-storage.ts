import { randomUUID } from "crypto";
import { and, eq, inArray, like, or, sql as drizzleSql } from "drizzle-orm";
import { db } from "./db";
import {
  clustersTable,
  unitsTable,
  coursesTable,
  participantsTable,
  learningPathsTable,
  enrollmentsTable,
  quizzesTable,
  quizAttemptsTable,
  certificatesTable,
  assessorsTable,
  assesseesTable,
  schemesTable,
  schedulesTable,
  portfolioItemsTable,
  certificationResultsTable,
  lspOrganizationsTable,
  notificationsTable,
  participantCompetenciesTable,
  evidencesTable,
  learningRecordsTable,
} from "@shared/schema";
import type {
  CompetencyCluster,
  UnitCompetency,
  ECourse,
  Participant,
  Evidence,
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
  NewQuizAttempt,
  QuizAttemptGradeInput,
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
  Notification,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { evaluateCourseCompletion } from "@shared/lms-course-rules";

// Helper to convert DB row to CompetencyCluster
function toCluster(row: typeof clustersTable.$inferSelect): CompetencyCluster {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    fullName: row.fullName,
    description: row.description,
    color: row.color,
  };
}

function toUnit(row: typeof unitsTable.$inferSelect): UnitCompetency {
  return {
    id: row.id,
    clusterId: row.clusterId,
    code: row.code,
    name: row.name,
    description: row.description,
    indicators: row.indicators as BehaviorIndicator[],
  };
}

function toCourse(row: typeof coursesTable.$inferSelect): ECourse {
  return {
    id: row.id,
    unitId: row.unitId,
    targetLevel: row.targetLevel as ECourse["targetLevel"],
    title: row.title,
    description: row.description,
    duration: row.duration,
    lessons: row.lessons as Lesson[],
    preTestId: row.preTestId ?? undefined,
    postTestId: row.postTestId ?? undefined,
    createdAt: row.createdAt,
  };
}

function toParticipant(
  row: typeof participantsTable.$inferSelect,
  competencies: ParticipantCompetency[] = [],
  evidences: Evidence[] = [],
  learningHistory: LearningRecord[] = [],
): Participant {
  return {
    id: row.id,
    nip: row.nip,
    name: row.name,
    position: row.position,
    unit: row.unit,
    email: row.email,
    bujkId: row.bujkId ?? undefined,
    competencies,
    learningHistory,
    evidences,
  };
}

function mapCompetencyRows(rows: (typeof participantCompetenciesTable.$inferSelect)[]): ParticipantCompetency[] {
  return rows.map(r => ({
    unitId: r.unitId,
    currentLevel: r.currentLevel as ParticipantCompetency["currentLevel"],
    targetLevel: r.targetLevel as ParticipantCompetency["targetLevel"],
    lastAssessed: r.lastAssessed,
    status: r.status as ParticipantCompetency["status"],
  }));
}

function mapEvidenceRows(rows: (typeof evidencesTable.$inferSelect)[]): Evidence[] {
  return rows.map(r => ({
    id: r.id,
    unitId: r.unitId,
    type: r.type as Evidence["type"],
    title: r.title,
    description: r.description,
    fileUrl: r.fileUrl ?? undefined,
    submittedAt: r.submittedAt,
    assessedAt: r.assessedAt ?? undefined,
    assessorId: r.assessorId ?? undefined,
    score: r.score ?? undefined,
    feedback: r.feedback ?? undefined,
    status: r.status as Evidence["status"],
  }));
}

function mapLearningRecordRows(rows: (typeof learningRecordsTable.$inferSelect)[]): LearningRecord[] {
  return rows.map(r => ({
    id: r.id,
    courseId: r.courseId,
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? undefined,
    progress: r.progress,
    status: r.status as LearningRecord["status"],
  }));
}

function toLearningPath(row: typeof learningPathsTable.$inferSelect): LearningPath {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetRole: row.targetRole,
    duration: row.duration,
    difficulty: row.difficulty as LearningPath["difficulty"],
    courseIds: row.courseIds as string[],
    prerequisites: row.prerequisites as string[],
    skills: row.skills as string[],
    isPublished: row.isPublished === 1,
    createdAt: row.createdAt,
  };
}

function toEnrollment(row: typeof enrollmentsTable.$inferSelect): Enrollment {
  return {
    id: row.id,
    participantId: row.participantId,
    courseId: row.courseId ?? undefined,
    learningPathId: row.learningPathId ?? undefined,
    enrolledAt: row.enrolledAt,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    progress: row.progress,
    completedLessonIds: (row.completedLessonIds as string[] | null) ?? [],
    status: row.status as Enrollment["status"],
    lastAccessedAt: row.lastAccessedAt ?? undefined,
  };
}

function toQuiz(row: typeof quizzesTable.$inferSelect): Quiz {
  return {
    id: row.id,
    courseId: row.courseId,
    lessonId: row.lessonId ?? undefined,
    title: row.title,
    description: row.description,
    passingScore: row.passingScore,
    timeLimit: row.timeLimit ?? undefined,
    maxAttempts: row.maxAttempts,
    shuffleQuestions: row.shuffleQuestions === 1,
    showResults: row.showResults === 1,
    questions: row.questions as Question[],
    createdAt: row.createdAt,
  };
}

function toQuizAttempt(row: typeof quizAttemptsTable.$inferSelect): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quizId,
    participantId: row.participantId,
    answers: row.answers as QuizAttempt["answers"],
    score: row.score,
    maxScore: row.maxScore,
    passed: row.passed === 1,
    gradingStatus: row.gradingStatus as QuizAttempt["gradingStatus"],
    gradingFeedback: row.gradingFeedback ?? undefined,
    gradedBy: row.gradedBy ?? undefined,
    gradedAt: row.gradedAt ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
    timeSpent: row.timeSpent ?? undefined,
  };
}

function toCertificate(row: typeof certificatesTable.$inferSelect): Certificate {
  return {
    id: row.id,
    participantId: row.participantId,
    courseId: row.courseId ?? undefined,
    learningPathId: row.learningPathId ?? undefined,
    assessmentId: row.assessmentId ?? undefined,
    title: row.title,
    description: row.description,
    certificateNumber: row.certificateNumber,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt ?? undefined,
    status: row.status as Certificate["status"],
    verificationUrl: row.verificationUrl,
    metadata: row.metadata as Record<string, string>,
  };
}

function toAssessor(row: typeof assessorsTable.$inferSelect): Assessor {
  return {
    id: row.id,
    registrationNumber: row.registrationNumber,
    name: row.name,
    email: row.email,
    phone: row.phone,
    lspId: row.lspId,
    competencySchemes: row.competencySchemes as string[],
    specializations: row.specializations as string[],
    status: row.status as Assessor["status"],
    validUntil: row.validUntil,
    totalAssessments: row.totalAssessments,
    createdAt: row.createdAt,
  };
}

function toAssessee(row: typeof assesseesTable.$inferSelect): Assessee {
  return {
    id: row.id,
    participantId: row.participantId,
    nik: row.nik,
    birthPlace: row.birthPlace,
    birthDate: row.birthDate,
    gender: row.gender as Assessee["gender"],
    education: row.education,
    workExperience: row.workExperience,
    currentCompany: row.currentCompany,
    currentPosition: row.currentPosition,
    schemeId: row.schemeId,
    registrationDate: row.registrationDate,
    status: row.status as Assessee["status"],
  };
}

function toScheme(row: typeof schemesTable.$inferSelect): CompetencyScheme {
  return {
    id: row.id,
    lspId: row.lspId,
    code: row.code,
    name: row.name,
    description: row.description,
    skkniCode: row.skkniCode ?? undefined,
    unitIds: row.unitIds as string[],
    assessmentMethods: row.assessmentMethods as CompetencyScheme["assessmentMethods"],
    duration: row.duration,
    fee: row.fee,
    isActive: row.isActive === 1,
  };
}

function toSchedule(row: typeof schedulesTable.$inferSelect): AssessmentSchedule {
  return {
    id: row.id,
    schemeId: row.schemeId,
    assesseeId: row.assesseeId,
    assessorId: row.assessorId,
    scheduledDate: row.scheduledDate,
    location: row.location,
    locationType: row.locationType as AssessmentSchedule["locationType"],
    methods: row.methods as AssessmentSchedule["methods"],
    duration: row.duration,
    status: row.status as AssessmentSchedule["status"],
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
  };
}

function toPortfolioItem(row: typeof portfolioItemsTable.$inferSelect): PortfolioItem {
  return {
    id: row.id,
    assesseeId: row.assesseeId,
    unitId: row.unitId,
    elementId: row.elementId ?? undefined,
    type: row.type as PortfolioItem["type"],
    title: row.title,
    description: row.description,
    fileUrl: row.fileUrl ?? undefined,
    issuedDate: row.issuedDate ?? undefined,
    issuedBy: row.issuedBy ?? undefined,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    status: row.status as PortfolioItem["status"],
    feedback: row.feedback ?? undefined,
  };
}

function toCertificationResult(row: typeof certificationResultsTable.$inferSelect): CertificationResult {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    assesseeId: row.assesseeId,
    assessorId: row.assessorId,
    schemeId: row.schemeId,
    unitResults: row.unitResults as CertificationResult["unitResults"],
    overallResult: row.overallResult as CertificationResult["overallResult"],
    recommendations: row.recommendations ?? undefined,
    assessedAt: row.assessedAt,
    certificateId: row.certificateId ?? undefined,
  };
}

function toLSPOrganization(row: typeof lspOrganizationsTable.$inferSelect): LSPOrganization {
  return {
    id: row.id,
    name: row.name,
    licenseNumber: row.licenseNumber,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website ?? undefined,
    leadAssessorId: row.leadAssessorId ?? undefined,
    competencySchemes: row.competencySchemes as CompetencyScheme[],
    status: row.status as LSPOrganization["status"],
    validUntil: row.validUntil,
    createdAt: row.createdAt,
  };
}

function toNotification(row: typeof notificationsTable.$inferSelect): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as Notification["type"],
    category: row.category as Notification["category"],
    title: row.title,
    message: row.message,
    link: row.link ?? undefined,
    isRead: row.isRead === 1,
    createdAt: row.createdAt,
  };
}

export class DrizzleStorage implements IStorage {
  // Clusters
  async getClusters(): Promise<CompetencyCluster[]> {
    const rows = await db.select().from(clustersTable);
    return rows.map(toCluster);
  }

  async getCluster(id: string): Promise<CompetencyCluster | undefined> {
    const rows = await db.select().from(clustersTable).where(eq(clustersTable.id, id));
    return rows[0] ? toCluster(rows[0]) : undefined;
  }

  async createCluster(data: InsertCluster): Promise<CompetencyCluster> {
    const id = `cluster-${randomUUID()}`;
    const row = {
      id,
      code: data.code.toUpperCase(),
      name: data.name,
      fullName: data.fullName,
      description: data.description,
      color: data.color,
    };
    await db.insert(clustersTable).values(row);
    return toCluster(row);
  }

  async updateCluster(id: string, data: Partial<InsertCluster>): Promise<CompetencyCluster | undefined> {
    const existing = await this.getCluster(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.name && { name: data.name }),
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.description && { description: data.description }),
      ...(data.color && { color: data.color }),
    };
    await db.update(clustersTable).set(updated).where(eq(clustersTable.id, id));
    return updated;
  }

  async deleteCluster(id: string): Promise<boolean> {
    const existing = await this.getCluster(id);
    if (!existing) return false;
    // Delete associated units
    await db.delete(unitsTable).where(eq(unitsTable.clusterId, id));
    await db.delete(clustersTable).where(eq(clustersTable.id, id));
    return true;
  }

  // Units
  async getUnits(): Promise<UnitCompetency[]> {
    const rows = await db.select().from(unitsTable);
    return rows.map(toUnit);
  }

  async getUnit(id: string): Promise<UnitCompetency | undefined> {
    const rows = await db.select().from(unitsTable).where(eq(unitsTable.id, id));
    return rows[0] ? toUnit(rows[0]) : undefined;
  }

  async getUnitsByCluster(clusterId: string): Promise<UnitCompetency[]> {
    const rows = await db.select().from(unitsTable).where(eq(unitsTable.clusterId, clusterId));
    return rows.map(toUnit);
  }

  async createUnit(data: InsertUnit): Promise<UnitCompetency> {
    const id = `unit-${randomUUID()}`;
    const defaultIndicators: BehaviorIndicator[] = data.indicators || [
      { level: "L1", indicators: ["Indikator L1 belum didefinisikan"] },
      { level: "L2", indicators: ["Indikator L2 belum didefinisikan"] },
      { level: "L3", indicators: ["Indikator L3 belum didefinisikan"] },
      { level: "L4", indicators: ["Indikator L4 belum didefinisikan"] },
    ];
    const row = {
      id,
      clusterId: data.clusterId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      indicators: defaultIndicators,
    };
    await db.insert(unitsTable).values(row);
    return toUnit(row);
  }

  async updateUnit(id: string, data: Partial<InsertUnit>): Promise<UnitCompetency | undefined> {
    const existing = await this.getUnit(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      ...(data.clusterId && { clusterId: data.clusterId }),
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.indicators && { indicators: data.indicators }),
    };
    await db.update(unitsTable).set(updated).where(eq(unitsTable.id, id));
    return updated;
  }

  async deleteUnit(id: string): Promise<boolean> {
    const existing = await this.getUnit(id);
    if (!existing) return false;
    await db.delete(unitsTable).where(eq(unitsTable.id, id));
    return true;
  }

  // Courses
  async getCourses(): Promise<ECourse[]> {
    const rows = await db.select().from(coursesTable);
    return rows.map(toCourse);
  }

  async getCourse(id: string): Promise<ECourse | undefined> {
    const rows = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
    return rows[0] ? toCourse(rows[0]) : undefined;
  }

  async getCoursesByUnit(unitId: string): Promise<ECourse[]> {
    const rows = await db.select().from(coursesTable).where(eq(coursesTable.unitId, unitId));
    return rows.map(toCourse);
  }

  async createCourse(data: InsertCourse): Promise<ECourse> {
    const id = `course-${randomUUID()}`;
    const defaultLessons: Lesson[] = [
      { id: `${id}-l1`, order: 1, type: "orientation", title: "Orientasi Kompetensi", description: "Memahami standar dan indikator", content: "" },
      { id: `${id}-l2`, order: 2, type: "context", title: "Konteks Dunia Nyata", description: "Studi kasus dan tantangan", content: "" },
      { id: `${id}-l3`, order: 3, type: "microlearning", title: "Micro Learning", description: "Materi ringkas dan modular", content: "" },
      { id: `${id}-l4`, order: 4, type: "practice", title: "Aktivitas Praktik", description: "Tugas berbasis kerja nyata", content: "" },
      { id: `${id}-l5`, order: 5, type: "assessment", title: "Asesmen Kompetensi", description: "Penilaian berbasis evidensi", content: "" },
      { id: `${id}-l6`, order: 6, type: "reflection", title: "Refleksi & Evidensi", description: "Dokumentasi pembelajaran", content: "" },
    ];
    const row = {
      id,
      unitId: data.unitId,
      targetLevel: data.targetLevel,
      title: data.title,
      description: data.description,
      duration: data.duration,
      lessons: defaultLessons,
      preTestId: data.preTestId ?? null,
      postTestId: data.postTestId ?? null,
      createdAt: new Date().toISOString().split("T")[0],
    };
    await db.insert(coursesTable).values(row);
    return toCourse(row);
  }

  async deleteCourse(id: string): Promise<boolean> {
    const existing = await this.getCourse(id);
    if (!existing) return false;

    await db.transaction(async (tx) => {
      const quizRows = await tx
        .select({ id: quizzesTable.id })
        .from(quizzesTable)
        .where(eq(quizzesTable.courseId, id));
      const quizIds = quizRows.map(({ id: quizId }) => quizId);

      if (quizIds.length > 0) {
        await tx.delete(quizAttemptsTable).where(inArray(quizAttemptsTable.quizId, quizIds));
        await tx.delete(quizzesTable).where(inArray(quizzesTable.id, quizIds));
      }

      await tx.delete(enrollmentsTable).where(eq(enrollmentsTable.courseId, id));
      await tx.delete(learningRecordsTable).where(eq(learningRecordsTable.courseId, id));
      await tx.update(certificatesTable)
        .set({ courseId: null })
        .where(eq(certificatesTable.courseId, id));
      await tx.delete(coursesTable).where(eq(coursesTable.id, id));
    });
    return true;
  }

  // Participants
  async getParticipants(): Promise<Participant[]> {
    const [rows, allComps, allEvs, allLrs] = await Promise.all([
      db.select().from(participantsTable),
      db.select().from(participantCompetenciesTable),
      db.select().from(evidencesTable),
      db.select().from(learningRecordsTable),
    ]);

    return rows.map(row => {
      const competencies = mapCompetencyRows(allComps.filter(c => c.participantId === row.id));
      const evidences = mapEvidenceRows(allEvs.filter(e => e.participantId === row.id));
      const learningHistory = mapLearningRecordRows(allLrs.filter(lr => lr.participantId === row.id));
      return toParticipant(row, competencies, evidences, learningHistory);
    });
  }

  async getParticipant(id: string): Promise<Participant | undefined> {
    const [rows, compRows, evRows, lrRows] = await Promise.all([
      db.select().from(participantsTable).where(eq(participantsTable.id, id)),
      db.select().from(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, id)),
      db.select().from(evidencesTable).where(eq(evidencesTable.participantId, id)),
      db.select().from(learningRecordsTable).where(eq(learningRecordsTable.participantId, id)),
    ]);
    if (!rows[0]) return undefined;
    return toParticipant(
      rows[0],
      mapCompetencyRows(compRows),
      mapEvidenceRows(evRows),
      mapLearningRecordRows(lrRows),
    );
  }

  async createParticipant(data: InsertParticipant): Promise<Participant> {
    const id = `p-${randomUUID()}`;
    const row = {
      id,
      nip: data.nip,
      name: data.name,
      position: data.position,
      unit: data.unit,
      email: data.email,
      bujkId: data.bujkId ?? null,
      competencies: [] as ParticipantCompetency[],
      learningHistory: [] as LearningRecord[],
      evidences: [] as Evidence[],
    };
    await db.insert(participantsTable).values(row);
    return toParticipant(row, [], [], []);
  }

  async updateParticipantCompetencies(id: string, competencies: ParticipantCompetency[]): Promise<Participant | undefined> {
    return db.transaction(async (tx) => {
      // Serialize replacements for the same participant. Without this lock,
      // two calls that both start from an empty competency set can each insert
      // their payload and leave a mixture of both sets behind.
      const participantRows = await tx
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.id, id))
        .for("update");
      if (!participantRows[0]) return undefined;

      await tx.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, id));
      if (competencies.length > 0) {
        await tx.insert(participantCompetenciesTable).values(
          competencies.map(c => ({
            id: `pc-${randomUUID()}`,
            participantId: id,
            unitId: c.unitId,
            currentLevel: c.currentLevel,
            targetLevel: c.targetLevel,
            lastAssessed: c.lastAssessed,
            status: c.status,
          }))
        );
      }

      const [competencyRows, evidenceRows, learningRecordRows] = await Promise.all([
        tx.select().from(participantCompetenciesTable)
          .where(eq(participantCompetenciesTable.participantId, id)),
        tx.select().from(evidencesTable)
          .where(eq(evidencesTable.participantId, id)),
        tx.select().from(learningRecordsTable)
          .where(eq(learningRecordsTable.participantId, id)),
      ]);

      return toParticipant(
        participantRows[0],
        mapCompetencyRows(competencyRows),
        mapEvidenceRows(evidenceRows),
        mapLearningRecordRows(learningRecordRows),
      );
    });
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const existing = await this.getParticipant(id);
    if (!existing) return false;
    // Delete every participant-owned record in one transaction. Database
    // cascades provide a second line of defense for direct SQL deletions.
    await db.transaction(async (tx) => {
      await tx.delete(quizAttemptsTable).where(eq(quizAttemptsTable.participantId, id));
      await tx.delete(certificatesTable).where(eq(certificatesTable.participantId, id));
      await tx.delete(enrollmentsTable).where(eq(enrollmentsTable.participantId, id));
      await tx.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, id));
      await tx.delete(evidencesTable).where(eq(evidencesTable.participantId, id));
      await tx.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, id));
      await tx.delete(participantsTable).where(eq(participantsTable.id, id));
    });
    return true;
  }

  // Evidences
  async addEvidence(participantId: string, data: InsertEvidence): Promise<Evidence> {
    const participantExists = await db.select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.id, participantId));
    if (!participantExists[0]) throw new Error("Participant not found");

    const evidence: Evidence = {
      id: `ev-${randomUUID()}`,
      unitId: data.unitId,
      type: data.type,
      title: data.title,
      description: data.description,
      submittedAt: new Date().toISOString().split("T")[0],
      status: "pending",
    };

    await db.insert(evidencesTable).values({
      id: evidence.id,
      participantId,
      unitId: evidence.unitId,
      type: evidence.type,
      title: evidence.title,
      description: evidence.description,
      fileUrl: null,
      submittedAt: evidence.submittedAt,
      assessedAt: null,
      assessorId: null,
      score: null,
      feedback: null,
      status: evidence.status,
    });

    return evidence;
  }

  async updateEvidenceStatus(participantId: string, evidenceId: string, status: Evidence["status"], score?: number, feedback?: string): Promise<Evidence | undefined> {
    const evRows = await db.select().from(evidencesTable)
      .where(eq(evidencesTable.id, evidenceId));
    if (!evRows[0] || evRows[0].participantId !== participantId) return undefined;

    const assessedAt = new Date().toISOString().split("T")[0];
    const dbUpdates: Partial<typeof evidencesTable.$inferInsert> = { status, assessedAt };
    if (score !== undefined) dbUpdates.score = score;
    if (feedback) dbUpdates.feedback = feedback;

    await db.update(evidencesTable).set(dbUpdates).where(eq(evidencesTable.id, evidenceId));

    // Build the return value with explicit casts to preserve narrow types
    const base = mapEvidenceRows([evRows[0]])[0];
    const updatedEvidence: Evidence = {
      ...base,
      status,
      assessedAt,
      score: score !== undefined ? score : base.score,
      feedback: feedback !== undefined ? feedback : base.feedback,
    };
    return updatedEvidence;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const participants = await this.getParticipants();
    const courses = await this.getCourses();

    const allCompetencies = participants.flatMap(p => p.competencies);
    const completedLearning = participants.flatMap(p => p.learningHistory.filter(l => l.status === "completed"));
    const totalLearning = participants.flatMap(p => p.learningHistory);

    const levelCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
    allCompetencies.forEach(c => { levelCounts[c.currentLevel]++; });
    const totalComps = allCompetencies.length || 1;

    const gapsByUnit: Record<string, { count: number; currentSum: number; targetSum: number }> = {};
    allCompetencies.filter(c => c.status === "gap").forEach(c => {
      if (!gapsByUnit[c.unitId]) gapsByUnit[c.unitId] = { count: 0, currentSum: 0, targetSum: 0 };
      gapsByUnit[c.unitId].count++;
      gapsByUnit[c.unitId].currentSum += parseInt(c.currentLevel.replace("L", ""));
      gapsByUnit[c.unitId].targetSum += parseInt(c.targetLevel.replace("L", ""));
    });

    const units = await this.getUnits();
    const clusters = await this.getClusters();
    const unitMap = new Map(units.map(u => [u.id, u]));
    const clusterMap = new Map(clusters.map(c => [c.id, c]));

    const competencyGaps = Object.entries(gapsByUnit)
      .map(([unitId, data]) => {
        const unit = unitMap.get(unitId);
        const cluster = unit ? clusterMap.get(unit.clusterId) : undefined;
        return {
          unitId,
          unitName: unit?.name || unitId,
          clusterCode: cluster?.code || "LAINNYA",
          gapCount: data.count,
          avgCurrentLevel: data.currentSum / data.count,
          avgTargetLevel: data.targetSum / data.count,
        };
      })
      .sort((a, b) => b.gapCount - a.gapCount)
      .slice(0, 5);

    const avgLevel = allCompetencies.reduce((sum, c) => sum + parseInt(c.currentLevel.replace("L", "")), 0) / totalComps;

    return {
      totalParticipants: participants.length,
      totalCourses: courses.length,
      completionRate: totalLearning.length > 0 ? Math.round((completedLearning.length / totalLearning.length) * 100) : 0,
      averageLevel: Math.round(avgLevel * 10) / 10,
      competencyGaps,
      levelDistribution: [
        { level: "L1", count: levelCounts.L1, percentage: Math.round((levelCounts.L1 / totalComps) * 100) },
        { level: "L2", count: levelCounts.L2, percentage: Math.round((levelCounts.L2 / totalComps) * 100) },
        { level: "L3", count: levelCounts.L3, percentage: Math.round((levelCounts.L3 / totalComps) * 100) },
        { level: "L4", count: levelCounts.L4, percentage: Math.round((levelCounts.L4 / totalComps) * 100) },
      ],
    };
  }

  async getHeatmapData(): Promise<HeatmapData[]> {
    const participants = await this.getParticipants();
    const units = await this.getUnits();
    const clusters = await this.getClusters();
    const clusterMap = new Map(clusters.map(c => [c.id, c]));

    return units.map(unit => {
      const cluster = clusterMap.get(unit.clusterId);
      const competencies = participants.flatMap(p => p.competencies.filter(c => c.unitId === unit.id));
      return {
        unitId: unit.id,
        unitCode: unit.code,
        unitName: unit.name,
        clusterCode: cluster?.code || "LAINNYA",
        l1Count: competencies.filter(c => c.currentLevel === "L1").length,
        l2Count: competencies.filter(c => c.currentLevel === "L2").length,
        l3Count: competencies.filter(c => c.currentLevel === "L3").length,
        l4Count: competencies.filter(c => c.currentLevel === "L4").length,
        total: competencies.length,
      };
    });
  }

  // LMS - Learning Paths
  async getLearningPaths(): Promise<LearningPath[]> {
    const rows = await db.select().from(learningPathsTable);
    return rows.map(toLearningPath);
  }

  async getLearningPath(id: string): Promise<LearningPath | undefined> {
    const rows = await db.select().from(learningPathsTable).where(eq(learningPathsTable.id, id));
    return rows[0] ? toLearningPath(rows[0]) : undefined;
  }

  async createLearningPath(data: InsertLearningPath): Promise<LearningPath> {
    const id = `path-${randomUUID()}`;
    const row = {
      id,
      title: data.title,
      description: data.description,
      targetRole: data.targetRole,
      duration: data.duration,
      difficulty: data.difficulty,
      courseIds: data.courseIds || [],
      prerequisites: data.prerequisites || [],
      skills: data.skills || [],
      isPublished: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    await db.insert(learningPathsTable).values(row);
    return toLearningPath(row);
  }

  async updateLearningPath(id: string, data: Partial<InsertLearningPath>): Promise<LearningPath | undefined> {
    const existing = await this.getLearningPath(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    await db.update(learningPathsTable).set({
      ...data,
      isPublished: updated.isPublished ? 1 : 0,
    }).where(eq(learningPathsTable.id, id));
    return updated;
  }

  async deleteLearningPath(id: string): Promise<boolean> {
    await db.delete(learningPathsTable).where(eq(learningPathsTable.id, id));
    return true;
  }

  // LMS - Enrollments
  async getEnrollments(): Promise<Enrollment[]> {
    const rows = await db.select().from(enrollmentsTable);
    return rows.map(toEnrollment);
  }

  async getEnrollmentsByParticipant(participantId: string): Promise<Enrollment[]> {
    const rows = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.participantId, participantId));
    return rows.map(toEnrollment);
  }

  async createEnrollment(participantId: string, courseId?: string, learningPathId?: string): Promise<Enrollment> {
    const id = `enroll-${randomUUID()}`;
    const row = {
      id,
      participantId,
      courseId: courseId ?? null,
      learningPathId: learningPathId ?? null,
      enrolledAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      progress: 0,
      completedLessonIds: [],
      status: "enrolled",
      lastAccessedAt: null,
    };
    await db.insert(enrollmentsTable).values(row);
    return toEnrollment(row);
  }

  async updateEnrollmentProgress(id: string, progress: number, status?: Enrollment["status"]): Promise<Enrollment | undefined> {
    const existing = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, id));
    if (!existing[0]) return undefined;
    const now = new Date().toISOString();
    const updates: Partial<typeof enrollmentsTable.$inferInsert> = {
      progress,
      lastAccessedAt: now,
    };
    if (status) updates.status = status;
    if (progress > 0 && !existing[0].startedAt) updates.startedAt = now;
    if (progress >= 100) {
      updates.completedAt = now;
      updates.status = "completed";
    }
    await db.update(enrollmentsTable).set(updates).where(eq(enrollmentsTable.id, id));
    const updated = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, id));
    return updated[0] ? toEnrollment(updated[0]) : undefined;
  }

  async markEnrollmentLessonCompleted(id: string, lessonId: string): Promise<Enrollment | undefined> {
    const rows = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, id));
    const enrollment = rows[0];
    if (!enrollment?.courseId) return undefined;
    const course = await this.getCourse(enrollment.courseId);
    if (!course?.lessons.some(lesson => lesson.id === lessonId)) return undefined;

    await db.update(enrollmentsTable)
      .set({
        completedLessonIds: drizzleSql`
          CASE
            WHEN ${enrollmentsTable.completedLessonIds} ? ${lessonId}::text
              THEN ${enrollmentsTable.completedLessonIds}
            ELSE ${enrollmentsTable.completedLessonIds} || jsonb_build_array(${lessonId}::text)
          END
        `,
      })
      .where(eq(enrollmentsTable.id, id));
    return this.refreshCourseEnrollmentProgress(id);
  }

  async refreshCourseEnrollmentProgress(id: string): Promise<Enrollment | undefined> {
    const rows = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, id));
    const enrollment = rows[0];
    if (!enrollment?.courseId) return undefined;
    const course = await this.getCourse(enrollment.courseId);
    if (!course) return undefined;

    const postTest = course.postTestId ? await this.getQuiz(course.postTestId) : undefined;
    const postTestAttempts = postTest
      ? await db.select().from(quizAttemptsTable)
          .where(eq(quizAttemptsTable.quizId, postTest.id))
      : [];
    const postTestPassed = postTestAttempts.some(
      attempt =>
        attempt.participantId === enrollment.participantId &&
        attempt.gradingStatus === "graded" &&
        attempt.passed === 1,
    );
    const completedLessonIds = (enrollment.completedLessonIds as string[] | null) ?? [];
    const completion = evaluateCourseCompletion(course, completedLessonIds, postTestPassed);
    const now = new Date().toISOString();
    const updates: Partial<typeof enrollmentsTable.$inferInsert> = {
      progress: completion.progress,
      status: completion.isComplete
        ? "completed"
        : completion.progress > 0
          ? "in_progress"
          : "enrolled",
      lastAccessedAt: now,
      completedAt: completion.isComplete ? enrollment.completedAt ?? now : null,
    };
    if (completion.progress > 0 && !enrollment.startedAt) updates.startedAt = now;

    await db.update(enrollmentsTable).set(updates).where(eq(enrollmentsTable.id, id));
    const updated = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, id));
    return updated[0] ? toEnrollment(updated[0]) : undefined;
  }

  // LMS - Quizzes
  async getQuizzes(): Promise<Quiz[]> {
    const rows = await db.select().from(quizzesTable);
    return rows.map(toQuiz);
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const rows = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id));
    return rows[0] ? toQuiz(rows[0]) : undefined;
  }

  async getQuizzesByCourse(courseId: string): Promise<Quiz[]> {
    const rows = await db.select().from(quizzesTable).where(eq(quizzesTable.courseId, courseId));
    return rows.map(toQuiz);
  }

  async createQuiz(data: InsertQuiz & { questions: Question[] }): Promise<Quiz> {
    const id = `quiz-${randomUUID()}`;
    const row = {
      id,
      courseId: data.courseId,
      lessonId: data.lessonId ?? null,
      title: data.title,
      description: data.description,
      passingScore: data.passingScore ?? 70,
      timeLimit: data.timeLimit ?? null,
      maxAttempts: data.maxAttempts ?? 3,
      shuffleQuestions: data.shuffleQuestions ? 1 : 0,
      showResults: data.showResults !== false ? 1 : 0,
      questions: data.questions,
      createdAt: new Date().toISOString().split("T")[0],
    };
    await db.insert(quizzesTable).values(row);
    return toQuiz(row);
  }

  async deleteQuiz(id: string): Promise<boolean> {
    const existing = await this.getQuiz(id);
    if (!existing) return false;
    await db.transaction(async (tx) => {
      await tx.delete(quizAttemptsTable).where(eq(quizAttemptsTable.quizId, id));
      await tx.update(coursesTable)
        .set({ preTestId: null })
        .where(eq(coursesTable.preTestId, id));
      await tx.update(coursesTable)
        .set({ postTestId: null })
        .where(eq(coursesTable.postTestId, id));
      await tx.delete(quizzesTable).where(eq(quizzesTable.id, id));
    });
    return true;
  }

  // LMS - Quiz Attempts
  async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const rows = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.quizId, quizId));
    return rows.map(toQuizAttempt);
  }

  async getQuizAttemptsByParticipant(participantId: string): Promise<QuizAttempt[]> {
    const rows = await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.participantId, participantId));
    return rows.map(toQuizAttempt);
  }

  async getQuizAttemptsAwaitingReview(): Promise<QuizAttempt[]> {
    const rows = await db.select().from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.gradingStatus, "awaiting_review"));
    return rows.map(toQuizAttempt);
  }

  async createQuizAttempt(attempt: NewQuizAttempt): Promise<QuizAttempt> {
    const id = `attempt-${randomUUID()}`;
    const row = {
      id,
      quizId: attempt.quizId,
      participantId: attempt.participantId,
      answers: attempt.answers,
      score: attempt.score,
      maxScore: attempt.maxScore,
      passed: attempt.passed ? 1 : 0,
      gradingStatus: attempt.gradingStatus ?? "graded",
      gradingFeedback: attempt.gradingFeedback ?? null,
      gradedBy: attempt.gradedBy ?? null,
      gradedAt: attempt.gradedAt ?? null,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      timeSpent: attempt.timeSpent ?? null,
    };
    await db.insert(quizAttemptsTable).values(row);
    const quiz = await this.getQuiz(attempt.quizId);
    const course = quiz ? await this.getCourse(quiz.courseId) : undefined;
    if (quiz && course && course.postTestId === quiz.id) {
      const enrollments = await this.getEnrollmentsByParticipant(attempt.participantId);
      const enrollment = enrollments.find(item => item.courseId === course.id);
      if (enrollment) await this.refreshCourseEnrollmentProgress(enrollment.id);
    }
    return toQuizAttempt(row);
  }

  async gradeQuizAttempt(
    id: string,
    grade: QuizAttemptGradeInput,
  ): Promise<QuizAttempt | undefined> {
    const [current] = await db.select().from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, id))
      .limit(1);
    if (!current || current.gradingStatus !== "awaiting_review") return undefined;
    const attempt = toQuizAttempt(current);
    const quiz = await this.getQuiz(attempt.quizId);
    if (!quiz) return undefined;

    let updates: Partial<typeof quizAttemptsTable.$inferInsert>;
    if (typeof grade.score === "number") {
      if (!Number.isInteger(grade.score) || grade.score < 0 || grade.score > 100) return undefined;
      updates = {
        score: grade.score,
        maxScore: 100,
        passed: grade.score >= quiz.passingScore ? 1 : 0,
      };
    } else {
      const essayScores = grade.essayScores;
      if (!essayScores) return undefined;
      const essayQuestions = quiz.questions.filter(question => question.type === "essay");
      const essayQuestionIds = new Set(essayQuestions.map(question => question.id));
      if (
        essayQuestionIds.size !== Object.keys(essayScores).length ||
        Object.keys(essayScores).some(questionId => !essayQuestionIds.has(questionId)) ||
        essayQuestions.some(question => {
          const score = essayScores[question.id];
          return !Number.isInteger(score) || score < 0 || score > Math.max(0, question.points);
        })
      ) {
        return undefined;
      }

      const answers = attempt.answers.map(answer => {
        const question = essayQuestions.find(item => item.id === answer.questionId);
        if (!question) return answer;
        const points = essayScores[question.id];
        return {
          ...answer,
          isCorrect: question.points > 0 && points >= question.points,
          points,
        };
      });
      const score = attempt.maxScore > 0
        ? Math.round((answers.reduce((total, answer) => total + answer.points, 0) / attempt.maxScore) * 100)
        : 0;
      updates = {
        answers,
        score,
        passed: attempt.maxScore > 0 && score >= quiz.passingScore ? 1 : 0,
      };
    }

    const [row] = await db.update(quizAttemptsTable)
      .set({
        ...updates,
        gradingStatus: "graded",
        gradingFeedback: grade.feedback ?? null,
        gradedBy: grade.gradedBy,
        gradedAt: grade.gradedAt,
      })
      .where(and(
        eq(quizAttemptsTable.id, id),
        eq(quizAttemptsTable.gradingStatus, "awaiting_review"),
      ))
      .returning();
    if (!row) return undefined;

    const course = await this.getCourse(quiz.courseId);
    if (course?.postTestId === quiz.id) {
      const enrollments = await this.getEnrollmentsByParticipant(attempt.participantId);
      const enrollment = enrollments.find(item => item.courseId === course.id);
      if (enrollment) await this.refreshCourseEnrollmentProgress(enrollment.id);
    }
    return toQuizAttempt(row);
  }

  // LMS - Certificates
  async getCertificates(): Promise<Certificate[]> {
    const rows = await db.select().from(certificatesTable);
    return rows.map(toCertificate);
  }

  async getCertificate(id: string): Promise<Certificate | undefined> {
    const rows = await db.select().from(certificatesTable).where(eq(certificatesTable.id, id));
    return rows[0] ? toCertificate(rows[0]) : undefined;
  }

  async getCertificatesByParticipant(participantId: string): Promise<Certificate[]> {
    const rows = await db.select().from(certificatesTable).where(eq(certificatesTable.participantId, participantId));
    return rows.map(toCertificate);
  }

  async createCertificate(data: InsertCertificate): Promise<Certificate> {
    const id = `cert-${randomUUID()}`;
    const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const row = {
      id,
      participantId: data.participantId,
      courseId: data.courseId ?? null,
      learningPathId: data.learningPathId ?? null,
      assessmentId: data.assessmentId ?? null,
      title: data.title,
      description: data.description,
      certificateNumber: certNumber,
      issuedAt: new Date().toISOString(),
      expiresAt: null,
      status: "active",
      verificationUrl: `/verify/${certNumber}`,
      metadata: {} as Record<string, string>,
    };
    await db.insert(certificatesTable).values(row);
    return toCertificate(row);
  }

  async verifyCertificate(certificateNumber: string): Promise<Certificate | undefined> {
    const rows = await db.select().from(certificatesTable).where(eq(certificatesTable.certificateNumber, certificateNumber));
    return rows[0] ? toCertificate(rows[0]) : undefined;
  }

  // LSP - Assessors
  async getAssessors(): Promise<Assessor[]> {
    const rows = await db.select().from(assessorsTable);
    return rows.map(toAssessor);
  }

  async getAssessor(id: string): Promise<Assessor | undefined> {
    const rows = await db.select().from(assessorsTable).where(eq(assessorsTable.id, id));
    return rows[0] ? toAssessor(rows[0]) : undefined;
  }

  async createAssessor(data: InsertAssessor): Promise<Assessor> {
    const id = `assessor-${randomUUID()}`;
    const row = {
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
      createdAt: new Date().toISOString().split("T")[0],
    };
    await db.insert(assessorsTable).values(row);
    return toAssessor(row);
  }

  async updateAssessor(id: string, data: Partial<InsertAssessor>): Promise<Assessor | undefined> {
    const existing = await this.getAssessor(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    await db.update(assessorsTable).set(data).where(eq(assessorsTable.id, id));
    return updated;
  }

  async deleteAssessor(id: string): Promise<boolean> {
    await db.delete(assessorsTable).where(eq(assessorsTable.id, id));
    return true;
  }

  // LSP - Assessees
  async getAssessees(): Promise<Assessee[]> {
    const rows = await db.select().from(assesseesTable);
    return rows.map(toAssessee);
  }

  async getAssessee(id: string): Promise<Assessee | undefined> {
    const rows = await db.select().from(assesseesTable).where(eq(assesseesTable.id, id));
    return rows[0] ? toAssessee(rows[0]) : undefined;
  }

  async createAssessee(data: InsertAssessee): Promise<Assessee> {
    const id = `assessee-${randomUUID()}`;
    const row = {
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
      registrationDate: new Date().toISOString().split("T")[0],
      status: "registered",
    };
    await db.insert(assesseesTable).values(row);
    return toAssessee(row);
  }

  async updateAssesseeStatus(id: string, status: Assessee["status"]): Promise<Assessee | undefined> {
    const existing = await this.getAssessee(id);
    if (!existing) return undefined;
    await db.update(assesseesTable).set({ status }).where(eq(assesseesTable.id, id));
    return { ...existing, status };
  }

  // LSP - Schemes
  async getSchemes(): Promise<CompetencyScheme[]> {
    const rows = await db.select().from(schemesTable);
    return rows.map(toScheme);
  }

  async getScheme(id: string): Promise<CompetencyScheme | undefined> {
    const rows = await db.select().from(schemesTable).where(eq(schemesTable.id, id));
    return rows[0] ? toScheme(rows[0]) : undefined;
  }

  async createScheme(data: InsertScheme): Promise<CompetencyScheme> {
    const id = `scheme-${randomUUID()}`;
    const row = {
      id,
      lspId: data.lspId,
      code: data.code,
      name: data.name,
      description: data.description,
      skkniCode: data.skkniCode ?? null,
      unitIds: data.unitIds || [],
      assessmentMethods: data.assessmentMethods,
      duration: data.duration,
      fee: data.fee,
      isActive: 1,
    };
    await db.insert(schemesTable).values(row);
    return toScheme(row);
  }

  // LSP - Schedules
  async getSchedules(): Promise<AssessmentSchedule[]> {
    const rows = await db.select().from(schedulesTable);
    return rows.map(toSchedule);
  }

  async getSchedule(id: string): Promise<AssessmentSchedule | undefined> {
    const rows = await db.select().from(schedulesTable).where(eq(schedulesTable.id, id));
    return rows[0] ? toSchedule(rows[0]) : undefined;
  }

  async createSchedule(data: InsertSchedule): Promise<AssessmentSchedule> {
    const id = `schedule-${randomUUID()}`;
    const row = {
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
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(schedulesTable).values(row);
    return toSchedule(row);
  }

  async updateScheduleStatus(id: string, status: AssessmentSchedule["status"]): Promise<AssessmentSchedule | undefined> {
    const existing = await this.getSchedule(id);
    if (!existing) return undefined;
    await db.update(schedulesTable).set({ status }).where(eq(schedulesTable.id, id));
    return { ...existing, status };
  }

  // LSP - Portfolio
  async getPortfolioItems(assesseeId: string): Promise<PortfolioItem[]> {
    const rows = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.assesseeId, assesseeId));
    return rows.map(toPortfolioItem);
  }

  async createPortfolioItem(data: InsertPortfolio): Promise<PortfolioItem> {
    const id = `portfolio-${randomUUID()}`;
    const row = {
      id,
      assesseeId: data.assesseeId,
      unitId: data.unitId,
      elementId: data.elementId ?? null,
      type: data.type,
      title: data.title,
      description: data.description,
      fileUrl: null,
      issuedDate: data.issuedDate ?? null,
      issuedBy: data.issuedBy ?? null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      status: "submitted",
      feedback: null,
    };
    await db.insert(portfolioItemsTable).values(row);
    return toPortfolioItem(row);
  }

  async updatePortfolioStatus(id: string, status: PortfolioItem["status"], feedback?: string): Promise<PortfolioItem | undefined> {
    const existing = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.id, id));
    if (!existing[0]) return undefined;
    const updates: Partial<typeof portfolioItemsTable.$inferInsert> = {
      status,
      reviewedAt: new Date().toISOString(),
    };
    if (feedback) updates.feedback = feedback;
    await db.update(portfolioItemsTable).set(updates).where(eq(portfolioItemsTable.id, id));
    const updated = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.id, id));
    return updated[0] ? toPortfolioItem(updated[0]) : undefined;
  }

  // LSP - Certification Results
  async getCertificationResults(): Promise<CertificationResult[]> {
    const rows = await db.select().from(certificationResultsTable);
    return rows.map(toCertificationResult);
  }

  async createCertificationResult(result: Omit<CertificationResult, "id">): Promise<CertificationResult> {
    const id = `result-${randomUUID()}`;
    const row = {
      id,
      scheduleId: result.scheduleId,
      assesseeId: result.assesseeId,
      assessorId: result.assessorId,
      schemeId: result.schemeId,
      unitResults: result.unitResults,
      overallResult: result.overallResult,
      recommendations: result.recommendations ?? null,
      assessedAt: result.assessedAt,
      certificateId: result.certificateId ?? null,
    };
    await db.insert(certificationResultsTable).values(row);
    return toCertificationResult(row);
  }

  // LSP - Organizations
  async getLSPOrganizations(): Promise<LSPOrganization[]> {
    const rows = await db.select().from(lspOrganizationsTable);
    return rows.map(toLSPOrganization);
  }

  async getLSPOrganization(id: string): Promise<LSPOrganization | undefined> {
    const rows = await db.select().from(lspOrganizationsTable).where(eq(lspOrganizationsTable.id, id));
    return rows[0] ? toLSPOrganization(rows[0]) : undefined;
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const rows = await db.select().from(notificationsTable);
    return rows
      .map(toNotification)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
    if (!rows[0]) return undefined;
    await db.update(notificationsTable).set({ isRead: 1 }).where(eq(notificationsTable.id, id));
    return { ...toNotification(rows[0]), isRead: true };
  }

  async markAllNotificationsRead(): Promise<void> {
    await db.update(notificationsTable).set({ isRead: 1 });
  }

  // Search
  async searchAll(query: string): Promise<{ participants: Participant[]; courses: ECourse[]; units: UnitCompetency[] }> {
    const q = query.toLowerCase().trim();
    if (!q) return { participants: [], courses: [], units: [] };

    const [allParticipants, allCourses, allUnits] = await Promise.all([
      this.getParticipants(),
      this.getCourses(),
      this.getUnits(),
    ]);

    const participants = allParticipants.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nip.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    ).slice(0, 5);

    const courses = allCourses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    ).slice(0, 5);

    const units = allUnits.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.code.toLowerCase().includes(q) ||
      u.description.toLowerCase().includes(q)
    ).slice(0, 5);

    return { participants, courses, units };
  }

  // Analytics
  async getAnalyticsData() {
    const [participants, courses, units, clusters] = await Promise.all([
      this.getParticipants(),
      this.getCourses(),
      this.getUnits(),
      this.getClusters(),
    ]);

    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const monthName = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      const baseCompleted = Math.floor(participants.length * 0.3) + i * 2;
      const baseEnrolled = Math.floor(participants.length * 0.5) + i * 3;
      return { month: monthName, completions: baseCompleted, enrollments: baseEnrolled };
    });

    const levelDistributionByCluster = clusters.map(cluster => {
      const clusterUnits = units.filter(u => u.clusterId === cluster.id);
      const allComps = participants.flatMap(p =>
        p.competencies.filter(c => clusterUnits.some(u => u.id === c.unitId))
      );
      return {
        cluster: cluster.code,
        L1: allComps.filter(c => c.currentLevel === "L1").length,
        L2: allComps.filter(c => c.currentLevel === "L2").length,
        L3: allComps.filter(c => c.currentLevel === "L3").length,
        L4: allComps.filter(c => c.currentLevel === "L4").length,
      };
    });

    const courseCompletionByLevel = ["L1", "L2", "L3", "L4"].map(level => ({
      level,
      count: courses.filter(c => c.targetLevel === level).length,
    }));

    const topGapUnits = units.map(unit => {
      const gaps = participants.flatMap(p =>
        p.competencies.filter(c => c.unitId === unit.id && c.status === "gap")
      ).length;
      return { name: unit.name, gap: gaps, code: unit.code };
    }).sort((a, b) => b.gap - a.gap).slice(0, 5);

    const participantsByUnit = units.map(unit => ({
      unit: unit.code,
      count: participants.flatMap(p => p.competencies.filter(c => c.unitId === unit.id)).length,
    })).sort((a, b) => b.count - a.count).slice(0, 6);

    return { monthlyTrend, levelDistributionByCluster, courseCompletionByLevel, topGapUnits, participantsByUnit };
  }
}
