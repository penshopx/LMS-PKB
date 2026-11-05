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
  clustersTable, unitsTable, coursesTable, evidencesTable, learningRecordsTable,
  participantCompetenciesTable, participantsTable, quizzesTable, users,
} from "@shared/schema";
import { DrizzleStorage } from "../db-storage";
import { eq, inArray } from "drizzle-orm";
import { PKB_PARTICIPANTS } from "../pkb-catalog";
import { PUB_CLUSTERS, PUB_COURSES, PUB_UNITS } from "../pub-catalog";
import { PKB_OVERVIEW_COURSE_ID, PKB_OVERVIEW_POSTTEST_ID, PKB_OVERVIEW_PRETEST_ID } from "@shared/pkb-course";

const storage = new DrizzleStorage();
const adminClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quotedSchemaName = `"${isolatedDatabase.schemaName}"`;
const seededTables = [
  "users", "clusters", "units", "courses", "quizzes", "participants",
  "learning_paths", "lsp_organizations", "schemes", "assessors", "notifications",
  "participant_competencies", "evidences", "learning_records",
];

describe("PKB seed and preserved archive", () => {
  beforeAll(async () => {
    await adminClient.connect();
    await adminClient.query(`CREATE SCHEMA ${quotedSchemaName}`);
    for (const tableName of seededTables) {
      await adminClient.query(`CREATE TABLE ${quotedSchemaName}."${tableName}" AS TABLE public."${tableName}" WITH NO DATA`);
      await adminClient.query(`ALTER TABLE ${quotedSchemaName}."${tableName}" ADD PRIMARY KEY (id)`);
    }
    await adminClient.query(`ALTER TABLE ${quotedSchemaName}.users ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
    // Keep the actual cyclic FK ordering requirement in the fresh-seed test.
    await adminClient.query(`ALTER TABLE ${quotedSchemaName}.quizzes ADD FOREIGN KEY (course_id) REFERENCES ${quotedSchemaName}.courses(id)`);
    await adminClient.query(`ALTER TABLE ${quotedSchemaName}.courses ADD FOREIGN KEY (pre_test_id) REFERENCES ${quotedSchemaName}.quizzes(id), ADD FOREIGN KEY (post_test_id) REFERENCES ${quotedSchemaName}.quizzes(id)`);
  });
  afterAll(async () => {
    await adminClient.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
    await adminClient.end();
  });

  it("seeds only the new curriculum, then binds quizzes and relational participant data", async () => {
    await seedDatabase();
    expect(await db.select().from(users)).toEqual([]);
    expect(await storage.getCourse("course-tender01-l2")).toBeUndefined();
    const course = await storage.getCourse(PKB_OVERVIEW_COURSE_ID);
    expect(course?.lessons).toHaveLength(6);
    expect(course?.preTestId).toBe(PKB_OVERVIEW_PRETEST_ID);
    expect(course?.postTestId).toBe(PKB_OVERVIEW_POSTTEST_ID);
    expect((await db.select().from(quizzesTable)).map(quiz => quiz.id).sort()).toEqual([PKB_OVERVIEW_POSTTEST_ID, PKB_OVERVIEW_PRETEST_ID].sort());
    for (const expected of PKB_PARTICIPANTS) {
      const actual = await storage.getParticipant(expected.id);
      expect(actual).toMatchObject({ name: expected.name, competencies: expected.competencies, learningHistory: expected.learningHistory });
    }
    expect((await storage.getParticipant(PKB_PARTICIPANTS[0].id))?.evidences[0]).toMatchObject({ unitId: "pkb-short-course", status: "approved" });
  });

  it("restores missing PKB demo relations without duplicate records", async () => {
    const ids = PKB_PARTICIPANTS.map(participant => participant.id);
    await db.delete(participantCompetenciesTable).where(inArray(participantCompetenciesTable.participantId, ids));
    await db.delete(evidencesTable).where(inArray(evidencesTable.participantId, ids));
    await db.delete(learningRecordsTable).where(inArray(learningRecordsTable.participantId, ids));
    await seedDatabase();
    await seedDatabase();
    expect(await db.select().from(participantsTable)).toHaveLength(PKB_PARTICIPANTS.length);
    expect(await db.select().from(participantCompetenciesTable)).toHaveLength(PKB_PARTICIPANTS.reduce((total, participant) => total + participant.competencies.length, 0));
    expect(await db.select().from(learningRecordsTable)).toHaveLength(PKB_PARTICIPANTS.reduce((total, participant) => total + participant.learningHistory.length, 0));
    expect(await db.select().from(evidencesTable)).toHaveLength(1);
  });

  it("preserves legacy curriculum, identity, and history unchanged while hiding it from the active catalog", async () => {
    const legacyCourse = PUB_COURSES[0];
    const legacyUnit = PUB_UNITS.find(unit => unit.id === legacyCourse.unitId)!;
    const legacyCluster = PUB_CLUSTERS.find(cluster => cluster.id === legacyUnit.clusterId)!;
    await db.insert(clustersTable).values(legacyCluster);
    await db.insert(unitsTable).values(legacyUnit);
    await db.insert(coursesTable).values({ ...legacyCourse, preTestId: null, postTestId: null });
    await db.insert(participantsTable).values({ id: "legacy-participant", name: "Peserta Arsip", nip: "ARCHIVE", position: "Riwayat", unit: "Kurikulum lama", email: "archive@example.invalid" });
    await db.insert(learningRecordsTable).values({ id: "legacy-record", participantId: "legacy-participant", courseId: legacyCourse.id, startedAt: "2025-01-01", completedAt: "2025-01-03", progress: 100, status: "completed" });
    const beforeCourse = await storage.getCourse(legacyCourse.id);
    const beforeParticipant = await storage.getParticipant("legacy-participant");
    await seedDatabase();
    expect(await storage.getCourse(legacyCourse.id)).toEqual(beforeCourse);
    expect(await storage.getParticipant("legacy-participant")).toEqual(beforeParticipant);
    expect((await storage.getCourses()).some(course => course.id === legacyCourse.id)).toBe(false);
    expect((await storage.getCourses(true)).find(course => course.id === legacyCourse.id)?.archived).toBe(true);
  });

  it("does not restore quiz defaults an administrator deliberately cleared", async () => {
    await db.update(coursesTable).set({ preTestId: null, postTestId: null }).where(eq(coursesTable.id, PKB_OVERVIEW_COURSE_ID));
    await seedDatabase();
    expect(await storage.getCourse(PKB_OVERVIEW_COURSE_ID)).toMatchObject({ preTestId: undefined, postTestId: undefined });
  });
});
