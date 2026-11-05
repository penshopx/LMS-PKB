import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
import { LEGACY_BUJK_COURSE_IDS } from "./pkb-catalog";
import {
  bujksTable, coursesTable, enrollmentsTable, learningProgramMembersTable as members,
  learningProgramsTable as programs, notificationsTable, participantsTable, users,
  type User,
} from "@shared/schema";
import {
  assignedProgramInput, dayOffset, learningDay, learningProgramFields,
  learningStatus, updateLearningProgramInput, type LearningProgramView,
} from "@shared/learning-program";

class ProgramError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? "Data rencana tidak valid." });
      }
      if (error instanceof ProgramError) return res.status(error.status).json({ message: error.message });
      res.status(500).json({ message: "Rencana belajar tidak dapat diproses. Silakan coba kembali." });
    }
  };
}

// Personal targets are intentionally invisible even to group coordinators.
export async function getLearningPrograms(user: User): Promise<LearningProgramView[]> {
  const scope = user.role === "admin" ? eq(programs.source, "assigned")
    : user.role === "participant" ? eq(members.participantId, user.participantId ?? "")
      : user.bujkId ? and(eq(programs.source, "assigned"), eq(participantsTable.bujkId, user.bujkId))
        : sql`false`;
  const rows = await db.select({
    id: programs.id, title: programs.title, description: programs.description,
    courseId: programs.courseId, courseTitle: coursesTable.title, dueDate: programs.dueDate,
    source: programs.source, createdAt: programs.createdAt, canceledAt: programs.canceledAt,
    memberId: members.id, participantId: members.participantId,
    participantName: participantsTable.name, unit: participantsTable.unit,
    progress: enrollmentsTable.progress, enrollmentStatus: enrollmentsTable.status,
    completedAt: enrollmentsTable.completedAt, lastAccessedAt: enrollmentsTable.lastAccessedAt,
  }).from(programs)
    .innerJoin(members, eq(members.programId, programs.id))
    .innerJoin(participantsTable, eq(participantsTable.id, members.participantId))
    .innerJoin(coursesTable, eq(coursesTable.id, programs.courseId))
    // Choose one existing enrollment, including legacy installs with duplicates.
    // No enrollments are created or overwritten by a target.
    .leftJoin(enrollmentsTable, eq(enrollmentsTable.id, sql`(
      SELECT e.id FROM enrollments e
      WHERE e.participant_id = ${members.participantId} AND e.course_id = ${programs.courseId}
      ORDER BY (e.status = 'completed') DESC, e.progress DESC, e.enrolled_at DESC, e.id
      LIMIT 1
    )`))
    .where(scope).orderBy(desc(programs.createdAt), programs.id, participantsTable.name, members.id);
  const grouped = new Map<string, LearningProgramView>();
  const today = learningDay();
  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id, title: row.title, description: row.description, courseId: row.courseId,
        courseTitle: row.courseTitle, courseArchived: LEGACY_BUJK_COURSE_IDS.has(row.courseId),
        dueDate: row.dueDate, source: row.source, createdAt: row.createdAt,
        canceledAt: row.canceledAt, members: [],
      });
    }
    grouped.get(row.id)!.members.push({
      id: row.memberId, participantId: row.participantId, participantName: row.participantName,
      unit: row.unit, progress: row.progress ?? 0, completedAt: row.completedAt,
      lastAccessedAt: row.lastAccessedAt,
      status: learningStatus({ ...row, progress: row.progress ?? 0 }, today),
    });
  }
  return Array.from(grouped.values());
}

// Deterministic IDs also deduplicate concurrent polling and manual reminders.
async function sendReminders(programId: string, onlyUserId?: string, assignedOnly = false) {
  return db.transaction(async tx => {
    const [program] = await tx.select().from(programs).where(eq(programs.id, programId)).for("update");
    if (!program || (assignedOnly && program.source !== "assigned")) {
      throw new ProgramError(404, "Program tidak ditemukan.");
    }
    if (program.canceledAt || LEGACY_BUJK_COURSE_IDS.has(program.courseId)) return 0;
    const targets = await tx.select({ memberId: members.id, userId: users.id })
      .from(members).innerJoin(users, and(
        eq(users.participantId, members.participantId), eq(users.role, "participant"), eq(users.isActive, true),
      )).where(and(
        eq(members.programId, programId),
        onlyUserId ? eq(users.id, onlyUserId) : sql`true`,
        sql`NOT EXISTS (SELECT 1 FROM enrollments e
          WHERE e.participant_id = ${members.participantId} AND e.course_id = ${program.courseId}
          AND e.status = 'completed')`,
      ));
    if (!targets.length) return 0;
    const today = learningDay();
    const values = targets.map(target => ({
      id: `learning-reminder:${target.memberId}:${target.userId}:${today}`,
      userId: target.userId, type: "warning", category: "learning",
      title: program.dueDate < today ? "Target belajar melewati tenggat" : "Pengingat rencana belajar",
      message: `${program.title} — target ${program.dueDate} (WIB). Lanjutkan pembelajaran Anda.`,
      link: "/app/learning-programs", createdAt: new Date().toISOString(),
    }));
    const inserted = await tx.insert(notificationsTable).values(values).onConflictDoNothing()
      .returning({ id: notificationsTable.id });
    return inserted.length;
  });
}

// In-app reminders are materialized on the learner's notification check, not
// presented as an email/push service or a background delivery guarantee.
export async function ensureLearningProgramReminders(user: User): Promise<void> {
  if (user.role !== "participant" || !user.participantId) return;
  const due = await db.select({ id: programs.id }).from(programs)
    .innerJoin(members, eq(members.programId, programs.id))
    .where(and(
      eq(members.participantId, user.participantId), isNull(programs.canceledAt),
      lte(programs.dueDate, dayOffset(learningDay(), 3)),
      sql`NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.participant_id = ${members.participantId}
        AND e.course_id = ${programs.courseId} AND e.status = 'completed')`,
      sql`NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id =
        'learning-reminder:' || ${members.id} || ':' || ${user.id} || ':' || ${learningDay()})`,
    )).orderBy(programs.dueDate, programs.id).limit(50);
  for (const program of due) await sendReminders(program.id, user.id);
}

export function registerLearningProgramRoutes(app: Express) {
  app.get("/api/learning-programs", handle(async (req, res) => {
    res.json(await getLearningPrograms(req.user as User));
  }));

  app.post("/api/learning-programs", handle(async (req, res) => {
    const user = req.user as User;
    if (user.role === "bujk_pic") throw new ProgramError(403, "Koordinator hanya dapat memantau program.");
    const data = user.role === "admin" ? assignedProgramInput.parse(req.body) : learningProgramFields.parse(req.body);
    if (data.dueDate < learningDay()) throw new ProgramError(400, "Tenggat baru tidak boleh sebelum hari ini (WIB).");
    if (LEGACY_BUJK_COURSE_IDS.has(data.courseId)) throw new ProgramError(400, "Kursus arsip tidak dapat ditugaskan.");
    const id = randomUUID();
    await db.transaction(async tx => {
      const [course] = await tx.select({ id: coursesTable.id }).from(coursesTable)
        .where(eq(coursesTable.id, data.courseId)).for("share");
      if (!course) throw new ProgramError(404, "Kursus tidak ditemukan.");
      let participantIds: string[];
      if (user.role === "participant") {
        if (!user.participantId) throw new ProgramError(403, "Akun belum terhubung dengan peserta.");
        const [participant] = await tx.select({ id: participantsTable.id }).from(participantsTable)
          .where(eq(participantsTable.id, user.participantId));
        if (!participant) throw new ProgramError(404, "Peserta tidak ditemukan.");
        participantIds = [participant.id];
      } else {
        const input = assignedProgramInput.parse(data);
        const direct = Array.from(new Set(input.participantIds));
        const groups = Array.from(new Set(input.groupIds));
        if (!direct.length && !groups.length) throw new ProgramError(400, "Pilih peserta atau kelompok PKB.");
        if (groups.length) {
          const foundGroups = await tx.select({ id: bujksTable.id }).from(bujksTable).where(inArray(bujksTable.id, groups));
          if (foundGroups.length !== groups.length) throw new ProgramError(404, "Kelompok PKB tidak ditemukan.");
        }
        const targets = await tx.select({ id: participantsTable.id }).from(participantsTable).where(or(
          direct.length ? inArray(participantsTable.id, direct) : sql`false`,
          groups.length ? inArray(participantsTable.bujkId, groups) : sql`false`,
        ));
        const found = new Set(targets.map(target => target.id));
        if (direct.some(target => !found.has(target))) throw new ProgramError(404, "Peserta tidak ditemukan.");
        participantIds = Array.from(found);
        if (!participantIds.length) throw new ProgramError(400, "Kelompok yang dipilih belum memiliki peserta.");
        if (participantIds.length > 500) throw new ProgramError(400, "Maksimal 500 peserta dalam satu penugasan.");
      }
      const createdAt = new Date().toISOString();
      await tx.insert(programs).values({
        id, title: data.title, description: data.description, courseId: data.courseId,
        dueDate: data.dueDate, source: user.role === "admin" ? "assigned" : "personal",
        createdBy: user.id, createdAt,
      });
      await tx.insert(members).values(participantIds.map(participantId => ({
        id: randomUUID(), programId: id, participantId,
      })));
      if (user.role === "admin") {
        const accounts = await tx.select({ id: users.id }).from(users).where(and(
          inArray(users.participantId, participantIds), eq(users.role, "participant"), eq(users.isActive, true),
        ));
        if (accounts.length) await tx.insert(notificationsTable).values(accounts.map(account => ({
          id: `learning-assigned:${id}:${account.id}`, userId: account.id,
          type: "info", category: "learning", title: "Penugasan belajar baru",
          message: `${data.title} — target ${data.dueDate} (WIB). Progres kursus yang sudah ada tetap digunakan.`,
          link: "/app/learning-programs", createdAt,
        })));
      }
    });
    res.status(201).json({ id });
  }));

  const authorizeEdit = async (user: User, id: string, tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    const [program] = await tx.select().from(programs).where(eq(programs.id, id)).for("update");
    if (!program) throw new ProgramError(404, "Rencana tidak ditemukan.");
    if (user.role === "admin" && program.source === "assigned") return program;
    if (user.role === "participant" && program.source === "personal") {
      const [member] = await tx.select({ id: members.id }).from(members)
        .where(and(eq(members.programId, id), eq(members.participantId, user.participantId ?? "")));
      if (member) return program;
    }
    // Do not disclose whether another participant's personal target exists.
    throw new ProgramError(404, "Rencana tidak ditemukan.");
  };

  app.patch("/api/learning-programs/:id", handle(async (req, res) => {
    const data = updateLearningProgramInput.parse(req.body);
    const id = String(req.params.id);
    await db.transaction(async tx => {
      const program = await authorizeEdit(req.user as User, id, tx);
      if (program.canceledAt) throw new ProgramError(409, "Rencana yang dibatalkan tidak dapat diubah.");
      await tx.update(programs).set(data).where(eq(programs.id, id));
    });
    res.json({ id });
  }));

  app.post("/api/learning-programs/:id/cancel", handle(async (req, res) => {
    const id = String(req.params.id);
    await db.transaction(async tx => {
      const program = await authorizeEdit(req.user as User, id, tx);
      if (!program.canceledAt) await tx.update(programs).set({ canceledAt: new Date().toISOString() })
        .where(eq(programs.id, id));
    });
    res.json({ id });
  }));

  app.post("/api/learning-programs/:id/remind", requireRole("admin"), handle(async (req, res) => {
    const sent = await sendReminders(String(req.params.id), undefined, true);
    res.json({ sent });
  }));
}
