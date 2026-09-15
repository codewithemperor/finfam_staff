import "server-only";

import {
  APPOINTMENT_META,
  APPOINTMENT_REFERENCE_MIN_DIGITS,
  APPOINTMENT_REFERENCE_PREFIX,
  APPOINTMENT_ROLE_TITLE,
  getAppointmentContent,
} from "@/config/appointment";
import { db } from "@/lib/db";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import { AppError, notFoundError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type {
  AppointmentView,
  CandidateStatusId,
  IssuedAppointmentView,
  RecruitmentStageId,
} from "@/types/recruitment";

/**
 * Provisional Appointment (stage 4) service.
 *
 * One issued letter per candidate, exactly once, decided entirely
 * server-side — pages and route handlers never touch Prisma and never
 * decide eligibility:
 *
 * - Lazy issuance (approved model): the first open by an OFFER_ACCEPTED
 *   candidate issues the letter. There is no separate accept step — the
 *   candidate already accepted the Responsibility & Reward Agreement
 *   (stage 3), and the appointment is a formal issued record, not another
 *   decision form. Issuance transitions OFFER_ACCEPTED → APPOINTMENT_ISSUED,
 *   writes the Appointment row and records exactly ONE APPOINTMENT/COMPLETED
 *   StageEvent — all in a single transaction.
 * - Idempotency: the transition is a conditional status update, so
 *   repeated or concurrent requests can only ever produce one Appointment
 *   row, one reference, one issuedAt, one version, one event. Losers of a
 *   race re-read the winner's state; they never write a second letter.
 * - Reference allocation: FFL/HR/PLA/NNN from a server-controlled
 *   singleton sequence, allocated with an atomic `UPDATE ... RETURNING`
 *   inside the issuance transaction. Never derived from client input and
 *   never from count(*); the unique constraint on the column is the final
 *   backstop. The sequence may skip numbers if a transaction rolls back
 *   after allocation — monotonicity and uniqueness are what matter.
 * - Read-only record: after issuance the letter is immutable. Viewing
 *   again (page, API, journey "View letter") re-renders the SAME snapshot
 *   and can never re-enter issuance.
 * - Historical integrity: the letter text is resolved from the content
 *   registry by the version pinned on the row. A missing registry version
 *   is an integrity failure that fails loudly — never a silent fallback to
 *   the current pointer.
 * - Date semantics: one server-issued timestamp (`issuedAt`) doubles as
 *   the printed letter date for the MVP; there is deliberately no
 *   separate effectiveDate (docs/CONTENT-QUESTIONS.md §23).
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

/** Singleton row that backs FFL/HR/PLA/NNN allocation (seeded by migration). */
const SEQUENCE_NAME = "PROVISIONAL_APPOINTMENT";

const ISSUED_EVENT_DESCRIPTION_PREFIX = "Provisional appointment";

type AppointmentRelation = {
  appointmentReference: string;
  version: string;
  printedName: string;
  roleTitle: string;
  issuedAt: Date;
};

type CandidateWithAppointment = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  status: CandidateStatusId;
  appointment: AppointmentRelation | null;
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
      version: true,
      printedName: true,
      roleTitle: true,
      issuedAt: true,
    },
  },
} as const;

async function loadCandidate(
  reference: string,
): Promise<CandidateWithAppointment> {
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

  return candidate as CandidateWithAppointment;
}

/**
 * Render the letter for a persisted appointment. Resolves content by the
 * PINNED version — an issued letter must always reproduce the version it
 * was issued under, so a missing registry entry fails loudly instead of
 * silently rendering the current wording.
 */
function toIssuedAppointment(
  appointment: AppointmentRelation,
): IssuedAppointmentView {
  const content = getAppointmentContent(appointment.version);

  if (!content) {
    throw new AppError(
      "INTERNAL",
      "Your appointment record could not be displayed. Please contact support.",
      { status: 500 },
    );
  }

  return {
    appointmentReference: appointment.appointmentReference,
    version: appointment.version,
    printedName: appointment.printedName,
    roleTitle: appointment.roleTitle,
    issuedAt: appointment.issuedAt.toISOString(),
    content,
  };
}

function toView(candidate: CandidateWithAppointment): AppointmentView {
  const appointment = candidate.appointment
    ? toIssuedAppointment(candidate.appointment)
    : null;

  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    status: candidate.status,
    issued: appointment !== null,
    appointment,
  };
}

/**
 * Atomically allocate the next FFL/HR/PLA/NNN number. The singleton row's
 * row-level lock serialises concurrent allocations; `value` stores the
 * last allocated number (seeded at 12 — the supplied sample letter's
 * FFL/HR/PLA/012 — so the first system-issued reference is 013).
 * Must run inside the issuance transaction.
 */
async function allocateAppointmentReference(tx: {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}): Promise<string> {
  const rows = (await tx.$queryRaw`
    UPDATE "appointment_sequences"
    SET "value" = "value" + 1
    WHERE "name" = ${SEQUENCE_NAME}
    RETURNING "value"
  `) as { value: number }[];

  if (rows.length !== 1 || typeof rows[0].value !== "number") {
    throw new AppError(
      "INTERNAL",
      "The appointment reference sequence is unavailable. Please try again.",
      { status: 500 },
    );
  }

  const numeric = String(rows[0].value).padStart(
    APPOINTMENT_REFERENCE_MIN_DIGITS,
    "0",
  );
  return `${APPOINTMENT_REFERENCE_PREFIX}${numeric}`;
}

/**
 * Issue the provisional appointment for an eligible (OFFER_ACCEPTED)
 * candidate. Exactly-once by construction: the conditional status update
 * is the gate — only the transaction that moves the status writes the
 * letter, the event, and allocates the reference. Returns true when THIS
 * call performed the issuance, false when a concurrent request already
 * won (the caller re-reads persisted state either way).
 *
 * Lock order (candidate row → sequence row → inserts) is identical in
 * every transaction, so concurrent issuances cannot deadlock.
 */
async function issueAppointment(
  candidate: CandidateWithAppointment,
): Promise<{ issued: boolean; deliveryId: string | null }> {
  const issuedAt = new Date();

  // The APPOINTMENT_ISSUED intent is queued in the SAME transaction as the
  // issuance (outbox pattern — brief §13), and ONLY on the gate-winner path
  // — a concurrent loser never queues a duplicate (§11/§28). The Mailjet
  // send happens after the commit, fire-and-forget (§12/§16).
  let deliveryId: string | null = null;

  const issued = await db.$transaction(async (tx) => {
    // The gate: exactly one transaction can move the candidate out of
    // OFFER_ACCEPTED. Everyone else must not write anything at all.
    const transitioned = await tx.candidate.updateMany({
      where: { id: candidate.id, status: "OFFER_ACCEPTED" },
      data: { status: "APPOINTMENT_ISSUED" },
    });

    if (transitioned.count === 0) {
      return false;
    }

    const appointmentReference = await allocateAppointmentReference(tx);

    // Candidate-specific snapshot — taken from persisted server data,
    // never from client input. Immutable after this insert.
    const appointmentRow = await tx.appointment.create({
      data: {
        candidateId: candidate.id,
        appointmentReference,
        version: APPOINTMENT_META.version,
        printedName: candidate.fullName,
        roleTitle: APPOINTMENT_ROLE_TITLE,
        issuedAt,
      },
      select: { id: true },
    });

    // Exactly ONE timeline event for the whole stage — issuance itself is
    // the meaningful event; no separate ENTERED exists for this stage.
    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "APPOINTMENT" satisfies RecruitmentStageId,
        type: "COMPLETED",
        description: `${ISSUED_EVENT_DESCRIPTION_PREFIX} ${appointmentReference} issued.`,
      },
    });

    const enqueued = await enqueueNotification(tx, {
      type: "APPOINTMENT_ISSUED",
      dedupeKey: buildDedupeKey("APPOINTMENT_ISSUED", appointmentRow.id),
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    });
    deliveryId = enqueued.deliveryId;

    return true;
  });

  return { issued, deliveryId };
}

/**
 * Read the appointment stage. This is the stage's entry action: the first
 * open by an OFFER_ACCEPTED candidate issues the letter (lazily,
 * idempotently, exactly once); every later read returns the same issued
 * record unchanged. Ineligible candidates get an honest issued:false view
 * — reading never creates anything and never reveals stage-gated content.
 */
export async function getAppointmentView(
  reference: string,
): Promise<AppointmentView> {
  // Bounded loop: re-read once or twice after losing a benign race; the
  // loop always terminates because issuance is one-way.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await loadCandidate(reference);

    if (candidate.appointment) {
      // Read-only record — never regenerated, never mutated.
      return toView(candidate);
    }

    if (candidate.status !== "OFFER_ACCEPTED") {
      // Not at the appointment stage (agreement not accepted, declined,
      // or an earlier stage): nothing to issue, nothing to show.
      return toView(candidate);
    }

    const { issued, deliveryId } = await issueAppointment(candidate);
    if (issued) {
      // Post-commit: attempt the actual send without blocking the response.
      if (deliveryId) {
        dispatchNotification(deliveryId);
      }
      // Read back the persisted truth (idempotent canonical view).
      return toView(await loadCandidate(reference));
    }
    // A concurrent request won the transition — loop once and render
    // ITS issued record instead of writing a second one.
  }

  // Unreachable in practice (issuance is one-way and idempotent).
  return toView(await loadCandidate(reference));
}
