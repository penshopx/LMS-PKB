import { describe, expect, it } from "vitest";
import type { ECourse, Quiz } from "@shared/schema";
import {
  evaluateCourseCompletion,
  gradeQuizSubmission,
  quizForLearner,
} from "@shared/lms-course-rules";

const course: ECourse = {
  id: "course-rules-test",
  unitId: "unit-test",
  targetLevel: "L2",
  title: "Kursus uji",
  description: "Uji aturan penyelesaian kursus",
  duration: "1 jam",
  lessons: [
    { id: "lesson-a", order: 1, type: "orientation", title: "A", description: "", content: "" },
    { id: "lesson-b", order: 2, type: "reflection", title: "B", description: "", content: "" },
  ],
  preTestId: "pre-test",
  postTestId: "post-test",
  createdAt: "2026-10-31",
};

const quiz: Quiz = {
  id: "post-test",
  courseId: course.id,
  title: "Post-test",
  description: "Uji penilaian server",
  passingScore: 70,
  maxAttempts: 3,
  shuffleQuestions: false,
  showResults: true,
  questions: [
    {
      id: "q1",
      type: "multiple_choice",
      text: "Jawaban?",
      points: 10,
      options: [
        { id: "a", text: "Benar", isCorrect: true },
        { id: "b", text: "Salah", isCorrect: false },
      ],
      correctAnswer: "Benar",
      explanation: "Penjelasan internal",
      order: 1,
    },
  ],
  createdAt: "2026-10-31",
};

describe("aturan penyelesaian kursus", () => {
  it("mengharuskan semua lesson dan post-test, tetapi tidak mensyaratkan pre-test", () => {
    const noLessons = evaluateCourseCompletion(course, [], false);
    expect(noLessons.isComplete).toBe(false);
    expect(noLessons.progress).toBe(0);

    const allLessons = evaluateCourseCompletion(course, ["lesson-a", "lesson-b"], false);
    expect(allLessons).toMatchObject({
      progress: 100,
      lessonsCompleted: true,
      requiresPostTest: true,
      postTestPassed: false,
      isComplete: false,
    });

    expect(
      evaluateCourseCompletion(course, ["lesson-a", "lesson-b"], true).isComplete,
    ).toBe(true);

    const courseWithoutPostTest = { ...course, postTestId: undefined };
    expect(
      evaluateCourseCompletion(courseWithoutPostTest, ["lesson-a", "lesson-b"], false).isComplete,
    ).toBe(true);
  });

  it("menghitung nilai dari jawaban dan ambang kuis di server", () => {
    expect(gradeQuizSubmission(quiz, { q1: "Salah" })).toMatchObject({
      score: 0,
      maxScore: 10,
      passed: false,
      answers: [{ questionId: "q1", isCorrect: false, points: 0 }],
    });
    expect(gradeQuizSubmission(quiz, { q1: "Benar" })).toMatchObject({
      score: 100,
      maxScore: 10,
      passed: true,
      answers: [{ questionId: "q1", isCorrect: true, points: 10 }],
    });
  });

  it("tidak meluluskan post-test yang masih berisi soal esai tanpa penilaian", () => {
    const quizWithEssay = {
      ...quiz,
      passingScore: 50,
      questions: [
        ...quiz.questions,
        {
          ...quiz.questions[0],
          id: "q2",
          type: "essay" as const,
          points: 10,
          options: [],
        },
      ],
    };

    expect(
      gradeQuizSubmission(quizWithEssay, { q1: "Benar", q2: "Refleksi peserta" }),
    ).toMatchObject({
      score: 50,
      maxScore: 20,
      passed: false,
    });
  });

  it("menghapus kunci jawaban dari data kuis yang dikirim ke peserta", () => {
    const publicQuiz = quizForLearner(quiz);
    expect(publicQuiz.questions[0]).not.toHaveProperty("correctAnswer");
    expect(publicQuiz.questions[0]).not.toHaveProperty("explanation");
    expect(publicQuiz.questions[0].options?.[0]).toEqual({
      id: "a",
      text: "Benar",
    });
    expect(publicQuiz.questions[0].options?.[0]).not.toHaveProperty("isCorrect");
  });
});
