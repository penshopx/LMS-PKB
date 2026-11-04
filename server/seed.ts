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
  participantCompetenciesTable,
  evidencesTable,
  learningRecordsTable,
  assessorsTable,
  schemesTable,
  learningPathsTable,
  lspOrganizationsTable,
  notificationsTable,
  quizzesTable,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  PUB_CLUSTERS,
  PUB_COURSES,
  PUB_LEARNING_PATHS,
  PUB_PARTICIPANTS,
  PUB_UNITS,
} from "./pub-catalog";
import { PUB_QUIZZES } from "../shared/siap-tender-course";
import { catalogLessonsPreservingReferences } from "./catalog-reference-sync";

const LEGACY_FIXTURE_EMAILS: Record<string, string[]> = {
  "p-001": ["andi.pratama@org.go.id"],
  "p-002": ["budi.santoso@org.go.id"],
  "p-003": ["citra.dewi@org.go.id"],
  "p-004": ["dedi.kurniawan@org.go.id"],
  "p-005": ["eka.putra@org.go.id"],
};

const PARTICIPANT_COMPETENCY_SEED_ROWS = PUB_PARTICIPANTS.flatMap(participant =>
  participant.competencies.map((competency, index) => ({
    id: `pc-${participant.id.replace("-", "")}-${index + 1}`,
    participantId: participant.id,
    ...competency,
  })),
);

const EVIDENCE_SEED_ROWS = [
  { id: "ev-1", participantId: "p-002", unitId: "tender-01", type: "document", title: "Checklist Dokumen Tender", description: "Hasil review kelengkapan dan konsistensi dokumen kualifikasi", submittedAt: "2026-08-18", status: "approved", score: 85, feedback: "Dokumen lengkap dan risiko telah diidentifikasi" },
  { id: "ev-2", participantId: "p-003", unitId: "sert-02", type: "presentation", title: "Peta Kebutuhan SKK", description: "Pemetaan jabatan kerja dan kesenjangan SKK tenaga kerja konstruksi", submittedAt: "2026-08-15", status: "approved", score: 90, feedback: null },
  { id: "ev-3", participantId: "p-005", unitId: "smap-04", type: "document", title: "Laporan Evaluasi SMAP", description: "Evaluasi penerapan SMAP dan rencana tindak lanjut badan usaha", submittedAt: "2026-08-01", status: "approved", score: 95, feedback: null },
] satisfies (typeof evidencesTable.$inferInsert)[];

const LEARNING_RECORD_SEED_ROWS = PUB_PARTICIPANTS.flatMap(participant =>
  participant.learningHistory.map(record => ({
    participantId: participant.id,
    ...record,
  })),
);

async function synchronizePubCatalog() {
  for (const cluster of PUB_CLUSTERS) {
    const { id: _id, ...updates } = cluster;
    await db.insert(clustersTable).values(cluster).onConflictDoUpdate({
      target: clustersTable.id,
      set: updates,
    });
  }

  for (const unit of PUB_UNITS) {
    const { id: _id, ...updates } = unit;
    await db.insert(unitsTable).values(unit).onConflictDoUpdate({
      target: unitsTable.id,
      set: updates,
    });
  }

  for (const course of PUB_COURSES) {
    const row = {
      ...course,
      preTestId: course.preTestId ?? null,
      postTestId: course.postTestId ?? null,
    };
    const {
      id: _id,
      preTestId: _preTestId,
      postTestId: _postTestId,
      ...updates
    } = row;
    await db.insert(coursesTable).values(row).onConflictDoUpdate({
      target: coursesTable.id,
      set: { ...updates, lessons: catalogLessonsPreservingReferences(course.lessons) },
    });
  }

  for (const quiz of PUB_QUIZZES) {
    const row = {
      ...quiz,
      lessonId: quiz.lessonId ?? null,
      timeLimit: quiz.timeLimit ?? null,
      shuffleQuestions: quiz.shuffleQuestions ? 1 : 0,
      showResults: quiz.showResults ? 1 : 0,
    };
    const { id: _id, ...updates } = row;
    await db.insert(quizzesTable).values(row).onConflictDoUpdate({
      target: quizzesTable.id,
      set: updates,
    });
  }

  for (const path of PUB_LEARNING_PATHS) {
    const row = { ...path, isPublished: path.isPublished ? 1 : 0 };
    const { id: _id, ...updates } = row;
    await db.insert(learningPathsTable).values(row).onConflictDoUpdate({
      target: learningPathsTable.id,
      set: updates,
    });
  }

  const existingParticipants = await db.select({
    id: participantsTable.id,
    email: participantsTable.email,
  }).from(participantsTable);
  const existingById = new Map(existingParticipants.map(participant => [participant.id, participant]));

  for (const participant of PUB_PARTICIPANTS) {
    const existing = existingById.get(participant.id);
    if (!existing || !LEGACY_FIXTURE_EMAILS[participant.id]?.includes(existing.email)) {
      continue;
    }

    await db.transaction(async tx => {
      await tx.update(participantsTable).set({
        nip: participant.nip,
        name: participant.name,
        position: participant.position,
        unit: participant.unit,
        email: participant.email,
      }).where(eq(participantsTable.id, participant.id));
    });
  }
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
    await synchronizePubCatalog();
    const existingParticipants = await db.select({
      id: participantsTable.id,
    }).from(participantsTable);
    await synchronizeParticipantRelations(
      new Set(existingParticipants.map(participant => participant.id)),
    );
    console.log("[seed] PUB-ASPEKINDO baseline catalog synchronized.");
    return;
  }

  console.log("[seed] Seeding database with initial data...");

  await db.insert(clustersTable).values(PUB_CLUSTERS);
  await db.insert(unitsTable).values(PUB_UNITS);
  await db.insert(coursesTable).values(PUB_COURSES.map(course => ({
    ...course,
    preTestId: course.preTestId ?? null,
    postTestId: course.postTestId ?? null,
  })));
  await db.insert(quizzesTable).values(PUB_QUIZZES.map(quiz => ({
    ...quiz,
    lessonId: quiz.lessonId ?? null,
    timeLimit: quiz.timeLimit ?? null,
    shuffleQuestions: quiz.shuffleQuestions ? 1 : 0,
    showResults: quiz.showResults ? 1 : 0,
  })));

  // Participants
  await db.insert(participantsTable).values([
    { id: "p-001", nip: "BUJK-0001", name: "Andi Pratama", position: "Direktur Operasional", unit: "Manajemen BUJK", email: "andi.pratama@example.id" },
    { id: "p-002", nip: "BUJK-0002", name: "Budi Santoso", position: "Manajer Tender", unit: "Tender dan Komersial", email: "budi.santoso@example.id" },
    { id: "p-003", nip: "BUJK-0003", name: "Citra Dewi", position: "Penanggung Jawab Teknik", unit: "Sertifikasi dan Teknik", email: "citra.dewi@example.id" },
    { id: "p-004", nip: "BUJK-0004", name: "Dedi Kurniawan", position: "Kepala Proyek", unit: "Pelaksanaan Proyek", email: "dedi.kurniawan@example.id" },
    { id: "p-005", nip: "BUJK-0005", name: "Eka Putra", position: "Direktur Utama", unit: "Tata Kelola dan Kepatuhan", email: "eka.putra@example.id" },
  ]);

  // Participant competencies (relational)
  await db.insert(participantCompetenciesTable).values(PARTICIPANT_COMPETENCY_SEED_ROWS);

  // Evidences (relational)
  await db.insert(evidencesTable).values(EVIDENCE_SEED_ROWS);

  // Learning records (relational)
  await db.insert(learningRecordsTable).values(LEARNING_RECORD_SEED_ROWS);

  // LSP Organization
  await db.insert(lspOrganizationsTable).values([
    {
      id: "lsp-001",
      name: "LSP Konstruksi Indonesia",
      licenseNumber: "BNSP-LSP-KONSTRUKSI-001",
      address: "Jakarta, Indonesia",
      phone: "+62-21-12345678",
      email: "info@example.id",
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
      code: "SKK-PROYEK-01",
      name: "Skema Manajemen Pelaksanaan Proyek Konstruksi",
      description: "Sertifikasi kompetensi untuk pengelolaan administrasi kontrak, kinerja, mutu, dan keselamatan proyek konstruksi",
      skkniCode: "SKKNI-KONSTRUKSI",
      unitIds: ["proyek-01", "proyek-02", "pan-03", "smap-01"],
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
      email: "ahmad.wijaya@example.id",
      phone: "+62-812-3456789",
      lspId: "lsp-001",
      competencySchemes: ["scheme-001"],
      specializations: ["Manajemen Proyek Konstruksi", "Administrasi Kontrak", "Keselamatan Konstruksi"],
      status: "active",
      validUntil: "2026-12-31",
      totalAssessments: 45,
      createdAt: "2024-01-15",
    },
  ]);

  // Learning Paths
  await db.insert(learningPathsTable).values(
    PUB_LEARNING_PATHS.map(path => ({
      ...path,
      isPublished: path.isPublished ? 1 : 0,
    })),
  );

  // Notifications
  const now = Date.now();
  await db.insert(notificationsTable).values([
    {
      id: "notif-001",
      userId: "system",
      type: "warning",
      category: "assessment",
      title: "Gap Kompetensi Terdeteksi",
      message: "Terdapat gap kompetensi pada SIAP Proyek. Jadwalkan pembelajaran pengendalian proyek dan keselamatan konstruksi.",
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
      message: "Sertifikat kompetensi konstruksi berhasil diterbitkan untuk peserta yang telah menyelesaikan asesmen.",
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
      message: "Kursus 'SIAP Tender: Kualifikasi dan Dokumen Pemilihan' telah dipublikasikan dan siap diakses peserta.",
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
      message: "Asesi dinyatakan KOMPETEN pada skema manajemen pelaksanaan proyek konstruksi. Sertifikat dapat diterbitkan.",
      link: "/app/assessment",
      isRead: 1,
      createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
    },
  ]);

  console.log("[seed] Database seeded successfully.");
}
