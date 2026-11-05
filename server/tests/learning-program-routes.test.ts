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
  bujksTable, coursesTable, enrollmentsTable, learningProgramsTable,
  notificationsTable, users, type ApplicationRole,
} from "@shared/schema";
import {
  dayOffset, learningDateSchema, learningDay, learningStatus, type LearningProgramView,
} from "@shared/learning-program";

const tag = randomUUID();
const password = "Disposable-Program-Test-2026!";
const groups = [randomUUID(), randomUUID()];
const accounts: string[] = [];
const participants: string[] = [];
const programIds: string[] = [];
const courseIds: string[] = [];
const cookies: Record<string, string> = {};
let server: Server;
let base = "";
let assignedId = "";
let personalId = "";
let reminderId = "";
const future = dayOffset(learningDay(), 14);

async function request(role: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookies[role] ? { Cookie: cookies[role] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function list(role: string) {
  const response = await request(role, "/api/learning-programs");
  expect(response.status).toBe(200);
  return response.json() as Promise<LearningProgramView[]>;
}
async function create(role: string, extra: Record<string, unknown> = {}) {
  const response = await request(role, "/api/learning-programs", "POST", {
    title: `Program PKB ${tag}`, description: "Target pembelajaran uji",
    courseId: courseIds[0], dueDate: future, ...extra,
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const { id } = await response.json();
  programIds.push(id);
  return id as string;
}

beforeAll(async () => {
  await runMigrations();
  await db.insert(bujksTable).values(groups.map((id, index) => ({
    id, name: `Kelompok uji program ${index} ${tag}`, createdAt: new Date().toISOString(),
  })));
  for (let index = 0; index < 3; index++) {
    participants.push((await storage.createParticipant({
      name: `Peserta program ${index}`, email: `program-${index}-${tag}@example.test`,
      nip: randomUUID(), position: "Teknik", unit: `Unit ${index}`,
      ...(index < 2 ? { bujkId: groups[index] } : {}),
    })).id);
  }
  for (let index = 0; index < 3; index++) {
    courseIds.push((await storage.createCourse({
      unitId: "tender-01", targetLevel: "L2", title: `Kursus program ${index} ${tag}`,
      description: "Kursus uji program", duration: "15 menit",
    })).id);
  }
  const roles: Array<[string, ApplicationRole, string | undefined, string | undefined]> = [
    ["admin", "admin", undefined, undefined], ["picA", "bujk_pic", undefined, groups[0]],
    ["picB", "bujk_pic", undefined, groups[1]], ["a", "participant", participants[0], groups[0]],
    ["b", "participant", participants[1], groups[1]], ["independent", "participant", participants[2], undefined],
  ];
  for (const [key, role, participantId, bujkId] of roles) {
    const user = await createUser(`program-${key}-${tag}`, password, { role, participantId, bujkId });
    accounts.push(user.id);
  }
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  for (const [key] of roles) {
    const response = await request("", "/api/login", "POST", { username: `program-${key}-${tag}`, password });
    expect(response.status).toBe(200);
    cookies[key] = response.headers.get("set-cookie")!.split(";")[0];
  }
});

afterAll(async () => {
  try {
    if (programIds.length) await db.delete(learningProgramsTable).where(inArray(learningProgramsTable.id, programIds));
    if (accounts.length) {
      await db.delete(notificationsTable).where(inArray(notificationsTable.userId, accounts));
      await db.delete(users).where(inArray(users.id, accounts));
    }
    for (const participantId of participants) await storage.deleteParticipant(participantId);
    for (const courseId of courseIds) await storage.deleteCourse(courseId);
    await db.delete(bujksTable).where(inArray(bujksTable.id, groups));
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});

describe("Rencana Belajar PKB", () => {
  it("uses valid calendar dates, WIB boundaries and authoritative completion", () => {
    expect(learningDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(learningDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(learningDay(new Date("2026-11-05T16:59:59Z"))).toBe("2026-11-05");
    expect(learningDay(new Date("2026-11-05T17:00:00Z"))).toBe("2026-11-06");
    const value = { dueDate: "2026-11-05", canceledAt: null, progress: 100, enrollmentStatus: "in_progress" };
    expect(learningStatus(value, "2026-11-05")).toBe("due_soon");
    expect(learningStatus(value, "2026-11-06")).toBe("overdue");
    expect(learningStatus({ ...value, enrollmentStatus: "completed" }, "2026-11-06")).toBe("completed");
    expect(learningStatus({ ...value, canceledAt: "2026-11-04" }, "2026-11-06")).toBe("canceled");
  });

  it("requires authentication and keeps coordinators read-only", async () => {
    expect((await request("", "/api/learning-programs")).status).toBe(401);
    expect((await request("picA", "/api/learning-programs", "POST", {})).status).toBe(403);
    expect((await request("picA", "/api/learning-programs/missing", "PATCH", { title: "Tidak boleh" })).status).toBe(403);
  });

  it("assigns selected groups plus individual targets once, without resetting enrollment", async () => {
    const enrollment = await storage.createEnrollment(participants[0], courseIds[0]);
    await db.update(enrollmentsTable).set({ progress: 35, status: "in_progress" }).where(eq(enrollmentsTable.id, enrollment.id));
    assignedId = await create("admin", { groupIds: [groups[0], groups[1]], participantIds: [participants[0]] });
    const program = (await list("admin")).find(item => item.id === assignedId)!;
    expect(program.members).toHaveLength(2);
    expect(program.members.find(item => item.participantId === participants[0])?.progress).toBe(35);
    expect((await storage.getEnrollmentsByParticipant(participants[0])).filter(item => item.courseId === courseIds[0])).toHaveLength(1);
    expect(await storage.getEnrollmentsByParticipant(participants[1])).toHaveLength(0);
  });

  it("filters members and counts at the server boundary for each group and participant", async () => {
    for (const role of ["picA", "a"]) {
      const program = (await list(role)).find(item => item.id === assignedId)!;
      expect(program.members.map(item => item.participantId)).toEqual([participants[0]]);
      expect(JSON.stringify(program)).not.toContain(participants[1]);
    }
    expect((await list("picB")).find(item => item.id === assignedId)!.members[0].participantId).toBe(participants[1]);
    expect((await list("independent")).some(item => item.id === assignedId)).toBe(false);
  });

  it("creates a private personal target without assigning other users", async () => {
    personalId = await create("a", { title: "Rencana pribadi rahasia" });
    expect((await list("a")).find(item => item.id === personalId)?.source).toBe("personal");
    for (const role of ["admin", "picA", "picB", "b", "independent"]) {
      expect((await list(role)).some(item => item.id === personalId)).toBe(false);
    }
    const response = await request("a", "/api/learning-programs", "POST", {
      title: "Tidak boleh", courseId: courseIds[0], dueDate: future, participantIds: [participants[1]],
    });
    expect(response.status).toBe(400);
  });

  it("allows independent participants to manage their own targets", async () => {
    const id = await create("independent", { title: "Belajar mandiri independen" });
    expect((await list("independent")).find(item => item.id === id)?.members[0].participantId).toBe(participants[2]);
    expect((await request("independent", `/api/learning-programs/${id}`, "PATCH", { title: "Target telah diperbarui" })).status).toBe(200);
    expect((await list("independent")).find(item => item.id === id)?.title).toBe("Target telah diperbarui");
  });

  it("rejects nonexistent targets, invalid dates, past deadlines, archived courses and empty edits", async () => {
    const payload = { title: "Uji validasi", courseId: courseIds[0], dueDate: future, participantIds: [participants[0]] };
    for (const extra of [{ dueDate: "2026-02-30" }, { dueDate: dayOffset(learningDay(), -1) }, { participantIds: [] }]) {
      expect((await request("admin", "/api/learning-programs", "POST", { ...payload, ...extra })).status).toBe(400);
    }
    for (const extra of [{ participantIds: ["missing"] }, { groupIds: ["missing"] }, { courseId: "missing" }]) {
      expect((await request("admin", "/api/learning-programs", "POST", { ...payload, ...extra })).status).toBe(404);
    }
    expect((await request("admin", `/api/learning-programs/${assignedId}`, "PATCH", {})).status).toBe(400);
    expect((await request("admin", `/api/learning-programs/${assignedId}`, "PATCH", { courseId: courseIds[1] })).status).toBe(400);
    const { LEGACY_BUJK_COURSE_IDS } = await import("../pkb-catalog");
    expect((await request("admin", "/api/learning-programs", "POST", {
      ...payload, courseId: Array.from(LEGACY_BUJK_COURSE_IDS)[0],
    })).status).toBe(400);
  });

  it("blocks changes to foreign and admin-assigned plans without disclosing private plans", async () => {
    for (const role of ["b", "admin"]) {
      expect((await request(role, `/api/learning-programs/${personalId}`, "PATCH", { title: "Dilarang" })).status).toBe(404);
      expect((await request(role, `/api/learning-programs/${personalId}/cancel`, "POST")).status).toBe(404);
    }
    expect((await request("a", `/api/learning-programs/${assignedId}`, "PATCH", { title: "Dilarang" })).status).toBe(404);
    expect((await request("a", `/api/learning-programs/${assignedId}/cancel`, "POST")).status).toBe(404);
    expect((await request("a", `/api/learning-programs/${assignedId}/remind`, "POST")).status).toBe(403);
  });

  it("keeps 100% lesson progress with a pending test distinct from course completion", async () => {
    const [enrollment] = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.participantId, participants[0]));
    await db.update(enrollmentsTable).set({ progress: 100, status: "in_progress" }).where(eq(enrollmentsTable.id, enrollment.id));
    const member = (await list("a")).find(item => item.id === assignedId)!.members[0];
    expect(member.progress).toBe(100);
    expect(member.status).toBe("in_progress");
  });

  it("edits deadlines, calculates overdue and preserves the original enrollment", async () => {
    expect((await request("admin", `/api/learning-programs/${assignedId}`, "PATCH", {
      title: "Tenggat telah diperbarui", dueDate: dayOffset(learningDay(), -1),
    })).status).toBe(200);
    expect((await list("a")).find(item => item.id === assignedId)?.members[0].status).toBe("overdue");
    expect((await storage.getEnrollmentsByParticipant(participants[0]))[0].progress).toBe(100);
  });

  it("creates assignment notifications and deduplicates simultaneous daily reminders", async () => {
    reminderId = await create("admin", { courseId: courseIds[1], participantIds: [participants[0], participants[1]] });
    const assigned = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, accounts[3]));
    expect(assigned.some(item => item.id.includes(reminderId) && item.link === "/app/learning-programs")).toBe(true);
    const responses = await Promise.all(Array.from({ length: 2 }, () =>
      request("admin", `/api/learning-programs/${reminderId}/remind`, "POST")));
    const results = await Promise.all(responses.map(response => response.json()));
    expect(results.map(item => item.sent).sort()).toEqual([0, 2]);
  });

  it("does not remind completed or deactivated recipients", async () => {
    const id = await create("admin", { courseId: courseIds[2], participantIds: [participants[0], participants[1]] });
    const enrollment = await storage.createEnrollment(participants[0], courseIds[2]);
    await db.update(enrollmentsTable).set({ status: "completed", progress: 100 }).where(eq(enrollmentsTable.id, enrollment.id));
    await db.update(users).set({ isActive: false }).where(eq(users.id, accounts[4]));
    try {
      const response = await request("admin", `/api/learning-programs/${id}/remind`, "POST");
      expect(await response.json()).toEqual({ sent: 0 });
      expect((await list("a")).find(item => item.id === id)?.members[0].status).toBe("completed");
    } finally {
      await db.update(users).set({ isActive: true }).where(eq(users.id, accounts[4]));
    }
  });

  it("materializes approaching-deadline reminders once when a participant checks notifications", async () => {
    const id = await create("independent", { dueDate: dayOffset(learningDay(), 2), courseId: courseIds[1] });
    const memberId = (await list("independent")).find(item => item.id === id)!.members[0].id;
    const notificationId = `learning-reminder:${memberId}:${accounts[5]}:${learningDay()}`;
    for (let index = 0; index < 2; index++) {
      const response = await request("independent", "/api/notifications");
      expect(response.status).toBe(200);
      const notifications = await response.json();
      expect(notifications.filter((item: { id: string }) => item.id === notificationId)).toHaveLength(1);
    }
  });

  it("cancels targets idempotently without deleting enrollment, then blocks further edits or reminders", async () => {
    const before = await storage.getEnrollmentsByParticipant(participants[0]);
    expect((await request("a", `/api/learning-programs/${personalId}/cancel`, "POST")).status).toBe(200);
    expect((await request("a", `/api/learning-programs/${personalId}/cancel`, "POST")).status).toBe(200);
    expect((await list("a")).find(item => item.id === personalId)?.canceledAt).toBeTruthy();
    expect((await request("a", `/api/learning-programs/${personalId}`, "PATCH", { title: "Tidak boleh diubah" })).status).toBe(409);
    expect(await storage.getEnrollmentsByParticipant(participants[0])).toEqual(before);
    expect((await request("admin", `/api/learning-programs/${reminderId}/cancel`, "POST")).status).toBe(200);
    expect(await (await request("admin", `/api/learning-programs/${reminderId}/remind`, "POST")).json()).toEqual({ sent: 0 });
  });

  it("retains linked course history instead of cascading program deletion", async () => {
    expect((await request("admin", `/api/courses/${courseIds[0]}`, "DELETE")).status).toBe(409);
    expect((await db.select().from(coursesTable).where(eq(coursesTable.id, courseIds[0])))).toHaveLength(1);
    expect((await list("a")).some(item => item.id === assignedId)).toBe(true);
  });
});
