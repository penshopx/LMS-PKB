import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  baselineLessonReferences, lessonReferenceSchema, lessonReferencesSchema,
  updateLessonReferencesSchema,
} from "../../shared/course-references";
import { registerCourseReferenceRoutes, type ReferenceUpdateResult } from "../course-reference-routes";
import { PUB_COURSES } from "../pub-catalog";

const sample = { sourceId: "PU-6-2025" as const, pageStart: 29, note: "Konteks pembelajaran" };

describe("lesson reference validation and baseline", () => {
  it("accepts ranges and normalizes optional notes without claiming official verification", () => {
    expect(lessonReferenceSchema.parse({ ...sample, pageEnd: 34, section: "  PUB  " }).section).toBe("PUB");
    expect(lessonReferencesSchema.parse([])).toEqual([]);
  });
  it.each([0, -1, 1.5, 92, "29", null, ""])("rejects invalid start page %s", pageStart => {
    expect(lessonReferenceSchema.safeParse({ ...sample, pageStart }).success).toBe(false);
  });
  it("rejects reversed or oversized ranges and unknown document IDs", () => {
    for (const change of [
      { pageEnd: 28 }, { pageEnd: 92 }, { sourceId: "PUPR-7-2024" },
      { sourceId: "DAGRI-7-2024", pageStart: 141 }, { note: " " },
      { verified: true }, { url: "javascript:alert(1)" },
    ]) expect(lessonReferenceSchema.safeParse({ ...sample, ...change }).success).toBe(false);
    expect(lessonReferenceSchema.safeParse({ ...sample, sourceId: "DAGRI-7-2024", pageStart: 140 }).success).toBe(true);
    expect(lessonReferencesSchema.safeParse(Array(13).fill(sample)).success).toBe(false);
    expect(updateLessonReferencesSchema.safeParse({ references: [sample] }).success).toBe(false);
  });
  it("keeps baseline references valid and PANCEK without an invented legal mandate", () => {
    for (const course of PUB_COURSES) for (const lesson of course.lessons) {
      expect(lessonReferencesSchema.safeParse(lesson.references ?? []).success).toBe(true);
    }
    expect(baselineLessonReferences("pan-01")).toEqual([]);
    for (const prefix of ["legal-", "sert-", "tender-", "proyek-", "smap-"]) {
      const courses = PUB_COURSES.filter(course => course.unitId.startsWith(prefix));
      expect(courses.length).toBeGreaterThan(0);
      for (const course of courses) {
        expect(course.lessons.some(lesson => lesson.references?.length)).toBe(true);
      }
    }
  });
});

let server: Server;
let origin: string;
const update = vi.fn<() => Promise<ReferenceUpdateResult>>();
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Disposable role fixture only; the real app uses its existing auth middleware.
  app.use((req, _res, next) => {
    const role = req.get("X-Test-Role");
    if (role) req.user = { role } as Express.User;
    next();
  });
  registerCourseReferenceRoutes(app, update);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server unavailable");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

async function patch(role: string | undefined, body: unknown) {
  return fetch(`${origin}/api/courses/course/lessons/lesson/references`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(role ? { "X-Test-Role": role } : {}) },
    body: JSON.stringify(body),
  });
}
describe("reference mutation boundary", () => {
  it.each([undefined, "participant", "bujk_pic"])("refuses writes from %s before touching storage", async role => {
    update.mockClear();
    const response = await patch(role, { references: [sample], expectedReferences: [] });
    expect(response.status).toBe(role ? 403 : 401);
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects malformed changes before touching storage", async () => {
    update.mockClear();
    expect((await patch("admin", { references: [{ ...sample, pageStart: 99 }], expectedReferences: [] })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("supports adding, editing and explicitly clearing references", async () => {
    for (const references of [[sample], [{ ...sample, note: "Updated relevance" }], []]) {
      update.mockResolvedValueOnce({ status: "saved", references });
      const response = await patch("admin", { references, expectedReferences: [] });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ references });
    }
  });
  it.each([
    ["course_missing", 404], ["lesson_missing", 404], ["conflict", 409],
  ] as const)("reports %s explicitly", async (status, code) => {
    update.mockResolvedValueOnce({ status });
    expect((await patch("admin", { references: [], expectedReferences: [] })).status).toBe(code);
  });
  it("does not imply rollback when storage outcome is unconfirmed", async () => {
    update.mockRejectedValueOnce(new Error("private storage detail"));
    const response = await patch("admin", { references: [], expectedReferences: [] });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toContain("belum dapat dikonfirmasi");
    expect(JSON.stringify(body)).not.toContain("private storage");
  });
});
