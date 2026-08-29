import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { DrizzleStorage } from "../db-storage";
import {
  certificatesTable,
  clustersTable,
  coursesTable,
  enrollmentsTable,
  learningRecordsTable,
  participantsTable,
  quizAttemptsTable,
  quizzesTable,
  unitsTable,
} from "@shared/schema";
import { MemStorage } from "../storage";

const storage = new DrizzleStorage();
const tag = randomUUID().slice(0, 8);
const clusterId = `delete-cluster-${tag}`;
const unitId = `delete-unit-${tag}`;
const courseId = `delete-course-${tag}`;
const participantIds: string[] = [];

async function createParticipant(label: string): Promise<string> {
  const participant = await storage.createParticipant({
    nip: `DELETE-${tag}-${label}`,
    name: `Deletion Integrity ${label}`,
    position: "Tester",
    unit: "Quality Assurance",
    email: `delete-${tag}-${label}@test.invalid`,
  });
  participantIds.push(participant.id);
  return participant.id;
}

describe("LMS deletion integrity", () => {
  beforeAll(async () => {
    await db.insert(clustersTable).values({
      id: clusterId,
      code: `DEL${tag}`.slice(0, 20),
      name: "Deletion Integrity",
      fullName: "LMS Deletion Integrity",
      description: "Isolated deletion integrity fixtures",
      color: "#000000",
    });
    await db.insert(unitsTable).values({
      id: unitId,
      clusterId,
      code: `DEL-${tag}`.slice(0, 20),
      name: "Deletion integrity unit",
      description: "Isolated deletion integrity fixture",
      indicators: [],
    });
    await db.insert(coursesTable).values({
      id: courseId,
      unitId,
      targetLevel: "L2",
      title: "Deletion integrity course",
      description: "Isolated deletion integrity fixture",
      duration: "1 jam",
      lessons: [],
      preTestId: null,
      postTestId: null,
      createdAt: "2026-08-30",
    });
  });

  afterAll(async () => {
    await db.delete(certificatesTable)
      .where(eq(certificatesTable.courseId, courseId));
    await db.delete(quizzesTable)
      .where(eq(quizzesTable.courseId, courseId));
    for (const participantId of participantIds) {
      await db.delete(participantsTable)
        .where(eq(participantsTable.id, participantId));
    }
    await db.delete(coursesTable).where(eq(coursesTable.id, courseId));
    await db.delete(unitsTable).where(eq(unitsTable.id, unitId));
    await db.delete(clustersTable).where(eq(clustersTable.id, clusterId));
  });

  it("deleting a quiz removes its attempts", async () => {
    const participantId = await createParticipant("quiz");
    const quiz = await storage.createQuiz({
      courseId,
      title: "Quiz to delete",
      description: "Quiz deletion fixture",
      questions: [],
    });
    const attempt = await storage.createQuizAttempt({
      quizId: quiz.id,
      participantId,
      answers: [],
      score: 80,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });
    await db.update(coursesTable)
      .set({ preTestId: quiz.id, postTestId: quiz.id })
      .where(eq(coursesTable.id, courseId));

    expect(await storage.deleteQuiz(quiz.id)).toBe(true);
    expect(await storage.getQuiz(quiz.id)).toBeUndefined();
    expect(await storage.getQuizAttempts(quiz.id)).toEqual([]);
    expect(await storage.getCourse(courseId)).toMatchObject({
      preTestId: undefined,
      postTestId: undefined,
    });
    expect(
      await db.select().from(quizAttemptsTable)
        .where(eq(quizAttemptsTable.id, attempt.id)),
    ).toEqual([]);
  });

  it("direct database quiz deletion cascades its attempts", async () => {
    const participantId = await createParticipant("direct-quiz");
    const quiz = await storage.createQuiz({
      courseId,
      title: "Directly deleted quiz",
      description: "Direct deletion fixture",
      questions: [],
    });
    const attempt = await storage.createQuizAttempt({
      quizId: quiz.id,
      participantId,
      answers: [],
      score: 70,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });

    await db.delete(quizzesTable).where(eq(quizzesTable.id, quiz.id));

    expect(
      await db.select().from(quizAttemptsTable)
        .where(eq(quizAttemptsTable.id, attempt.id)),
    ).toEqual([]);
  });

  it("deleting a course removes quizzes and attempts but preserves certificates", async () => {
    const participantId = await createParticipant("course");
    const quiz = await storage.createQuiz({
      courseId,
      title: "Course-owned quiz",
      description: "Course deletion fixture",
      questions: [],
    });
    await storage.createQuizAttempt({
      quizId: quiz.id,
      participantId,
      answers: [],
      score: 90,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });
    const enrollment = await storage.createEnrollment(participantId, courseId);
    await db.insert(learningRecordsTable).values({
      id: `delete-learning-${tag}`,
      participantId,
      courseId,
      startedAt: "2026-08-30",
      completedAt: null,
      progress: 50,
      status: "in_progress",
    });
    const certificate = await storage.createCertificate({
      participantId,
      courseId,
      title: "Preserved certificate",
      description: "Must remain verifiable after course deletion",
    });

    expect(await storage.deleteCourse(courseId)).toBe(true);
    expect(await storage.getQuiz(quiz.id)).toBeUndefined();
    expect(await storage.getQuizAttempts(quiz.id)).toEqual([]);
    expect(
      await db.select().from(enrollmentsTable)
        .where(eq(enrollmentsTable.id, enrollment.id)),
    ).toEqual([]);
    expect(
      await db.select().from(learningRecordsTable)
        .where(eq(learningRecordsTable.courseId, courseId)),
    ).toEqual([]);
    expect(await storage.verifyCertificate(certificate.certificateNumber))
      .toMatchObject({
        id: certificate.id,
        courseId: undefined,
      });
  });

  it("deleting a participant removes quiz attempts and certificates", async () => {
    const replacementCourse = await storage.createCourse({
      unitId,
      targetLevel: "L2",
      title: "Participant deletion course",
      description: "Participant deletion fixture",
      duration: "1 jam",
    });
    const participantId = await createParticipant("participant");
    const quiz = await storage.createQuiz({
      courseId: replacementCourse.id,
      title: "Participant-owned attempt",
      description: "Participant deletion fixture",
      questions: [],
    });
    await storage.createQuizAttempt({
      quizId: quiz.id,
      participantId,
      answers: [],
      score: 75,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });
    const certificate = await storage.createCertificate({
      participantId,
      courseId: replacementCourse.id,
      title: "Participant certificate",
      description: "Removed with participant",
    });

    expect(await storage.deleteParticipant(participantId)).toBe(true);
    expect(await storage.getQuizAttemptsByParticipant(participantId)).toEqual([]);
    expect(await storage.getCertificatesByParticipant(participantId)).toEqual([]);
    expect(await storage.verifyCertificate(certificate.certificateNumber))
      .toBeUndefined();

    await storage.deleteCourse(replacementCourse.id);
  });

  it("direct course deletion cascades learning records through the database FK", async () => {
    const directCourse = await storage.createCourse({
      unitId,
      targetLevel: "L2",
      title: "Direct deletion course",
      description: "Direct database deletion fixture",
      duration: "1 jam",
    });
    const participantId = await createParticipant("direct-course");
    const learningRecordId = `delete-direct-learning-${tag}`;
    await db.insert(learningRecordsTable).values({
      id: learningRecordId,
      participantId,
      courseId: directCourse.id,
      startedAt: "2026-08-30",
      completedAt: null,
      progress: 25,
      status: "in_progress",
    });

    await db.delete(coursesTable).where(eq(coursesTable.id, directCourse.id));

    expect(
      await db.select().from(learningRecordsTable)
        .where(eq(learningRecordsTable.id, learningRecordId)),
    ).toEqual([]);
  });
});

describe("MemStorage LMS deletion integrity", () => {
  it("clears quiz pointers and dependent attempts", async () => {
    const memory = new MemStorage();
    const quiz = await memory.createQuiz({
      courseId: "course-smap01-l2",
      title: "Memory quiz",
      description: "Memory deletion fixture",
      questions: [],
    });
    const course = await memory.createCourse({
      unitId: "smap-01",
      targetLevel: "L2",
      title: "Memory pointer course",
      description: "Memory deletion fixture",
      duration: "1 jam",
      preTestId: quiz.id,
      postTestId: quiz.id,
    });
    await memory.createQuizAttempt({
      quizId: quiz.id,
      participantId: "p-001",
      answers: [],
      score: 80,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });

    expect(await memory.deleteQuiz(quiz.id)).toBe(true);
    expect(await memory.getQuizAttempts(quiz.id)).toEqual([]);
    expect(await memory.getCourse(course.id)).toMatchObject({
      preTestId: undefined,
      postTestId: undefined,
    });
  });

  it("cleans course and participant dependents consistently", async () => {
    const memory = new MemStorage();
    const participant = await memory.createParticipant({
      nip: `MEM-${tag}`,
      name: "Memory participant",
      position: "Tester",
      unit: "Quality Assurance",
      email: `memory-${tag}@test.invalid`,
    });
    const course = await memory.createCourse({
      unitId: "smap-01",
      targetLevel: "L2",
      title: "Memory deletion course",
      description: "Memory deletion fixture",
      duration: "1 jam",
    });
    const quiz = await memory.createQuiz({
      courseId: course.id,
      title: "Memory course quiz",
      description: "Memory deletion fixture",
      questions: [],
    });
    await memory.createQuizAttempt({
      quizId: quiz.id,
      participantId: participant.id,
      answers: [],
      score: 90,
      maxScore: 100,
      passed: true,
      startedAt: new Date().toISOString(),
    });
    const certificate = await memory.createCertificate({
      participantId: participant.id,
      courseId: course.id,
      title: "Memory certificate",
      description: "Memory deletion fixture",
    });
    await memory.createEnrollment(participant.id, course.id);

    expect(await memory.deleteCourse(course.id)).toBe(true);
    expect(await memory.getQuiz(quiz.id)).toBeUndefined();
    expect(await memory.getQuizAttempts(quiz.id)).toEqual([]);
    expect(await memory.verifyCertificate(certificate.certificateNumber))
      .toMatchObject({ courseId: undefined });
    expect(
      (await memory.getEnrollmentsByParticipant(participant.id))
        .some(enrollment => enrollment.courseId === course.id),
    ).toBe(false);

    const secondCertificate = await memory.createCertificate({
      participantId: participant.id,
      title: "Participant-owned memory certificate",
      description: "Memory deletion fixture",
    });
    expect(await memory.deleteParticipant(participant.id)).toBe(true);
    expect(await memory.verifyCertificate(secondCertificate.certificateNumber))
      .toBeUndefined();
  });
});