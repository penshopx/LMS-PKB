import type { Express } from "express";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { hashPassword, requireRole } from "./auth";
import { loginAttemptLimiter } from "./login-attempt-limiter";
import { normalizeClientSource } from "./client-source";
import { coursesTable, coursePublicationsTable, participantsTable, users, enrollmentsTable, type User } from "@shared/schema";
import { catalogSettingsSchema, publicRegistrationSchema, type PublicCourse } from "@shared/public-catalog";

const defaults = { published: true, format: "self_paced" as const, startsAt: null, instructor: "", recordingUrl: "" };

async function catalogRows() {
  return db.select({ course: coursesTable, publication: coursePublicationsTable })
    .from(coursesTable)
    .leftJoin(coursePublicationsTable, eq(coursePublicationsTable.courseId, coursesTable.id))
    .orderBy(coursesTable.title);
}

function publicSummary(row: Awaited<ReturnType<typeof catalogRows>>[number]): PublicCourse {
  const settings = row.publication ?? defaults;
  return {
    id: row.course.id, title: row.course.title, description: row.course.description,
    duration: row.course.duration, targetLevel: row.course.targetLevel,
    lessonCount: row.course.lessons.length,
    lessons: row.course.lessons.map(lesson => ({ title: lesson.title, type: lesson.type })),
    format: settings.format, startsAt: settings.startsAt, instructor: settings.instructor,
  };
}

// Register before the global authentication boundary. Only explicit public DTOs leave here.
export function registerPublicCatalogRoutes(app: Express) {
  app.get("/api/public/courses", async (_req, res) => {
    try {
      res.json((await catalogRows()).filter(row => row.publication?.published !== false).map(publicSummary));
    } catch {
      res.status(503).json({ message: "Katalog belum dapat dimuat. Silakan coba lagi." });
    }
  });
  app.get("/api/public/courses/:id", async (req, res) => {
    try {
      const row = (await catalogRows()).find(row => row.course.id === req.params.id && row.publication?.published !== false);
      if (!row) return res.status(404).json({ message: "Kursus tidak ditemukan." });
      res.json(publicSummary(row));
    } catch {
      res.status(503).json({ message: "Detail kursus belum dapat dimuat." });
    }
  });
  app.post("/api/register", async (req, res) => {
    const input = publicRegistrationSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: input.error.issues[0].message });
    try {
      // Separate namespaces: public signup must not consume login reservations.
      const acquisition = await loginAttemptLimiter.tryAcquire(
        `registration:${input.data.email}`,
        `registration:${normalizeClientSource(req.ip ?? req.socket.remoteAddress ?? "unknown")}`,
      );
      if (!acquisition.allowed) {
        res.setHeader("Retry-After", acquisition.retryAfterSeconds);
        return res.status(429).json({ message: "Terlalu banyak percobaan registrasi. Silakan coba lagi nanti.", retryAfterSeconds: acquisition.retryAfterSeconds });
      }
      const password = await hashPassword(input.data.password);
      const created = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.data.email}, 0))`);
        const [existing] = await tx.select({ id: users.id }).from(users)
          .where(sql`lower(${users.username}) = ${input.data.email}`).limit(1);
        const [profile] = await tx.select({ id: participantsTable.id }).from(participantsTable)
          .where(sql`lower(${participantsTable.email}) = ${input.data.email}`).limit(1);
        if (existing || profile) return false;
        const participantId = `p-${randomUUID()}`;
        await tx.insert(participantsTable).values({
          id: participantId, name: input.data.name, email: input.data.email,
          nip: `mandiri-${randomUUID()}`, position: "Peserta mandiri", unit: "Mandiri", bujkId: null,
        });
        await tx.insert(users).values({
          id: randomUUID(), username: input.data.email, password,
          role: "participant", participantId, bujkId: null, isActive: true, sessionVersion: 0,
        });
        return true;
      });
      if (!created) return res.status(409).json({ message: "Email sudah terdaftar. Silakan masuk atau hubungi PIC jika akun berasal dari undangan." });
      res.status(201).json({ username: input.data.email, message: "Akun berhasil dibuat. Silakan masuk." });
    } catch {
      res.status(503).json({ message: "Registrasi belum dapat dikonfirmasi. Coba masuk terlebih dahulu sebelum mendaftar ulang." });
    }
  });
}

// Called only after requireAuth and the role boundary.
export function registerPrivateCatalogRoutes(app: Express) {
  app.get("/api/catalog/settings", requireRole("admin"), async (_req, res) => {
    try {
      res.json((await catalogRows()).map(row => ({
        ...defaults, ...row.publication, courseId: row.course.id, title: row.course.title,
      })));
    } catch {
      res.status(503).json({ message: "Pengaturan katalog gagal dimuat." });
    }
  });
  app.put("/api/catalog/settings/:id", requireRole("admin"), async (req, res) => {
    const input = catalogSettingsSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: input.error.issues[0].message });
    try {
      const courseId = String(req.params.id);
      if (!await storage.getCourse(courseId)) return res.status(404).json({ message: "Kursus tidak ditemukan." });
      const [row] = await db.insert(coursePublicationsTable).values({ courseId, ...input.data })
        .onConflictDoUpdate({ target: coursePublicationsTable.courseId, set: input.data }).returning();
      res.json(row);
    } catch {
      res.status(503).json({ message: "Pengaturan katalog gagal disimpan." });
    }
  });
  app.post("/api/catalog/:id/enroll", requireRole("participant"), async (req, res) => {
    const participantId = (req.user as User).participantId;
    if (!participantId) return res.status(403).json({ message: "Profil peserta belum tersedia." });
    try {
      const courseId = String(req.params.id);
      const enrollment = await db.transaction(async tx => {
        // Serialize public enrollments for the same participant/course only.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${participantId}:${courseId}`}, 0))`);
        const [course] = await tx.select().from(coursesTable).where(eq(coursesTable.id, courseId)).for("share");
        const [publication] = await tx.select().from(coursePublicationsTable)
          .where(eq(coursePublicationsTable.courseId, courseId));
        if (!course || publication?.published === false) return undefined;
        const [existing] = await tx.select().from(enrollmentsTable).where(sql`
          ${enrollmentsTable.participantId} = ${participantId} AND ${enrollmentsTable.courseId} = ${courseId}`);
        if (existing) return existing;
        const [created] = await tx.insert(enrollmentsTable).values({
          id: `enroll-${randomUUID()}`, participantId, courseId,
          enrolledAt: new Date().toISOString(), status: "enrolled", progress: 0,
          completedLessonIds: [],
        }).returning();
        return created;
      });
      if (!enrollment) return res.status(404).json({ message: "Kursus tidak tersedia." });
      res.json(enrollment);
    } catch {
      res.status(503).json({ message: "Pendaftaran kursus belum dapat dikonfirmasi. Silakan coba lagi." });
    }
  });
  app.get("/api/catalog/:id/recording", requireRole("participant"), async (req, res) => {
    try {
      const participantId = (req.user as User).participantId;
      const courseId = String(req.params.id);
      const enrollments = participantId ? await storage.getEnrollmentsByParticipant(participantId) : [];
      if (!enrollments.some(item => item.courseId === courseId)) {
        return res.status(403).json({ message: "Daftar kursus terlebih dahulu untuk melihat rekaman." });
      }
      const [settings] = await db.select().from(coursePublicationsTable)
        .where(eq(coursePublicationsTable.courseId, courseId));
      if (!settings?.recordingUrl || !settings.recordingUrl.startsWith("https://")) {
        return res.status(404).json({ message: "Rekaman belum tersedia." });
      }
      res.redirect(settings.recordingUrl);
    } catch {
      res.status(503).json({ message: "Rekaman belum dapat dibuka." });
    }
  });
}
