import type { ECourse, Quiz, QuizAnswer, Question, QuizOption } from "./schema";

export type SubmittedQuizAnswers = Record<string, string | string[]>;
type LearnerQuestion = Omit<
  Question,
  "correctAnswer" | "correctAnswers" | "explanation" | "options"
> & {
  options?: Array<string | Pick<QuizOption, "id" | "text">>;
};
type LearnerQuiz = Omit<Quiz, "questions"> & { questions: LearnerQuestion[] };

export function evaluateCourseCompletion(
  course: ECourse,
  completedLessonIds: string[],
  postTestPassed: boolean,
) {
  const completed = new Set(completedLessonIds);
  const lessonsCompleted =
    course.lessons.length > 0 && course.lessons.every(lesson => completed.has(lesson.id));
  const requiresPostTest = Boolean(course.postTestId);

  return {
    progress: course.lessons.length
      ? Math.round(
          (course.lessons.filter(lesson => completed.has(lesson.id)).length / course.lessons.length) * 100,
        )
      : 0,
    lessonsCompleted,
    requiresPostTest,
    postTestPassed: !requiresPostTest || postTestPassed,
    isComplete: lessonsCompleted && (!requiresPostTest || postTestPassed),
  };
}

function normalizeAnswer(answer: string | string[]): string[] {
  const values = Array.isArray(answer) ? answer : [answer];
  return values.map(value => value.trim().toLocaleLowerCase()).filter(Boolean).sort();
}

function expectedAnswers(question: Question): string[] {
  if (question.correctAnswers?.length) return normalizeAnswer(question.correctAnswers);
  if (question.correctAnswer !== undefined) return normalizeAnswer(question.correctAnswer);

  const correctOptions = (question.options ?? [])
    .filter(option => typeof option !== "string" && option.isCorrect)
    .map(option => typeof option === "string" ? option : option.text);
  return normalizeAnswer(correctOptions);
}

export function gradeQuizSubmission(quiz: Quiz, submitted: SubmittedQuizAnswers): {
  answers: QuizAnswer[];
  score: number;
  maxScore: number;
  passed: boolean;
} {
  const questions = [...quiz.questions].sort((a, b) => a.order - b.order);
  const objectiveQuestions = questions.filter(question => question.type !== "essay");
  const maxScore = questions.reduce((total, question) => total + Math.max(0, question.points), 0);
  const answers = questions.map(question => {
    const answer = submitted[question.id] ?? "";
    const expected = expectedAnswers(question);
    const actual = normalizeAnswer(answer);
    const isCorrect =
      question.type !== "essay" &&
      expected.length > 0 &&
      expected.length === actual.length &&
      expected.every((value, index) => value === actual[index]);

    return {
      questionId: question.id,
      answer,
      isCorrect,
      points: isCorrect ? Math.max(0, question.points) : 0,
    };
  });
  const pointsEarned = answers.reduce((total, answer) => total + answer.points, 0);
  const score = maxScore > 0 ? Math.round((pointsEarned / maxScore) * 100) : 0;

  return {
    answers,
    score,
    maxScore,
    passed:
      maxScore > 0 &&
      objectiveQuestions.length === questions.length &&
      score >= quiz.passingScore,
  };
}

export function quizForLearner(quiz: Quiz): LearnerQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map(question => {
      const {
        correctAnswer: _correctAnswer,
        correctAnswers: _correctAnswers,
        explanation: _explanation,
        options,
        ...safeQuestion
      } = question;
      return {
        ...safeQuestion,
        options: options?.map(option =>
          typeof option === "string"
            ? option
            : { id: option.id, text: option.text },
        ),
      };
    }),
  };
}
