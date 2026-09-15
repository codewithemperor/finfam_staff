import "server-only";

import type { NotificationType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { OPEN_POSITION } from "@/config/content";
import { ASSESSMENT_POLICY } from "@/server/assessment-content";

import {
  type NotificationPayloadMap,
  type NotificationTypeId,
  type NotificationRuntimeConfig,
  entityIdFromDedupeKey,
  getNotificationConfig,
  isDeliveryActive,
} from "./notification-types";
import {
  NOTIFICATION_TEMPLATE_VERSION,
  renderNotificationEmail,
} from "./notification-templates";
import { sendViaMailjet } from "./providers/mailjet";

/**
 * Central transactional notification service (brief §6, §11–§16).
 *
 * Architecture: domain services know about notification EVENTS, never about
 * Mailjet payloads. They call `enqueueNotification` INSIDE their business
 * transaction (so a committed event always has a queued intent) and
 * `dispatchNotification` AFTER the transaction commits (so Mailjet is never
 * called while database locks are held, and an email outage can never roll
 * back or fail a business action).
 *
 * Exactly-once: the unique `dedupeKey` makes queueing idempotent; an
 * optimistic claim (`attemptCount` compare-and-increment) makes sending
 * exactly-once under concurrent dispatches; the bounded attempt budget
 * stops infinite retries (§15).
 */

export const NOTIFICATION_PROVIDER = "mailjet";

export interface EnqueueNotificationInput {
  type: NotificationType;
  dedupeKey: string;
  /** Owning candidate, where applicable (cascade-deleted with them). */
  candidateId?: string | null;
  /** Recipient email snapshotted at enqueue time. */
  recipientEmail: string;
}

export interface EnqueuedNotification {
  /** Row id — pass to dispatchNotification after the business commit. */
  deliveryId: string | null;
  dedupeKey: string;
  /** True when a row with this dedupeKey already existed (idempotent skip). */
  alreadyQueued: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Queue one notification intent. Accepts either a `db` client or a
 * transaction client — pass the `tx` from the surrounding business
 * transaction so the intent commits atomically WITH the state change (§13).
 *
 * Idempotent by construction: a duplicate dedupeKey (double-click, retry,
 * concurrent request) resolves to the existing row and never throws (§11).
 */
export async function enqueueNotification(
  client: Prisma.TransactionClient,
  input: EnqueueNotificationInput,
): Promise<EnqueuedNotification> {
  try {
    const row = await client.notificationDelivery.create({
      data: {
        type: input.type,
        dedupeKey: input.dedupeKey,
        candidateId: input.candidateId ?? null,
        recipientEmail: input.recipientEmail,
        templateVersion: NOTIFICATION_TEMPLATE_VERSION,
        provider: NOTIFICATION_PROVIDER,
      },
      select: { id: true },
    });
    return { deliveryId: row.id, dedupeKey: input.dedupeKey, alreadyQueued: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await client.notificationDelivery.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      return {
        deliveryId: existing?.id ?? null,
        dedupeKey: input.dedupeKey,
        alreadyQueued: true,
      };
    }
    throw error;
  }
}

/**
 * Fire-and-forget post-commit delivery. Call this AFTER the business
 * transaction has committed with the deliveryId captured inside the
 * transaction. It never throws and never blocks the business response —
 * an email failure must not surface as a recruitment failure (§12/§14).
 */
export function dispatchNotification(deliveryId: string): void {
  void sendNotification(deliveryId).catch((error: unknown) => {
    console.error("[notifications] dispatch crashed", {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export type DeliveryOutcome = "SENT" | "FAILED" | "SKIPPED" | "SUPPRESSED";

/**
 * Attempt delivery of ONE queued notification. Safe to call repeatedly:
 * SENT rows are skipped, attempt budget is bounded, concurrent callers
 * serialise on an optimistic claim (one send per attempt slot).
 *
 * Named `sendNotification` (first delivery) and `retryNotification`
 * (re-drive) in the brief; both share this guarded implementation.
 */
export async function sendNotification(
  deliveryId: string,
): Promise<DeliveryOutcome> {
  const config = getNotificationConfig();

  // No network request may ever leave while notifications are disabled or
  // the provider is not configured (§26). The row simply stays queued.
  if (!isDeliveryActive(config)) {
    console.log("[notifications] suppressed (disabled or provider not configured)", {
      deliveryId,
    });
    return "SUPPRESSED";
  }

  const row = await db.notificationDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!row || row.status === "SENT") {
    return "SKIPPED";
  }
  if (row.attemptCount >= config.maxAttempts) {
    console.log("[notifications] attempt budget exhausted", {
      deliveryId,
      type: row.type,
      attemptCount: row.attemptCount,
    });
    return "SKIPPED";
  }

  // Optimistic claim: exactly one concurrent dispatcher wins this attempt
  // slot — a duplicate email can never be produced by parallel calls.
  const claimed = await db.notificationDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { not: "SENT" },
      attemptCount: row.attemptCount,
    },
    data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
  });
  if (claimed.count === 0) {
    return "SKIPPED";
  }
  const attemptNumber = row.attemptCount + 1;

  try {
    const payload = await deriveNotificationPayload(row.type, row.dedupeKey);
    if (!payload) {
      await markFailed(
        deliveryId,
        "PAYLOAD_UNAVAILABLE",
        "The notification content could not be derived from the application record.",
      );
      console.log("[notifications] payload unavailable", {
        deliveryId,
        type: row.type,
        attempt: attemptNumber,
      });
      return "FAILED";
    }

    const email = renderNotificationEmail(row.type, payload, config.baseUrl);
    const result = await sendViaMailjet(
      {
        to: row.recipientEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        customId: row.dedupeKey,
      },
      { timeoutMs: config.sendTimeoutMs },
    );

    if (result.ok) {
      await db.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.messageId,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      console.log("[notifications] sent", {
        deliveryId,
        type: row.type,
        attempt: attemptNumber,
        messageId: result.messageId,
      });
      return "SENT";
    }

    await markFailed(deliveryId, result.errorCode, result.errorMessage);
    console.log("[notifications] provider failure", {
      deliveryId,
      type: row.type,
      attempt: attemptNumber,
      errorCode: result.errorCode,
    });
    return "FAILED";
  } catch (error) {
    // Unexpected render/derive crash — record it safely and swallow: the
    // business state is already committed and must never be disturbed (§14).
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(deliveryId, "UNEXPECTED_ERROR", message);
    console.error("[notifications] unexpected delivery error", {
      deliveryId,
      type: row.type,
      attempt: attemptNumber,
      error: message,
    });
    return "FAILED";
  }
}

/** Brief §15 naming — re-drive one notification through the guarded path. */
export async function retryNotification(
  deliveryId: string,
): Promise<DeliveryOutcome> {
  return sendNotification(deliveryId);
}

export interface RetryBatchResult {
  considered: number;
  sent: number;
  failed: number;
  suppressed: number;
  skipped: number;
}

/**
 * Re-drive queued/failed notifications within the bounded attempt budget.
 * Intended for a PROTECTED future scheduler/worker — this project ships no
 * cron and no unauthenticated trigger; whatever deployment infrastructure
 * exists later can call this service (§15).
 */
export async function retryPendingNotifications(
  options: { limit?: number } = {},
): Promise<RetryBatchResult> {
  const config: NotificationRuntimeConfig = getNotificationConfig();
  const empty: RetryBatchResult = {
    considered: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    skipped: 0,
  };
  if (!isDeliveryActive(config)) {
    console.log("[notifications] batch retry suppressed (delivery disabled)");
    return empty;
  }

  const rows = await db.notificationDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attemptCount: { lt: config.maxAttempts },
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 20,
    select: { id: true },
  });

  const result: RetryBatchResult = { ...empty, considered: rows.length };
  for (const row of rows) {
    const outcome = await sendNotification(row.id);
    if (outcome === "SENT") result.sent += 1;
    else if (outcome === "FAILED") result.failed += 1;
    else if (outcome === "SUPPRESSED") result.suppressed += 1;
    else result.skipped += 1;
  }
  return result;
}

async function markFailed(
  deliveryId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  // Never clobber a SENT row (a concurrent attempt may have succeeded).
  await db.notificationDelivery.updateMany({
    where: { id: deliveryId, status: { not: "SENT" } },
    data: {
      status: "FAILED",
      lastErrorCode: errorCode.slice(0, 64),
      lastErrorMessage: errorMessage.slice(0, 200),
    },
  });
}

/** Shared candidate identity select for payload derivation. */
const PAYLOAD_CANDIDATE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  referenceNumber: true,
} as const;

type PayloadCandidate = {
  id: string;
  fullName: string;
  email: string;
  referenceNumber: string;
};

/**
 * Re-derive the typed payload for a queued row from immutable snapshot
 * rows (staff/appointment/agreement/attempt rows are immutable by schema
 * design), so retries render faithful content without storing bodies or
 * payloads (§9). Returns null when the source record is gone or — for the
 * RESERVED Stage 7 type — when no provisioning model exists yet.
 */
async function deriveNotificationPayload(
  type: NotificationType,
  dedupeKey: string,
): Promise<NotificationPayloadMap[NotificationTypeId] | null> {
  const entityId = entityIdFromDedupeKey(type, dedupeKey);

  switch (type) {
    case "APPLICATION_RECEIVED":
    case "ORIENTATION_COMPLETED": {
      const candidate = await db.candidate.findUnique({
        where: { id: entityId },
        select: {
          ...PAYLOAD_CANDIDATE_SELECT,
          applications: {
            orderBy: { submittedAt: "desc" as const },
            take: 1,
            select: { roleTitle: true },
          },
        },
      });
      if (!candidate) return null;
      return {
        candidateId: candidate.id,
        candidateName: candidate.fullName,
        recipientEmail: candidate.email,
        referenceNumber: candidate.referenceNumber,
        roleTitle: candidate.applications[0]?.roleTitle ?? OPEN_POSITION.title,
      };
    }

    case "ASSESSMENT_PASSED":
    case "ASSESSMENT_FAILED": {
      const attempt = await db.assessmentAttempt.findUnique({
        where: { id: entityId },
        select: {
          attemptNumber: true,
          percentage: true,
          passed: true,
          candidate: { select: PAYLOAD_CANDIDATE_SELECT },
        },
      });
      if (!attempt) return null;
      return {
        candidateId: attempt.candidate.id,
        candidateName: attempt.candidate.fullName,
        recipientEmail: attempt.candidate.email,
        referenceNumber: attempt.candidate.referenceNumber,
        attemptNumber: attempt.attemptNumber,
        percentage: attempt.percentage ?? 0,
        passed: attempt.passed ?? type === "ASSESSMENT_PASSED",
        retakeAllowed: ASSESSMENT_POLICY.allowRetakeAfterFailure,
      };
    }

    case "AGREEMENT_ACCEPTED": {
      const agreement = await db.agreement.findUnique({
        where: { id: entityId },
        select: {
          version: true,
          candidate: { select: PAYLOAD_CANDIDATE_SELECT },
        },
      });
      if (!agreement) return null;
      return {
        candidateId: agreement.candidate.id,
        candidateName: agreement.candidate.fullName,
        recipientEmail: agreement.candidate.email,
        referenceNumber: agreement.candidate.referenceNumber,
        agreementVersion: agreement.version,
      };
    }

    case "APPOINTMENT_ISSUED": {
      const appointment = await db.appointment.findUnique({
        where: { id: entityId },
        select: {
          appointmentReference: true,
          roleTitle: true,
          issuedAt: true,
          candidate: { select: PAYLOAD_CANDIDATE_SELECT },
        },
      });
      if (!appointment) return null;
      return {
        candidateId: appointment.candidate.id,
        candidateName: appointment.candidate.fullName,
        recipientEmail: appointment.candidate.email,
        referenceNumber: appointment.candidate.referenceNumber,
        appointmentReference: appointment.appointmentReference,
        designation: appointment.roleTitle,
        issuedAt: appointment.issuedAt.toISOString(),
      };
    }

    case "STAFF_ACTIVATED": {
      const staff = await db.staff.findUnique({
        where: { id: entityId },
        select: {
          staffId: true,
          roleTitle: true,
          activatedAt: true,
          candidate: { select: PAYLOAD_CANDIDATE_SELECT },
        },
      });
      if (!staff) return null;
      return {
        candidateId: staff.candidate.id,
        candidateName: staff.candidate.fullName,
        recipientEmail: staff.candidate.email,
        referenceNumber: staff.candidate.referenceNumber,
        staffId: staff.staffId,
        designation: staff.roleTitle,
        activatedAt: staff.activatedAt.toISOString(),
      };
    }

    case "ONBOARDING_STARTED":
    case "ONBOARDING_COMPLETED": {
      const onboarding = await db.staffOnboarding.findUnique({
        where: { id: entityId },
        select: {
          staff: {
            select: {
              staffId: true,
              roleTitle: true,
              candidate: { select: PAYLOAD_CANDIDATE_SELECT },
            },
          },
        },
      });
      if (!onboarding) return null;
      const staff: {
        staffId: string;
        roleTitle: string;
        candidate: PayloadCandidate;
      } = onboarding.staff;
      return {
        candidateId: staff.candidate.id,
        candidateName: staff.candidate.fullName,
        recipientEmail: staff.candidate.email,
        referenceNumber: staff.candidate.referenceNumber,
        staffId: staff.staffId,
        designation: staff.roleTitle,
      };
    }

    case "STAFF_ACCOUNT_CREATED":
      // RESERVED for Stage 7: there is no StaffAccount model yet, so no
      // payload can be derived. Nothing enqueues this type during the
      // recruitment/onboarding MVP (brief §2/§25).
      return null;
  }
}
