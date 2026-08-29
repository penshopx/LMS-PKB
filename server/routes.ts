import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import {
  requireAuth,
  changeUserPassword,
  passwordChangeAttemptLimiter,
} from "./auth";
import { storage } from "./storage";
import { 
  insertParticipantSchema, 
  insertEvidenceSchema, 
  insertCourseSchema, 
  insertClusterSchema, 
  insertUnitSchema,
  insertLearningPathSchema,
  insertQuizSchema,
  insertCertificateSchema,
  insertAssessorSchema,
  insertAssesseeSchema,
  insertSchemeSchema,
  insertScheduleSchema,
  insertPortfolioSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============ AUTH ROUTES (public) ============
  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      res.json({ id: user.id, username: user.username });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login gagal" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({ id: user.id, username: user.username });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  // Protect all remaining /api/* routes
  app.use("/api", requireAuth);

  // ============ CHANGE PASSWORD ============
  app.post("/api/me/password", async (req, res) => {
    try {
      const user = req.user as { id: string };
      const { currentPassword, newPassword } = req.body ?? {};

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({ message: "currentPassword dan newPassword wajib diisi" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password baru minimal 6 karakter" });
      }

      const source = req.ip || req.socket.remoteAddress || "unknown";
      const attempt = await passwordChangeAttemptLimiter.tryAcquire(user.id, source);
      if (!attempt.allowed) {
        res.set("Retry-After", String(attempt.retryAfterSeconds));
        return res.status(429).json({
          message: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        });
      }

      const result = await changeUserPassword(user.id, currentPassword, newPassword);
      if (result === "user_not_found") {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }
      if (result === "invalid_current_password") {
        return res.status(401).json({ message: "Password saat ini tidak benar" });
      }

      try {
        await passwordChangeAttemptLimiter.recordSuccessfulChange(user.id, source);
      } catch (error) {
        console.error("[auth] Failed to clear successful password-change attempt:", error);
      }
      res.json({ message: "Password berhasil diubah" });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengubah password" });
    }
  });

  // ============ CLUSTERS ============
  app.get("/api/clusters", async (req, res) => {
    try {
      const clusters = await storage.getClusters();
      res.json(clusters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clusters" });
    }
  });

  app.get("/api/clusters/:id", async (req, res) => {
    try {
      const cluster = await storage.getCluster(req.params.id);
      if (!cluster) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.json(cluster);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cluster" });
    }
  });

  app.post("/api/clusters", async (req, res) => {
    try {
      const data = insertClusterSchema.parse(req.body);
      const cluster = await storage.createCluster(data);
      res.status(201).json(cluster);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create cluster" });
    }
  });

  app.patch("/api/clusters/:id", async (req, res) => {
    try {
      const cluster = await storage.updateCluster(req.params.id, req.body);
      if (!cluster) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.json(cluster);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cluster" });
    }
  });

  app.delete("/api/clusters/:id", async (req, res) => {
    try {
      const success = await storage.deleteCluster(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cluster" });
    }
  });

  // ============ UNITS ============
  app.get("/api/units", async (req, res) => {
    try {
      const clusterId = req.query.clusterId as string | undefined;
      if (clusterId) {
        const units = await storage.getUnitsByCluster(clusterId);
        return res.json(units);
      }
      const units = await storage.getUnits();
      res.json(units);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });

  app.get("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.getUnit(req.params.id);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unit" });
    }
  });

  app.post("/api/units", async (req, res) => {
    try {
      const data = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(data);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create unit" });
    }
  });

  app.patch("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.updateUnit(req.params.id, req.body);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ message: "Failed to update unit" });
    }
  });

  app.delete("/api/units/:id", async (req, res) => {
    try {
      const success = await storage.deleteUnit(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });

  // ============ COURSES ============
  app.get("/api/courses", async (req, res) => {
    try {
      const unitId = req.query.unitId as string | undefined;
      if (unitId) {
        const courses = await storage.getCoursesByUnit(unitId);
        return res.json(courses);
      }
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const data = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(data);
      res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const success = await storage.deleteCourse(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // ============ PARTICIPANTS ============
  app.get("/api/participants", async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  app.get("/api/participants/:id", async (req, res) => {
    try {
      const participant = await storage.getParticipant(req.params.id);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participant" });
    }
  });

  app.post("/api/participants", async (req, res) => {
    try {
      const data = insertParticipantSchema.parse(req.body);
      const participant = await storage.createParticipant(data);
      res.status(201).json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create participant" });
    }
  });

  app.patch("/api/participants/:id/competencies", async (req, res) => {
    try {
      const participant = await storage.updateParticipantCompetencies(
        req.params.id,
        req.body.competencies
      );
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Failed to update competencies" });
    }
  });

  app.delete("/api/participants/:id", async (req, res) => {
    try {
      const success = await storage.deleteParticipant(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // ============ EVIDENCES ============
  app.post("/api/participants/:id/evidences", async (req, res) => {
    try {
      const data = insertEvidenceSchema.parse(req.body);
      const evidence = await storage.addEvidence(req.params.id, data);
      res.status(201).json(evidence);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add evidence" });
    }
  });

  app.patch("/api/participants/:participantId/evidences/:evidenceId", async (req, res) => {
    try {
      const { status, score, feedback } = req.body;
      const evidence = await storage.updateEvidenceStatus(
        req.params.participantId,
        req.params.evidenceId,
        status,
        score,
        feedback
      );
      if (!evidence) {
        return res.status(404).json({ message: "Evidence not found" });
      }
      res.json(evidence);
    } catch (error) {
      res.status(500).json({ message: "Failed to update evidence" });
    }
  });

  // ============ DASHBOARD ============
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/heatmap", async (req, res) => {
    try {
      const heatmap = await storage.getHeatmapData();
      res.json(heatmap);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // ============ LEARNING PATHS ============
  app.get("/api/learning-paths", async (req, res) => {
    try {
      const paths = await storage.getLearningPaths();
      res.json(paths);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch learning paths" });
    }
  });

  app.get("/api/learning-paths/:id", async (req, res) => {
    try {
      const path = await storage.getLearningPath(req.params.id);
      if (!path) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.json(path);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch learning path" });
    }
  });

  app.post("/api/learning-paths", async (req, res) => {
    try {
      const data = insertLearningPathSchema.parse(req.body);
      const path = await storage.createLearningPath(data);
      res.status(201).json(path);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create learning path" });
    }
  });

  app.patch("/api/learning-paths/:id", async (req, res) => {
    try {
      const path = await storage.updateLearningPath(req.params.id, req.body);
      if (!path) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.json(path);
    } catch (error) {
      res.status(500).json({ message: "Failed to update learning path" });
    }
  });

  app.delete("/api/learning-paths/:id", async (req, res) => {
    try {
      const success = await storage.deleteLearningPath(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete learning path" });
    }
  });

  // ============ ENROLLMENTS ============
  app.get("/api/enrollments", async (req, res) => {
    try {
      const participantId = req.query.participantId as string | undefined;
      if (participantId) {
        const enrollments = await storage.getEnrollmentsByParticipant(participantId);
        return res.json(enrollments);
      }
      const enrollments = await storage.getEnrollments();
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    try {
      const { participantId, courseId, learningPathId } = req.body;
      const enrollment = await storage.createEnrollment(participantId, courseId, learningPathId);
      res.status(201).json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create enrollment" });
    }
  });

  app.patch("/api/enrollments/:id/progress", async (req, res) => {
    try {
      const { progress, status } = req.body;
      const enrollment = await storage.updateEnrollmentProgress(req.params.id, progress, status);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      res.json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update enrollment" });
    }
  });

  // ============ QUIZZES ============
  app.get("/api/quizzes", async (req, res) => {
    try {
      const courseId = req.query.courseId as string | undefined;
      if (courseId) {
        const quizzes = await storage.getQuizzesByCourse(courseId);
        return res.json(quizzes);
      }
      const quizzes = await storage.getQuizzes();
      res.json(quizzes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quizzes" });
    }
  });

  app.get("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });

  app.post("/api/quizzes", async (req, res) => {
    try {
      const data = insertQuizSchema.parse(req.body);
      const quiz = await storage.createQuiz({ ...data, questions: req.body.questions || [] });
      res.status(201).json(quiz);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.delete("/api/quizzes/:id", async (req, res) => {
    try {
      const success = await storage.deleteQuiz(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });

  // ============ QUIZ ATTEMPTS ============
  app.get("/api/quizzes/:quizId/attempts", async (req, res) => {
    try {
      const attempts = await storage.getQuizAttempts(req.params.quizId);
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.get("/api/participants/:participantId/quiz-attempts", async (req, res) => {
    try {
      const attempts = await storage.getQuizAttemptsByParticipant(req.params.participantId);
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.post("/api/quizzes/:quizId/attempts", async (req, res) => {
    try {
      const attempt = await storage.createQuizAttempt({
        quizId: req.params.quizId,
        ...req.body
      });
      res.status(201).json(attempt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create quiz attempt" });
    }
  });

  // ============ CERTIFICATES ============
  app.get("/api/certificates", async (req, res) => {
    try {
      const participantId = req.query.participantId as string | undefined;
      if (participantId) {
        const certificates = await storage.getCertificatesByParticipant(participantId);
        return res.json(certificates);
      }
      const certificates = await storage.getCertificates();
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.get("/api/certificates/:id", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  app.post("/api/certificates", async (req, res) => {
    try {
      const data = insertCertificateSchema.parse(req.body);
      const certificate = await storage.createCertificate(data);
      res.status(201).json(certificate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create certificate" });
    }
  });

  app.get("/api/certificates/verify/:certificateNumber", async (req, res) => {
    try {
      const certificate = await storage.verifyCertificate(req.params.certificateNumber);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found", valid: false });
      }
      res.json({ valid: true, certificate });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify certificate" });
    }
  });

  // ============ ASSESSORS ============
  app.get("/api/assessors", async (req, res) => {
    try {
      const assessors = await storage.getAssessors();
      res.json(assessors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessors" });
    }
  });

  app.get("/api/assessors/:id", async (req, res) => {
    try {
      const assessor = await storage.getAssessor(req.params.id);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessor" });
    }
  });

  app.post("/api/assessors", async (req, res) => {
    try {
      const data = insertAssessorSchema.parse(req.body);
      const assessor = await storage.createAssessor(data);
      res.status(201).json(assessor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assessor" });
    }
  });

  app.patch("/api/assessors/:id", async (req, res) => {
    try {
      const assessor = await storage.updateAssessor(req.params.id, req.body);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assessor" });
    }
  });

  app.delete("/api/assessors/:id", async (req, res) => {
    try {
      const success = await storage.deleteAssessor(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assessor" });
    }
  });

  // ============ ASSESSEES ============
  app.get("/api/assessees", async (req, res) => {
    try {
      const assessees = await storage.getAssessees();
      res.json(assessees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessees" });
    }
  });

  app.get("/api/assessees/:id", async (req, res) => {
    try {
      const assessee = await storage.getAssessee(req.params.id);
      if (!assessee) {
        return res.status(404).json({ message: "Assessee not found" });
      }
      res.json(assessee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessee" });
    }
  });

  app.post("/api/assessees", async (req, res) => {
    try {
      const data = insertAssesseeSchema.parse(req.body);
      const assessee = await storage.createAssessee(data);
      res.status(201).json(assessee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assessee" });
    }
  });

  app.patch("/api/assessees/:id/status", async (req, res) => {
    try {
      const assessee = await storage.updateAssesseeStatus(req.params.id, req.body.status);
      if (!assessee) {
        return res.status(404).json({ message: "Assessee not found" });
      }
      res.json(assessee);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assessee status" });
    }
  });

  // ============ COMPETENCY SCHEMES ============
  app.get("/api/schemes", async (req, res) => {
    try {
      const schemes = await storage.getSchemes();
      res.json(schemes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schemes" });
    }
  });

  app.get("/api/schemes/:id", async (req, res) => {
    try {
      const scheme = await storage.getScheme(req.params.id);
      if (!scheme) {
        return res.status(404).json({ message: "Scheme not found" });
      }
      res.json(scheme);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scheme" });
    }
  });

  app.post("/api/schemes", async (req, res) => {
    try {
      const data = insertSchemeSchema.parse(req.body);
      const scheme = await storage.createScheme(data);
      res.status(201).json(scheme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create scheme" });
    }
  });

  // ============ ASSESSMENT SCHEDULES ============
  app.get("/api/schedules", async (req, res) => {
    try {
      const schedules = await storage.getSchedules();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.getSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const data = insertScheduleSchema.parse(req.body);
      const schedule = await storage.createSchedule(data);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.patch("/api/schedules/:id/status", async (req, res) => {
    try {
      const schedule = await storage.updateScheduleStatus(req.params.id, req.body.status);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to update schedule status" });
    }
  });

  // ============ PORTFOLIO ============
  app.get("/api/assessees/:assesseeId/portfolio", async (req, res) => {
    try {
      const items = await storage.getPortfolioItems(req.params.assesseeId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio items" });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    try {
      const data = insertPortfolioSchema.parse(req.body);
      const item = await storage.createPortfolioItem(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create portfolio item" });
    }
  });

  app.patch("/api/portfolio/:id/status", async (req, res) => {
    try {
      const { status, feedback } = req.body;
      const item = await storage.updatePortfolioStatus(req.params.id, status, feedback);
      if (!item) {
        return res.status(404).json({ message: "Portfolio item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update portfolio status" });
    }
  });

  // ============ CERTIFICATION RESULTS ============
  app.get("/api/certification-results", async (req, res) => {
    try {
      const results = await storage.getCertificationResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certification results" });
    }
  });

  app.post("/api/certification-results", async (req, res) => {
    try {
      const result = await storage.createCertificationResult(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to create certification result" });
    }
  });

  // ============ LSP ORGANIZATIONS ============
  app.get("/api/lsp-organizations", async (req, res) => {
    try {
      const orgs = await storage.getLSPOrganizations();
      res.json(orgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LSP organizations" });
    }
  });

  app.get("/api/lsp-organizations/:id", async (req, res) => {
    try {
      const org = await storage.getLSPOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ message: "LSP organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LSP organization" });
    }
  });

  // ============ NOTIFICATIONS ============
  app.get("/api/notifications", async (req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const notif = await storage.markNotificationRead(req.params.id);
      if (!notif) return res.status(404).json({ message: "Notification not found" });
      res.json(notif);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // ============ SEARCH ============
  app.get("/api/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const results = await storage.searchAll(query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // ============ ANALYTICS ============
  app.get("/api/analytics", async (req, res) => {
    try {
      const data = await storage.getAnalyticsData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  return httpServer;
}
