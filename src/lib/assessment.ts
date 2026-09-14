import { ASSESSMENT_META } from "@/config/assessment";
import type {
  AssessmentAttemptState,
  AssessmentView,
} from "@/types/recruitment";

/**
 * Pure helpers that combine the safe question data with the candidate's
 * saved answers into everything the assessment UI renders. Used by both
 * server and client components — no server-only imports, no Prisma.
 */

/** Quick lookup: questionId → selected option index. */
export function getAnswerMap(
  answers: { questionId: string; selectedOption: number }[],
): Map<string, number> {
  return new Map(answers.map((answer) => [answer.questionId, answer.selectedOption]));
}

export interface AttemptProgress {
  answered: number;
  total: number;
  remaining: number;
}

export function getAttemptProgress(
  attempt: AssessmentAttemptState,
): AttemptProgress {
  const answered = attempt.answers.length;
  return {
    answered,
    total: attempt.questions.length,
    remaining: attempt.questions.length - answered,
  };
}

/**
 * Resume point: the first unanswered question in the attempt's persisted
 * order (falls back to the first question; when everything is answered the
 * candidate lands on the last question to review and submit).
 */
export function getResumeIndex(attempt: AssessmentAttemptState): number {
  const answeredIds = new Set(attempt.answers.map((a) => a.questionId));
  const firstUnanswered = attempt.questions.findIndex(
    (question) => !answeredIds.has(question.id),
  );

  if (firstUnanswered !== -1) return firstUnanswered;
  return Math.max(0, attempt.questions.length - 1);
}

/**
 * Whether the assessment hub should offer a retake. Encapsulated here so
 * the interim policy reads consistently; the server remains the authority
 * and will reject a disallowed retake regardless of what the UI shows.
 */
export function canOfferRetake(view: AssessmentView): boolean {
  return (
    view.phase === "SUBMITTED" &&
    view.result?.passed === false &&
    view.status === "ASSESSMENT_FAILED"
  );
}

/** Display helpers for the assessment facts (intro + rails). */
export const assessmentFacts = {
  questions: ASSESSMENT_META.totalQuestions,
  marks: ASSESSMENT_META.totalMarks,
  passMark: ASSESSMENT_META.passMarkPercent,
} as const;
