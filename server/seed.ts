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
  users,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";
import {
  PUB_CLUSTERS,
  PUB_COURSES,
  PUB_LEARNING_PATHS,
  PUB_PARTICIPANTS,
  PUB_UNITS,
} from "./pub-catalog";

const LEGACY_FIXTURE_EMAILS: Record<string, string[]> = {
  "p-001": ["andi.pratama@org.go.id", "andi.pratama@example.id"],
  "p-002": ["budi.santoso@org.go.id", "budi.santoso@example.id"],
  "p-003": ["citra.dewi@org.go.id", "citra.dewi@example.id"],
  "p-004": ["dedi.kurniawan@org.go.id", "dedi.kurniawan@example.id"],
  "p-005": ["eka.putra@org.go.id", "eka.putra@example.id"],
};

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

      await tx.delete(participantCompetenciesTable)
        .where(eq(participantCompetenciesTable.participantId, participant.id));
      await tx.delete(evidencesTable)
        .where(eq(evidencesTable.participantId, participant.id));
      await tx.delete(learningRecordsTable)
        .where(eq(learningRecordsTable.participantId, participant.id));

      if (participant.competencies.length > 0) {
        await tx.insert(participantCompetenciesTable).values(
          participant.competencies.map((competency, index) => ({
            id: `pc-${participant.id}-${index + 1}`,
            participantId: participant.id,
            ...competency,
          })),
        );
      }

      if (participant.evidences.length > 0) {
        await tx.insert(evidencesTable).values(
          participant.evidences.map(evidence => ({
            participantId: participant.id,
            ...evidence,
          })),
        );
      }

      if (participant.learningHistory.length > 0) {
        await tx.insert(learningRecordsTable).values(
          participant.learningHistory.map(record => ({
            participantId: participant.id,
            ...record,
          })),
        );
      }
    });
  }
}

export async function seedDatabase() {
  // Ensure default admin user exists
  const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
  if (existingAdmin.length === 0) {
    const hashed = await hashPassword("admin123");
    await db.insert(users).values({ username: "admin", password: hashed });
    console.log("[seed] Default admin user created (username: admin, password: admin123)");
  }

  // Check if data already exists
  const existingClusters = await db.select().from(clustersTable).limit(1);
  if (existingClusters.length > 0) {
    await synchronizePubCatalog();
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

  // Participants
  await db.insert(participantsTable).values([
    { id: "p-001", nip: "BUJK-0001", name: "Andi Pratama", position: "Direktur Operasional", unit: "Manajemen BUJK", email: "andi.pratama@example.id" },
    { id: "p-002", nip: "BUJK-0002", name: "Budi Santoso", position: "Manajer Tender", unit: "Tender dan Komersial", email: "budi.santoso@example.id" },
    { id: "p-003", nip: "BUJK-0003", name: "Citra Dewi", position: "Penanggung Jawab Teknik", unit: "Sertifikasi dan Teknik", email: "citra.dewi@example.id" },
    { id: "p-004", nip: "BUJK-0004", name: "Dedi Kurniawan", position: "Kepala Proyek", unit: "Pelaksanaan Proyek", email: "dedi.kurniawan@example.id" },
    { id: "p-005", nip: "BUJK-0005", name: "Eka Putra", position: "Direktur Utama", unit: "Tata Kelola dan Kepatuhan", email: "eka.putra@example.id" },
  ]);

  // Participant competencies (relational)
  await db.insert(participantCompetenciesTable).values([
    // p-001
    { id: "pc-p001-1", participantId: "p-001", unitId: "legal-01", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-08-10", status: "gap" },
    { id: "pc-p001-2", participantId: "p-001", unitId: "tender-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-10", status: "gap" },
    { id: "pc-p001-3", participantId: "p-001", unitId: "smap-01", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2026-08-10", status: "achieved" },
    { id: "pc-p001-4", participantId: "p-001", unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-10", status: "on_track" },
    // p-002
    { id: "pc-p002-1", participantId: "p-002", unitId: "tender-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-08", status: "on_track" },
    { id: "pc-p002-2", participantId: "p-002", unitId: "tender-02", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-08-08", status: "gap" },
    { id: "pc-p002-3", participantId: "p-002", unitId: "legal-02", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2026-08-08", status: "achieved" },
    { id: "pc-p002-4", participantId: "p-002", unitId: "smap-02", currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-08-08", status: "gap" },
    // p-003
    { id: "pc-p003-1", participantId: "p-003", unitId: "sert-01", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2026-08-05", status: "achieved" },
    { id: "pc-p003-2", participantId: "p-003", unitId: "sert-02", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-05", status: "gap" },
    { id: "pc-p003-3", participantId: "p-003", unitId: "smap-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-05", status: "on_track" },
    { id: "pc-p003-4", participantId: "p-003", unitId: "pan-02", currentLevel: "L3", targetLevel: "L3", lastAssessed: "2026-08-05", status: "achieved" },
    // p-004
    { id: "pc-p004-1", participantId: "p-004", unitId: "proyek-01", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-12", status: "on_track" },
    { id: "pc-p004-2", participantId: "p-004", unitId: "proyek-02", currentLevel: "L1", targetLevel: "L3", lastAssessed: "2026-08-12", status: "gap" },
    { id: "pc-p004-3", participantId: "p-004", unitId: "pan-03", currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-12", status: "gap" },
    { id: "pc-p004-4", participantId: "p-004", unitId: "smap-01", currentLevel: "L2", targetLevel: "L2", lastAssessed: "2026-08-12", status: "achieved" },
    // p-005
    { id: "pc-p005-1", participantId: "p-005", unitId: "legal-01", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2026-08-01", status: "achieved" },
    { id: "pc-p005-2", participantId: "p-005", unitId: "tender-02", currentLevel: "L3", targetLevel: "L4", lastAssessed: "2026-08-01", status: "on_track" },
    { id: "pc-p005-3", participantId: "p-005", unitId: "proyek-01", currentLevel: "L3", targetLevel: "L4", lastAssessed: "2026-08-01", status: "on_track" },
    { id: "pc-p005-4", participantId: "p-005", unitId: "smap-04", currentLevel: "L4", targetLevel: "L4", lastAssessed: "2026-08-01", status: "achieved" },
  ]);

  // Evidences (relational)
  await db.insert(evidencesTable).values([
    { id: "ev-1", participantId: "p-002", unitId: "tender-01", type: "document", title: "Checklist Dokumen Tender", description: "Hasil review kelengkapan dan konsistensi dokumen kualifikasi", submittedAt: "2026-08-18", status: "approved", score: 85, feedback: "Dokumen lengkap dan risiko telah diidentifikasi" },
    { id: "ev-2", participantId: "p-003", unitId: "sert-02", type: "presentation", title: "Peta Kebutuhan SKK", description: "Pemetaan jabatan kerja dan kesenjangan SKK tenaga kerja konstruksi", submittedAt: "2026-08-15", status: "approved", score: 90, feedback: null },
    { id: "ev-3", participantId: "p-005", unitId: "smap-04", type: "document", title: "Laporan Evaluasi SMAP", description: "Evaluasi penerapan SMAP dan rencana tindak lanjut badan usaha", submittedAt: "2026-08-01", status: "approved", score: 95, feedback: null },
  ]);

  // Learning records (relational)
  await db.insert(learningRecordsTable).values([
    { id: "lr-1", participantId: "p-001", courseId: "course-legal01-l2", startedAt: "2026-08-15", progress: 60, status: "in_progress" },
    { id: "lr-2", participantId: "p-002", courseId: "course-tender01-l2", startedAt: "2026-08-12", completedAt: "2026-08-18", progress: 100, status: "completed" },
    { id: "lr-3", participantId: "p-004", courseId: "course-proyek01-l2", startedAt: "2026-08-14", progress: 80, status: "in_progress" },
  ]);

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
