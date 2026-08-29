import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import pg from "pg";
import { db } from "../db";
import { DrizzleStorage } from "../db-storage";
import { seedDatabase } from "../seed";
import {
  clustersTable,
  coursesTable,
  evidencesTable,
  learningRecordsTable,
  participantCompetenciesTable,
  participantsTable,
  unitsTable,
  type ParticipantCompetency,
} from "@shared/schema";

const storage = new DrizzleStorage();
const tag = randomUUID().slice(0, 8);
const clusterId = `rel-cluster-${tag}`;
const unitIds = Array.from({ length: 5 }, (_, index) => `rel-unit-${tag}-${index + 1}`);
const courseId = `rel-course-${tag}`;
const participantIds: string[] = [];

async function createParticipant(label: string): Promise<string> {
  const participant = await storage.createParticipant({
    nip: `REL-${tag}-${label}`,
    name: `Participant Relations ${label}`,
    position: "Tester",
    unit: "Quality Assurance",
    email: `relations-${tag}-${label}@test.invalid`,
  });
  participantIds.push(participant.id);
  return participant.id;
}

async function relationCounts(participantId: string) {
  const [competencies, evidences, learningRecords] = await Promise.all([
    db.select().from(participantCompetenciesTable)
      .where(eq(participantCompetenciesTable.participantId, participantId)),
    db.select().from(evidencesTable)
      .where(eq(evidencesTable.participantId, participantId)),
    db.select().from(learningRecordsTable)
      .where(eq(learningRecordsTable.participantId, participantId)),
  ]);
  return {
    competencies: competencies.length,
    evidences: evidences.length,
    learningRecords: learningRecords.length,
  };
}

describe("participant relational persistence", () => {
  beforeAll(async () => {
    await db.insert(clustersTable).values({
      id: clusterId,
      code: `REL${tag}`.slice(0, 20),
      name: "Participant Relations Test",
      fullName: "Participant Relations Integration Test",
      description: "Isolated relational participant fixtures",
      color: "#000000",
    });

    await db.insert(unitsTable).values(unitIds.map((id, index) => ({
      id,
      clusterId,
      code: `REL-${index + 1}`,
      name: `Relations unit ${index + 1}`,
      description: "Participant relations integration fixture",
      indicators: [],
    })));

    await db.insert(coursesTable).values({
      id: courseId,
      unitId: unitIds[0],
      targetLevel: "L2",
      title: "Participant Relations Course",
      description: "Participant relations integration fixture",
      duration: "1 jam",
      lessons: [],
      preTestId: null,
      postTestId: null,
      createdAt: "2026-08-29",
    });
  });

  afterAll(async () => {
    if (participantIds.length > 0) {
      await db.delete(participantsTable).where(inArray(participantsTable.id, participantIds));
    }
    await db.delete(coursesTable).where(eq(coursesTable.id, courseId));
    await db.delete(unitsTable).where(inArray(unitsTable.id, unitIds));
    await db.delete(clustersTable).where(eq(clustersTable.id, clusterId));
  });

  it("getParticipant reads competencies, evidences, and learning history from relational tables", async () => {
    const participantId = await createParticipant("read");
    await Promise.all([
      db.insert(participantCompetenciesTable).values({
        id: `rel-pc-${tag}`,
        participantId,
        unitId: unitIds[0],
        currentLevel: "L2",
        targetLevel: "L3",
        lastAssessed: "2026-08-20",
        status: "gap",
      }),
      db.insert(evidencesTable).values({
        id: `rel-ev-${tag}`,
        participantId,
        unitId: unitIds[0],
        type: "document",
        title: "Relational evidence",
        description: "Stored directly in evidences",
        fileUrl: "/evidence.pdf",
        submittedAt: "2026-08-21",
        assessedAt: null,
        assessorId: null,
        score: null,
        feedback: null,
        status: "pending",
      }),
      db.insert(learningRecordsTable).values({
        id: `rel-lr-${tag}`,
        participantId,
        courseId,
        startedAt: "2026-08-22",
        completedAt: null,
        progress: 45,
        status: "in_progress",
      }),
    ]);

    const participant = await storage.getParticipant(participantId);
    const listedParticipant = (await storage.getParticipants())
      .find(item => item.id === participantId);

    expect(participant?.competencies).toEqual([{
      unitId: unitIds[0],
      currentLevel: "L2",
      targetLevel: "L3",
      lastAssessed: "2026-08-20",
      status: "gap",
    }]);
    expect(participant?.evidences).toEqual([{
      id: `rel-ev-${tag}`,
      unitId: unitIds[0],
      type: "document",
      title: "Relational evidence",
      description: "Stored directly in evidences",
      fileUrl: "/evidence.pdf",
      submittedAt: "2026-08-21",
      status: "pending",
    }]);
    expect(participant?.learningHistory).toEqual([{
      id: `rel-lr-${tag}`,
      courseId,
      startedAt: "2026-08-22",
      progress: 45,
      status: "in_progress",
    }]);
    expect(listedParticipant).toEqual(participant);
  });

  it("updateParticipantCompetencies keeps one complete payload under concurrent replacements", async () => {
    const participantId = await createParticipant("concurrent");
    const first: ParticipantCompetency[] = [
      { unitId: unitIds[0], currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-08-23", status: "gap" },
      { unitId: unitIds[1], currentLevel: "L2", targetLevel: "L3", lastAssessed: "2026-08-23", status: "on_track" },
    ];
    const second: ParticipantCompetency[] = [
      { unitId: unitIds[2], currentLevel: "L3", targetLevel: "L3", lastAssessed: "2026-08-24", status: "achieved" },
      { unitId: unitIds[3], currentLevel: "L1", targetLevel: "L4", lastAssessed: "2026-08-24", status: "gap" },
      { unitId: unitIds[4], currentLevel: "L2", targetLevel: "L4", lastAssessed: "2026-08-24", status: "on_track" },
    ];

    const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const originalTransaction = db.transaction.bind(db);
    let transactionsReady!: () => void;
    let releaseTransactions!: () => void;
    let callbacksStarted!: () => void;
    let readyCount = 0;
    let callbackCount = 0;
    const bothTransactionsReady = new Promise<void>(resolve => { transactionsReady = resolve; });
    const transactionGate = new Promise<void>(resolve => { releaseTransactions = resolve; });
    const bothCallbacksStarted = new Promise<void>(resolve => { callbacksStarted = resolve; });
    const transactionSpy = vi.spyOn(db, "transaction").mockImplementation((
      callback: Parameters<typeof db.transaction>[0],
      config?: Parameters<typeof db.transaction>[1],
    ) => originalTransaction(async (tx) => {
      readyCount += 1;
      if (readyCount === 2) transactionsReady();
      await transactionGate;

      // Calling (without awaiting) runs the storage callback through its first
      // database await, so both SELECT ... FOR UPDATE statements are in flight.
      const result = callback(tx);
      callbackCount += 1;
      if (callbackCount === 2) callbacksStarted();
      return result;
    }, config));

    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM participants WHERE id = $1 FOR UPDATE", [participantId]);

      const firstUpdate = storage.updateParticipantCompetencies(participantId, first);
      const secondUpdate = storage.updateParticipantCompetencies(participantId, second);
      await bothTransactionsReady;
      releaseTransactions();
      await bothCallbacksStarted;
      await blocker.query("COMMIT");

      const [firstResult, secondResult] = await Promise.all([firstUpdate, secondUpdate]);
      expect(firstResult?.competencies).toEqual(first);
      expect(secondResult?.competencies).toEqual(second);
    } finally {
      transactionSpy.mockRestore();
      releaseTransactions();
      await blocker.query("ROLLBACK").catch(() => undefined);
      await blocker.end();
    }

    const stored = await storage.getParticipant(participantId);
    expect([first, second]).toContainEqual(stored?.competencies);
  });

  it("updateParticipantCompetencies rolls back the whole replacement when an insert fails", async () => {
    const participantId = await createParticipant("rollback");
    const original: ParticipantCompetency[] = [
      { unitId: unitIds[0], currentLevel: "L1", targetLevel: "L2", lastAssessed: "2026-08-25", status: "gap" },
      { unitId: unitIds[1], currentLevel: "L2", targetLevel: "L2", lastAssessed: "2026-08-25", status: "achieved" },
    ];
    await storage.updateParticipantCompetencies(participantId, original);

    await expect(storage.updateParticipantCompetencies(participantId, [
      original[0],
      { ...original[1], unitId: `missing-unit-${tag}` },
    ])).rejects.toThrow();

    expect((await storage.getParticipant(participantId))?.competencies).toEqual(original);
  });

  it("addEvidence inserts a row that appears in the next participant read", async () => {
    const participantId = await createParticipant("add-evidence");
    const evidence = await storage.addEvidence(participantId, {
      unitId: unitIds[0],
      type: "reflection",
      title: "Reflection evidence",
      description: "Created through storage",
    });

    const participant = await storage.getParticipant(participantId);
    expect(participant?.evidences).toContainEqual(evidence);
    expect((await relationCounts(participantId)).evidences).toBe(1);
  });

  it("updateEvidenceStatus persists status, score, feedback, and assessment date", async () => {
    const participantId = await createParticipant("update-evidence");
    const evidence = await storage.addEvidence(participantId, {
      unitId: unitIds[0],
      type: "presentation",
      title: "Presentation evidence",
      description: "Ready for assessment",
    });

    await storage.updateEvidenceStatus(participantId, evidence.id, "approved", 94, "Meets every indicator");

    const stored = (await storage.getParticipant(participantId))?.evidences
      .find(item => item.id === evidence.id);
    expect(stored).toMatchObject({
      status: "approved",
      score: 94,
      feedback: "Meets every indicator",
    });
    expect(stored?.assessedAt).toBeTruthy();
  });

  it("deleteParticipant removes all three relational collections", async () => {
    const participantId = await createParticipant("delete");
    await Promise.all([
      storage.updateParticipantCompetencies(participantId, [{
        unitId: unitIds[0],
        currentLevel: "L1",
        targetLevel: "L2",
        lastAssessed: "2026-08-26",
        status: "gap",
      }]),
      storage.addEvidence(participantId, {
        unitId: unitIds[0],
        type: "video",
        title: "Delete evidence",
        description: "Must be deleted with participant",
      }),
      db.insert(learningRecordsTable).values({
        id: `rel-delete-lr-${tag}`,
        participantId,
        courseId,
        startedAt: "2026-08-26",
        completedAt: null,
        progress: 10,
        status: "in_progress",
      }),
    ]);
    expect(await relationCounts(participantId)).toEqual({
      competencies: 1,
      evidences: 1,
      learningRecords: 1,
    });

    expect(await storage.deleteParticipant(participantId)).toBe(true);
    expect(await storage.getParticipant(participantId)).toBeUndefined();
    expect(await relationCounts(participantId)).toEqual({
      competencies: 0,
      evidences: 0,
      learningRecords: 0,
    });
  });

  it("seed synchronization preserves participant evidence", async () => {
    const evidenceId = `rel-seed-preserve-${tag}`;
    const [originalParticipant] = await db.select()
      .from(participantsTable)
      .where(eq(participantsTable.id, "p-001"));
    expect(originalParticipant).toBeDefined();

    await db.update(participantsTable)
      .set({ email: "andi.pratama@org.go.id" })
      .where(eq(participantsTable.id, "p-001"));

    await db.insert(evidencesTable).values({
      id: evidenceId,
      participantId: "p-001",
      unitId: "smap-01",
      type: "document",
      title: "Evidence added after onboarding",
      description: "Must survive the next startup seed synchronization",
      submittedAt: "2026-08-29",
      status: "pending",
    });

    try {
      await seedDatabase();

      const [preservedEvidence] = await db.select()
        .from(evidencesTable)
        .where(eq(evidencesTable.id, evidenceId));
      expect(preservedEvidence).toMatchObject({
        participantId: "p-001",
        title: "Evidence added after onboarding",
      });

      const [migratedParticipant] = await db.select()
        .from(participantsTable)
        .where(eq(participantsTable.id, "p-001"));
      expect(migratedParticipant.email).toBe("andi.pratama@example.id");
    } finally {
      await db.delete(evidencesTable).where(eq(evidencesTable.id, evidenceId));
      await db.update(participantsTable).set({
        nip: originalParticipant.nip,
        name: originalParticipant.name,
        position: originalParticipant.position,
        unit: originalParticipant.unit,
        email: originalParticipant.email,
      }).where(eq(participantsTable.id, originalParticipant.id));
    }
  });
});