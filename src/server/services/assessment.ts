import "server-only";

import { Prisma } from "@prisma/client";

import {
  ASSESSMENT_META,
  getAssessmentQuestion,
} from "@/config/assessment";
import { db } from "@/lib/db";
import { conflictError, notFoundError, validationError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { AssessmentAnswerInput } from "@/lib/validation/assessment";
import {
  ASSESSMENT_POLICY,
  getAuthoritativeQuestions,
  scoreAttempt,
} from "@/server/assessment-content";
import type {
  AssessmentResultState,
  AssessmentView,
  SafeAssessmentQuestion,
} from "@/types/recruitment";

/**
 * Automated Interview Assessment (stage 2) service.
 *
 * Every rule lives here — UI and route handlers never touch Prisma and never
 * decide anything about eligibility, scoring or progression:
 *
 * - Eligibility: the candidate must have explicitly completed orientation.
 *   Enforced here, so a hand-crafted API call is rejected too.
 * - Attempts: starting resumes an active attempt instead of creating a new
 *   one; passing closes the assessment; the (interim, config-driven) retake
 *   policy controls what happens after a failure.
 * - Order: each attempt snapshots the authoritative question order — the
 *   client never supplies or mutates ordering.
 * - Answers: saved server-side per question of the active attempt; questions
 *   must belong to the persisted attempt set; saves are idempotent upserts.
 * - Scoring: computed exclusively on the server from the server-only answer
 *   key; results are persisted once (double submits return the same result).
 * - Status machine: start → ASSESSMENT_PENDING (+ENTERED event); submit →
 *   ASSESSMENT_PASSED (+COMPLETED) or ASSESSMENT_FAILED (+FAILED). No new
 *   enum values; events are append-only.
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

type AttemptRelation = {
  id: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  correctCount: number | null;
  marksAwarded: number | null;
  totalMarks: number | null;
  percentage: number | null;
  passed: boolean | null;
  questions: { questionId: string; position: number }[];
  answers: { questionId: string; selectedOption: number }[];
};

type CandidateWithAssessment = {
  id: string;
  referenceNumber: string;
  fullName: string;
  status: AssessmentView["status"];
  orientation: { completedAt: Date | null } | null;
  attempts: AttemptRelation[];
};

const CANDIDATE_SELECT = {
  id: true,
  referenceNumber: true,
  fullName: true,
  status: true,
  orientation: { select: { completedAt: true } },
  attempts: {
    orderBy: { attemptNumber: "desc" as const },
    select: {
      id: true,
      attemptNumber: true,
      startedAt: true,
      submittedAt: true,
      correctCount: true,
      marksAwarded: true,
      totalMarks: true,
      percentage: true,
      passed: true,
      questions: {
        orderBy: { position: "asc" as const },
        select: { questionId: true, position: true },
      },
      answers: {
        select: { questionId: true, selectedOption: true },
      },
    },
  },
} as const;

async function loadCandidate(
  reference: string,
): Promise<CandidateWithAssessment> {
  const normalized = reference.trim().toUpperCase();

  if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  const candidate = await db.candidate.findUnique({
    where: { referenceNumber: normalized },
    select: CANDIDATE_SELECT,
  });

  if (!candidate) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  return candidate as CandidateWithAssessment;
}

function toSafeQuestions(attempt: AttemptRelation): SafeAssessmentQuestion[] {
  // Join the persisted order with the current config; skip any question id
  // that no longer exists (content drift) so an old attempt still renders.
  return attempt.questions.flatMap((row) => {
    const question = getAssessmentQuestion(row.questionId);
    if (!question) return [];
    return [
      {
        id: question.id,
        index: row.position + 1,
        text: question.text,
        options: [...question.options],
        category: question.category,
      },
    ];
  });
}

function toResultState(attempt: AttemptRelation): AssessmentResultState | null {
  if (
    attempt.submittedAt === null ||
    attempt.correctCount === null ||
    attempt.marksAwarded === null ||
    attempt.totalMarks === null ||
    attempt.percentage === null ||
    attempt.passed === null
  ) {
    return null;
  }

  return {
    attemptNumber: attempt.attemptNumber,
    submittedAt: attempt.submittedAt.toISOString(),
    correctCount: attempt.correctCount,
    marksAwarded: attempt.marksAwarded,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    passed: attempt.passed,
  };
}

function toView(candidate: CandidateWithAssessment): AssessmentView {
  const orientationCompleted =
    candidate.orientation?.completedAt != null;

  const activeAttempt =
    candidate.attempts.find((attempt) => attempt.submittedAt === null) ??
    null;
  const latestSubmitted =
    candidate.attempts.find((attempt) => attempt.submittedAt !== null) ??
    null;

  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    status: candidate.status,
    orientationCompleted,
    phase: activeAttempt
      ? "IN_PROGRESS"
      : latestSubmitted
        ? "SUBMITTED"
        : "NOT_STARTED",
    attempt: activeAttempt
      ? {
          attemptNumber: activeAttempt.attemptNumber,
          startedAt: activeAttempt.startedAt.toISOString(),
          questions: toSafeQuestions(activeAttempt),
          answers: activeAttempt.answers.map((answer) => ({
            questionId: answer.questionId,
            selectedOption: answer.selectedOption,
          })),
        }
      : null,
    result: latestSubmitted ? toResultState(latestSubmitted) : null,
    attemptCount: candidate.attempts.length,
  };
}

/** Read a candidate's assessment state (safe data only). */
export async function getAssessmentView(
  reference: string,
): Promise<AssessmentView> {
  return toView(await loadCandidate(reference));
}

/**
 * Start the assessment. Resumes an active attempt instead of creating a new
 * one; applies the interim retake policy after a failure; refuses once the
 * candidate has passed. A genuinely new attempt moves the candidate to
 * ASSESSMENT_PENDING and records an ENTERED StageEvent.
 */
export async function startAssessment(
  reference: string,
): Promise<AssessmentView> {
  const candidate = await loadCandidate(reference);

  // --- Eligibility (server-enforced; mirrors of the UI gate are not enough)
  if (!candidate.orientation?.completedAt) {
    throw conflictError(
      "You need to complete your orientation before you can take the assessment.",
    );
  }

  // --- Resume an active attempt (idempotent; no new events).
  const activeAttempt = candidate.attempts.find(
    (attempt) => attempt.submittedAt === null,
  );
  if (activeAttempt) {
    return toView(candidate);
  }

  // --- Already passed → the assessment is closed.
  const latestSubmitted = candidate.attempts.find(
    (attempt) => attempt.submittedAt !== null,
  );
  if (latestSubmitted?.passed === true) {
    throw conflictError(
      "You have already passed the assessment, so it can no longer be retaken.",
    );
  }

  // --- Retake policy (interim, config-driven — see assessment-content.ts).
  if (latestSubmitted) {
    if (!ASSESSMENT_POLICY.allowRetakeAfterFailure) {
      throw conflictError(
        "You did not pass this assessment. The recruitment team will contact you about next steps.",
      );
    }
    if (
      ASSESSMENT_POLICY.maxAttempts !== null &&
      candidate.attempts.length >= ASSESSMENT_POLICY.maxAttempts
    ) {
      throw conflictError(
        "You have used all available attempts for this assessment. The recruitment team will contact you about next steps.",
      );
    }
  }

  // --- Start is only valid from the assessment stage of the journey.
  const startableStatuses = [
    "ORIENTATION_COMPLETED",
    "ASSESSMENT_PENDING",
    "ASSESSMENT_FAILED",
  ] as const;
  if (
    !startableStatuses.includes(
      candidate.status as (typeof startableStatuses)[number],
    )
  ) {
    throw conflictError(
      "Your assessment can no longer be started from your current recruitment stage.",
    );
  }

  const isRetake = candidate.attempts.length > 0;

  try {
    await db.$transaction(async (tx) => {
      const attemptCount = await tx.assessmentAttempt.count({
        where: { candidateId: candidate.id },
      });

      const attempt = await tx.assessmentAttempt.create({
        data: {
          candidateId: candidate.id,
          attemptNumber: attemptCount + 1,
          questions: {
            create: getAuthoritativeQuestions().map((question, position) => ({
              questionId: question.id,
              position,
            })),
          },
        },
        select: { id: true },
      });

      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "ASSESSMENT_PENDING" },
      });

      await tx.stageEvent.create({
        data: {
          candidateId: candidate.id,
          stage: "ASSESSMENT",
          type: "ENTERED",
          description: isRetake
            ? "Started a retake of the Automated Interview Assessment"
            : "Started the Automated Interview Assessment",
        },
      });

      return attempt;
    });
  } catch (error) {
    // Race: a concurrent start created the attempt first — resume it.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return getAssessmentView(reference);
      }
    }
    throw error;
  }

  return getAssessmentView(reference);
}

/**
 * Save one answer on the active attempt. Idempotent per (attempt, question);
 * questions must belong to the attempt's persisted set; answers are
 * rejected once the attempt has been submitted.
 */
export async function saveAssessmentAnswer(
  reference: string,
  input: AssessmentAnswerInput,
): Promise<{ answeredCount: number; totalQuestions: number }> {
  const candidate = await loadCandidate(reference);

  const activeAttempt = candidate.attempts.find(
    (attempt) => attempt.submittedAt === null,
  );

  if (!activeAttempt) {
    const latestSubmitted = candidate.attempts.find(
      (attempt) => attempt.submittedAt !== null,
    );
    throw conflictError(
      latestSubmitted
        ? "Your assessment has been submitted, so answers can no longer be changed."
        : "Start the assessment before saving answers.",
    );
  }

  // The question must belong to THIS attempt's persisted question set —
  // a valid config id from a different attempt generation is still invalid.
  const questionRow = activeAttempt.questions.find(
    (row) => row.questionId === input.questionId,
  );
  if (!questionRow || !getAssessmentQuestion(input.questionId)) {
    throw validationError("That question is not part of your assessment.", {
      questionId: "That question is not part of your assessment.",
    });
  }

  await db.assessmentAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId: activeAttempt.id,
        questionId: input.questionId,
      },
    },
    create: {
      attemptId: activeAttempt.id,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
    },
    update: { selectedOption: input.selectedOption },
  });

  const answeredCount = await db.assessmentAnswer.count({
    where: { attemptId: activeAttempt.id },
  });

  return { answeredCount, totalQuestions: ASSESSMENT_META.totalQuestions };
}

/**
 * Submit the active attempt. Scoring happens exclusively here, from the
 * server-only answer key. Submission is idempotent: a double submit (or a
 * refresh after submission) returns the persisted result — never a second
 * one. Pass/fail updates the candidate status and records the StageEvent.
 */
export async function submitAssessment(
  reference: string,
): Promise<AssessmentView> {
  const candidate = await loadCandidate(reference);

  const activeAttempt = candidate.attempts.find(
    (attempt) => attempt.submittedAt === null,
  );

  // Idempotent: nothing active — return the current view (with the result,
  // when one exists). Never create a duplicate result.
  if (!activeAttempt) {
    return toView(candidate);
  }

  const selections: Record<string, number> = {};
  for (const answer of activeAttempt.answers) {
    selections[answer.questionId] = answer.selectedOption;
  }

  const outcome = scoreAttempt(selections);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: activeAttempt.id },
      data: {
        submittedAt: now,
        correctCount: outcome.correctCount,
        marksAwarded: outcome.marksAwarded,
        totalMarks: outcome.totalMarks,
        percentage: outcome.percentage,
        passed: outcome.passed,
      },
    });

    await tx.candidate.update({
      where: { id: candidate.id },
      data: {
        status: outcome.passed ? "ASSESSMENT_PASSED" : "ASSESSMENT_FAILED",
      },
    });

    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "ASSESSMENT",
        type: outcome.passed ? "COMPLETED" : "FAILED",
        description: outcome.passed
          ? `Passed the Automated Interview Assessment (score ${outcome.marksAwarded}/${outcome.totalMarks})`
          : `Did not pass the Automated Interview Assessment (score ${outcome.marksAwarded}/${outcome.totalMarks})`,
      },
    });
  });

  return getAssessmentView(reference);
}
