import { eq } from "drizzle-orm";
import { db } from "./db";
import { coursesTable } from "../shared/schema";
import { lessonReferencesSchema } from "../shared/course-references";
import type { ReferenceUpdate, ReferenceUpdateResult } from "./course-reference-routes";

export async function updateCourseLessonReferences(input: ReferenceUpdate): Promise<ReferenceUpdateResult> {
  return db.transaction(async tx => {
    const [course] = await tx.select({ lessons: coursesTable.lessons })
      .from(coursesTable).where(eq(coursesTable.id, input.courseId)).for("update");
    if (!course) return { status: "course_missing" };
    const lesson = course.lessons.find(item => item.id === input.lessonId);
    if (!lesson) return { status: "lesson_missing" };
    // Parse both sides to canonical field order: JSONB may reorder object keys.
    const current = lessonReferencesSchema.parse(lesson.references ?? []);
    const expected = lessonReferencesSchema.parse(input.expectedReferences);
    if (JSON.stringify(current) !== JSON.stringify(expected)) return { status: "conflict" };
    const references = lessonReferencesSchema.parse(input.references);
    const lessons = course.lessons.map(item =>
      item.id === input.lessonId ? { ...item, references } : item);
    await tx.update(coursesTable).set({ lessons }).where(eq(coursesTable.id, input.courseId));
    return { status: "saved", references };
  });
}
