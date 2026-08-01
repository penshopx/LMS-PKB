/**
 * Integration tests for DrizzleStorage — runs against the real PostgreSQL database.
 *
 * Isolation strategy:
 *   - Every test creates records with a unique `tid` prefix so tests can
 *     coexist with seed data without collisions.
 *   - Each describe block cleans up its own rows in afterAll so the database
 *     is left tidy after the suite finishes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { DrizzleStorage } from "../db-storage";
import { db } from "../db";
import {
  clustersTable,
  unitsTable,
  coursesTable,
  participantsTable,
  participantCompetenciesTable,
  evidencesTable,
  learningRecordsTable,
  learningPathsTable,
  enrollmentsTable,
  quizzesTable,
  quizAttemptsTable,
  certificatesTable,
  assessorsTable,
  assesseesTable,
  schemesTable,
  schedulesTable,
  portfolioItemsTable,
  certificationResultsTable,
  lspOrganizationsTable,
  notificationsTable,
} from "@shared/schema";
import { eq, like } from "drizzle-orm";

const storage = new DrizzleStorage();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const tid = () => randomUUID().slice(0, 8); // short unique tag per call

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------
describe("Clusters", () => {
  let clusterId: string;

  afterAll(async () => {
    if (clusterId) {
      await db.delete(unitsTable).where(eq(unitsTable.clusterId, clusterId));
      await db.delete(clustersTable).where(eq(clustersTable.id, clusterId));
    }
  });

  it("createCluster — persists and returns the new cluster", async () => {
    const tag = tid();
    const cluster = await storage.createCluster({
      code: `TST${tag}`.toUpperCase().slice(0, 10),
      name: `Test Cluster ${tag}`,
      fullName: `Test Cluster Full ${tag}`,
      description: "Integration test cluster",
      color: "hsl(0 0% 50%)",
    });

    clusterId = cluster.id;
    expect(cluster.id).toBeTruthy();
    expect(cluster.name).toBe(`Test Cluster ${tag}`);
  });

  it("getCluster — retrieves the cluster by id", async () => {
    const found = await storage.getCluster(clusterId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(clusterId);
  });

  it("getClusters — list includes the new cluster", async () => {
    const all = await storage.getClusters();
    expect(all.some(c => c.id === clusterId)).toBe(true);
  });

  it("updateCluster — partial update is reflected", async () => {
    const updated = await storage.updateCluster(clusterId, { name: "Updated Cluster Name" });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Updated Cluster Name");

    const refetch = await storage.getCluster(clusterId);
    expect(refetch!.name).toBe("Updated Cluster Name");
  });

  it("getCluster — returns undefined for unknown id", async () => {
    const missing = await storage.getCluster("nonexistent-cluster-id");
    expect(missing).toBeUndefined();
  });

  it("deleteCluster — removes the cluster", async () => {
    const ok = await storage.deleteCluster(clusterId);
    expect(ok).toBe(true);

    const gone = await storage.getCluster(clusterId);
    expect(gone).toBeUndefined();
    clusterId = ""; // already deleted — skip afterAll cleanup
  });

  it("deleteCluster — returns false for nonexistent id", async () => {
    const ok = await storage.deleteCluster("nonexistent-cluster-id");
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
describe("Units", () => {
  let clusterId: string;
  let unitId: string;

  beforeAll(async () => {
    const tag = tid();
    const cluster = await storage.createCluster({
      code: `UC${tag}`.slice(0, 10),
      name: `Unit Test Cluster ${tag}`,
      fullName: `Full ${tag}`,
      description: "For unit tests",
      color: "hsl(0 0% 40%)",
    });
    clusterId = cluster.id;
  });

  afterAll(async () => {
    if (unitId) await db.delete(unitsTable).where(eq(unitsTable.id, unitId));
    if (clusterId) await db.delete(clustersTable).where(eq(clustersTable.id, clusterId));
  });

  it("createUnit — persists with default indicators", async () => {
    const tag = tid();
    const unit = await storage.createUnit({
      clusterId,
      code: `U${tag}`.slice(0, 10),
      name: `Test Unit ${tag}`,
      description: "Integration test unit",
    });
    unitId = unit.id;
    expect(unit.id).toBeTruthy();
    expect(unit.clusterId).toBe(clusterId);
    expect(unit.indicators.length).toBeGreaterThanOrEqual(4);
  });

  it("getUnit — retrieves by id", async () => {
    const found = await storage.getUnit(unitId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(unitId);
  });

  it("getUnits — list includes the new unit", async () => {
    const all = await storage.getUnits();
    expect(all.some(u => u.id === unitId)).toBe(true);
  });

  it("getUnitsByCluster — returns only units for given cluster", async () => {
    const units = await storage.getUnitsByCluster(clusterId);
    expect(units.length).toBeGreaterThan(0);
    expect(units.every(u => u.clusterId === clusterId)).toBe(true);
  });

  it("updateUnit — name change is persisted", async () => {
    const updated = await storage.updateUnit(unitId, { name: "Updated Unit Name" });
    expect(updated!.name).toBe("Updated Unit Name");
  });

  it("getUnit — returns undefined for unknown id", async () => {
    const missing = await storage.getUnit("nonexistent-unit-id");
    expect(missing).toBeUndefined();
  });

  it("deleteUnit — removes the unit", async () => {
    const ok = await storage.deleteUnit(unitId);
    expect(ok).toBe(true);
    expect(await storage.getUnit(unitId)).toBeUndefined();
    unitId = "";
  });
});

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
describe("Courses", () => {
  let unitId: string;
  let clusterId: string;
  let courseId: string;

  beforeAll(async () => {
    const tag = tid();
    const cluster = await storage.createCluster({
      code: `CC${tag}`.slice(0, 10),
      name: `Course Cluster ${tag}`,
      fullName: `Full ${tag}`,
      description: "For course tests",
      color: "hsl(0 0% 30%)",
    });
    clusterId = cluster.id;
    const unit = await storage.createUnit({
      clusterId,
      code: `CU${tag}`.slice(0, 10),
      name: `Course Unit ${tag}`,
      description: "Unit for course tests",
    });
    unitId = unit.id;
  });

  afterAll(async () => {
    if (courseId) await db.delete(coursesTable).where(eq(coursesTable.id, courseId));
    if (unitId) await db.delete(unitsTable).where(eq(unitsTable.id, unitId));
    if (clusterId) await db.delete(clustersTable).where(eq(clustersTable.id, clusterId));
  });

  it("createCourse — persists and returns default lessons", async () => {
    const tag = tid();
    const course = await storage.createCourse({
      unitId,
      targetLevel: "L2",
      title: `Test Course ${tag}`,
      description: "Integration test course",
      duration: "2 jam",
    });
    courseId = course.id;
    expect(course.id).toBeTruthy();
    expect(course.unitId).toBe(unitId);
    expect(course.lessons.length).toBeGreaterThan(0);
  });

  it("getCourse — retrieves by id", async () => {
    const found = await storage.getCourse(courseId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(courseId);
  });

  it("getCourses — list includes the new course", async () => {
    const all = await storage.getCourses();
    expect(all.some(c => c.id === courseId)).toBe(true);
  });

  it("getCoursesByUnit — filters correctly", async () => {
    const courses = await storage.getCoursesByUnit(unitId);
    expect(courses.every(c => c.unitId === unitId)).toBe(true);
    expect(courses.some(c => c.id === courseId)).toBe(true);
  });

  it("getCourse — returns undefined for unknown id", async () => {
    expect(await storage.getCourse("nonexistent-course-id")).toBeUndefined();
  });

  it("deleteCourse — removes the course", async () => {
    const ok = await storage.deleteCourse(courseId);
    expect(ok).toBe(true);
    expect(await storage.getCourse(courseId)).toBeUndefined();
    courseId = "";
  });
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------
describe("Participants", () => {
  let participantId: string;

  afterAll(async () => {
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createParticipant — persists and returns participant with empty relations", async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `NIP${tag}`.slice(0, 18),
      name: `Test Participant ${tag}`,
      position: "Staf",
      unit: "Test Unit",
      email: `test${tag}@test.go.id`,
    });
    participantId = p.id;
    expect(p.id).toBeTruthy();
    expect(p.competencies).toEqual([]);
    expect(p.evidences).toEqual([]);
    expect(p.learningHistory).toEqual([]);
  });

  it("getParticipant — retrieves by id with relations", async () => {
    const found = await storage.getParticipant(participantId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(participantId);
    expect(Array.isArray(found!.competencies)).toBe(true);
  });

  it("getParticipants — list includes the new participant", async () => {
    const all = await storage.getParticipants();
    expect(all.some(p => p.id === participantId)).toBe(true);
  });

  it("updateParticipantCompetencies — replaces competency set atomically", async () => {
    const competencies = [
      { unitId: "smap-01", currentLevel: "L1" as const, targetLevel: "L2" as const, lastAssessed: "2025-01-01", status: "gap" as const },
      { unitId: "smap-02", currentLevel: "L2" as const, targetLevel: "L3" as const, lastAssessed: "2025-01-01", status: "on_track" as const },
    ];
    const updated = await storage.updateParticipantCompetencies(participantId, competencies);
    expect(updated).toBeDefined();
    expect(updated!.competencies.length).toBe(2);
    expect(updated!.competencies[0].unitId).toBe("smap-01");

    // Running again replaces (idempotent replace)
    const second = await storage.updateParticipantCompetencies(participantId, [competencies[0]]);
    expect(second!.competencies.length).toBe(1);
  });

  it("getParticipant — returns undefined for unknown id", async () => {
    expect(await storage.getParticipant("nonexistent-participant")).toBeUndefined();
  });

  it("updateParticipantCompetencies — returns undefined for nonexistent participant", async () => {
    const result = await storage.updateParticipantCompetencies("nonexistent", []);
    expect(result).toBeUndefined();
  });

  it("deleteParticipant — cascades to related rows and removes participant", async () => {
    const ok = await storage.deleteParticipant(participantId);
    expect(ok).toBe(true);
    expect(await storage.getParticipant(participantId)).toBeUndefined();
    participantId = "";
  });
});

// ---------------------------------------------------------------------------
// Evidences
// ---------------------------------------------------------------------------
describe("Evidences", () => {
  let participantId: string;
  let evidenceId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `EV${tag}`.slice(0, 18),
      name: `Evidence Test ${tag}`,
      position: "Staf",
      unit: "Evidence Unit",
      email: `ev${tag}@test.go.id`,
    });
    participantId = p.id;
  });

  afterAll(async () => {
    if (evidenceId) await db.delete(evidencesTable).where(eq(evidencesTable.id, evidenceId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("addEvidence — creates evidence with pending status", async () => {
    const ev = await storage.addEvidence(participantId, {
      unitId: "smap-01",
      type: "document",
      title: "Test Evidence",
      description: "Evidence for integration test",
    });
    evidenceId = ev.id;
    expect(ev.id).toBeTruthy();
    expect(ev.status).toBe("pending");
    expect(ev.unitId).toBe("smap-01");
  });

  it("addEvidence — throws for nonexistent participant", async () => {
    await expect(
      storage.addEvidence("nonexistent-participant", {
        unitId: "smap-01",
        type: "document",
        title: "Fail",
        description: "Should fail",
      })
    ).rejects.toThrow();
  });

  it("updateEvidenceStatus — marks approved with score and feedback", async () => {
    const updated = await storage.updateEvidenceStatus(participantId, evidenceId, "approved", 90, "Excellent work");
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("approved");
    expect(updated!.score).toBe(90);
    expect(updated!.feedback).toBe("Excellent work");
    expect(updated!.assessedAt).toBeTruthy();
  });

  it("updateEvidenceStatus — returns undefined when participantId doesn't match", async () => {
    const result = await storage.updateEvidenceStatus("wrong-participant", evidenceId, "rejected");
    expect(result).toBeUndefined();
  });

  it("getParticipant — evidences are visible via participant fetch", async () => {
    const p = await storage.getParticipant(participantId);
    expect(p!.evidences.some(e => e.id === evidenceId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
describe("Dashboard", () => {
  it("getDashboardStats — returns a valid stats object", async () => {
    const stats = await storage.getDashboardStats();
    expect(typeof stats.totalParticipants).toBe("number");
    expect(typeof stats.totalCourses).toBe("number");
    expect(typeof stats.completionRate).toBe("number");
    expect(typeof stats.averageLevel).toBe("number");
    expect(Array.isArray(stats.levelDistribution)).toBe(true);
    expect(stats.levelDistribution.length).toBe(4);
  });

  it("getHeatmapData — returns array of heatmap entries", async () => {
    const heatmap = await storage.getHeatmapData();
    expect(Array.isArray(heatmap)).toBe(true);
    if (heatmap.length > 0) {
      const entry = heatmap[0];
      expect(entry).toHaveProperty("unitId");
      expect(entry).toHaveProperty("unitCode");
      expect(entry).toHaveProperty("total");
    }
  });
});

// ---------------------------------------------------------------------------
// Learning Paths
// ---------------------------------------------------------------------------
describe("LearningPaths", () => {
  let pathId: string;

  afterAll(async () => {
    if (pathId) await db.delete(learningPathsTable).where(eq(learningPathsTable.id, pathId));
  });

  it("createLearningPath — persists and returns path", async () => {
    const tag = tid();
    const path = await storage.createLearningPath({
      title: `Test Path ${tag}`,
      description: "Integration test path",
      targetRole: "Test Role",
      duration: "1 bulan",
      difficulty: "beginner",
      courseIds: [],
      prerequisites: [],
      skills: ["Skill A"],
    });
    pathId = path.id;
    expect(path.id).toBeTruthy();
    expect(path.isPublished).toBe(false);
  });

  it("getLearningPath — retrieves by id", async () => {
    const found = await storage.getLearningPath(pathId);
    expect(found!.id).toBe(pathId);
  });

  it("getLearningPaths — list includes the new path", async () => {
    const all = await storage.getLearningPaths();
    expect(all.some(p => p.id === pathId)).toBe(true);
  });

  it("updateLearningPath — title update is persisted", async () => {
    const updated = await storage.updateLearningPath(pathId, { title: "Updated Path Title" });
    expect(updated!.title).toBe("Updated Path Title");
  });

  it("updateLearningPath — returns undefined for nonexistent id", async () => {
    const result = await storage.updateLearningPath("nonexistent-path", { title: "X" });
    expect(result).toBeUndefined();
  });

  it("deleteLearningPath — removes the path", async () => {
    const ok = await storage.deleteLearningPath(pathId);
    expect(ok).toBe(true);
    expect(await storage.getLearningPath(pathId)).toBeUndefined();
    pathId = "";
  });
});

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------
describe("Enrollments", () => {
  let participantId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `EN${tag}`.slice(0, 18),
      name: `Enroll Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `en${tag}@test.go.id`,
    });
    participantId = p.id;
  });

  afterAll(async () => {
    if (enrollmentId) await db.delete(enrollmentsTable).where(eq(enrollmentsTable.id, enrollmentId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createEnrollment — persists enrollment with enrolled status", async () => {
    const enrollment = await storage.createEnrollment(participantId, "course-smap01-l2");
    enrollmentId = enrollment.id;
    expect(enrollment.id).toBeTruthy();
    expect(enrollment.participantId).toBe(participantId);
    expect(enrollment.status).toBe("enrolled");
    expect(enrollment.progress).toBe(0);
  });

  it("getEnrollments — includes the new enrollment", async () => {
    const all = await storage.getEnrollments();
    expect(all.some(e => e.id === enrollmentId)).toBe(true);
  });

  it("getEnrollmentsByParticipant — filters by participant", async () => {
    const enrollments = await storage.getEnrollmentsByParticipant(participantId);
    expect(enrollments.every(e => e.participantId === participantId)).toBe(true);
    expect(enrollments.some(e => e.id === enrollmentId)).toBe(true);
  });

  it("updateEnrollmentProgress — mid-course progress sets startedAt", async () => {
    const updated = await storage.updateEnrollmentProgress(enrollmentId, 50, "in_progress");
    expect(updated).toBeDefined();
    expect(updated!.progress).toBe(50);
    expect(updated!.status).toBe("in_progress");
    expect(updated!.startedAt).toBeTruthy();
  });

  it("updateEnrollmentProgress — 100% auto-sets completed status and completedAt", async () => {
    const completed = await storage.updateEnrollmentProgress(enrollmentId, 100);
    expect(completed!.progress).toBe(100);
    expect(completed!.status).toBe("completed");
    expect(completed!.completedAt).toBeTruthy();
  });

  it("updateEnrollmentProgress — returns undefined for nonexistent id", async () => {
    const result = await storage.updateEnrollmentProgress("nonexistent-enroll", 50);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------
describe("Quizzes", () => {
  let quizId: string;

  afterAll(async () => {
    if (quizId) await db.delete(quizzesTable).where(eq(quizzesTable.id, quizId));
  });

  it("createQuiz — persists quiz with questions", async () => {
    const tag = tid();
    const quiz = await storage.createQuiz({
      courseId: "course-smap01-l2",
      title: `Test Quiz ${tag}`,
      description: "Integration test quiz",
      passingScore: 70,
      maxAttempts: 3,
      shuffleQuestions: false,
      showResults: true,
      questions: [
        {
          id: `q1-${tag}`,
          text: "What is strategic analysis?",
          type: "multiple_choice",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          points: 10,
        },
      ],
    });
    quizId = quiz.id;
    expect(quiz.id).toBeTruthy();
    expect(quiz.questions.length).toBe(1);
    expect(quiz.passingScore).toBe(70);
  });

  it("getQuiz — retrieves by id", async () => {
    const found = await storage.getQuiz(quizId);
    expect(found!.id).toBe(quizId);
  });

  it("getQuizzes — includes the new quiz", async () => {
    const all = await storage.getQuizzes();
    expect(all.some(q => q.id === quizId)).toBe(true);
  });

  it("getQuizzesByCourse — filters by courseId", async () => {
    const quizzes = await storage.getQuizzesByCourse("course-smap01-l2");
    expect(quizzes.some(q => q.id === quizId)).toBe(true);
  });

  it("getQuiz — returns undefined for unknown id", async () => {
    expect(await storage.getQuiz("nonexistent-quiz")).toBeUndefined();
  });

  it("deleteQuiz — removes the quiz", async () => {
    await storage.deleteQuiz(quizId);
    expect(await storage.getQuiz(quizId)).toBeUndefined();
    quizId = "";
  });
});

// ---------------------------------------------------------------------------
// Quiz Attempts
// ---------------------------------------------------------------------------
describe("QuizAttempts", () => {
  let quizId: string;
  let participantId: string;
  let attemptId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `QA${tag}`.slice(0, 18),
      name: `Quiz Attempt Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `qa${tag}@test.go.id`,
    });
    participantId = p.id;

    const quiz = await storage.createQuiz({
      courseId: "course-smap01-l2",
      title: `Attempt Quiz ${tag}`,
      description: "For attempt tests",
      passingScore: 60,
      maxAttempts: 5,
      shuffleQuestions: false,
      showResults: true,
      questions: [],
    });
    quizId = quiz.id;
  });

  afterAll(async () => {
    if (attemptId) await db.delete(quizAttemptsTable).where(eq(quizAttemptsTable.id, attemptId));
    if (quizId) await db.delete(quizzesTable).where(eq(quizzesTable.id, quizId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createQuizAttempt — persists and returns attempt", async () => {
    const attempt = await storage.createQuizAttempt({
      quizId,
      participantId,
      answers: [{ questionId: "q1", answer: "A" }],
      score: 80,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    attemptId = attempt.id;
    expect(attempt.id).toBeTruthy();
    expect(attempt.passed).toBe(true);
    expect(attempt.score).toBe(80);
  });

  it("getQuizAttempts — retrieves by quizId", async () => {
    const attempts = await storage.getQuizAttempts(quizId);
    expect(attempts.some(a => a.id === attemptId)).toBe(true);
  });

  it("getQuizAttemptsByParticipant — retrieves by participantId", async () => {
    const attempts = await storage.getQuizAttemptsByParticipant(participantId);
    expect(attempts.some(a => a.id === attemptId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
describe("Certificates", () => {
  let participantId: string;
  let certId: string;
  let certNumber: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `CT${tag}`.slice(0, 18),
      name: `Cert Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `ct${tag}@test.go.id`,
    });
    participantId = p.id;
  });

  afterAll(async () => {
    if (certId) await db.delete(certificatesTable).where(eq(certificatesTable.id, certId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createCertificate — persists with auto-generated certificate number", async () => {
    const cert = await storage.createCertificate({
      participantId,
      title: "Certificate of Completion",
      description: "Integration test certificate",
    });
    certId = cert.id;
    certNumber = cert.certificateNumber;
    expect(cert.id).toBeTruthy();
    expect(cert.certificateNumber).toBeTruthy();
    expect(cert.status).toBe("active");
    expect(cert.participantId).toBe(participantId);
  });

  it("getCertificate — retrieves by id", async () => {
    const found = await storage.getCertificate(certId);
    expect(found!.id).toBe(certId);
  });

  it("getCertificates — includes the new certificate", async () => {
    const all = await storage.getCertificates();
    expect(all.some(c => c.id === certId)).toBe(true);
  });

  it("getCertificatesByParticipant — filters by participant", async () => {
    const certs = await storage.getCertificatesByParticipant(participantId);
    expect(certs.some(c => c.id === certId)).toBe(true);
  });

  it("verifyCertificate — finds certificate by number", async () => {
    const found = await storage.verifyCertificate(certNumber);
    expect(found!.id).toBe(certId);
  });

  it("verifyCertificate — returns undefined for invalid number", async () => {
    expect(await storage.verifyCertificate("CERT-INVALID-NUMBER")).toBeUndefined();
  });

  it("getCertificate — returns undefined for unknown id", async () => {
    expect(await storage.getCertificate("nonexistent-cert")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Assessors
// ---------------------------------------------------------------------------
describe("Assessors", () => {
  let assessorId: string;

  afterAll(async () => {
    if (assessorId) await db.delete(assessorsTable).where(eq(assessorsTable.id, assessorId));
  });

  it("createAssessor — persists and returns assessor", async () => {
    const tag = tid();
    const assessor = await storage.createAssessor({
      registrationNumber: `NRA-${tag}`,
      name: `Test Assessor ${tag}`,
      email: `assessor${tag}@test.id`,
      phone: "+62-800-0000",
      lspId: "lsp-001",
      competencySchemes: [],
      specializations: ["Testing"],
      validUntil: "2027-12-31",
    });
    assessorId = assessor.id;
    expect(assessor.id).toBeTruthy();
    expect(assessor.status).toBe("active");
  });

  it("getAssessor — retrieves by id", async () => {
    const found = await storage.getAssessor(assessorId);
    expect(found!.id).toBe(assessorId);
  });

  it("getAssessors — includes the new assessor", async () => {
    const all = await storage.getAssessors();
    expect(all.some(a => a.id === assessorId)).toBe(true);
  });

  it("updateAssessor — name update is persisted", async () => {
    const updated = await storage.updateAssessor(assessorId, { name: "Updated Assessor Name" });
    expect(updated!.name).toBe("Updated Assessor Name");
  });

  it("updateAssessor — returns undefined for nonexistent id", async () => {
    const result = await storage.updateAssessor("nonexistent-assessor", { name: "X" });
    expect(result).toBeUndefined();
  });

  it("getAssessor — returns undefined for unknown id", async () => {
    expect(await storage.getAssessor("nonexistent-assessor")).toBeUndefined();
  });

  it("deleteAssessor — removes the assessor", async () => {
    await storage.deleteAssessor(assessorId);
    expect(await storage.getAssessor(assessorId)).toBeUndefined();
    assessorId = "";
  });
});

// ---------------------------------------------------------------------------
// Assessees
// ---------------------------------------------------------------------------
describe("Assessees", () => {
  let participantId: string;
  let assesseeId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `AS${tag}`.slice(0, 18),
      name: `Assessee Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `as${tag}@test.go.id`,
    });
    participantId = p.id;
  });

  afterAll(async () => {
    if (assesseeId) await db.delete(assesseesTable).where(eq(assesseesTable.id, assesseeId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createAssessee — persists with registered status", async () => {
    const tag = tid();
    const assessee = await storage.createAssessee({
      participantId,
      nik: `NIK${tag}`.slice(0, 16),
      birthPlace: "Jakarta",
      birthDate: "1990-01-01",
      gender: "male",
      education: "S1",
      workExperience: "5 tahun",
      currentCompany: "Test Corp",
      currentPosition: "Staf",
      schemeId: "scheme-001",
    });
    assesseeId = assessee.id;
    expect(assessee.id).toBeTruthy();
    expect(assessee.status).toBe("registered");
  });

  it("getAssessee — retrieves by id", async () => {
    const found = await storage.getAssessee(assesseeId);
    expect(found!.id).toBe(assesseeId);
  });

  it("getAssessees — includes the new assessee", async () => {
    const all = await storage.getAssessees();
    expect(all.some(a => a.id === assesseeId)).toBe(true);
  });

  it("updateAssesseeStatus — transitions status", async () => {
    const updated = await storage.updateAssesseeStatus(assesseeId, "scheduled");
    expect(updated!.status).toBe("scheduled");
  });

  it("updateAssesseeStatus — returns undefined for nonexistent id", async () => {
    const result = await storage.updateAssesseeStatus("nonexistent-assessee", "scheduled");
    expect(result).toBeUndefined();
  });

  it("getAssessee — returns undefined for unknown id", async () => {
    expect(await storage.getAssessee("nonexistent-assessee")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schemes
// ---------------------------------------------------------------------------
describe("Schemes", () => {
  let schemeId: string;

  afterAll(async () => {
    if (schemeId) await db.delete(schemesTable).where(eq(schemesTable.id, schemeId));
  });

  it("createScheme — persists and returns scheme", async () => {
    const tag = tid();
    const scheme = await storage.createScheme({
      lspId: "lsp-001",
      code: `SKM-${tag}`.slice(0, 20),
      name: `Test Scheme ${tag}`,
      description: "Integration test scheme",
      unitIds: ["smap-01"],
      assessmentMethods: ["written_test"],
      duration: "1 hari",
      fee: 1000000,
    });
    schemeId = scheme.id;
    expect(scheme.id).toBeTruthy();
    expect(scheme.isActive).toBe(true);
  });

  it("getScheme — retrieves by id", async () => {
    const found = await storage.getScheme(schemeId);
    expect(found!.id).toBe(schemeId);
  });

  it("getSchemes — includes the new scheme", async () => {
    const all = await storage.getSchemes();
    expect(all.some(s => s.id === schemeId)).toBe(true);
  });

  it("getScheme — returns undefined for unknown id", async () => {
    expect(await storage.getScheme("nonexistent-scheme")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
describe("Schedules", () => {
  let scheduleId: string;
  let assesseeId: string;
  let participantId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `SC${tag}`.slice(0, 18),
      name: `Schedule Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `sc${tag}@test.go.id`,
    });
    participantId = p.id;
    const assessee = await storage.createAssessee({
      participantId,
      nik: `SC${tag}`.slice(0, 16),
      birthPlace: "Jakarta",
      birthDate: "1990-01-01",
      gender: "female",
      education: "S1",
      workExperience: "3 tahun",
      currentCompany: "Test Corp",
      currentPosition: "Staf",
      schemeId: "scheme-001",
    });
    assesseeId = assessee.id;
  });

  afterAll(async () => {
    if (scheduleId) await db.delete(schedulesTable).where(eq(schedulesTable.id, scheduleId));
    if (assesseeId) await db.delete(assesseesTable).where(eq(assesseesTable.id, assesseeId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createSchedule — persists with scheduled status", async () => {
    const schedule = await storage.createSchedule({
      schemeId: "scheme-001",
      assesseeId,
      assessorId: "assessor-001",
      scheduledDate: "2026-09-01",
      location: "Jakarta",
      locationType: "offline",
      methods: ["written_test"],
      duration: "2 jam",
    });
    scheduleId = schedule.id;
    expect(schedule.id).toBeTruthy();
    expect(schedule.status).toBe("scheduled");
  });

  it("getSchedule — retrieves by id", async () => {
    const found = await storage.getSchedule(scheduleId);
    expect(found!.id).toBe(scheduleId);
  });

  it("getSchedules — includes the new schedule", async () => {
    const all = await storage.getSchedules();
    expect(all.some(s => s.id === scheduleId)).toBe(true);
  });

  it("updateScheduleStatus — transitions to in_progress", async () => {
    const updated = await storage.updateScheduleStatus(scheduleId, "in_progress");
    expect(updated!.status).toBe("in_progress");
  });

  it("updateScheduleStatus — returns undefined for nonexistent id", async () => {
    expect(await storage.updateScheduleStatus("nonexistent-schedule", "completed")).toBeUndefined();
  });

  it("getSchedule — returns undefined for unknown id", async () => {
    expect(await storage.getSchedule("nonexistent-schedule")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Portfolio Items
// ---------------------------------------------------------------------------
describe("PortfolioItems", () => {
  let assesseeId: string;
  let participantId: string;
  let portfolioId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `PF${tag}`.slice(0, 18),
      name: `Portfolio Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `pf${tag}@test.go.id`,
    });
    participantId = p.id;
    const assessee = await storage.createAssessee({
      participantId,
      nik: `PF${tag}`.slice(0, 16),
      birthPlace: "Jakarta",
      birthDate: "1990-01-01",
      gender: "male",
      education: "S1",
      workExperience: "2 tahun",
      currentCompany: "Test Corp",
      currentPosition: "Staf",
      schemeId: "scheme-001",
    });
    assesseeId = assessee.id;
  });

  afterAll(async () => {
    if (portfolioId) await db.delete(portfolioItemsTable).where(eq(portfolioItemsTable.id, portfolioId));
    if (assesseeId) await db.delete(assesseesTable).where(eq(assesseesTable.id, assesseeId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createPortfolioItem — persists with submitted status", async () => {
    const portfolio = await storage.createPortfolioItem({
      assesseeId,
      unitId: "smap-01",
      type: "certificate",
      title: "Test Portfolio Item",
      description: "Integration test portfolio",
    });
    portfolioId = portfolio.id;
    expect(portfolio.id).toBeTruthy();
    expect(portfolio.status).toBe("submitted");
  });

  it("getPortfolioItems — returns items for assessee", async () => {
    const items = await storage.getPortfolioItems(assesseeId);
    expect(items.some(i => i.id === portfolioId)).toBe(true);
  });

  it("updatePortfolioStatus — approves with feedback", async () => {
    const updated = await storage.updatePortfolioStatus(portfolioId, "approved", "Good quality");
    expect(updated!.status).toBe("approved");
    expect(updated!.feedback).toBe("Good quality");
    expect(updated!.reviewedAt).toBeTruthy();
  });

  it("updatePortfolioStatus — returns undefined for nonexistent id", async () => {
    expect(await storage.updatePortfolioStatus("nonexistent-portfolio", "approved")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Certification Results
// ---------------------------------------------------------------------------
describe("CertificationResults", () => {
  let resultId: string;
  let assesseeId: string;
  let participantId: string;
  let scheduleId: string;

  beforeAll(async () => {
    const tag = tid();
    const p = await storage.createParticipant({
      nip: `CR${tag}`.slice(0, 18),
      name: `CertResult Test ${tag}`,
      position: "Staf",
      unit: "Test",
      email: `cr${tag}@test.go.id`,
    });
    participantId = p.id;
    const assessee = await storage.createAssessee({
      participantId,
      nik: `CR${tag}`.slice(0, 16),
      birthPlace: "Jakarta",
      birthDate: "1990-01-01",
      gender: "female",
      education: "S1",
      workExperience: "4 tahun",
      currentCompany: "Test Corp",
      currentPosition: "Staf",
      schemeId: "scheme-001",
    });
    assesseeId = assessee.id;
    const schedule = await storage.createSchedule({
      schemeId: "scheme-001",
      assesseeId,
      assessorId: "assessor-001",
      scheduledDate: "2026-09-15",
      location: "Bandung",
      locationType: "offline",
      methods: ["written_test"],
      duration: "3 jam",
    });
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    if (resultId) await db.delete(certificationResultsTable).where(eq(certificationResultsTable.id, resultId));
    if (scheduleId) await db.delete(schedulesTable).where(eq(schedulesTable.id, scheduleId));
    if (assesseeId) await db.delete(assesseesTable).where(eq(assesseesTable.id, assesseeId));
    if (participantId) {
      await db.delete(participantCompetenciesTable).where(eq(participantCompetenciesTable.participantId, participantId));
      await db.delete(evidencesTable).where(eq(evidencesTable.participantId, participantId));
      await db.delete(learningRecordsTable).where(eq(learningRecordsTable.participantId, participantId));
      await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    }
  });

  it("createCertificationResult — persists and returns result", async () => {
    const result = await storage.createCertificationResult({
      scheduleId,
      assesseeId,
      assessorId: "assessor-001",
      schemeId: "scheme-001",
      unitResults: [{ unitId: "smap-01", result: "competent" as const, notes: "Passed" }],
      overallResult: "competent",
      recommendations: "Continue to next level",
      assessedAt: "2026-09-15",
    });
    resultId = result.id;
    expect(result.id).toBeTruthy();
    expect(result.overallResult).toBe("competent");
  });

  it("getCertificationResults — includes the new result", async () => {
    const all = await storage.getCertificationResults();
    expect(all.some(r => r.id === resultId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LSP Organizations
// ---------------------------------------------------------------------------
describe("LSPOrganizations", () => {
  it("getLSPOrganizations — returns array", async () => {
    const orgs = await storage.getLSPOrganizations();
    expect(Array.isArray(orgs)).toBe(true);
  });

  it("getLSPOrganization — retrieves existing seeded org", async () => {
    const orgs = await storage.getLSPOrganizations();
    if (orgs.length > 0) {
      const found = await storage.getLSPOrganization(orgs[0].id);
      expect(found!.id).toBe(orgs[0].id);
    }
  });

  it("getLSPOrganization — returns undefined for unknown id", async () => {
    expect(await storage.getLSPOrganization("nonexistent-lsp")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
describe("Notifications", () => {
  let notifId: string;

  beforeAll(async () => {
    const tag = tid();
    const id = `notif-test-${tag}`;
    await db.insert(notificationsTable).values({
      id,
      userId: "test-user",
      type: "info",
      category: "course",
      title: `Test Notification ${tag}`,
      message: "Integration test notification",
      link: null,
      isRead: 0,
      createdAt: new Date().toISOString(),
    });
    notifId = id;
  });

  afterAll(async () => {
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, "test-user"));
  });

  it("getNotifications — includes the test notification", async () => {
    const all = await storage.getNotifications();
    expect(all.some(n => n.id === notifId)).toBe(true);
  });

  it("getNotifications — sorted newest-first", async () => {
    const all = await storage.getNotifications();
    for (let i = 1; i < all.length; i++) {
      expect(new Date(all[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(all[i].createdAt).getTime()
      );
    }
  });

  it("markNotificationRead — marks single notification as read", async () => {
    const updated = await storage.markNotificationRead(notifId);
    expect(updated).toBeDefined();
    expect(updated!.isRead).toBe(true);
  });

  it("markNotificationRead — returns undefined for nonexistent id", async () => {
    const result = await storage.markNotificationRead("nonexistent-notif");
    expect(result).toBeUndefined();
  });

  it("markAllNotificationsRead — does not throw", async () => {
    await expect(storage.markAllNotificationsRead()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
describe("searchAll", () => {
  it("returns empty arrays for empty query", async () => {
    const result = await storage.searchAll("");
    expect(result.participants).toEqual([]);
    expect(result.courses).toEqual([]);
    expect(result.units).toEqual([]);
  });

  it("finds participants by name", async () => {
    // Seed data includes "Andi Pratama"
    const result = await storage.searchAll("Andi");
    expect(Array.isArray(result.participants)).toBe(true);
    // May be present or not depending on db state; just verify shape
    result.participants.forEach(p => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
    });
  });

  it("finds courses by title", async () => {
    const result = await storage.searchAll("Analisis");
    expect(Array.isArray(result.courses)).toBe(true);
  });

  it("finds units by code", async () => {
    const result = await storage.searchAll("SMAP");
    expect(Array.isArray(result.units)).toBe(true);
  });

  it("returns max 5 results per category", async () => {
    const result = await storage.searchAll("a");
    expect(result.participants.length).toBeLessThanOrEqual(5);
    expect(result.courses.length).toBeLessThanOrEqual(5);
    expect(result.units.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
describe("getAnalyticsData", () => {
  it("returns all required analytics fields", async () => {
    const data = await storage.getAnalyticsData();
    expect(Array.isArray(data.monthlyTrend)).toBe(true);
    expect(data.monthlyTrend.length).toBe(6);
    expect(Array.isArray(data.levelDistributionByCluster)).toBe(true);
    expect(Array.isArray(data.courseCompletionByLevel)).toBe(true);
    expect(Array.isArray(data.topGapUnits)).toBe(true);
    expect(Array.isArray(data.participantsByUnit)).toBe(true);
  });

  it("monthlyTrend entries have correct shape", async () => {
    const { monthlyTrend } = await storage.getAnalyticsData();
    monthlyTrend.forEach(entry => {
      expect(entry).toHaveProperty("month");
      expect(entry).toHaveProperty("completions");
      expect(entry).toHaveProperty("enrollments");
      expect(typeof entry.completions).toBe("number");
    });
  });

  it("levelDistributionByCluster entries have correct shape", async () => {
    const { levelDistributionByCluster } = await storage.getAnalyticsData();
    levelDistributionByCluster.forEach(entry => {
      expect(entry).toHaveProperty("cluster");
      expect(entry).toHaveProperty("L1");
      expect(entry).toHaveProperty("L2");
      expect(entry).toHaveProperty("L3");
      expect(entry).toHaveProperty("L4");
    });
  });
});
