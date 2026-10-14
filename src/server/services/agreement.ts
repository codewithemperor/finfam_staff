import "server-only";

import { AGREEMENT_META, AGREEMENT_SECTIONS } from "@/config/agreement";
import { OPEN_POSITION } from "@/config/content";
import { db } from "@/lib/db";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import { conflictError, notFoundError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { AgreementAcceptInput } from "@/lib/validation/agreement";
import type {
  AgreementView,
  CandidateStatusId,
  RecruitmentStageId,
} from "@/types/recruitment";

/**
 * Responsibility & Reward Agreement (stage 3) service.
 *
 * Persisted internally as the OFFER stage/statuses (see
 * prisma/schema.prisma); the candidate-facing label is "Agreement".
 * Every rule lives here — UI and route handlers never touch Prisma and
 * never decide anything about eligibility or progression:
 *
 * - Entry: opening the agreement (page or GET API) moves the candidate
 *   from ASSESSMENT_PASSED to OFFER_PENDING and records an ENTERED
 *   StageEvent — lazily and idempotently, exactly once. Viewing NEVER
 *   implies acceptance and never creates an Agreement row.
 * - Acceptance: an explicit, server-validated decision. The candidate must
 *   be at the agreement stage, the acknowledgement must be literally true
 *   (enforced by Zod) and the version echo must match the current config
 *   version. Acceptance transitions to OFFER_ACCEPTED, pins the accepted
 *   version in an Agreement row, and records a COMPLETED StageEvent — all
 *   in one transaction.
 * - Idempotency: a repeated accept (double submit, refresh, retry) returns
 *   the persisted decision — never a duplicate row or event.
 * - One-way progression: once accepted, the stage is closed. A direct URL
 *   or API call can no longer render or accept the workflow.
 *
 * Decline is deliberately NOT implemented — the decline policy is an
 * unresolved business decision (docs/CONTENT-QUESTIONS.md §16).
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

const ENTERED_DESCRIPTION = "Opened the Responsibility & Reward Agreement";

type AgreementRelation = {
  version: string;
  acceptedAt: Date | null;
};

type CandidateWithAgreement = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  status: CandidateStatusId;
  applications: { roleTitle: string }[];
  agreement: AgreementRelation | null;
};

const CANDIDATE_SELECT = {
  id: true,
  referenceNumber: true,
  fullName: true,
  email: true,
  status: true,
  applications: {
    orderBy: { submittedAt: "desc" as const },
    take: 1,
    select: { roleTitle: true },
  },
  agreement: {
    select: { version: true, acceptedAt: true },
  },
} as const;

async function loadCandidate(
  reference: string,
): Promise<CandidateWithAgreement> {
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

  return candidate as CandidateWithAgreement;
}

function toDecision(candidate: CandidateWithAgreement) {
  if (
    candidate.agreement?.acceptedAt == null ||
    candidate.status !== "OFFER_ACCEPTED"
  ) {
    return null;
  }
  return {
    kind: "ACCEPTED" as const,
    decidedAt: candidate.agreement.acceptedAt.toISOString(),
    version: candidate.agreement.version,
  };
}

function toView(candidate: CandidateWithAgreement): AgreementView {
  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    roleTitle: candidate.applications[0]?.roleTitle ?? OPEN_POSITION.title,
    status: candidate.status,
    eligible:
      candidate.status === "ASSESSMENT_PASSED" ||
      candidate.status === "OFFER_PENDING",
    decision: toDecision(candidate),
    agreement: {
      version: AGREEMENT_META.version,
      sections: AGREEMENT_SECTIONS,
    },
  };
}

/**
 * Read the agreement stage. Reading is the stage's entry action: the first
 * open moves ASSESSMENT_PASSED → OFFER_PENDING and records the ENTERED
 * event exactly once (race-safe via a conditional status update; a
 * concurrent reader re-reads the winner's state).
 */
export async function getAgreementView(
  reference: string,
): Promise<AgreementView> {
  let candidate = await loadCandidate(reference);

  if (candidate.status === "ASSESSMENT_PASSED") {
    const transitioned = await db.$transaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidate.id, status: "ASSESSMENT_PASSED" },
        data: { status: "OFFER_PENDING" },
      });
      if (result.count === 1) {
        await tx.stageEvent.create({
          data: {
            candidateId: candidate.id,
            stage: "OFFER" satisfies RecruitmentStageId,
            type: "ENTERED",
            description: ENTERED_DESCRIPTION,
          },
        });
      }
      return result.count === 1;
    });

    if (!transitioned) {
      // A concurrent request performed the entry — read its state.
      candidate = await loadCandidate(reference);
    } else {
      candidate = {
        ...candidate,
        status: "OFFER_PENDING",
      };
    }
  }

  return toView(candidate);
}

/**
 * Accept the Responsibility & Reward Agreement. The explicit, auditable
 * decision of stage 3. Eligibility, the version echo and the acknowledgement
 * are all verified here; the transition, the versioned Agreement row and
 * the COMPLETED StageEvent are written in one transaction. Repeated
 * requests return the persisted decision — never a duplicate.
 */
export async function acceptAgreement(
  reference: string,
  input: AgreementAcceptInput,
): Promise<AgreementView> {
  const candidate = await loadCandidate(reference);

  // Idempotent: an accepted agreement is final — return the record.
  if (candidate.status === "OFFER_ACCEPTED") {
    return toView(candidate);
  }

  // Eligibility (server-enforced; the UI gate is never enough).
  const eligibleStatuses: CandidateStatusId[] = [
    "ASSESSMENT_PASSED",
    "OFFER_PENDING",
  ];
  if (!eligibleStatuses.includes(candidate.status)) {
    throw conflictError(
      "Your agreement can no longer be accepted from your current recruitment stage. Continue your application to see where you are.",
    );
  }

  const wasEntered = candidate.status === "OFFER_PENDING";
  const now = new Date();

  // The AGREEMENT_ACCEPTED intent is queued in the SAME transaction as the
  // decision (outbox pattern — brief §13), and ONLY on the latch-winner
  // path — a concurrent loser never queues a duplicate (§11/§28). The
  // Mailjet send happens after the commit, fire-and-forget (§12/§16).
  let deliveryId: string | null = null;

  const transitioned = await db.$transaction(async (tx) => {
    const result = await tx.candidate.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["ASSESSMENT_PASSED", "OFFER_PENDING"] },
      },
      data: { status: "OFFER_ACCEPTED" },
    });

    if (result.count === 0) {
      // A concurrent decision won the race — fall through to the
      // idempotent re-read below; never write a second decision.
      return false;
    }

    // A direct API accept (stage never opened) still records the entry so
    // the timeline shows a complete, ordered trail.
    if (!wasEntered) {
      await tx.stageEvent.create({
        data: {
          candidateId: candidate.id,
          stage: "OFFER" satisfies RecruitmentStageId,
          type: "ENTERED",
          description: ENTERED_DESCRIPTION,
        },
      });
    }

    const agreementRow = await tx.agreement.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        version: input.version,
        acceptedAt: now,
      },
      update: { version: input.version, acceptedAt: now },
    });

    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "OFFER" satisfies RecruitmentStageId,
        type: "COMPLETED",
        description: `Accepted the Responsibility & Reward Agreement (version ${input.version})`,
      },
    });

    const enqueued = await enqueueNotification(tx, {
      type: "AGREEMENT_ACCEPTED",
      dedupeKey: buildDedupeKey("AGREEMENT_ACCEPTED", agreementRow.id),
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    });
    deliveryId = enqueued.deliveryId;

    return true;
  });

  if (transitioned && deliveryId) {
    dispatchNotification(deliveryId);
  }

  // Whether this request performed the transition or lost a benign race,
  // the authoritative view is read back from persisted state (idempotent).
  return getAgreementView(reference);
}

/**
 * Explicitly decline the Responsibility & Reward Offer.
 */
export async function declineAgreement(
  reference: string,
  input: { version: string },
): Promise<AgreementView> {
  const candidate = await loadCandidate(reference);

  if (candidate.status === "OFFER_DECLINED") {
    return getAgreementView(reference);
  }

  if (candidate.status !== "OFFER_PENDING" && candidate.status !== "ASSESSMENT_PASSED") {
    throw conflictError(
      "This application is not currently at the offer stage. Open your application to see your current status.",
    );
  }

  await db.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id: candidate.id },
      data: { status: "OFFER_DECLINED" },
    });

    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "OFFER" satisfies RecruitmentStageId,
        type: "FAILED",
        description: `Declined the Responsibility & Reward Policy (version ${input.version})`,
      },
    });
  });

  return getAgreementView(reference);
}
