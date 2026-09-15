import "server-only";

import { Prisma } from "@prisma/client";

import {
  ONBOARDING_ACKNOWLEDGEMENT_LABEL,
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEPS,
  ONBOARDING_WHATSAPP,
  getOnboardingStep,
} from "@/config/onboarding";
import { db } from "@/lib/db";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import { AppError, conflictError, notFoundError, validationError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type {
  OnboardingCompleteInput,
  OnboardingStepInput,
} from "@/lib/validation/onboarding";
import type {
  OnboardingCompletedStep,
  OnboardingRecordView,
  OnboardingStateId,
  OnboardingView,
  StaffRecordView,
} from "@/types/recruitment";

/**
 * Staff Onboarding (stage 6) service — the FINAL stage of the FinFam
 * recruitment/onboarding MVP.
 *
 * Onboarding is STAFF-SIDE operational state, deliberately outside the
 * recruitment state machine: it writes NO CandidateStatus value, NO
 * RecruitmentStage value and NO StageEvent. APPROVED_STAFF remains the
 * terminal recruitment result; this service only manages the
 * StaffOnboarding + StaffOnboardingStep records. Every rule lives here —
 * pages and route handlers never touch Prisma and never decide eligibility:
 *
 * - Eligibility: the candidate must exist (neutral 404 otherwise), be
 *   APPROVED_STAFF and have a Staff row (defensive 500 if the impossible
 *   "approved without staff record" state appears). Everyone earlier in the
 *   journey gets an honest eligible:false view — and every WRITE is refused.
 * - Entry: opening the stage (page or GET API) lazily creates the one
 *   StaffOnboarding row (startedAt, pinned version, currentStepId =
 *   "welcome") — idempotently and race-safely (the unique constraint is the
 *   backstop; a losing concurrent creator re-reads the winner's row).
 *   Opening NEVER completes a step and NEVER completes onboarding.
 * - Steps: sequential, server-enforced. A future/skip-ahead step is a 422
 *   that names the required preceding step; an unknown step id is a 422;
 *   re-completing a completed step is an idempotent no-op; completing a
 *   step after final completion is a 409. Exactly-once per step is
 *   guaranteed by the @@unique([onboardingId, stepId]) constraint (a
 *   concurrent duplicate insert loses the race and is treated as
 *   idempotent). `currentStepId` (the resume point) is derived on write —
 *   never trusted from the client.
 * - Completion: explicit, server-validated, exactly once. Requires the
 *   StaffOnboarding record, ALL review steps (1–6) completed per
 *   persistence, the literal acknowledgement and the current content
 *   version. The final "ready" step is recorded by the completion itself —
 *   its review IS the acknowledgement — in the same transaction as the
 *   completedAt latch, so the persisted audit trail always holds all seven
 *   step rows plus ONE completion timestamp. The exactly-once latch is a
 *   conditional update on `completedAt = null` — repeated or concurrent
 *   completions produce ONE timestamp, and losers re-read the winner's
 *   state. Completion re-pins the version so the row records which set of
 *   instructions the staff member completed. No CandidateStatus change, no
 *   StageEvent.
 * - One-way: completed onboarding is closed. Nothing reopens it, no step
 *   can be mutated afterwards, and the page redirects to the unified
 *   journey (the terminal staff state).
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

const ELIGIBLE_STATUS = "APPROVED_STAFF";

type OnboardingStepRelation = { stepId: string; completedAt: Date };

type OnboardingRelation = {
  id: string;
  version: string;
  currentStepId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  steps: OnboardingStepRelation[];
};

type StaffRelation = {
  id: string;
  staffId: string;
  version: string;
  roleTitle: string;
  appointmentReference: string;
  activatedAt: Date;
  onboarding: OnboardingRelation | null;
};

type CandidateWithOnboarding = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  status: string;
  staff: StaffRelation | null;
};

const CANDIDATE_SELECT = {
  id: true,
  referenceNumber: true,
  fullName: true,
  email: true,
  status: true,
  staff: {
    select: {
      id: true,
      staffId: true,
      version: true,
      roleTitle: true,
      appointmentReference: true,
      activatedAt: true,
      onboarding: {
        select: {
          id: true,
          version: true,
          currentStepId: true,
          startedAt: true,
          completedAt: true,
          steps: {
            orderBy: { completedAt: "asc" as const },
            select: { stepId: true, completedAt: true },
          },
        },
      },
    },
  },
} as const;

async function loadCandidate(
  reference: string,
): Promise<CandidateWithOnboarding> {
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

  return candidate as CandidateWithOnboarding;
}

/**
 * Eligibility for onboarding: the candidate must be APPROVED_STAFF with a
 * Staff row. Returns the Staff relation, or null when onboarding is not
 * available (every pre-approval status, or no staff record).
 */
function eligibleStaffOf(candidate: CandidateWithOnboarding): StaffRelation | null {
  if (candidate.status !== ELIGIBLE_STATUS || !candidate.staff) {
    return null;
  }
  return candidate.staff;
}

function toRecordView(onboarding: OnboardingRelation): OnboardingRecordView {
  const state: OnboardingStateId =
    onboarding.completedAt != null
      ? "COMPLETED"
      : "IN_PROGRESS";

  const steps: OnboardingCompletedStep[] = onboarding.steps.map((step) => ({
    id: step.stepId,
    completedAt: step.completedAt.toISOString(),
  }));

  return {
    state,
    version: onboarding.version,
    currentStepId: onboarding.currentStepId,
    startedAt: onboarding.startedAt.toISOString(),
    completedAt: onboarding.completedAt?.toISOString() ?? null,
    steps,
  };
}

function toStaffView(staff: StaffRelation): StaffRecordView {
  return {
    staffId: staff.staffId,
    version: staff.version,
    roleTitle: staff.roleTitle,
    appointmentReference: staff.appointmentReference,
    activatedAt: staff.activatedAt.toISOString(),
  };
}

function toView(
  candidate: CandidateWithOnboarding,
  staff: StaffRelation | null,
): OnboardingView {
  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    status: candidate.status as OnboardingView["status"],
    eligible: staff != null,
    staff: staff ? toStaffView(staff) : null,
    onboarding: staff?.onboarding ? toRecordView(staff.onboarding) : null,
    content: {
      version: ONBOARDING_META.version,
      acknowledgementLabel: ONBOARDING_ACKNOWLEDGEMENT_LABEL,
      whatsappNumber: ONBOARDING_WHATSAPP.number,
      whatsappMessage: ONBOARDING_WHATSAPP.message,
      steps: ONBOARDING_STEPS,
    },
  };
}

/**
 * Lazily create the one StaffOnboarding row for this staff member — the
 * stage's entry action. Race-safe: the unique constraint on staffId is the
 * backstop; a concurrent first-open loses the insert, re-reads the winner's
 * row and both observe the same single record. Opening never completes a
 * step and never completes onboarding.
 */
async function ensureOnboardingRecord(
  staffId: string,
  context: { candidateId: string; recipientEmail: string },
): Promise<OnboardingRelation> {
  const created = await db.staffOnboarding
    .create({
      data: {
        staffId,
        version: ONBOARDING_META.version,
        currentStepId: ONBOARDING_STEPS[0].id,
        startedAt: new Date(),
      },
      select: {
        id: true,
        version: true,
        currentStepId: true,
        startedAt: true,
        completedAt: true,
        steps: {
          orderBy: { completedAt: "asc" as const },
          select: { stepId: true, completedAt: true },
        },
      },
    })
    .catch((error) => {
      // A concurrent first-open already created the record — not an error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    });

  if (created) {
    // First open IS the onboarding start (brief §8) — queue the ONE
    // ONBOARDING_STARTED intent here. The unique dedupeKey keeps it
    // exactly-once even if a concurrent first-open raced past the P2002
    // backstop; the Mailjet send is fire-and-forget and suppressed safely
    // when notifications are disabled (§26).
    const enqueued = await enqueueNotification(db, {
      type: "ONBOARDING_STARTED",
      dedupeKey: buildDedupeKey("ONBOARDING_STARTED", created.id),
      candidateId: context.candidateId,
      recipientEmail: context.recipientEmail,
    });
    if (enqueued.deliveryId) {
      dispatchNotification(enqueued.deliveryId);
    }
    return created as OnboardingRelation;
  }

  const existing = await db.staffOnboarding.findUnique({
    where: { staffId },
    select: {
      id: true,
      version: true,
      currentStepId: true,
      startedAt: true,
      completedAt: true,
      steps: {
        orderBy: { completedAt: "asc" as const },
        select: { stepId: true, completedAt: true },
      },
    },
  });

  if (!existing) {
    throw new AppError(
      "INTERNAL",
      "Your onboarding could not be opened. Please try again.",
      { status: 500 },
    );
  }

  return existing as OnboardingRelation;
}

/**
 * Read the onboarding stage. For eligible staff this lazily creates the
 * onboarding record on first open (idempotent, race-safe) and returns the
 * full view; for everyone else it returns an honest eligible:false view
 * with no record — reading never writes onboarding progress.
 */
export async function getOnboardingView(
  reference: string,
): Promise<OnboardingView> {
  const candidate = await loadCandidate(reference);

  // Defensive integrity check: an APPROVED_STAFF candidate always has a
  // Staff row by construction (activation creates both in one transaction).
  // Refuse loudly rather than guess if the invariant is ever broken.
  if (candidate.status === ELIGIBLE_STATUS && !candidate.staff) {
    throw new AppError(
      "INTERNAL",
      "Your onboarding could not be opened. Please contact support.",
      { status: 500 },
    );
  }

  const staffOrNull = eligibleStaffOf(candidate);

  if (!staffOrNull) {
    return toView(candidate, null);
  }

  let staff = staffOrNull;
  if (!staff.onboarding) {
    staff = {
      ...staff,
      onboarding: await ensureOnboardingRecord(staff.id, {
        candidateId: candidate.id,
        recipientEmail: candidate.email,
      }),
    };
  }

  return toView(candidate, staff);
}

/**
 * Complete one onboarding step — an explicit, server-validated action
 * ("I have reviewed this onboarding section"). Enforces sequential order,
 * exactly-once persistence (unique constraint backstop) and the resume
 * pointer. Idempotent for safe double submits; a completed step after final
 * completion is refused (409).
 */
export async function completeOnboardingStep(
  reference: string,
  input: OnboardingStepInput,
): Promise<OnboardingView> {
  const candidate = await loadCandidate(reference);
  const staff = eligibleStaffOf(candidate);

  // Server-enforced eligibility: onboarding writes are refused for every
  // non-approved status, regardless of what the client sends.
  if (!staff) {
    throw conflictError(
      "Your staff profile cannot start onboarding from your current recruitment stage. Continue your application to see where you are.",
    );
  }

  const step = getOnboardingStep(input.stepId);
  if (!step) {
    throw validationError("That onboarding step does not exist.", {
      stepId: "That onboarding step does not exist.",
    });
  }

  // Lazily create the record on a direct step POST (the server never
  // depends on the client having opened the page first).
  let onboarding =
    staff.onboarding ?? (await ensureOnboardingRecord(staff.id, {
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    }));

  if (onboarding.completedAt) {
    throw conflictError(
      "Your onboarding is already complete, so steps can no longer be changed.",
    );
  }

  const completedIds = new Set(onboarding.steps.map((s) => s.stepId));

  // Idempotent: the step is already marked as reviewed.
  if (completedIds.has(step.id)) {
    return toView(candidate, { ...staff, onboarding });
  }

  // Sequential enforcement — everything before this step must be reviewed.
  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step.id);
  const missingPrior = ONBOARDING_STEPS.slice(0, stepIndex).find(
    (s) => !completedIds.has(s.id),
  );

  if (missingPrior) {
    throw validationError(
      `Onboarding steps are completed in order. Review "${missingPrior.title}" first.`,
      { stepId: `Review "${missingPrior.title}" first.` },
    );
  }

  await db.$transaction(async (tx) => {
    try {
      await tx.staffOnboardingStep.create({
        data: { onboardingId: onboarding.id, stepId: step.id },
      });
    } catch (error) {
      // A concurrent request completed this exact step first — the unique
      // constraint is the backstop. The winner already advanced the resume
      // point; this loser commits nothing and the idempotent re-read below
      // returns the authoritative state.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return;
      }
      throw error;
    }

    const remainingIds = new Set(completedIds);
    remainingIds.add(step.id);
    const nextStep = ONBOARDING_STEPS.find((s) => !remainingIds.has(s.id));

    await tx.staffOnboarding.update({
      where: { id: onboarding.id },
      data: { currentStepId: nextStep?.id ?? step.id },
    });
  });

  return getOnboardingView(reference);
}

/**
 * Complete onboarding — the explicit, auditable end of stage 6. Requires
 * the onboarding record, ALL seven steps completed per server persistence,
 * the literal acknowledgement and the current content version (the schema
 * enforces both before this runs). The exactly-once latch is the
 * conditional update on `completedAt = null` inside the transaction:
 * repeated or concurrent completions produce ONE completion timestamp and
 * the persisted record is returned — never a duplicate. No CandidateStatus
 * change, no StageEvent, no other table is touched.
 */
export async function completeOnboarding(
  reference: string,
  input: OnboardingCompleteInput,
): Promise<OnboardingView> {
  const candidate = await loadCandidate(reference);
  const staff = eligibleStaffOf(candidate);

  // Server-enforced eligibility (same rule as every onboarding write).
  if (!staff) {
    throw conflictError(
      "Your staff profile cannot start onboarding from your current recruitment stage. Continue your application to see where you are.",
    );
  }

  // Belt-and-braces literal check (the Zod refine already enforces this —
  // the acknowledgement must be literally true, never merely present).
  if (input.acknowledgement !== true) {
    throw validationError(
      "Please confirm the onboarding acknowledgement before completing.",
      {
        acknowledgement:
          "Please confirm the onboarding acknowledgement before completing.",
      },
    );
  }

  // Idempotent: completed onboarding is final — return the record.
  if (staff.onboarding?.completedAt) {
    return toView(candidate, staff);
  }

  // Lazily create the record on a direct completion POST, then re-check.
  const onboarding =
    staff.onboarding ?? (await ensureOnboardingRecord(staff.id, {
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    }));

  // The review steps (1–6) must all be completed; the final "ready" step is
  // recorded by the acknowledgement itself (below), never by "Continue".
  const completedIds = new Set(onboarding.steps.map((s) => s.stepId));
  const missingStep = ONBOARDING_STEPS.filter(
    (s) => s.id !== ONBOARDING_FINAL_STEP_ID,
  ).find((s) => !completedIds.has(s.id));

  if (missingStep) {
    throw validationError(
      "Every onboarding step must be reviewed before you can complete your onboarding.",
      {
        stepId: `Review "${missingStep.title}" first.`,
      },
    );
  }

  // The conditional latch: exactly one transaction records the final step
  // (its review IS the acknowledgement) and sets completedAt. Everyone else
  // must not write anything at all. The ONBOARDING_COMPLETED intent is
  // queued in the SAME transaction, ONLY when this transaction wins the
  // latch (count === 1) — a concurrent loser never queues a duplicate
  // (§11/§28). The Mailjet send happens after the commit, fire-and-forget
  // (§12/§16).
  const completedAt = new Date();
  let deliveryId: string | null = null;
  const result = await db.$transaction(async (tx) => {
    if (!completedIds.has(ONBOARDING_FINAL_STEP_ID)) {
      try {
        await tx.staffOnboardingStep.create({
          data: {
            onboardingId: onboarding.id,
            stepId: ONBOARDING_FINAL_STEP_ID,
          },
        });
      } catch (error) {
        // A concurrent completion recorded the final step first — harmless.
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        ) {
          throw error;
        }
      }
    }

    const updateResult = await tx.staffOnboarding.updateMany({
      where: { id: onboarding.id, completedAt: null },
      data: {
        completedAt,
        // Re-pin the version at completion so the row records which set of
        // instructions the staff member actually completed (content changed
        // between entry and completion is the rare edge this covers).
        version: ONBOARDING_META.version,
      },
    });

    if (updateResult.count === 1) {
      const enqueued = await enqueueNotification(tx, {
        type: "ONBOARDING_COMPLETED",
        dedupeKey: buildDedupeKey("ONBOARDING_COMPLETED", onboarding.id),
        candidateId: candidate.id,
        recipientEmail: candidate.email,
      });
      deliveryId = enqueued.deliveryId;
    }

    return updateResult;
  });

  if (result.count === 0) {
    // A concurrent completion won the race — fall through to the
    // idempotent re-read below; never write a second completion.
  }

  // Post-commit: attempt the actual send without blocking the response.
  if (deliveryId) {
    dispatchNotification(deliveryId);
  }

  // Whether this request performed the completion or lost a benign race,
  // the authoritative view is read back from persisted state (idempotent).
  return getOnboardingView(reference);
}
