import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bujksTable, users, practiceMissionsTable, missionSubmissionsTable, enrollmentsTable,
  quizAttemptsTable, certificatesTable,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";

const tag = randomUUID();
const password = "mission-route-test-password";
const bujkIds = [randomUUID(), randomUUID()];
const userIds: string[] = [];
const participantIds: string[] = [];
const courseIds: string[] = [];
const missionIds: string[] = [];
const cookies: Record<string, string> = {};
let server: Server;
let baseUrl = "";
const checklist = ["Pisahkan fakta dari asumsi", "Catat tindak lanjut dan penanggung jawab"];
const missionData = {
  title: "Latihan keputusan tender singkat",
  objective: "Mencatat dasar keputusan dan tindak lanjut yang dapat diperiksa.",
  scenario: "Simulasi: dokumen belum lengkap dan tenggat tiga hari. Susun keputusan sementara dan langkah verifikasi.",
  sourceText: "Sumber latihan publik, bukan dokumen rahasia.",
  durationMinutes: 10,
  checklist,
};
const evidenceText = "Fakta: satu dokumen belum lengkap. Tindakan: konfirmasi penanggung jawab sebelum tenggat dan catat hasilnya.";
function submission(key = randomUUID()) {
  return { submissionKey: key, completedChecklist: checklist, evidenceText, evidenceUrl: "https://example.test/evidence", privateReflection: "Refleksi pribadi peserta yang tidak boleh dibaca PIC." };
}
async function request(role: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookies[role] ? { Cookie: cookies[role] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function createMission(courseId = courseIds[0]) {
  const response = await request("admin", "/api/practice-missions", "POST", { ...missionData, courseId });
  expect(response.status).toBe(201);
  const mission = await response.json();
  missionIds.push(mission.id);
  return mission.id as string;
}
async function send(role: string, missionId: string, body = submission()) {
  return request(role, `/api/practice-missions/${missionId}/submissions`, "POST", body);
}
async function review(id: string, body: Record<string, unknown> = { status: "accepted", feedback: "Bukti sudah menunjukkan tindakan yang dapat ditelusuri.", nextPracticeAt: null }) {
  return request("admin", `/api/practice-missions/submissions/${id}/review`, "POST", body);
}

beforeAll(async () => {
  await db.insert(bujksTable).values(bujkIds.map((id, index) => ({ id, name: `Mission BUJK ${index} ${tag}`, createdAt: new Date().toISOString() })));
  for (let index = 0; index < 3; index++) {
    const participant = await storage.createParticipant({
      name: `Mission learner ${index}`, email: `mission-${index}-${tag}@example.test`,
      nip: randomUUID(), position: "Staf", unit: "Tender", bujkId: bujkIds[index === 1 ? 1 : 0],
    });
    participantIds.push(participant.id);
  }
  for (let index = 0; index < 2; index++) {
    const course = await storage.createCourse({
      unitId: "tender-01", targetLevel: "L2", title: `Mission course ${index} ${tag}`, description: "Course for mission isolation", duration: "1 jam",
    });
    courseIds.push(course.id);
  }
  await storage.createEnrollment(participantIds[0], courseIds[0]);
  await storage.createEnrollment(participantIds[1], courseIds[0]);
  const accounts = [
    { key: "admin", role: "admin" as const },
    { key: "pic", role: "bujk_pic" as const, bujkId: bujkIds[0] },
    { key: "a", role: "participant" as const, bujkId: bujkIds[0], participantId: participantIds[0] },
    { key: "b", role: "participant" as const, bujkId: bujkIds[1], participantId: participantIds[1] },
    { key: "unenrolled", role: "participant" as const, bujkId: bujkIds[0], participantId: participantIds[2] },
  ];
  for (const account of accounts) userIds.push((await createUser(`mission-${account.key}-${tag}`, password, account)).id);
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  }));
  for (const { key } of accounts) {
    const response = await request("", "/api/login", "POST", { username: `mission-${key}-${tag}`, password });
    expect(response.status).toBe(200);
    cookies[key] = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  }
});

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (missionIds.length) {
    await db.delete(missionSubmissionsTable).where(inArray(missionSubmissionsTable.missionId, missionIds));
    await db.delete(practiceMissionsTable).where(inArray(practiceMissionsTable.id, missionIds));
  }
  for (const id of courseIds) await storage.deleteCourse(id);
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  for (const id of participantIds) await storage.deleteParticipant(id);
  await db.delete(bujksTable).where(inArray(bujksTable.id, bujkIds));
});

describe("misi praktik: akses dan validasi", () => {
  it("mengharuskan login dan hanya admin yang dapat membuat atau mengarsipkan misi", async () => {
    expect((await request("", "/api/practice-missions")).status).toBe(401);
    for (const role of ["pic", "a"]) {
      expect((await request(role, "/api/practice-missions", "POST", {})).status).toBe(403);
      expect((await request(role, "/api/practice-missions/unknown", "PATCH", { active: false })).status).toBe(403);
    }
    expect((await request("admin", "/api/practice-missions", "POST", { ...missionData, courseId: courseIds[0], durationMinutes: 30 })).status).toBe(400);
    expect((await request("admin", "/api/practice-missions", "POST", { ...missionData, courseId: courseIds[0], checklist: [checklist[0], checklist[0]] })).status).toBe(400);
  });

  it("menampilkan misi hanya untuk kursus yang diikuti peserta atau tim PIC", async () => {
    const own = await createMission();
    const other = await createMission(courseIds[1]);
    for (const role of ["a", "pic"]) {
      const missions = await (await request(role, "/api/practice-missions")).json();
      expect(missions.some((item: { id: string }) => item.id === own)).toBe(true);
      expect(missions.some((item: { id: string }) => item.id === other)).toBe(false);
    }
    const notEnrolled = await (await request("unenrolled", "/api/practice-missions")).json();
    expect(notEnrolled).toEqual([]);
    expect((await send("unenrolled", own)).status).toBe(403);
    expect((await send("pic", own)).status).toBe(403);
  });

  it("mengharuskan checklist lengkap, bukti cukup, dan tautan HTTPS", async () => {
    const id = await createMission();
    expect((await send("a", id, { ...submission(), completedChecklist: [checklist[0]] })).status).toBe(400);
    expect((await send("a", id, { ...submission(), completedChecklist: [checklist[0], checklist[0]] })).status).toBe(400);
    expect((await send("a", id, { ...submission(), evidenceText: "Singkat" })).status).toBe(400);
    expect((await send("a", id, { ...submission(), evidenceUrl: "javascript:alert(1)" })).status).toBe(400);
  });
});

describe("misi praktik: kirim ulang, privasi, feedback dan pengulangan", () => {
  it("dua kiriman identik bersamaan hanya menyimpan satu putaran dan retry mengembalikan hasil yang sama", async () => {
    const id = await createMission();
    const body = submission();
    const responses = await Promise.all([send("a", id, body), send("a", id, body)]);
    expect(responses.map(item => item.status).sort()).toEqual([200, 201]);
    const results = await Promise.all(responses.map(item => item.json()));
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].round).toBe(1);
    expect((await send("a", id, { ...body, evidenceText: `${evidenceText} Konten berbeda.` })).status).toBe(409);
    expect((await send("a", id)).status).toBe(409);
    expect((await db.select().from(missionSubmissionsTable).where(eq(missionSubmissionsTable.missionId, id))).length).toBe(1);
  });

  it("putaran dan kunci pengiriman peserta berbeda tidak saling memblokir", async () => {
    const id = await createMission();
    const body = submission();
    const a = await send("a", id, body);
    const b = await send("b", id, body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(await a.json()).toMatchObject({ participantId: participantIds[0], round: 1 });
    expect(await b.json()).toMatchObject({ participantId: participantIds[1], round: 1 });
  });

  it("PIC hanya mendapat bukti BUJK-nya tanpa properti refleksi pribadi", async () => {
    const id = await createMission();
    await send("a", id);
    await send("b", id);
    const picResults = await (await request("pic", "/api/practice-missions/submissions")).json();
    expect(picResults.some((item: { missionId: string }) => item.missionId === id)).toBe(true);
    expect(picResults.every((item: { participantId: string }) => item.participantId !== participantIds[1])).toBe(true);
    expect(picResults.every((item: object) => !("privateReflection" in item))).toBe(true);
    const ownResults = await (await request("a", "/api/practice-missions/submissions")).json();
    expect(ownResults.every((item: { participantId: string }) => item.participantId === participantIds[0])).toBe(true);
    expect(ownResults.some((item: { privateReflection: string }) => item.privateReflection === submission().privateReflection)).toBe(true);
    const adminResults = await (await request("admin", "/api/practice-missions/submissions")).json();
    expect(adminResults.some((item: { missionId: string; participantId: string }) => item.missionId === id && item.participantId === participantIds[1])).toBe(true);
  });

  it("hanya satu feedback admin disimpan saat review bersamaan dan tidak dapat ditimpa", async () => {
    const id = await createMission();
    const saved = await (await send("a", id)).json();
    for (const role of ["a", "pic"]) {
      expect((await request(role, `/api/practice-missions/submissions/${saved.id}/review`, "POST", { status: "accepted", feedback: "Tidak berhak menilai" })).status).toBe(403);
    }
    const reviewed = await Promise.all([review(saved.id), review(saved.id)]);
    expect(reviewed.map(item => item.status).sort()).toEqual([200, 409]);
    expect((await review(saved.id)).status).toBe(409);
  });

  it("memerlukan tanggal untuk pengulangan dan membuat riwayat putaran baru setelah feedback", async () => {
    const id = await createMission();
    const firstBody = submission();
    const first = await (await send("a", id, firstBody)).json();
    expect((await review(first.id, { status: "repeat_requested", feedback: "Tambahkan penanggung jawab tindak lanjut." })).status).toBe(400);
    expect((await review(first.id, { status: "repeat_requested", feedback: "Tambahkan penanggung jawab tindak lanjut.", nextPracticeAt: "2099-01-01" })).status).toBe(200);
    const retry = await send("a", id, firstBody);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ id: first.id, round: 1, status: "repeat_requested", nextPracticeAt: "2099-01-01" });
    const repeated = await send("a", id);
    expect(repeated.status).toBe(201);
    expect(await repeated.json()).toMatchObject({ round: 2, status: "pending_review" });
  });

  it("arsip mencegah praktik baru tetapi mempertahankan bukti dan dapat diaktifkan kembali", async () => {
    const id = await createMission();
    const first = await (await send("a", id)).json();
    await review(first.id);
    expect((await request("admin", `/api/practice-missions/${id}`, "PATCH", { active: false })).status).toBe(200);
    expect((await send("a", id)).status).toBe(409);
    const visible = await (await request("a", "/api/practice-missions")).json();
    expect(visible.some((item: { id: string }) => item.id === id)).toBe(false);
    const history = await (await request("a", "/api/practice-missions/submissions")).json();
    expect(history.some((item: { id: string }) => item.id === first.id)).toBe(true);
    expect((await request("admin", `/api/practice-missions/${id}`, "PATCH", { active: true })).status).toBe(200);
    expect((await send("a", id)).status).toBe(201);
  });

  it("praktik dan feedback tidak menambah progres lesson, percobaan kuis, atau sertifikat", async () => {
    const snapshot = async () => ({
      enrollments: await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.participantId, participantIds[0])),
      attempts: await db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.participantId, participantIds[0])),
      certificates: await db.select().from(certificatesTable).where(eq(certificatesTable.participantId, participantIds[0])),
    });
    const before = await snapshot();
    const id = await createMission();
    const saved = await (await send("a", id)).json();
    await review(saved.id);
    expect(await snapshot()).toEqual(before);
  });

  it("menghapus kursus tidak menghapus riwayat bukti praktik", async () => {
    await storage.createEnrollment(participantIds[0], courseIds[1]);
    const id = await createMission(courseIds[1]);
    const saved = await (await send("a", id)).json();
    await storage.deleteCourse(courseIds[1]);
    const [mission] = await db.select().from(practiceMissionsTable).where(eq(practiceMissionsTable.id, id));
    expect(mission.courseId).toBeNull();
    const [proof] = await db.select().from(missionSubmissionsTable).where(and(eq(missionSubmissionsTable.missionId, id), eq(missionSubmissionsTable.id, saved.id)));
    expect(proof.evidenceText).toBe(evidenceText);
    expect((await review(saved.id)).status).toBe(200);
    expect((await send("a", id)).status).toBe(409);
  });
});
