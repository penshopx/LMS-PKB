import type { Express, RequestHandler } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
import {
  coursesTable, enrollmentsTable, participantsTable, practiceMissionsTable,
  missionSubmissionsTable, type User,
} from "@shared/schema";
import { missionInputSchema, missionReviewSchema, missionSubmissionSchema } from "@shared/practice-missions";

class MissionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function handle(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.issues.map(issue => issue.message).join(" "), errors: error.issues });
      } else if (error instanceof MissionError) {
        res.status(error.status).json({ message: error.message });
      } else {
        // Do not log submitted evidence or private reflections.
        console.error("[practice-missions] Request failed:", error instanceof Error ? error.name : "Unknown error");
        res.status(500).json({ message: "Misi praktik gagal diproses. Silakan coba kembali." });
      }
    }
  };
}

function participantScope(user: User) {
  if (user.role === "admin") return sql`true`;
  if (user.role === "participant") return eq(participantsTable.id, user.participantId ?? "");
  return user.bujkId ? eq(participantsTable.bujkId, user.bujkId) : sql`false`;
}

/** Called only after the application's authentication and role boundary middleware. */
export function registerPracticeMissionRoutes(app: Express) {
  app.get("/api/practice-missions", handle(async (req, res) => {
    const user = req.user as User;
    let scope = sql`true`;
    if (user.role === "participant") {
      scope = sql`${practiceMissionsTable.active} = true AND EXISTS (
        SELECT 1 FROM ${enrollmentsTable}
        WHERE ${enrollmentsTable.courseId} = ${practiceMissionsTable.courseId}
          AND ${enrollmentsTable.participantId} = ${user.participantId ?? ""}
      )`;
    } else if (user.role === "bujk_pic") {
      scope = user.bujkId ? sql`${practiceMissionsTable.active} = true AND EXISTS (
        SELECT 1 FROM ${enrollmentsTable}
        JOIN ${participantsTable} ON ${participantsTable.id} = ${enrollmentsTable.participantId}
        WHERE ${enrollmentsTable.courseId} = ${practiceMissionsTable.courseId}
          AND ${participantsTable.bujkId} = ${user.bujkId}
      )` : sql`false`;
    }
    const missions = await db.select({
      ...getTableColumns(practiceMissionsTable),
      courseTitle: coursesTable.title,
    }).from(practiceMissionsTable)
      .leftJoin(coursesTable, eq(coursesTable.id, practiceMissionsTable.courseId))
      .where(scope).orderBy(desc(practiceMissionsTable.createdAt));
    res.json(missions.map(({ createdBy: _createdBy, ...mission }) => mission));
  }));

  app.get("/api/practice-missions/submissions", handle(async (req, res) => {
    const user = req.user as User;
    res.setHeader("Cache-Control", "no-store");
    const submissions = await db.select({
      ...getTableColumns(missionSubmissionsTable),
      missionTitle: practiceMissionsTable.title,
      participantName: participantsTable.name,
    }).from(missionSubmissionsTable)
      .innerJoin(participantsTable, eq(participantsTable.id, missionSubmissionsTable.participantId))
      .innerJoin(practiceMissionsTable, eq(practiceMissionsTable.id, missionSubmissionsTable.missionId))
      .where(participantScope(user)).orderBy(desc(missionSubmissionsTable.submittedAt));
    res.json(submissions.map(({ submissionKey: _key, reviewedBy: _reviewer, privateReflection, ...submission }) =>
      user.role === "bujk_pic" ? submission : { ...submission, privateReflection }));
  }));

  app.post("/api/practice-missions", requireRole("admin"), handle(async (req, res) => {
    const data = missionInputSchema.parse(req.body);
    const [course] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.id, data.courseId));
    if (!course) throw new MissionError(404, "Kursus tidak ditemukan.");
    const [mission] = await db.insert(practiceMissionsTable).values({
      ...data, id: randomUUID(), createdBy: (req.user as User).id, createdAt: new Date().toISOString(),
    }).returning();
    res.status(201).json(mission);
  }));

  app.patch("/api/practice-missions/:id", requireRole("admin"), handle(async (req, res) => {
    const data = z.object({ active: z.boolean() }).strict().parse(req.body);
    const [mission] = await db.update(practiceMissionsTable).set(data)
      .where(eq(practiceMissionsTable.id, String(req.params.id))).returning();
    if (!mission) throw new MissionError(404, "Misi tidak ditemukan.");
    res.json(mission);
  }));

  app.post("/api/practice-missions/:id/submissions", requireRole("participant"), handle(async (req, res) => {
    const user = req.user as User;
    if (!user.participantId) throw new MissionError(403, "Akun belum terhubung dengan peserta.");
    const participantId = user.participantId;
    const missionId = String(req.params.id);
    const data = missionSubmissionSchema.parse(req.body);
    res.setHeader("Cache-Control", "no-store");
    const result = await db.transaction(async tx => {
      const [mission] = await tx.select().from(practiceMissionsTable)
        .where(eq(practiceMissionsTable.id, missionId)).for("share");
      if (!mission) throw new MissionError(404, "Misi tidak ditemukan.");
      // Serialize only this learner's practice rounds, not all users or quiz attempts.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`practice:${missionId}:${participantId}`}, 0))`);
      const tuple = and(
        eq(missionSubmissionsTable.missionId, missionId),
        eq(missionSubmissionsTable.participantId, participantId),
      );
      const [existing] = await tx.select().from(missionSubmissionsTable).where(and(
        tuple, eq(missionSubmissionsTable.submissionKey, data.submissionKey),
      ));
      const completedSet = new Set(data.completedChecklist);
      const checklistComplete = completedSet.size === mission.checklist.length
        && completedSet.size === data.completedChecklist.length
        && mission.checklist.every(item => completedSet.has(item));
      if (!checklistComplete) throw new MissionError(400, "Selesaikan seluruh butir checklist misi sebelum mengirim.");
      const completedChecklist = [...mission.checklist];
      if (existing) {
        if (existing.evidenceText !== data.evidenceText || existing.evidenceUrl !== data.evidenceUrl
          || existing.privateReflection !== data.privateReflection
          || JSON.stringify(existing.completedChecklist) !== JSON.stringify(completedChecklist)) {
          throw new MissionError(409, "ID pengiriman ini telah dipakai untuk bukti berbeda. Muat ulang riwayat sebelum mencoba lagi.");
        }
        return { submission: existing, replayed: true };
      }
      if (!mission.active || !mission.courseId) throw new MissionError(409, "Misi ini sudah diarsipkan atau kursusnya tidak tersedia.");
      const [enrollment] = await tx.select({ id: enrollmentsTable.id }).from(enrollmentsTable).where(and(
        eq(enrollmentsTable.participantId, participantId),
        eq(enrollmentsTable.courseId, mission.courseId),
      )).for("share");
      if (!enrollment) throw new MissionError(403, "Daftar pada kursus terkait sebelum mengerjakan misi ini.");
      const prior = await tx.select({ round: missionSubmissionsTable.round, status: missionSubmissionsTable.status })
        .from(missionSubmissionsTable).where(tuple);
      if (prior.some(item => item.status === "pending_review")) {
        throw new MissionError(409, "Bukti sebelumnya masih menunggu feedback admin.");
      }
      const round = prior.reduce((highest, item) => Math.max(highest, item.round), 0) + 1;
      const [submission] = await tx.insert(missionSubmissionsTable).values({
        ...data, completedChecklist, id: randomUUID(), missionId, participantId, round,
        submittedAt: new Date().toISOString(), status: "pending_review",
      }).returning();
      return { submission, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result.submission);
  }));

  app.post("/api/practice-missions/submissions/:id/review", requireRole("admin"), handle(async (req, res) => {
    const data = missionReviewSchema.parse(req.body);
    const submission = await db.transaction(async tx => {
      const [current] = await tx.select().from(missionSubmissionsTable)
        .where(eq(missionSubmissionsTable.id, String(req.params.id))).for("update");
      if (!current) throw new MissionError(404, "Bukti praktik tidak ditemukan.");
      if (current.status !== "pending_review") throw new MissionError(409, "Feedback sudah final dan tidak dapat ditimpa.");
      const [updated] = await tx.update(missionSubmissionsTable).set({
        ...data, reviewedBy: (req.user as User).id, reviewedAt: new Date().toISOString(),
      }).where(and(eq(missionSubmissionsTable.id, current.id), eq(missionSubmissionsTable.status, "pending_review"))).returning();
      return updated;
    });
    // Practice feedback does not modify lessons, post-tests, enrollments, or certificates.
    res.json(submission);
  }));
}
