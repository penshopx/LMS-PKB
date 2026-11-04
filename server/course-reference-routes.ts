import type { Express } from "express";
import type { LessonReference } from "../shared/course-references";
import { updateLessonReferencesSchema } from "../shared/course-references";
import type { User } from "../shared/schema";

export type ReferenceUpdate = {
  courseId: string;
  lessonId: string;
  references: LessonReference[];
  expectedReferences: LessonReference[];
};
export type ReferenceUpdateResult =
  | { status: "saved"; references: LessonReference[] }
  | { status: "course_missing" | "lesson_missing" | "conflict" };

export function registerCourseReferenceRoutes(
  app: Express,
  update: (input: ReferenceUpdate) => Promise<ReferenceUpdateResult>,
) {
  app.patch("/api/courses/:courseId/lessons/:lessonId/references", async (req, res) => {
    const user = req.user as User | undefined;
    if (!user) return res.status(401).json({ message: "Silakan masuk kembali." });
    if (user.role !== "admin") return res.status(403).json({ message: "Hanya admin yang dapat mengubah rujukan materi." });
    const parsed = updateLessonReferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Rujukan tidak valid. Periksa dokumen, halaman, dan catatan relevansi.", errors: parsed.error.flatten() });
    }
    try {
      const result = await update({
        courseId: req.params.courseId,
        lessonId: req.params.lessonId,
        ...parsed.data,
      });
      if (result.status === "course_missing") return res.status(404).json({ message: "Kursus tidak ditemukan." });
      if (result.status === "lesson_missing") return res.status(404).json({ message: "Lesson tidak ditemukan." });
      if (result.status === "conflict") return res.status(409).json({ message: "Rujukan telah diubah admin lain. Muat ulang sebelum menyimpan." });
      if (result.status === "saved") return res.json({ references: result.references });
    } catch {
      return res.status(500).json({ message: "Rujukan belum dapat dikonfirmasi tersimpan. Muat ulang sebelum mencoba lagi." });
    }
  });
}
