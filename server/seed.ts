/**
 * Seeds the database with initial data if it's empty.
 * Synchronizes the current PKB curriculum without rewriting the archived catalog.
 */
import { db } from "./db";
import {
  clustersTable,
  unitsTable,
  coursesTable,
  participantsTable,
  participantCompetenciesTable,
  evidencesTable,
  learningRecordsTable,
  learningPathsTable,
  notificationsTable,
  quizzesTable,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  PKB_CLUSTERS,
  PKB_COURSES,
  PKB_LEARNING_PATHS,
  PKB_PARTICIPANTS,
  PKB_UNITS,
} from "./pkb-catalog";
import { PKB_QUIZZES } from "../shared/pkb-course";
import { catalogLessonsPreservingReferences } from "./catalog-reference-sync";

const PARTICIPANT_COMPETENCY_SEED_ROWS = PKB_PARTICIPANTS.flatMap(participant =>
  participant.competencies.map((competency, index) => ({
    id: `pc-${participant.id.replace("-", "")}-${index + 1}`,
    participantId: participant.id,
    ...competency,
  })),
);

const EVIDENCE_SEED_ROWS = [
  { id: "pkb-evidence-001", participantId: "pkb-participant-001", unitId: "pkb-short-course", type: "document", title: "Indeks Bukti Pendidikan Singkat", description: "Daftar bukti kursus, jadwal, dan ringkasan materi untuk latihan pencatatan PKB.", submittedAt: "2026-10-20", status: "approved", score: 85, feedback: "Dokumen tersusun; penilaian ini hanya umpan balik pembelajaran." },
] satisfies (typeof evidencesTable.$inferInsert)[];

const LEARNING_RECORD_SEED_ROWS = PKB_PARTICIPANTS.flatMap(participant =>
  participant.learningHistory.map(record => ({
    participantId: participant.id,
    ...record,
  })),
);

async function synchronizePkbCatalog() {
  await db.transaction(async tx => {
  const existingCourseIds = new Set((await tx.select({ id: coursesTable.id }).from(coursesTable)).map(row => row.id));
  for (const cluster of PKB_CLUSTERS) {
    const { id: _id, ...updates } = cluster;
    await tx.insert(clustersTable).values(cluster).onConflictDoUpdate({
      target: clustersTable.id,
      set: updates,
    });
  }

  for (const unit of PKB_UNITS) {
    const { id: _id, ...updates } = unit;
    await tx.insert(unitsTable).values(unit).onConflictDoUpdate({
      target: unitsTable.id,
      set: updates,
    });
  }

  for (const course of PKB_COURSES) {
    const row = {
      ...course,
      // Courses and quizzes have cyclic foreign keys: bind new defaults only
      // after both sides exist, and preserve existing admin-selected bindings.
      preTestId: null,
      postTestId: null,
    };
    const {
      id: _id,
      preTestId: _preTestId,
      postTestId: _postTestId,
      ...updates
    } = row;
    await tx.insert(coursesTable).values(row).onConflictDoUpdate({
      target: coursesTable.id,
      set: { ...updates, lessons: catalogLessonsPreservingReferences(course.lessons) },
    });
  }

  for (const quiz of PKB_QUIZZES) {
    const row = {
      ...quiz,
      lessonId: quiz.lessonId ?? null,
      timeLimit: quiz.timeLimit ?? null,
      shuffleQuestions: quiz.shuffleQuestions ? 1 : 0,
      showResults: quiz.showResults ? 1 : 0,
    };
    const { id: _id, ...updates } = row;
    await tx.insert(quizzesTable).values(row).onConflictDoUpdate({
      target: quizzesTable.id,
      set: updates,
    });
  }

  for (const course of PKB_COURSES) {
    if (!existingCourseIds.has(course.id)) {
      await tx.update(coursesTable).set({
        preTestId: course.preTestId ?? null,
        postTestId: course.postTestId ?? null,
      }).where(eq(coursesTable.id, course.id));
    }
  }

  for (const path of PKB_LEARNING_PATHS) {
    const row = { ...path, isPublished: path.isPublished ? 1 : 0 };
    const { id: _id, ...updates } = row;
    await tx.insert(learningPathsTable).values(row).onConflictDoUpdate({
      target: learningPathsTable.id,
      set: updates,
    });
  }
  });
}

async function synchronizeParticipantRelations(participantIds: Set<string>) {
  const competencies = PARTICIPANT_COMPETENCY_SEED_ROWS
    .filter(competency => participantIds.has(competency.participantId));
  if (competencies.length > 0) {
    await db.insert(participantCompetenciesTable)
      .values(competencies)
      .onConflictDoNothing();
  }

  const evidences = EVIDENCE_SEED_ROWS
    .filter(evidence => participantIds.has(evidence.participantId));
  if (evidences.length > 0) {
    await db.insert(evidencesTable)
      .values(evidences)
      .onConflictDoNothing();
  }

  const learningRecords = LEARNING_RECORD_SEED_ROWS
    .filter(record => participantIds.has(record.participantId));
  if (learningRecords.length > 0) {
    await db.insert(learningRecordsTable)
      .values(learningRecords)
      .onConflictDoNothing();
  }
}

export async function seedDatabase() {
  // Check if data already exists
  const existingClusters = await db.select().from(clustersTable).limit(1);
  if (existingClusters.length > 0) {
    await synchronizePkbCatalog();
    const existingParticipants = await db.select({
      id: participantsTable.id,
    }).from(participantsTable);
    await synchronizeParticipantRelations(
      new Set(existingParticipants.map(participant => participant.id)),
    );
    console.log("[seed] PKB ASDAMKINDO baseline catalog synchronized.");
    return;
  }

  console.log("[seed] Seeding database with initial data...");

  await synchronizePkbCatalog();

  // Participants
  await db.insert(participantsTable).values(PKB_PARTICIPANTS.map(({ competencies: _competencies, learningHistory: _learningHistory, evidences: _evidences, ...participant }) => participant));

  // Participant competencies (relational)
  await db.insert(participantCompetenciesTable).values(PARTICIPANT_COMPETENCY_SEED_ROWS);

  // Evidences (relational)
  await db.insert(evidencesTable).values(EVIDENCE_SEED_ROWS);

  // Learning records (relational)
  await db.insert(learningRecordsTable).values(LEARNING_RECORD_SEED_ROWS);

  // Notifications
  const now = Date.now();
  await db.insert(notificationsTable).values([
    {
      id: "notif-001",
      userId: "system",
      type: "warning",
      category: "assessment",
      title: "Rencana PKB perlu ditinjau",
      message: "Tinjau rencana kegiatan PKB dan lengkapi bukti pembelajaran yang relevan dengan kompetensi keahlian.",
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
      message: "Sertifikat penyelesaian kursus PKB diterbitkan. Sertifikat ini bukan SKK atau penetapan Angka Kredit.",
      link: "/app/certificates",
      isRead: 0,
      createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "notif-003",
      userId: "system",
      type: "info",
      category: "schedule",
      title: "Periksa bukti kegiatan PKB",
      message: "Lengkapi indeks bukti untuk kegiatan pengembangan keprofesian yang telah diikuti.",
      link: "/app/competencies",
      isRead: 0,
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: "notif-004",
      userId: "system",
      type: "info",
      category: "course",
      title: "E-Course Baru Ditambahkan",
      message: "Kursus dasar PKB telah tersedia untuk tenaga kerja konstruksi.",
      link: "/app/courses",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: "notif-005",
      userId: "system",
      type: "warning",
      category: "certificate",
      title: "Tinjau rencana pengembangan",
      message: "Periksa kembali sasaran dan jadwal kegiatan PKB Anda.",
      link: "/app/learning-paths",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: "notif-006",
      userId: "system",
      type: "success",
      category: "assessment",
      title: "Kursus PKB selesai",
      message: "Pembelajaran selesai. Catatan kursus tidak menggantikan verifikasi atau penetapan Angka Kredit resmi.",
      link: "/app/courses",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
    },
  ]);

  console.log("[seed] Database seeded successfully.");
}
