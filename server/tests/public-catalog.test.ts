import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { createUser, setupAuth } from "../auth";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { loginAttemptKeys } from "../login-attempt-limiter";
import { users, participantsTable, enrollmentsTable } from "@shared/schema";
import { courseEntryDestination } from "../../client/src/lib/course-entry";

const tag = randomUUID();
const email = `public-${tag}@example.test`;
const source = "198.51.100.221";
const password = "Test-public-secure-2026";
const keys = new Set<string>();
let server: Server;
let base: string;
let courseId: string;
let adminId: string;
let adminCookie: string;
let learnerCookie: string;
let participantId: string;

function request(path: string, body?: unknown, cookie = "", method = body ? "POST" : "GET") {
  return fetch(`${base}${path}`, {
    method, redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Forwarded-For": source },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function login(username: string, suppliedPassword: string) {
  loginAttemptKeys(username, source).forEach(key => keys.add(key));
  const response = await request("/api/login", { username, password: suppliedPassword });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0];
}

beforeAll(async () => {
  await pool.query(readFileSync(new URL("../migrations/021_public_catalog.sql", import.meta.url), "utf8"));
  const admin = await createUser(`public-admin-${tag}`, password);
  adminId = admin.id;
  const course = await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: `Katalog publik ${tag}`,
    description: "Ringkasan publik", duration: "1 jam",
  });
  courseId = course.id;
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  base = `http://127.0.0.1:${address.port}`;
  adminCookie = await login(admin.username, password);
});

afterAll(async () => {
  if (courseId) await storage.deleteCourse(courseId);
  await db.delete(users).where(eq(users.username, email));
  if (participantId) await storage.deleteParticipant(participantId);
  if (adminId) await db.delete(users).where(eq(users.id, adminId));
  await pool.query("DELETE FROM login_attempts WHERE attempt_key = ANY($1::text[])", [[...keys]]);
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("katalog publik dan registrasi mandiri", () => {
  it("menyajikan ringkasan tanpa konten lesson, jawaban, atau tautan rekaman", async () => {
    const response = await request(`/api/public/courses/${courseId}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: courseId, format: "self_paced", instructor: "" });
    expect(Object.keys(body).sort()).toEqual([
      "id", "title", "description", "duration", "targetLevel", "lessonCount", "lessons", "format", "startsAt", "instructor",
    ].sort());
    for (const lesson of body.lessons) expect(Object.keys(lesson).sort()).toEqual(["title", "type"]);
    expect((await request("/api/courses")).status).toBe(401);
    expect((await request("/api/catalog/settings")).status).toBe(401);
  });

  it("menolak sandi lemah dan penentuan peran oleh pendaftar", async () => {
    for (const body of [
      { name: "Peserta", email, password: "password123456" },
      { name: "Peserta", email, password, role: "admin" },
      { name: "Peserta", email, password, bujkId: "other-company" },
    ]) expect((await request("/api/register", body)).status).toBe(400);
  });

  it("membuat akun peserta tanpa BUJK dan menolak email duplikat tanpa profil yatim", async () => {
    loginAttemptKeys(`registration:${email}`, `registration:${source}`).forEach(key => keys.add(key));
    const registration = { name: "Peserta Mandiri", email: email.toUpperCase(), password };
    const response = await request("/api/register", registration);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ username: email });
    expect((await request("/api/me")).status).toBe(401); // No implicit sign-in.
    const [account] = await db.select().from(users).where(eq(users.username, email));
    participantId = account.participantId!;
    expect(account).toMatchObject({ role: "participant", bujkId: null, isActive: true });
    expect(account.password).not.toBe(password);
    expect((await request("/api/register", registration)).status).toBe(409);
    expect(await db.select().from(participantsTable).where(eq(participantsTable.email, email))).toHaveLength(1);
    learnerCookie = await login(email, password);
    expect((await request("/api/catalog/settings", undefined, learnerCookie)).status).toBe(403);
  });

  it("mempublikasikan jadwal mendatang untuk pengunjung dan memvalidasi metadata", async () => {
    const settings = { published: true, format: "upcoming", startsAt: "2026-12-01T09:00:00+07:00", instructor: "Pengajar uji", recordingUrl: "" };
    expect((await request(`/api/catalog/settings/${courseId}`, { ...settings, startsAt: null }, adminCookie, "PUT")).status).toBe(400);
    expect((await request(`/api/catalog/settings/${courseId}`, settings, adminCookie, "PUT")).status).toBe(200);
    expect(await (await request(`/api/public/courses/${courseId}`)).json()).toMatchObject({ format: "upcoming", startsAt: settings.startsAt });
  });

  it("pendaftaran memerlukan login dan aman dikirim bersamaan tanpa enrollment ganda", async () => {
    expect((await request(`/api/catalog/${courseId}/enroll`, {})).status).toBe(401);
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(`/api/catalog/${courseId}/enroll`, {}, learnerCookie)));
    for (const response of responses) expect(response.status).toBe(200);
    const bodies = await Promise.all(responses.map(response => response.json()));
    expect(new Set(bodies.map(body => body.id)).size).toBe(1);
    expect(await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.courseId, courseId))).toHaveLength(1);
    expect(bodies[0].participantId).toBe(participantId);
  });

  it("tautan rekaman tidak ada di katalog publik dan hanya terbuka setelah terdaftar", async () => {
    const settings = { published: true, format: "recording", startsAt: null, instructor: "", recordingUrl: "https://example.com/lesson-recording" };
    expect((await request(`/api/catalog/settings/${courseId}`, { ...settings, recordingUrl: "" }, adminCookie, "PUT")).status).toBe(400);
    expect((await request(`/api/catalog/settings/${courseId}`, settings, adminCookie, "PUT")).status).toBe(200);
    expect((await request(`/api/catalog/${courseId}/recording`)).status).toBe(401);
    const publicBody = await (await request(`/api/public/courses/${courseId}`)).json();
    expect(publicBody.format).toBe("recording");
    expect(publicBody).not.toHaveProperty("recordingUrl");
    const recording = await request(`/api/catalog/${courseId}/recording`, undefined, learnerCookie);
    expect(recording.status).toBe(302);
    expect(recording.headers.get("location")).toBe(settings.recordingUrl);
  });

  it("kursus disembunyikan tidak muncul pada daftar/detail dan tidak menerima pendaftaran publik", async () => {
    expect((await request(`/api/catalog/settings/${courseId}`, {
      published: false, format: "self_paced", startsAt: null, instructor: "", recordingUrl: "",
    }, adminCookie, "PUT")).status).toBe(200);
    expect((await request(`/api/public/courses/${courseId}`)).status).toBe(404);
    const courses = await (await request("/api/public/courses")).json();
    expect(courses.some((course: { id: string }) => course.id === courseId)).toBe(false);
    expect((await request(`/api/catalog/${courseId}/enroll`, {}, learnerCookie)).status).toBe(404);
  });

  it("tujuan setelah login hanya menerima halaman kursus lokal", () => {
    expect(courseEntryDestination("?next=%2Fcourses%2Fcourse-1")).toBe("/courses/course-1");
    for (const value of ["https://example.com", "//example.com", "/courses/../admin", "/courses/a\\evil"]) {
      expect(courseEntryDestination(`?next=${encodeURIComponent(value)}`)).toBe("/app");
    }
  });
});
