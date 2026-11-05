import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../db";
import { storage } from "../storage";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";
import { runMigrations } from "../db-migrate";
import {
  bujksTable, discussionThreadsTable as threads, discussionRepliesTable as replies,
  enrollmentsTable, learningProgramsTable, notificationsTable, participantsTable, users, type ApplicationRole,
  discussionReportsTable as reports,
} from "@shared/schema";
import type { DiscussionView } from "@shared/discussions";

const tag = randomUUID();
const password = `Disposable-${randomUUID()}!`;
const groups = [randomUUID(), randomUUID()];
const ids: Record<string, string> = {};
const participantIds: string[] = [];
const cookies: Record<string, string> = {};
let server: Server;
let base = "", courseId = "", threadId = "", replyId = "", privateId = "";
const path = () => `/api/courses/${courseId}/discussions`;
async function request(role: string, url: string, method = "GET", data?: unknown) {
  return fetch(`${base}${url}`, {
    method, headers: { "Content-Type": "application/json", ...(cookies[role] ? { Cookie: cookies[role] } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function view(role: string) {
  const response = await request(role, path());
  expect(response.status).toBe(200);
  return response.json() as Promise<DiscussionView>;
}
beforeAll(async () => {
  await runMigrations();
  await db.insert(bujksTable).values(groups.map((id, index) => ({ id, name: `Forum ${index} ${tag}`, createdAt: new Date().toISOString() })));
  courseId = (await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: `Forum course ${tag}`, description: "Disposable discussion test", duration: "15 menit",
  })).id;
  const roles: [string, ApplicationRole, string?][] = [
    ["admin", "admin"], ["picA", "bujk_pic", groups[0]], ["picB", "bujk_pic", groups[1]],
    ["a", "participant", groups[0]], ["peer", "participant", groups[0]], ["b", "participant", groups[1]],
    ["solo", "participant"], ["otherSolo", "participant"], ["unenrolled", "participant", groups[0]],
  ];
  for (const [key, role, group] of roles) {
    let participantId: string | undefined;
    if (role === "participant") {
      participantId = (await storage.createParticipant({
        name: `Forum ${key}`, email: `${key}-${tag}@example.test`, nip: randomUUID(), position: "Teknik", unit: "Unit", bujkId: group,
      })).id;
      participantIds.push(participantId);
      if (key !== "unenrolled") await storage.createEnrollment(participantId, courseId);
    }
    ids[key] = (await createUser(`forum-${key}-${tag}`, password, { role, participantId, bujkId: group })).id;
  }
  const app = express(); app.use(express.json()); setupAuth(app);
  server = createServer(app); await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  for (const [key] of roles) {
    const response = await request("", "/api/login", "POST", { username: `forum-${key}-${tag}`, password });
    expect(response.status).toBe(200);
    cookies[key] = response.headers.get("set-cookie")!.split(";")[0];
  }
});
afterAll(async () => {
  try {
    if (courseId) await storage.deleteCourse(courseId);
    if (Object.values(ids).length) {
      await db.delete(notificationsTable).where(inArray(notificationsTable.userId, Object.values(ids)));
      await db.delete(users).where(inArray(users.id, Object.values(ids)));
    }
    for (const id of participantIds) await storage.deleteParticipant(id);
    await db.delete(bujksTable).where(inArray(bujksTable.id, groups));
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});

describe("Course discussion privacy and persistence", () => {
  it("requires login, enrollment and valid input; coordinators stay read-only", async () => {
    expect((await request("", path())).status).toBe(401);
    expect((await request("unenrolled", path())).status).toBe(403);
    expect((await request("unenrolled", path(), "POST", { title: "Tidak boleh", body: "Belum terdaftar di kursus" })).status).toBe(403);
    expect((await request("picA", path(), "POST", {})).status).toBe(403);
    expect((await request("a", path(), "POST", { title: " ", body: " " })).status).toBe(400);
    expect((await request("a", path(), "POST", { title: "Pertanyaan", body: "Isi teknis pertanyaan", groupId: groups[1] })).status).toBe(400);
  });
  it("stores a group question and replies without changing completion", async () => {
    const before = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId));
    const response = await request("a", path(), "POST", { title: "Toleransi inspeksi beton", body: "Bagaimana memeriksa toleransi pada sambungan beton?" });
    expect(response.status).toBe(201); threadId = (await response.json()).id;
    for (const role of ["a", "peer", "picA", "admin"]) expect((await view(role)).threads.some(t => t.id === threadId)).toBe(true);
    for (const role of ["b", "picB", "solo", "otherSolo"]) expect((await view(role)).threads).toHaveLength(0);
    for (const role of ["b", "solo", "otherSolo"]) {
      expect((await request(role, `/api/discussions/${threadId}/replies`, "POST", { body: "Tidak boleh" })).status).toBe(404);
    }
    expect((await request("picA", `/api/discussions/${threadId}/replies`, "POST", { body: "Baca saja" })).status).toBe(403);
    const reply = await request("peer", `/api/discussions/${threadId}/replies`, "POST", { body: "Gunakan pengukuran sesuai rujukan teknis." });
    expect(reply.status).toBe(201); replyId = (await reply.json()).id;
    const [stored] = await db.select().from(replies).where(eq(replies.id, replyId));
    expect(stored.body).toBe("Gunakan pengukuran sesuai rujukan teknis.");
    expect((await view("a")).threads[0].replies[0].body).toBe(stored.body);
    expect(await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId))).toEqual(before);
    const payload = JSON.stringify(await view("picA"));
    for (const field of ["privateReflection", "score", "answers", "email", "participantId", "bujkId", "password"]) expect(payload).not.toContain(`"${field}"`);
  });
  it("keeps independent questions private, even after joining a group", async () => {
    const response = await request("solo", path(), "POST", { title: "Pertanyaan mandiri privat", body: "Konteks teknis yang hanya untuk fasilitator." });
    expect(response.status).toBe(201); privateId = (await response.json()).id;
    for (const role of ["a", "peer", "b", "picA", "picB", "otherSolo"]) expect((await view(role)).threads.some(t => t.id === privateId)).toBe(false);
    for (const role of ["solo", "admin"]) expect((await view(role)).threads.some(t => t.id === privateId)).toBe(true);
    expect((await request("admin", `/api/discussions/${privateId}/replies`, "POST", { body: "Jawaban privat admin." })).status).toBe(201);
    const [user] = await db.select().from(users).where(eq(users.id, ids.solo));
    await db.update(participantsTable).set({ bujkId: groups[0] }).where(eq(participantsTable.id, user!.participantId!));
    expect((await view("solo")).threads.some(t => t.id === privateId)).toBe(true);
    expect((await view("a")).threads.some(t => t.id === privateId)).toBe(false);
    await db.update(participantsTable).set({ bujkId: null }).where(eq(participantsTable.id, user!.participantId!));
  });
  it("keeps reports private, validates targets, serializes duplicates and restricts handling", async () => {
    const reportPath = `/api/discussions/${threadId}/reports`;
    const reason = "Alasan sensitif privat yang tidak boleh dibagikan ke kelompok.";
    expect((await request("", reportPath, "POST", { reason })).status).toBe(401);
    for (const role of ["picA", "picB", "admin"]) {
      expect((await request(role, reportPath, "POST", { reason })).status).toBe(403);
    }
    for (const role of ["b", "solo", "otherSolo"]) {
      expect((await request(role, reportPath, "POST", { reason })).status).toBe(404);
    }
    expect((await request("unenrolled", reportPath, "POST", { reason })).status).toBe(403);
    expect((await request("a", reportPath, "POST", { reason: "pendek" })).status).toBe(400);
    expect((await request("a", reportPath, "POST", { reason: "x".repeat(1001) })).status).toBe(400);
    expect((await request("a", reportPath, "POST", { reason, reporterId: ids.peer })).status).toBe(400);
    const privateReply = (await view("admin")).threads.find(t => t.id === privateId)!.replies[0].id;
    expect((await request("a", reportPath, "POST", { reason, replyId: privateReply })).status).toBe(404);
    const results = await Promise.all(Array.from({ length: 4 }, () => request("a", reportPath, "POST", { reason })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409, 409, 409]);
    const reportId = (await results.find(r => r.status === 201)!.json()).id;
    const replyReport = await request("a", reportPath, "POST", { reason, replyId });
    expect(replyReport.status).toBe(201);
    expect((await request("solo", `/api/discussions/${privateId}/reports`, "POST", { reason })).status).toBe(201);
    expect((await request("otherSolo", `/api/discussions/${privateId}/reports`, "POST", { reason })).status).toBe(404);
    for (const role of ["picA", "picB"]) expect((await request(role, "/api/discussion-reports")).status).toBe(403);
    for (const role of ["peer", "b", "otherSolo"]) {
      expect((await (await request(role, "/api/discussion-reports")).json()).reports).toEqual([]);
    }
    const own = await (await request("a", "/api/discussion-reports")).json();
    expect(own.isAdmin).toBe(false);
    expect(own.reports).toHaveLength(2);
    for (const report of own.reports) {
      expect(report.reason).toBe(reason);
      for (const field of ["threadTitle", "targetBody", "reporterName", "courseId", "targetHidden"]) expect(report[field]).toBeNull();
    }
    const admin = await (await request("admin", "/api/discussion-reports?status=open&page=1")).json();
    expect(admin.reports.find((r: { id: string }) => r.id === reportId).targetBody).toContain("beton");
    expect((await request("admin", "/api/discussion-reports?status=invalid")).status).toBe(400);
    expect((await request("admin", "/api/discussion-reports?page=0")).status).toBe(400);
    for (const role of ["a", "peer", "picA"]) expect((await request(role, `/api/discussion-reports/${reportId}`, "PATCH", { status: "resolved", adminNote: "Sudah ditinjau." })).status).toBe(403);
    expect((await request("admin", `/api/discussion-reports/${randomUUID()}`, "PATCH", { status: "reviewing" })).status).toBe(404);
    expect((await request("admin", `/api/discussion-reports/${reportId}`, "PATCH", { status: "resolved" })).status).toBe(400);
    for (const status of ["reviewing", "resolved", "open", "dismissed"]) {
      expect((await request("admin", `/api/discussion-reports/${reportId}`, "PATCH", { status, adminNote: "Catatan privat fasilitator." })).status).toBe(200);
      const updated = await (await request("a", `/api/discussion-reports?status=${status}`)).json();
      expect(updated.reports.some((r: { id: string; status: string }) => r.id === reportId && r.status === status)).toBe(true);
    }
    const [author] = await db.select().from(users).where(eq(users.id, ids.a));
    await db.update(participantsTable).set({ bujkId: groups[1] }).where(eq(participantsTable.id, author.participantId!));
    try {
      expect((await request("a", reportPath, "POST", { reason })).status).toBe(404);
      const history = await (await request("a", "/api/discussion-reports")).json();
      expect(history.reports).toHaveLength(2);
      expect(history.reports.every((r: { targetBody: string | null }) => r.targetBody === null)).toBe(true);
    } finally {
      await db.update(participantsTable).set({ bujkId: groups[0] }).where(eq(participantsTable.id, author.participantId!));
    }
    expect(JSON.stringify(await view("peer"))).not.toContain(reason);
    const notices = await db.select().from(notificationsTable).where(eq(notificationsTable.link, "/app/discussion-reports"));
    const relevant = notices.filter(n => Object.values(ids).includes(n.userId));
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.every(n => [ids.admin, ids.a].includes(n.userId))).toBe(true);
    expect(JSON.stringify(relevant)).not.toContain(reason);
  });

  it("limits report spam across concurrent requests and persists the quota", async () => {
    const targets: string[] = [];
    for (let i = 0; i < 7; i++) {
      const result = await request("a", path(), "POST", { title: `Topik quota ${i}`, body: "Konteks teknis untuk pengujian batas laporan." });
      targets.push((await result.json()).id);
    }
    const results = await Promise.all(targets.map(id => request("a", `/api/discussions/${id}/reports`, "POST", { reason: "Konten perlu diperiksa fasilitator." })));
    // Two earlier reports already consumed this reporter's hourly quota.
    expect(results.filter(r => r.status === 201)).toHaveLength(3);
    expect(results.filter(r => r.status === 429)).toHaveLength(4);
    const failed = targets[results.findIndex(r => r.status === 429)];
    expect((await request("a", `/api/discussions/${failed}/reports`, "POST", { reason: "Masih dalam batas jam yang sama." })).status).toBe(429);
    await db.update(reports).set({ createdAt: new Date(Date.now() - 3601000).toISOString() }).where(eq(reports.reporterId, ids.a));
    expect((await request("a", `/api/discussions/${failed}/reports`, "POST", { reason: "Sesudah waktu pembatasan berakhir." })).status).toBe(201);
    expect((await request("a", `/api/discussions/${threadId}/reports`, "POST", { reason: "Laporan yang sudah ditutup tidak boleh berulang." })).status).toBe(409);
  });

  it("paginates report histories without mixing other reporters and filters persisted status", async () => {
    const now = new Date().toISOString();
    const fixtures = Array.from({ length: 32 }, () => ({ id: randomUUID(), reportId: randomUUID() }));
    // Disposable fixtures exercise the bounded read endpoint, not the write quota.
    await db.insert(replies).values(fixtures.map(row => ({
      id: row.id, threadId: privateId, authorId: ids.solo, body: "Konten privat fixture halaman.", createdAt: now,
    })));
    await db.insert(reports).values(fixtures.map(row => ({
      id: row.reportId, threadId: privateId, replyId: row.id, reporterId: ids.solo,
      targetKey: `reply:${row.id}`, reason: "Alasan privat fixture halaman.", createdAt: now, updatedAt: now,
      status: "reviewing" as const,
    })));
    const first = await (await request("solo", "/api/discussion-reports?status=reviewing&page=1")).json();
    const second = await (await request("solo", "/api/discussion-reports?status=reviewing&page=2")).json();
    expect(first.reports).toHaveLength(30); expect(first.hasMore).toBe(true);
    expect(second.reports).toHaveLength(2); expect(second.hasMore).toBe(false);
    expect(new Set([...first.reports, ...second.reports].map(r => r.id)).size).toBe(32);
    const admin = await (await request("admin", "/api/discussion-reports?status=reviewing&page=2")).json();
    expect(admin.reports.map((r: { id: string }) => r.id)).toEqual(second.reports.map((r: { id: string }) => r.id));
    expect((await (await request("otherSolo", "/api/discussion-reports?page=2")).json()).reports).toEqual([]);
    await db.delete(replies).where(inArray(replies.id, fixtures.map(row => row.id)));
  });

  it("allows only admin moderation and helpful marks; redacts hidden content", async () => {
    const mark = `/api/discussion-replies/${replyId}/helpful`;
    for (const role of ["a", "peer", "picA", "b"]) expect((await request(role, mark, "PATCH", { helpful: true })).status).toBe(403);
    expect((await request("admin", mark, "PATCH", { helpful: true })).status).toBe(200);
    expect((await view("a")).threads.find(t => t.id === threadId)!.replies[0].helpful).toBe(true);
    const moderation = `/api/discussion-replies/${replyId}/moderation`;
    expect((await request("admin", moderation, "PATCH", { hidden: true, reason: "" })).status).toBe(400);
    expect((await request("admin", moderation, "PATCH", { hidden: true, reason: "Perlu peninjauan sumber teknis." })).status).toBe(200);
    expect((await request("a", `/api/discussions/${threadId}/reports`, "POST", { reason: "Balasan yang telah disembunyikan.", replyId })).status).toBe(409);
    for (const role of ["a", "peer", "picA"]) {
      const reply = (await view(role)).threads.find(t => t.id === threadId)!.replies[0];
      expect(reply.body).toBe(""); expect(reply.hidden).toBe(true); expect(reply.helpful).toBe(false);
    }
    expect((await view("admin")).threads.find(t => t.id === threadId)!.replies[0].body).toContain("pengukuran");
    expect((await request("admin", mark, "PATCH", { helpful: true })).status).toBe(409);
    expect((await request("admin", moderation, "PATCH", { hidden: false, reason: "Rujukan sudah diperiksa." })).status).toBe(200);
    const root = `/api/discussions/${threadId}/moderation`;
    expect((await request("a", root, "PATCH", { hidden: true, reason: "Tidak diizinkan" })).status).toBe(403);
    expect((await request("admin", root, "PATCH", { hidden: true, reason: "Pertanyaan sedang ditinjau." })).status).toBe(200);
    expect((await request("a", `/api/discussions/${threadId}/reports`, "POST", { reason: "Pertanyaan yang telah disembunyikan." })).status).toBe(409);
    const hidden = (await view("picA")).threads.find(t => t.id === threadId)!;
    expect(hidden.title).toBe("Pertanyaan disembunyikan"); expect(hidden.body).toBe(""); expect(hidden.replies).toEqual([]);
    for (const role of ["peer", "admin"]) expect((await request(role, `/api/discussions/${threadId}/replies`, "POST", { body: "Ditutup" })).status).toBe(409);
    expect((await request("admin", root, "PATCH", { hidden: false, reason: "Selesai diperiksa fasilitator." })).status).toBe(200);
    expect((await view("a")).threads.find(t => t.id === threadId)!.replies).toHaveLength(1);
  });
  it("sends generic, scoped notifications and denies stale group links", async () => {
    const notices = await db.select().from(notificationsTable).where(inArray(notificationsTable.userId, Object.values(ids)));
    const forThread = (id: string) => notices.filter(n => n.link?.includes(`thread=${id}`));
    const groupRecipients = new Set(forThread(threadId).map(n => n.userId));
    for (const role of ["admin", "a", "peer", "picA"]) expect(groupRecipients.has(ids[role])).toBe(true);
    for (const role of ["b", "picB", "solo", "otherSolo", "unenrolled"]) expect(groupRecipients.has(ids[role])).toBe(false);
    expect(new Set(forThread(privateId).map(n => n.userId))).toEqual(new Set([ids.solo, ids.admin]));
    for (const n of notices) {
      expect(n.message).not.toContain("beton"); expect(n.message).not.toContain("privat admin");
      expect(n.link).toMatch(/^\/app\/(?:discussions\/|discussion-reports$)/);
    }
    const [user] = await db.select().from(users).where(eq(users.id, ids.peer));
    await db.update(participantsTable).set({ bujkId: groups[1] }).where(eq(participantsTable.id, user!.participantId!));
    expect((await view("peer")).threads.some(t => t.id === threadId)).toBe(false);
    expect((await request("peer", `/api/discussions/${threadId}/replies`, "POST", { body: "Tautan lama" })).status).toBe(404);
    await db.update(enrollmentsTable).set({ status: "dropped" }).where(eq(enrollmentsTable.participantId, user!.participantId!));
    expect((await request("peer", path())).status).toBe(403);
  });

  it("deletes course-owned discussions via the normal API, atomically with existing course records", async () => {
    const course = await storage.createCourse({
      unitId: "tender-01", targetLevel: "L2", title: `Deletion forum ${tag}`,
      description: "Disposable deletion regression", duration: "15 menit",
    });
    let programId: string | undefined;
    try {
      const [author] = await db.select().from(users).where(eq(users.id, ids.a));
      const enrollment = await storage.createEnrollment(author.participantId!, course.id);
      const response = await request("a", `/api/courses/${course.id}/discussions`, "POST", {
        title: "Pertanyaan sebelum penghapusan", body: "Diskusi ini milik kursus yang akan dihapus.",
      });
      expect(response.status).toBe(201);
      const { id } = await response.json();
      const reply = await request("admin", `/api/discussions/${id}/replies`, "POST", { body: "Tanggapan fasilitator." });
      expect(reply.status).toBe(201);
      const replyId = (await reply.json()).id;
      const report = await request("a", `/api/discussions/${id}/reports`, "POST", { reason: "Pengujian penghapusan laporan bersama kursus." });
      expect(report.status).toBe(201);
      const reportId = (await report.json()).id;
      const program = await request("admin", "/api/learning-programs", "POST", {
        title: "Rencana yang menahan penghapusan", description: "", courseId: course.id,
        dueDate: "2099-12-31", participantIds: [author.participantId!], groupIds: [],
      });
      expect(program.status).toBe(201); programId = (await program.json()).id;
      const existingNotices = await db.select().from(notificationsTable)
        .where(eq(notificationsTable.link, `/app/discussions/${course.id}?thread=${id}`));
      expect(existingNotices.length).toBeGreaterThan(0);
      expect((await request("admin", `/api/courses/${course.id}`, "DELETE")).status).toBe(409);
      expect(await db.select().from(threads).where(eq(threads.id, id))).toHaveLength(1);
      expect(await db.select().from(replies).where(eq(replies.id, replyId))).toHaveLength(1);
      expect(await db.select().from(reports).where(eq(reports.id, reportId))).toHaveLength(1);
      expect(await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, enrollment.id))).toHaveLength(1);
      expect(await db.select().from(notificationsTable)
        .where(eq(notificationsTable.link, `/app/discussions/${course.id}?thread=${id}`))).toEqual(existingNotices);
      await db.delete(learningProgramsTable).where(eq(learningProgramsTable.id, programId!));
      programId = undefined;
      expect((await request("a", `/api/courses/${course.id}`, "DELETE")).status).toBe(403);
      expect((await request("admin", `/api/courses/${course.id}`, "DELETE")).status).toBe(204);
      expect(await storage.getCourse(course.id)).toBeUndefined();
      expect(await db.select().from(threads).where(eq(threads.id, id))).toHaveLength(0);
      expect(await db.select().from(replies).where(eq(replies.id, replyId))).toHaveLength(0);
      expect(await db.select().from(reports).where(eq(reports.id, reportId))).toHaveLength(0);
      expect(await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, enrollment.id))).toHaveLength(0);
      expect(await db.select().from(notificationsTable)
        .where(eq(notificationsTable.link, `/app/discussions/${course.id}?thread=${id}`))).toHaveLength(0);
    } finally {
      if (programId) await db.delete(learningProgramsTable).where(eq(learningProgramsTable.id, programId));
      await storage.deleteCourse(course.id);
    }
  });
});
