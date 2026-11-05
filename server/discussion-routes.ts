import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
import {
  coursesTable, discussionThreadsTable as threads, discussionRepliesTable as replies,
  enrollmentsTable, participantsTable, users, bujksTable, notificationsTable, type User,
} from "@shared/schema";
import { questionInput, replyInput, moderationInput, type DiscussionView } from "@shared/discussions";

class DiscussionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type DiscussionRequest = Request<Record<string, string>>;
function handle(fn: (req: DiscussionRequest, res: Response) => Promise<unknown>) {
  return async (req: DiscussionRequest, res: Response) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
      if (error instanceof DiscussionError) return res.status(error.status).json({ message: error.message });
      console.error("[discussions] Request failed", error instanceof Error ? error.name : "Unknown error");
      return res.status(500).json({ message: "Diskusi belum dapat diproses. Silakan coba kembali." });
    }
  };
}
type Connection = Pick<typeof db, "select" | "insert" | "update">;

async function courseAccess(conn: Connection, user: User, courseId: string) {
  const [course] = await conn.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, courseId));
  if (!course) throw new DiscussionError(404, "Kursus tidak ditemukan.");
  if (user.role === "admin") return { ...course, groupId: null, canPost: false };
  if (user.role === "bujk_pic") {
    if (!user.bujkId) throw new DiscussionError(403, "Akun belum terhubung dengan kelompok.");
    return { ...course, groupId: user.bujkId, canPost: false };
  }
  const [participant] = await conn.select({ groupId: participantsTable.bujkId }).from(participantsTable)
    .where(eq(participantsTable.id, user.participantId ?? ""));
  const [enrollment] = await conn.select({ id: enrollmentsTable.id }).from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.participantId, user.participantId ?? ""),
      eq(enrollmentsTable.courseId, courseId), sql`${enrollmentsTable.status} <> 'dropped'`));
  if (!participant || !enrollment) throw new DiscussionError(403, "Daftar kursus terlebih dahulu untuk mengikuti diskusi.");
  return { ...course, groupId: participant.groupId, canPost: true };
}
function scope(user: User, groupId: string | null) {
  if (user.role === "admin") return sql`true`;
  const group = groupId ? eq(threads.groupId, groupId) : sql`false`;
  return user.role === "participant"
    ? or(group, and(isNull(threads.groupId), eq(threads.authorId, user.id)))!
    : group;
}
async function threadAccess(conn: Connection, user: User, id: string) {
  const [thread] = await conn.select().from(threads).where(eq(threads.id, id));
  if (!thread) throw new DiscussionError(404, "Diskusi tidak ditemukan.");
  const access = await courseAccess(conn, user, thread.courseId);
  const [visible] = await conn.select({ id: threads.id }).from(threads)
    .where(and(eq(threads.id, id), scope(user, access.groupId)));
  if (!visible) throw new DiscussionError(404, "Diskusi tidak ditemukan.");
  return thread;
}

// No question text, author identity, group label, or moderation reason in notices.
// Authorization is checked again at the linked destination, including after a move.
async function notify(conn: Connection, thread: typeof threads.$inferSelect, actor: User, title: string) {
  const recipients = await conn.select({ id: users.id }).from(users)
    .leftJoin(participantsTable, eq(participantsTable.id, users.participantId))
    .where(and(eq(users.isActive, true), sql`${users.id} <> ${actor.id}`, or(
      eq(users.role, "admin"),
      thread.groupId ? and(eq(users.role, "bujk_pic"), eq(users.bujkId, thread.groupId)) : sql`false`,
      and(eq(users.role, "participant"),
        thread.groupId ? eq(participantsTable.bujkId, thread.groupId) : eq(users.id, thread.authorId),
        sql`EXISTS (SELECT 1 FROM enrollments e WHERE e.participant_id = ${users.participantId}
          AND e.course_id = ${thread.courseId} AND e.status <> 'dropped')`),
    )));
  if (recipients.length) await conn.insert(notificationsTable).values(recipients.map(user => ({
    id: randomUUID(), userId: user.id, type: "info", category: "learning", title,
    message: "Ada pembaruan diskusi kursus. Buka diskusi untuk melihat informasi sesuai akses Anda.",
    link: `/app/discussions/${encodeURIComponent(thread.courseId)}?thread=${encodeURIComponent(thread.id)}`,
    createdAt: new Date().toISOString(),
  })));
}

export function registerDiscussionRoutes(app: Express) {
  app.get("/api/courses/:courseId/discussions", handle(async (req, res) => {
    const user = req.user as User;
    const access = await courseAccess(db, user, req.params.courseId);
    const rows = await db.select({
      thread: threads, authorName: users.username, groupName: bujksTable.name,
    }).from(threads).innerJoin(users, eq(users.id, threads.authorId))
      .leftJoin(bujksTable, eq(bujksTable.id, threads.groupId))
      .where(and(eq(threads.courseId, req.params.courseId), scope(user, access.groupId)))
      .orderBy(desc(threads.createdAt), threads.id);
    const ids = rows.filter(row => user.role === "admin" || !row.thread.hidden).map(row => row.thread.id);
    const posts = ids.length ? await db.select({ reply: replies, authorName: users.username })
      .from(replies).innerJoin(users, eq(users.id, replies.authorId))
      .where(inArray(replies.threadId, ids)).orderBy(asc(replies.createdAt), replies.id) : [];
    const view: DiscussionView = {
      courseTitle: access.title, canPost: access.canPost, isAdmin: user.role === "admin",
      scopeLabel: user.role === "admin" ? "Fasilitator — semua kelompok dan pertanyaan privat"
        : access.groupId ? "Diskusi kelompok sendiri" : "Privat — hanya Anda dan admin",
      threads: rows.map(({ thread, authorName, groupName }) => ({
        id: thread.id, courseId: thread.courseId, title: thread.hidden && user.role !== "admin" ? "Pertanyaan disembunyikan" : thread.title,
        body: thread.hidden && user.role !== "admin" ? "" : thread.body,
        authorName, scopeLabel: thread.groupId ? `Kelompok: ${groupName}` : "Privat — pengirim dan admin",
        hidden: thread.hidden, moderationReason: thread.moderationReason, createdAt: thread.createdAt,
        replies: posts.filter(p => p.reply.threadId === thread.id).map(({ reply, authorName }) => ({
          id: reply.id, authorName, body: reply.hidden && user.role !== "admin" ? "" : reply.body,
          hidden: reply.hidden, moderationReason: reply.moderationReason,
          helpful: !reply.hidden && reply.helpful, createdAt: reply.createdAt,
        })),
      })),
    };
    res.json(view);
  }));

  app.post("/api/courses/:courseId/discussions", requireRole("participant"), handle(async (req, res) => {
    const data = questionInput.parse(req.body);
    const user = req.user as User;
    const id = randomUUID();
    await db.transaction(async tx => {
      const access = await courseAccess(tx, user, req.params.courseId);
      const [thread] = await tx.insert(threads).values({
        id, courseId: req.params.courseId, authorId: user.id, groupId: access.groupId,
        ...data, createdAt: new Date().toISOString(),
      }).returning();
      await notify(tx, thread, user, "Pertanyaan diskusi baru");
    });
    res.status(201).json({ id });
  }));

  app.post("/api/discussions/:threadId/replies", requireRole("participant", "admin"), handle(async (req, res) => {
    const data = replyInput.parse(req.body);
    const user = req.user as User;
    const id = randomUUID();
    await db.transaction(async tx => {
      // Serialize moderation with replies: hidden questions never accept a reply.
      await tx.select({ id: threads.id }).from(threads).where(eq(threads.id, req.params.threadId)).for("update");
      const thread = await threadAccess(tx, user, req.params.threadId);
      if (thread.hidden) throw new DiscussionError(409, "Pertanyaan sedang disembunyikan. Balasan ditutup.");
      await tx.insert(replies).values({
        id, threadId: thread.id, authorId: user.id, body: data.body, createdAt: new Date().toISOString(),
      });
      await notify(tx, thread, user, "Balasan diskusi baru");
    });
    res.status(201).json({ id });
  }));

  app.patch("/api/discussions/:threadId/moderation", requireRole("admin"), handle(async (req, res) => {
    const data = moderationInput.parse(req.body);
    const user = req.user as User;
    await db.transaction(async tx => {
      const [thread] = await tx.update(threads).set({
        hidden: data.hidden, moderationReason: data.reason, moderatedBy: user.id, moderatedAt: new Date().toISOString(),
      }).where(eq(threads.id, req.params.threadId)).returning();
      if (!thread) throw new DiscussionError(404, "Diskusi tidak ditemukan.");
      await notify(tx, thread, user, "Status moderasi diskusi diperbarui");
    });
    res.json({ success: true });
  }));

  app.patch("/api/discussion-replies/:replyId/moderation", requireRole("admin"), handle(async (req, res) => {
    const data = moderationInput.parse(req.body);
    const user = req.user as User;
    await db.transaction(async tx => {
      const [reply] = await tx.update(replies).set({
        hidden: data.hidden, helpful: false, moderationReason: data.reason,
        moderatedBy: user.id, moderatedAt: new Date().toISOString(),
      }).where(eq(replies.id, req.params.replyId)).returning();
      if (!reply) throw new DiscussionError(404, "Balasan tidak ditemukan.");
      const thread = await threadAccess(tx, user, reply.threadId);
      await notify(tx, thread, user, "Status moderasi diskusi diperbarui");
    });
    res.json({ success: true });
  }));

  app.patch("/api/discussion-replies/:replyId/helpful", requireRole("admin"), handle(async (req, res) => {
    const data = z.object({ helpful: z.boolean() }).strict().parse(req.body);
    await db.transaction(async tx => {
      const [reply] = await tx.select().from(replies).where(eq(replies.id, req.params.replyId)).for("update");
      if (!reply) throw new DiscussionError(404, "Balasan tidak ditemukan.");
      const thread = await threadAccess(tx, req.user as User, reply.threadId);
      if (data.helpful && (reply.hidden || thread.hidden)) throw new DiscussionError(409, "Konten tersembunyi tidak dapat ditandai membantu.");
      await tx.update(replies).set(data).where(eq(replies.id, reply.id));
      await notify(tx, thread, req.user as User, "Penanda jawaban membantu diperbarui");
    });
    res.json({ success: true });
  }));
}
