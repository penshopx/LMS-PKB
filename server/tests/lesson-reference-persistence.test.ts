import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { coursesTable, type Lesson } from "../../shared/schema";
import { updateCourseLessonReferences } from "../course-reference-store";
import { catalogLessonsPreservingReferences } from "../catalog-reference-sync";
import type { LessonReference } from "../../shared/course-references";

let id: string;
const originalLessons: Lesson[] = [
  { id: "first", order: 1, type: "orientation", title: "First", description: "Description", content: "Keep this content" },
  { id: "second", order: 2, type: "context", title: "Second", description: "Context", content: "Keep other lesson" },
];
const sample: LessonReference = { sourceId: "PU-6-2025", pageStart: 29, note: "Interpretasi untuk latihan" };
const other: LessonReference = { sourceId: "DAGRI-7-2024", pageStart: 118, pageEnd: 119, note: "Konteks BMD saja" };

beforeEach(async () => {
  id = `reference-test-${randomUUID()}`;
  await db.insert(coursesTable).values({
    id, unitId: "tender-01", targetLevel: "L2", title: "Disposable reference test",
    description: "Only test data", duration: "1 jam", lessons: originalLessons, createdAt: "2026-11-04",
  });
});
afterEach(async () => {
  if (id) await db.delete(coursesTable).where(eq(coursesTable.id, id));
});
afterAll(async () => { await pool.end(); });

async function getCourse() {
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  return course;
}
async function change(lessonId: string, references: LessonReference[], expectedReferences: LessonReference[] = []) {
  return updateCourseLessonReferences({ courseId: id, lessonId, references, expectedReferences });
}

describe("PostgreSQL lesson reference persistence", () => {
  it("adds, edits, reads back and removes references without changing lesson content or quiz settings", async () => {
    expect((await change("first", [sample])).status).toBe("saved");
    expect((await getCourse()).lessons[0].references).toEqual([sample]);
    expect((await change("first", [other], [sample])).status).toBe("saved");
    expect((await getCourse()).lessons[0].references).toEqual([other]);
    expect((await change("first", [], [other])).status).toBe("saved");
    const course = await getCourse();
    expect(course.lessons[0]).toEqual({ ...originalLessons[0], references: [] });
    expect(course.lessons[1]).toEqual(originalLessons[1]);
    expect(course.postTestId).toBeNull();
    expect(course.preTestId).toBeNull();
  });
  it("compares JSONB object keys canonically and prevents stale overwrites", async () => {
    await change("first", [sample]);
    const readback = (await getCourse()).lessons[0].references!;
    expect((await change("first", [other], readback)).status).toBe("saved");
    expect((await change("first", [], readback)).status).toBe("conflict");
    expect((await getCourse()).lessons[0].references).toEqual([other]);
  });
  it("allows only one concurrent change from the same baseline", async () => {
    const results = await Promise.all([change("first", [sample]), change("first", [other])]);
    expect(results.map(result => result.status).sort()).toEqual(["conflict", "saved"]);
  });
  it("preserves concurrent edits on different lessons", async () => {
    const results = await Promise.all([change("first", [sample]), change("second", [other])]);
    expect(results.every(result => result.status === "saved")).toBe(true);
    const course = await getCourse();
    expect(course.lessons[0].references).toEqual([sample]);
    expect(course.lessons[1].references).toEqual([other]);
  });
  it("reports deleted course or lesson without writing", async () => {
    expect((await change("missing", [sample])).status).toBe("lesson_missing");
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    expect((await change("first", [sample])).status).toBe("course_missing");
  });
  it("preserves admin changes and explicit deletion across baseline catalog synchronization", async () => {
    await change("first", [other]);
    await change("second", [sample]);
    await change("second", [], [sample]);
    const refreshed = originalLessons.map(lesson => ({
      ...lesson, content: "Refreshed baseline content", references: [sample],
    }));
    const course = await getCourse();
    await db.insert(coursesTable).values({ ...course, lessons: refreshed }).onConflictDoUpdate({
      target: coursesTable.id,
      set: { lessons: catalogLessonsPreservingReferences(refreshed) },
    });
    const result = await getCourse();
    expect(result.lessons[0].references).toEqual([other]);
    expect(result.lessons[1].references).toEqual([]);
    expect(result.lessons.every(lesson => lesson.content === "Refreshed baseline content")).toBe(true);
  });
  it("adds baseline references only when the lesson has never stored its own selection", async () => {
    const refreshed = originalLessons.map(lesson => ({ ...lesson, references: [sample] }));
    const course = await getCourse();
    await db.insert(coursesTable).values({ ...course, lessons: refreshed }).onConflictDoUpdate({
      target: coursesTable.id, set: { lessons: catalogLessonsPreservingReferences(refreshed) },
    });
    expect((await getCourse()).lessons.map(lesson => lesson.references)).toEqual([[sample], [sample]]);
  });
});
