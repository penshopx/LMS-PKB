/**
 * One-time migration: moves participant competencies, evidences, and learning history
 * from JSONB columns in the `participants` table into proper relational tables.
 * This is idempotent — it skips records that already exist in the target tables.
 */

import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  participantsTable,
  participantCompetenciesTable,
  evidencesTable,
  learningRecordsTable,
} from "@shared/schema";
import type { ParticipantCompetency, Evidence, LearningRecord } from "@shared/schema";

export async function migrateParticipantRelations(): Promise<void> {
  // Get all participants (reading the raw JSONB columns directly)
  const rows = await db.select().from(participantsTable);

  for (const row of rows) {
    const participantId = row.id;

    // --- Competencies ---
    const existingComps = await db
      .select({ id: participantCompetenciesTable.id })
      .from(participantCompetenciesTable)
      .where(eq(participantCompetenciesTable.participantId, participantId));

    if (existingComps.length === 0) {
      const competencies = (row.competencies ?? []) as ParticipantCompetency[];
      if (competencies.length > 0) {
        await db.insert(participantCompetenciesTable).values(
          competencies.map(c => ({
            id: `pc-${randomUUID()}`,
            participantId,
            unitId: c.unitId,
            currentLevel: c.currentLevel,
            targetLevel: c.targetLevel,
            lastAssessed: c.lastAssessed,
            status: c.status,
          }))
        );
      }
    }

    // --- Evidences ---
    const existingEvs = await db
      .select({ id: evidencesTable.id })
      .from(evidencesTable)
      .where(eq(evidencesTable.participantId, participantId));

    if (existingEvs.length === 0) {
      const evidences = (row.evidences ?? []) as Evidence[];
      if (evidences.length > 0) {
        await db.insert(evidencesTable).values(
          evidences.map(e => ({
            id: e.id,
            participantId,
            unitId: e.unitId,
            type: e.type,
            title: e.title,
            description: e.description,
            fileUrl: e.fileUrl ?? null,
            submittedAt: e.submittedAt,
            assessedAt: e.assessedAt ?? null,
            assessorId: e.assessorId ?? null,
            score: e.score ?? null,
            feedback: e.feedback ?? null,
            status: e.status,
          }))
        );
      }
    }

    // --- Learning History ---
    const existingLrs = await db
      .select({ id: learningRecordsTable.id })
      .from(learningRecordsTable)
      .where(eq(learningRecordsTable.participantId, participantId));

    if (existingLrs.length === 0) {
      const learningHistory = (row.learningHistory ?? []) as LearningRecord[];
      if (learningHistory.length > 0) {
        await db.insert(learningRecordsTable).values(
          learningHistory.map(lr => ({
            id: lr.id,
            participantId,
            courseId: lr.courseId,
            startedAt: lr.startedAt,
            completedAt: lr.completedAt ?? null,
            progress: lr.progress,
            status: lr.status,
          }))
        );
      }
    }
  }

  console.log(`[migration] Participant relations migration complete for ${rows.length} participants.`);
}
