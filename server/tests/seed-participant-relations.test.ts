import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import pg from "pg";

const isolatedDatabase = vi.hoisted(() => ({
  schemaName: `seed_participant_relations_${Math.random().toString(36).slice(2)}`,
}));

vi.mock("../db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { default: pgModule } = await import("pg");
  const schema = await import("@shared/schema");
  const pool = new pgModule.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${isolatedDatabase.schemaName}`,
  });

  return { db: drizzle(pool, { schema }) };
});

import { db } from "../db";
import { seedDatabase } from "../seed";
import {
  evidencesTable,
  learningRecordsTable,
  participantCompetenciesTable,
  participantsTable,
  quizzesTable,
} from "@shared/schema";
import { DrizzleStorage } from "../db-storage";
import { inArray } from "drizzle-orm";

const storage = new DrizzleStorage();
const adminClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quotedSchemaName = `"${isolatedDatabase.schemaName}"`;

const seededTables = [
  "users",
  "clusters",
  "units",
  "courses",
  "quizzes",
  "participants",
  "learning_paths",
  "lsp_organizations",
  "schemes",
  "assessors",
  "notifications",
  "participant_competencies",
  "evidences",
  "learning_records",
];

describe("fresh seed participant relations", () => {
  beforeAll(async () => {
    await adminClient.connect();
    await adminClient.query(`CREATE SCHEMA ${quotedSchemaName}`);

    for (const tableName of seededTables) {
      await adminClient.query(
        `CREATE TABLE ${quotedSchemaName}."${tableName}" AS TABLE public."${tableName}" WITH NO DATA`,
      );
      await adminClient.query(
        `ALTER TABLE ${quotedSchemaName}."${tableName}" ADD PRIMARY KEY (id)`,
      );
    }
    await adminClient.query(
      `ALTER TABLE ${quotedSchemaName}.users ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
    );
  });

  afterAll(async () => {
    await adminClient.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
    await adminClient.end();
  });

  it("seeds relational participant data that getParticipant exposes", async () => {
    expect(await db.select().from(participantsTable)).toEqual([]);
    await seedDatabase();

    const tenderCourse = await storage.getCourse("course-tender01-l2");
    expect(tenderCourse?.lessons.map(lesson => lesson.title)).toEqual([
      "Orientasi: Peta Proses Tender",
      "Telaah Peluang dan Keputusan Go/No-Go",
      "Pemeriksaan Kualifikasi dan Dokumen Administrasi",
      "Pemetaan Persyaratan Teknis ke Bukti",
      "Jadwal Persiapan, Rekap, dan Risiko",
      "Simulasi Akhir dan Rencana Perbaikan",
    ]);
    const tenderQuizzes = await db.select().from(quizzesTable);
    expect(tenderQuizzes.map(quiz => quiz.id).sort()).toEqual([
      "quiz-tender01-posttest",
      "quiz-tender01-pretest",
    ]);

    const p001 = await storage.getParticipant("p-001");
    expect(p001).toMatchObject({
      id: "p-001",
      name: "Andi Pratama",
    });
    expect(p001?.competencies).toEqual([
      {
        unitId: "legal-01",
        currentLevel: "L1",
        targetLevel: "L2",
        lastAssessed: "2026-08-10",
        status: "gap",
      },
      {
        unitId: "tender-01",
        currentLevel: "L2",
        targetLevel: "L3",
        lastAssessed: "2026-08-10",
        status: "gap",
      },
      {
        unitId: "smap-01",
        currentLevel: "L2",
        targetLevel: "L2",
        lastAssessed: "2026-08-10",
        status: "achieved",
      },
      {
        unitId: "pan-03",
        currentLevel: "L2",
        targetLevel: "L3",
        lastAssessed: "2026-08-10",
        status: "on_track",
      },
    ]);
    expect(p001?.evidences).toEqual([]);
    expect(p001?.learningHistory).toEqual([
      {
        id: "lr-1",
        courseId: "course-legal01-l2",
        startedAt: "2026-08-15",
        progress: 60,
        status: "in_progress",
      },
    ]);

    const p002 = await storage.getParticipant("p-002");
    expect(p002).toMatchObject({
      id: "p-002",
      name: "Budi Santoso",
    });
    expect(p002?.competencies).toEqual([
      {
        unitId: "tender-01",
        currentLevel: "L2",
        targetLevel: "L3",
        lastAssessed: "2026-08-08",
        status: "on_track",
      },
      {
        unitId: "tender-02",
        currentLevel: "L1",
        targetLevel: "L2",
        lastAssessed: "2026-08-08",
        status: "gap",
      },
      {
        unitId: "legal-02",
        currentLevel: "L2",
        targetLevel: "L2",
        lastAssessed: "2026-08-08",
        status: "achieved",
      },
      {
        unitId: "smap-02",
        currentLevel: "L1",
        targetLevel: "L2",
        lastAssessed: "2026-08-08",
        status: "gap",
      },
    ]);
    expect(p002?.evidences).toEqual([
      {
        id: "ev-1",
        unitId: "tender-01",
        type: "document",
        title: "Checklist Dokumen Tender",
        description: "Hasil review kelengkapan dan konsistensi dokumen kualifikasi",
        submittedAt: "2026-08-18",
        score: 85,
        feedback: "Dokumen lengkap dan risiko telah diidentifikasi",
        status: "approved",
      },
    ]);
    expect(p002?.learningHistory).toEqual([
      {
        id: "lr-2",
        courseId: "course-tender01-l2",
        startedAt: "2026-08-12",
        completedAt: "2026-08-18",
        progress: 100,
        status: "completed",
      },
    ]);
  });

  it("restores missing p-001 and p-002 relations when catalog data already exists", async () => {
    await db.delete(participantCompetenciesTable)
      .where(inArray(participantCompetenciesTable.participantId, ["p-001", "p-002"]));
    await db.delete(evidencesTable)
      .where(inArray(evidencesTable.participantId, ["p-001", "p-002"]));
    await db.delete(learningRecordsTable)
      .where(inArray(learningRecordsTable.participantId, ["p-001", "p-002"]));

    expect(await db.select().from(participantsTable)).toHaveLength(5);
    expect(await db.select().from(participantCompetenciesTable)
      .where(inArray(participantCompetenciesTable.participantId, ["p-001", "p-002"]))).toEqual([]);

    await seedDatabase();

    const p001 = await storage.getParticipant("p-001");
    expect(p001?.competencies).toHaveLength(4);
    expect(p001?.evidences).toEqual([]);
    expect(p001?.learningHistory).toEqual([
      {
        id: "lr-1",
        courseId: "course-legal01-l2",
        startedAt: "2026-08-15",
        progress: 60,
        status: "in_progress",
      },
    ]);

    const p002 = await storage.getParticipant("p-002");
    expect(p002?.competencies).toHaveLength(4);
    expect(p002?.evidences).toEqual([
      {
        id: "ev-1",
        unitId: "tender-01",
        type: "document",
        title: "Checklist Dokumen Tender",
        description: "Hasil review kelengkapan dan konsistensi dokumen kualifikasi",
        submittedAt: "2026-08-18",
        score: 85,
        feedback: "Dokumen lengkap dan risiko telah diidentifikasi",
        status: "approved",
      },
    ]);
    expect(p002?.learningHistory).toEqual([
      {
        id: "lr-2",
        courseId: "course-tender01-l2",
        startedAt: "2026-08-12",
        completedAt: "2026-08-18",
        progress: 100,
        status: "completed",
      },
    ]);
  });
});