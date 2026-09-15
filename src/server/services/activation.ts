import "server-only";

import {
  ACTIVATION_ACKNOWLEDGEMENT_LABEL,
  ACTIVATION_INTRO,
  ACTIVATION_META,
  ACTIVATION_SECTIONS,
  STAFF_ID_MIN_DIGITS,
  STAFF_ID_PREFIX,
  STAFF_ID_SEQUENCE_NAME,
} from "@/config/activation";
import { db } from "@/lib/db";
import { provisionStaffAccount } from "@/server/services/staff-accounts";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import { AppError, conflictError, notFoundError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { ActivationInput } from "@/lib/validation/activation";
import type {
  ActivationView,
  CandidateStatusId,
  RecruitmentStageId,
} from "@/types/recruitment";

/**
 * Staff Activation (stage 5) service.
 *
 * The approved activation rule (Option E): the provisionally appointed
 * candidate becomes an active FinFam staff member by an EXPLICIT in-portal
 * action — no manual administrator approval. Every rule lives here; pages
 * and route handlers never touch Prisma and never decide eligibility:
 *
 * - Entry: opening the activation stage (page or GET API) moves the
 *   candidate from APPOINTMENT_ISSUED to ACTIVATION_PENDING and records an
 *   ENTERED StageEvent — lazily and idempotently, exactly once (mirrors the
 *   agreement stage). Opening NEVER activates anything and never creates a
 *   Staff row.
 * - Activation: an explicit, server-validated action. The candidate must be
 *   at the activation stage, the acknowledgement must be literally true and
 *   the version echo must match the current config version. Activation
 *   transitions to APPROVED_STAFF, creates the one Staff row (the permanent
 *   activation record), allocates the Staff ID, and records exactly ONE
 *   COMPLETED StageEvent — all in one transaction. A direct API activation
 *   from APPOINTMENT_ISSUED is valid and records the ENTERED event first so
 *   the timeline stays complete and ordered.
 * - Staff ID allocation: FF-STF-NNNN from a server-controlled singleton
 *   sequence, allocated with an atomic `UPDATE ... RETURNING` inside the
 *   activation transaction. Never derived from client input, never from
 *   count(*); the unique constraint on the column is the final backstop.
 *   The sequence may skip numbers if a transaction rolls back after
 *   allocation — monotonicity and uniqueness are what matter. Once
 *   assigned, a Staff ID is immutable forever.
 * - Idempotency: repeated or concurrent activation can only ever produce
 *   one Staff row, one Staff ID, one activatedAt, one version, one status
 *   transition, one event. Losers of a race re-read the winner's state.
 * - Snapshots: the designation and appointment reference are snapshotted
 *   FROM the issued Appointment row at activation — the appointment is the
 *   authoritative source for the designation under which the person was
 *   activated. No personal data is duplicated onto the Staff row.
 * - One-way: activation is permanent in the MVP. There is no deactivate,
 *   revoke or reassign workflow (docs/CONTENT-QUESTIONS.md §32).
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

const ENTERED_DESCRIPTION = "Opened staff activation.";

/** Singleton row that backs FF-STF-NNNN allocation (seeded by migration). */
const SEQUENCE_NAME = STAFF_ID_SEQUENCE_NAME;

/** Statuses from which the explicit activation action is accepted. */
const ELIGIBLE_STATUSES: CandidateStatusId[] = [
  "APPOINTMENT_ISSUED",
  "ACTIVATION_PENDING",
];

type AppointmentRelation = {
  appointmentReference: string;
  roleTitle: string;
  issuedAt: Date;
};

type StaffRelation = {
  id: string;
  staffId: string;
  version: string;
  roleTitle: string;
  appointmentReference: string;
  activatedAt: Date;
  account: { id: string } | null;
};

type CandidateWithActivation = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  status: CandidateStatusId;
  appointment: AppointmentRelation | null;
  staff: StaffRelation | null;
};

const CANDIDATE_SELECT = {
  id: true,
  referenceNumber: true,
  fullName: true,
  email: true,
  status: true,
  appointment: {
    select: {
      appointmentReference: true,
      roleTitle: true,
      issuedAt: true,
    },
  },
  staff: {
    select: {
      id: true,
      staffId: true,
      version: true,
      roleTitle: true,
      appointmentReference: true,
      activatedAt: true,
      account: { select: { id: true } },
    },
  },
} as const;

async function loadCandidate(
  reference: string,
): Promise<CandidateWithActivation> {
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

  return candidate as CandidateWithActivation;
}

function toView(candidate: CandidateWithActivation): ActivationView {
  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    status: candidate.status,
    eligible: ELIGIBLE_STATUSES.includes(candidate.status),
    appointment: candidate.appointment
      ? {
          appointmentReference: candidate.appointment.appointmentReference,
          roleTitle: candidate.appointment.roleTitle,
          issuedAt: candidate.appointment.issuedAt.toISOString(),
        }
      : null,
    staff: candidate.staff
      ? {
          staffId: candidate.staff.staffId,
          version: candidate.staff.version,
          roleTitle: candidate.staff.roleTitle,
          appointmentReference: candidate.staff.appointmentReference,
          activatedAt: candidate.staff.activatedAt.toISOString(),
        }
      : null,
    content: {
      version: ACTIVATION_META.version,
      intro: ACTIVATION_INTRO,
      acknowledgementLabel: ACTIVATION_ACKNOWLEDGEMENT_LABEL,
      sections: ACTIVATION_SECTIONS,
    },
  };
}

/**
 * Atomically allocate the next FF-STF-NNNN Staff ID. The singleton row's
 * row-level lock serialises concurrent allocations; `value` stores the last
 * allocated number (seeded at 0, so the first system-issued Staff ID is
 * FF-STF-0001). Must run inside the activation transaction.
 */
async function allocateStaffId(tx: {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}): Promise<string> {
  const rows = (await tx.$queryRaw`
    UPDATE "staff_id_sequences"
    SET "value" = "value" + 1
    WHERE "name" = ${SEQUENCE_NAME}
    RETURNING "value"
  `) as { value: number }[];

  if (rows.length !== 1 || typeof rows[0].value !== "number") {
    throw new AppError(
      "INTERNAL",
      "The staff ID sequence is unavailable. Please try again.",
      { status: 500 },
    );
  }

  const numeric = String(rows[0].value).padStart(STAFF_ID_MIN_DIGITS, "0");
  return `${STAFF_ID_PREFIX}${numeric}`;
}

/**
 * Read the activation stage. Opening is the stage's entry action: the first
 * open by an APPOINTMENT_ISSUED candidate moves them to ACTIVATION_PENDING
 * and records the ENTERED event exactly once (race-safe via a conditional
 * status update; a concurrent reader re-reads the winner's state). Opening
 * never activates anything and never creates a Staff row.
 */
export async function getActivationView(
  reference: string,
): Promise<ActivationView> {
  let candidate = await loadCandidate(reference);

  if (candidate.status === "APPOINTMENT_ISSUED") {
    const transitioned = await db.$transaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidate.id, status: "APPOINTMENT_ISSUED" },
        data: { status: "ACTIVATION_PENDING" },
      });
      if (result.count === 1) {
        await tx.stageEvent.create({
          data: {
            candidateId: candidate.id,
            stage: "ACTIVATION" satisfies RecruitmentStageId,
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
        status: "ACTIVATION_PENDING",
      };
    }
  }

  return toView(candidate);
}

/**
 * Activate the staff profile — the explicit, auditable end of the
 * recruitment journey. Eligibility, the version echo and the literal
 * acknowledgement are all verified before the transaction; the status
 * transition, Staff ID allocation, Staff row and COMPLETED StageEvent are
 * written in ONE transaction (no partial activation is possible). Repeated
 * or concurrent requests return the persisted record — never a duplicate
 * row, a second Staff ID or a second event.
 */
export async function activateStaff(
  reference: string,
  input: ActivationInput,
): Promise<ActivationView> {
  const candidate = await loadCandidate(reference);

  // Idempotent: an activated staff profile is final — return the record.
  // Self-healing guard (Stage 7): a Staff row that predates Staff Account
  // provisioning still gets its portal account here, through the SAME
  // provisionStaffAccount core the activation path uses — exactly-once by
  // unique FK + dedupeKey, so revisits stay no-ops.
  if (candidate.status === "APPROVED_STAFF" && candidate.staff) {
    if (!candidate.staff.account) {
      const healed = await provisionStaffAccount(db, {
        staffId: candidate.staff.id,
        candidateId: candidate.id,
        recipientEmail: candidate.email,
      });
      if (healed.deliveryId) {
        dispatchNotification(healed.deliveryId);
      }
    }
    return toView(candidate);
  }

  // Eligibility (server-enforced; the UI gate is never enough).
  if (!ELIGIBLE_STATUSES.includes(candidate.status)) {
    throw conflictError(
      "Your staff profile cannot be activated from your current recruitment stage. Continue your application to see where you are.",
    );
  }

  // Defensive integrity check: the designation and appointment reference
  // snapshots come from the issued Appointment row. An APPOINTMENT_ISSUED
  // candidate without an appointment row is impossible by construction —
  // refuse loudly rather than guess.
  const appointment = candidate.appointment;

  if (!appointment) {
    throw new AppError(
      "INTERNAL",
      "Your staff profile could not be activated. Please contact support.",
      { status: 500 },
    );
  }

  const wasEntered = candidate.status === "ACTIVATION_PENDING";
  const activatedAt = new Date();

  // The STAFF_ACTIVATED and STAFF_ACCOUNT_CREATED intents are queued in the
  // SAME transaction as the activation (outbox pattern — brief §13), and
  // ONLY on the latch-winner path — a concurrent loser never queues a
  // duplicate (§11/§28). The Mailjet sends happen after the commit,
  // fire-and-forget (§12/§16); a Mailjet outage can never roll back the
  // activation, the Staff row or the StaffAccount row.
  let deliveryId: string | null = null;
  let accountDeliveryId: string | null = null;

  const activated = await db.$transaction(async (tx) => {
    // The gate: exactly one transaction can move the candidate to
    // APPROVED_STAFF. Everyone else must not write anything at all.
    const result = await tx.candidate.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["APPOINTMENT_ISSUED", "ACTIVATION_PENDING"] },
      },
      data: { status: "APPROVED_STAFF" },
    });

    if (result.count === 0) {
      // A concurrent activation won the race — fall through to the
      // idempotent re-read below; never write a second staff record.
      return false;
    }

    // A direct API activation (stage never opened) still records the entry
    // so the timeline shows a complete, ordered trail.
    if (!wasEntered) {
      await tx.stageEvent.create({
        data: {
          candidateId: candidate.id,
          stage: "ACTIVATION" satisfies RecruitmentStageId,
          type: "ENTERED",
          description: ENTERED_DESCRIPTION,
        },
      });
    }

    const staffId = await allocateStaffId(tx);

    // Candidate-specific snapshots — taken from persisted server data (the
    // issued Appointment row), never from client input. Immutable after
    // this insert.
    const staffRow = await tx.staff.create({
      data: {
        candidateId: candidate.id,
        staffId,
        version: ACTIVATION_META.version,
        roleTitle: appointment.roleTitle,
        appointmentReference: appointment.appointmentReference,
        activatedAt,
      },
      select: { id: true },
    });

    // Stage 7: the Staff Portal account is provisioned in the SAME winning
    // transaction — Staff row + account + StageEvent + both notification
    // intents commit atomically (approved architecture §2). The shared core
    // is the exact code path the backfill uses.
    const provisioned = await provisionStaffAccount(tx, {
      staffId: staffRow.id,
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    });
    accountDeliveryId = provisioned.deliveryId;

    // Exactly ONE completion event for the whole stage.
    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "ACTIVATION" satisfies RecruitmentStageId,
        type: "COMPLETED",
        description: `Staff profile activated. Staff ID ${staffId} assigned.`,
      },
    });

    const enqueued = await enqueueNotification(tx, {
      type: "STAFF_ACTIVATED",
      dedupeKey: buildDedupeKey("STAFF_ACTIVATED", staffRow.id),
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    });
    deliveryId = enqueued.deliveryId;

    return true;
  });

  if (activated && deliveryId) {
    dispatchNotification(deliveryId);
  }
  if (activated && accountDeliveryId) {
    dispatchNotification(accountDeliveryId);
  }

  // Whether this request performed the transition or lost a benign race,
  // the authoritative view is read back from persisted state (idempotent).
  return toView(await loadCandidate(reference));
}
