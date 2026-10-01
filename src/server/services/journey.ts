import { ORIENTATION_SECTIONS } from "@/config/orientation";
import { ONBOARDING_STEPS } from "@/config/onboarding";
import { OPEN_POSITION } from "@/config/content";
import {
  CANDIDATE_STATUS_DETAILS,
  RECRUITMENT_STAGES,
} from "@/config/recruitment";
import { db } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { ReferenceRecoveryInput } from "@/lib/validation/recovery";
import type {
  CandidateStageEvent,
  CandidateStatusId,
  JourneyNextAction,
  JourneyStageState,
  JourneyStageView,
  RecruitmentJourneyView,
  RecruitmentStageId,
  StageEventTypeId,
} from "@/types/recruitment";

/**
 * Unified recruitment journey service.
 *
 * ONE application, ONE reference, ONE journey. This module is the single
 * place that derives the candidate's current stage, completed stages and
 * next action from persisted state (CandidateStatus + stage records +
 * append-only StageEvents). Pages and API routes render this view — they
 * never decide stage rules themselves, and the candidate can never select
 * their own stage.
 *
 * Rules encoded here:
 * - The reference is created when the application is submitted, so the
 *   APPLICATION stage is always complete on the unified journey — even for
 *   APPLICANT, whose current stage is the (not yet entered) orientation.
 * - Progression is one-way: a completed stage never becomes current again.
 *   Completed stages are records, not re-enterable workflows.
 * - After ASSESSMENT_PASSED the agreement (persisted as the OFFER stage)
 *   is the current stage: the one action is "Review Agreement". After it
 *   is accepted, the appointment stage becomes current with ONE action:
 *   "View Provisional Appointment" — the first open issues the letter
 *   (lazily, server-side). After issuance the appointment stage is a
 *   completed record, the letter stays reachable as a read-only document
 *   (the one-way-lock exception), and Activation is shown as the current
 *   stage with ONE action: "Continue to Staff Activation" — the explicit
 *   in-portal activation (stage 5). Once activated, the journey is
 *   complete: the staff record (Staff ID, activation date, designation)
 *   is shown read-only, and Onboarding — the next stage — is honestly
 *   announced without a fake recruitment CTA (it is NOT a seventh
 *   recruitment stage). Once the staff profile exists, a separate
 *   staff-side onboarding summary is attached to the view: the unified
 *   journey renders it as its own "Staff Onboarding" section (Start /
 *   Continue / Completed) beneath the staff record, with the CTA owned by
 *   that section — never by deriveNextAction, which stays null for
 *   APPROVED_STAFF. Onboarding writes no CandidateStatus, no
 *   RecruitmentStage and no StageEvent (staff-side operational state).
 * - StageEvent history is read for display only; CandidateStatus and the
 *   stage records remain the authoritative current state.
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

/* -------------------------------------------------------------------------
 * Journey derivation
 * ---------------------------------------------------------------------- */

/**
 * Current-stage index and completed boundary for a status.
 *
 * `APPLICANT` is the one special case: the application IS submitted (that's
 * why a reference exists), so the journey treats APPLICATION as completed
 * and orientation — not the application — as the current stage. Every other
 * status maps directly onto the existing status definitions.
 */
function deriveStageStates(status: CandidateStatusId): {
  stages: JourneyStageView[];
  currentStage: RecruitmentStageId | null;
} {
  const definition = CANDIDATE_STATUS_DETAILS[status];
  const mappedIndex = RECRUITMENT_STAGES.findIndex(
    (stage) => stage.id === definition.stage,
  );

  const applicationIndex = RECRUITMENT_STAGES.findIndex(
    (stage) => stage.id === "APPLICATION",
  );

  // Last stage index that counts as completed.
  const completedBoundary =
    status === "APPLICANT"
      ? applicationIndex
      : definition.stageCompleted
        ? mappedIndex
        : mappedIndex - 1;

  // The current stage is the first stage AFTER the completed boundary —
  // including for statuses that just completed a stage (e.g.
  // ORIENTATION_COMPLETED → the assessment is current;
  // ASSESSMENT_PASSED → the agreement is current).
  const currentIndex = definition.journeyComplete
    ? -1
    : status === "APPLICANT"
      ? RECRUITMENT_STAGES.findIndex((stage) => stage.id === "ORIENTATION")
      : definition.stageCompleted
        ? mappedIndex + 1
        : mappedIndex;

  const stages: JourneyStageView[] = RECRUITMENT_STAGES.map((stage, index) => {
    const state: JourneyStageState =
      definition.journeyComplete || index <= completedBoundary
        ? "completed"
        : index === currentIndex
          ? "current"
          : "locked";
    return { id: stage.id, label: stage.label, state };
  });

  return {
    stages,
    currentStage: definition.journeyComplete
      ? null
      : (RECRUITMENT_STAGES[currentIndex]?.id ?? null),
  };
}

/**
 * The ONE obvious next action for the current stage. Derived from the
 * persisted status — never from client input. Returns null when the next
 * stage is not implemented yet (honest locked state, no fake CTA).
 */
function deriveNextAction(
  status: CandidateStatusId,
  referenceNumber: string,
  orientationStarted: boolean,
): JourneyNextAction | null {
  switch (status) {
    case "APPLICANT":
    case "ORIENTATION_PENDING":
      return {
        label: orientationStarted
          ? "Continue orientation"
          : "Start orientation",
        href: `/orientation/${referenceNumber}`,
      };
    case "ORIENTATION_COMPLETED":
      return { label: "Start assessment", href: `/assessment/${referenceNumber}` };
    case "ASSESSMENT_PENDING":
    case "ASSESSMENT_FAILED":
      // The hub shows resume/result state; the runner is reached from there.
      return { label: "Continue assessment", href: `/assessment/${referenceNumber}` };
    case "ASSESSMENT_PASSED":
      // The agreement (the OFFER stage) is the current, actionable stage.
      return { label: "Review Agreement", href: `/agreement/${referenceNumber}` };
    case "OFFER_ACCEPTED":
      // The appointment stage is current: ONE action. The first open
      // issues the letter server-side; later opens are the read-only
      // record — the URL is the same either way.
      return {
        label: "View Provisional Appointment",
        href: `/appointment/${referenceNumber}`,
      };
    case "APPOINTMENT_ISSUED":
    case "ACTIVATION_PENDING":
      // The activation stage is current: ONE action — the explicit
      // in-portal activation. Opening the page records the stage entry
      // (APPOINTMENT_ISSUED → ACTIVATION_PENDING); the activation itself
      // is the explicit, server-validated action on that page. The URL is
      // the same before and after entry.
      return {
        label: "Continue to Staff Activation",
        href: `/activation/${referenceNumber}`,
      };
    default:
      // APPROVED_STAFF: the recruitment journey is complete. Onboarding is
      // the next stage but is not implemented yet — no action, honest note
      // instead. A declined agreement never advances the journey.
      return null;
  }
}

/**
 * Honest "coming next" copy for candidates whose next stage is not open
 * yet. Falls back to the status definition's nextStep for later statuses.
 */
function deriveUpcomingNote(status: CandidateStatusId): string | null {
  return CANDIDATE_STATUS_DETAILS[status].nextStep;
}

/* -------------------------------------------------------------------------
 * Loading + view
 * ---------------------------------------------------------------------- */

type JourneyCandidate = {
  id: string;
  referenceNumber: string;
  fullName: string;
  status: CandidateStatusId;
  createdAt: Date;
  applications: { roleTitle: string }[];
  orientation: {
    completedAt: Date | null;
    sections: { sectionId: string }[];
  } | null;
  attempts: {
    attemptNumber: number;
    startedAt: Date;
    submittedAt: Date | null;
    marksAwarded: number | null;
    totalMarks: number | null;
    passed: boolean | null;
    questions: { questionId: string }[];
    answers: { questionId: string }[];
  }[];
  agreement: {
    version: string;
    acceptedAt: Date | null;
  } | null;
  appointment: {
    appointmentReference: string;
    version: string;
    issuedAt: Date;
  } | null;
  staff: {
    staffId: string;
    version: string;
    roleTitle: string;
    activatedAt: Date;
    onboarding: {
      currentStepId: string | null;
      startedAt: Date;
      completedAt: Date | null;
      steps: { stepId: string }[];
    } | null;
  } | null;
  events: {
    id: string;
    stage: RecruitmentStageId;
    type: StageEventTypeId;
    description: string | null;
    occurredAt: Date;
  }[];
};

async function loadJourneyCandidate(
  reference: string,
): Promise<JourneyCandidate> {
  const normalized = reference.trim().toUpperCase();

  if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  const candidate = await db.candidate.findUnique({
    where: { referenceNumber: normalized },
    select: {
      id: true,
      referenceNumber: true,
      fullName: true,
      status: true,
      createdAt: true,
      applications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { roleTitle: true },
      },
      orientation: {
        select: {
          completedAt: true,
          sections: { select: { sectionId: true } },
        },
      },
      attempts: {
        orderBy: { attemptNumber: "desc" },
        select: {
          attemptNumber: true,
          startedAt: true,
          submittedAt: true,
          marksAwarded: true,
          totalMarks: true,
          passed: true,
          questions: { select: { questionId: true } },
          answers: { select: { questionId: true } },
        },
      },
      agreement: {
        select: { version: true, acceptedAt: true },
      },
      appointment: {
        select: {
          appointmentReference: true,
          version: true,
          issuedAt: true,
        },
      },
      staff: {
        select: {
          staffId: true,
          version: true,
          roleTitle: true,
          activatedAt: true,
          onboarding: {
            select: {
              currentStepId: true,
              startedAt: true,
              completedAt: true,
              steps: { select: { stepId: true } },
            },
          },
        },
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: {
          id: true,
          stage: true,
          type: true,
          description: true,
          occurredAt: true,
        },
      },
    },
  });

  if (!candidate) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  return candidate as unknown as JourneyCandidate;
}

/**
 * Build the unified journey view for a candidate.
 *
 * This is the server-determined answer to "where am I?" — used by the
 * unified application screen (direct import) and GET /api/journey/[reference].
 */
export async function getRecruitmentJourney(
  reference: string,
): Promise<RecruitmentJourneyView> {
  const candidate = await loadJourneyCandidate(reference);

  const { stages, currentStage } = deriveStageStates(candidate.status);

  const orientationStarted =
    (candidate.orientation?.sections.length ?? 0) > 0 &&
    candidate.orientation?.completedAt == null;

  const activeAttempt = candidate.attempts.find(
    (attempt) => attempt.submittedAt === null,
  );
  const latestSubmitted = candidate.attempts.find(
    (attempt) => attempt.submittedAt !== null && attempt.passed !== null,
  );

  // Concrete resume detail for the current stage — one glance tells the
  // candidate how far they got without opening the stage itself.
  let currentStageDetail: string | null = null;
  if (currentStage === "ORIENTATION" && candidate.orientation && !candidate.orientation.completedAt) {
    currentStageDetail = `${candidate.orientation.sections.length} of ${ORIENTATION_SECTIONS.length} sections read`;
  } else if (currentStage === "ASSESSMENT" && activeAttempt) {
    currentStageDetail = `${activeAttempt.answers.length} of ${activeAttempt.questions.length} questions answered`;
  }

  const events: CandidateStageEvent[] = candidate.events.map((event) => ({
    id: event.id,
    stage: event.stage,
    type: event.type,
    description: event.description,
    occurredAt: event.occurredAt.toISOString(),
  }));

  const staffOnboarding = candidate.staff?.onboarding ?? null;

  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    roleTitle: candidate.applications[0]?.roleTitle ?? OPEN_POSITION.title,
    status: candidate.status,
    submittedAt: candidate.createdAt.toISOString(),
    stages,
    currentStage,
    nextAction: deriveNextAction(
      candidate.status,
      candidate.referenceNumber,
      orientationStarted,
    ),
    upcomingNote: deriveUpcomingNote(candidate.status),
    currentStageDetail,
    assessmentResult:
      latestSubmitted && latestSubmitted.marksAwarded !== null && latestSubmitted.totalMarks !== null
        ? {
            attemptNumber: latestSubmitted.attemptNumber,
            submittedAt: latestSubmitted.submittedAt!.toISOString(),
            passed: latestSubmitted.passed === true,
            marksAwarded: latestSubmitted.marksAwarded,
            totalMarks: latestSubmitted.totalMarks,
          }
        : null,
    agreementRecord:
      candidate.agreement?.acceptedAt != null
        ? {
            version: candidate.agreement.version,
            acceptedAt: candidate.agreement.acceptedAt.toISOString(),
          }
        : null,
    appointmentRecord: candidate.appointment
      ? {
          appointmentReference: candidate.appointment.appointmentReference,
          version: candidate.appointment.version,
          issuedAt: candidate.appointment.issuedAt.toISOString(),
        }
      : null,
    staffRecord: candidate.staff
      ? {
          staffId: candidate.staff.staffId,
          roleTitle: candidate.staff.roleTitle,
          activatedAt: candidate.staff.activatedAt.toISOString(),
        }
      : null,
    onboarding: candidate.staff
      ? {
          state:
            staffOnboarding == null
              ? ("NOT_STARTED" as const)
              : staffOnboarding.completedAt != null
                ? ("COMPLETED" as const)
                : ("IN_PROGRESS" as const),
          completedSteps: staffOnboarding?.steps.length ?? 0,
          totalSteps: ONBOARDING_STEPS.length,
          startedAt: staffOnboarding?.startedAt.toISOString() ?? null,
          completedAt: staffOnboarding?.completedAt?.toISOString() ?? null,
        }
      : null,
    events,
  };
}

/* -------------------------------------------------------------------------
 * Reference recovery
 *
 * Interim access policy (see docs/CONTENT-QUESTIONS.md §11): the candidate
 * must supply ALL THREE details they applied with. Only the reference is
 * revealed — never the application details — and every failure returns the
 * same neutral message, so responses cannot be used to enumerate
 * applications.
 * ---------------------------------------------------------------------- */

const RECOVERY_NOT_FOUND_MESSAGE =
  "We couldn't find an application that matches those details. Check each field and try again, or contact us if you still can't access your application.";

/** Compare phone numbers on their significant trailing digits. */
function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Compare names on collapsed, lower-cased text. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface ReferenceRecoveryResult {
  referenceNumber: string;
}

/**
 * Locate an application from the details supplied at application time and
 * return ONLY its recruitment reference. Any mismatch produces the same
 * neutral not-found error — the response never reveals whether an
 * application exists for a particular person.
 */
export async function recoverApplicationReference(
  input: ReferenceRecoveryInput,
): Promise<ReferenceRecoveryResult> {
  // Email is unique per candidate, so it is the discriminating lookup;
  // name and phone are verified in code (collation-independent).
  const candidate = await db.candidate.findFirst({
    where: { email: input.email.toLowerCase() },
    select: { referenceNumber: true, fullName: true, phone: true },
  });

  const nameMatches =
    candidate !== null &&
    normalizeName(candidate.fullName) === normalizeName(input.fullName);

  const phoneMatches =
    candidate !== null &&
    normalizePhoneDigits(candidate.phone) === normalizePhoneDigits(input.phone) &&
    normalizePhoneDigits(input.phone).length > 0;

  if (!candidate || !nameMatches || !phoneMatches) {
    throw notFoundError(RECOVERY_NOT_FOUND_MESSAGE);
  }

  return { referenceNumber: candidate.referenceNumber };
}
