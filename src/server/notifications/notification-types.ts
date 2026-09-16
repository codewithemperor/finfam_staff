import "server-only";

import type { NotificationType } from "@prisma/client";

/**
 * Stable lifecycle notification keys — brief §7.
 *
 * The Prisma enum `NotificationType` is the single source of truth (schema
 * mirrors it 1:1); this file adds the typed payload contract, the dedupe-key
 * convention and the runtime configuration used by the delivery service.
 *
 * STAFF_ACCOUNT_CREATED was reserved for Stage 7 and is now enqueued by
 * Staff Account provisioning (activation transaction + backfill) — exactly
 * once per StaffAccount row via its dedupeKey. STAFF_LOGIN_CODE (Stage 7)
 * is ONE-SHOT: the plaintext OTP never touches the database (see below).
 *
 * Deliberately absent: keys for page views, orientation sections, onboarding
 * steps or any other small step — those would be notification spam (§7/§8).
 *
 * Stage 8 adds DAILY_REPORT_SUBMITTED — a concise receipt per SUBMITTED
 * report (dedupeKey per report id). There is deliberately NO
 * DAILY_REPORT_REMINDER: no deadline/overdue policy has been confirmed and
 * a recurring reminder without one would be spam.
 */
export type { NotificationType };

/**
 * Identity facts every lifecycle email carries. Only safe fields (§30):
 * name, references, designations, dates and server-derived results — never
 * NIN/BVN/bank details/answers/credentials.
 */
export interface NotificationRecipient {
  candidateId: string;
  candidateName: string;
  referenceNumber: string;
  recipientEmail: string;
}

export interface ApplicationReceivedPayload extends NotificationRecipient {
  roleTitle: string;
}

export interface OrientationCompletedPayload extends NotificationRecipient {
  roleTitle: string;
}

export interface AssessmentResultPayload extends NotificationRecipient {
  attemptNumber: number;
  /** Final percentage (0–100), server-computed at submission. */
  percentage: number;
  /** Mirrors the notification type; kept explicit for template rendering. */
  passed: boolean;
  /** Current business policy — the email may only promise a retake when this is true (§8). */
  retakeAllowed: boolean;
}

export interface AgreementAcceptedPayload extends NotificationRecipient {
  /** Pinned agreement content version the candidate accepted. */
  agreementVersion: string;
}

export interface AppointmentIssuedPayload extends NotificationRecipient {
  appointmentReference: string;
  designation: string;
  /** ISO timestamp of the server issuance. */
  issuedAt: string;
}

export interface StaffActivatedPayload extends NotificationRecipient {
  staffId: string;
  designation: string;
  /** ISO timestamp of the activation. */
  activatedAt: string;
}

export interface OnboardingStartedPayload extends NotificationRecipient {
  staffId: string;
  designation: string;
}

export interface OnboardingCompletedPayload extends NotificationRecipient {
  staffId: string;
  designation: string;
}

export interface StaffAccountCreatedPayload extends NotificationRecipient {
  staffId: string;
}

export interface StaffLoginCodePayload extends NotificationRecipient {
  staffId: string;
  /** The 6-digit login code. ONE-SHOT: never persisted, never logged (§10). */
  loginCode: string;
  /** ISO timestamp after which the code is dead. */
  expiresAt: string;
}

export interface DailyReportSubmittedPayload extends NotificationRecipient {
  staffId: string;
  /** "YYYY-MM-DD" Africa/Lagos calendar date the reported work occurred. */
  reportDate: string;
  /** ISO instant the report was finalised (the submission latch). */
  submittedAt: string;
}

/**
 * Payload contract per notification key. Templates render strictly from
 * these payloads — they never read the database themselves.
 */
export type NotificationPayloadMap = {
  APPLICATION_RECEIVED: ApplicationReceivedPayload;
  ORIENTATION_COMPLETED: OrientationCompletedPayload;
  ASSESSMENT_PASSED: AssessmentResultPayload;
  ASSESSMENT_FAILED: AssessmentResultPayload;
  AGREEMENT_ACCEPTED: AgreementAcceptedPayload;
  APPOINTMENT_ISSUED: AppointmentIssuedPayload;
  STAFF_ACTIVATED: StaffActivatedPayload;
  ONBOARDING_STARTED: OnboardingStartedPayload;
  ONBOARDING_COMPLETED: OnboardingCompletedPayload;
  STAFF_ACCOUNT_CREATED: StaffAccountCreatedPayload;
  STAFF_LOGIN_CODE: StaffLoginCodePayload;
  DAILY_REPORT_SUBMITTED: DailyReportSubmittedPayload;
};

/**
 * One-shot notification types (Stage 7, brief §10): their payload contains
 * short-lived secret material (the plaintext OTP) that is deliberately NOT
 * stored anywhere, so it can never be re-derived for a retry. They are
 * dispatched exactly once from memory; a failed delivery is terminal for
 * that code and the user requests a fresh one.
 */
export const ONE_SHOT_NOTIFICATION_TYPES: readonly NotificationTypeId[] = [
  "STAFF_LOGIN_CODE",
] as const;

/** Per-type delivery-attempt budget overrides (§10: one attempt per OTP). */
export const MAX_ATTEMPTS_OVERRIDES: Partial<Record<NotificationTypeId, number>> = {
  STAFF_LOGIN_CODE: 1,
};

export type NotificationTypeId = keyof NotificationPayloadMap;

/**
 * Dedupe-key convention (brief §11): "<TYPE>:<immutable entity id>".
 * The entity id is the database row whose existence/creation IS the event —
 * a candidate for journey-wide milestones, the attempt/agreement/appointment/
 * staff/onboarding row for entity-specific ones. Immutable database ids
 * only; never an email address.
 */
export function buildDedupeKey(
  type: NotificationTypeId,
  entityId: string,
): string {
  return `${type}:${entityId}`;
}

/** Extract the entity id from a dedupe key ("<TYPE>:<entityId>"). */
export function entityIdFromDedupeKey(
  type: NotificationTypeId,
  dedupeKey: string,
): string {
  if (!dedupeKey.startsWith(`${type}:`)) {
    throw new Error(`Dedupe key "${dedupeKey}" does not belong to ${type}.`);
  }
  return dedupeKey.slice(type.length + 1);
}

/** Runtime configuration, read from the environment at call time so tests
 * and future workers can change behaviour without a redeploy. */
export interface NotificationRuntimeConfig {
  /** Master switch (NOTIFICATIONS_ENABLED). When false, delivery rows may
   * still be queued but NO network request is ever attempted (§26). */
  enabled: boolean;
  /** Whether the Mailjet credentials/sender are present in the environment. */
  providerConfigured: boolean;
  /** Bounded retry policy (§15) — rows never retry forever. */
  maxAttempts: number;
  /** Per-send network timeout in ms. */
  sendTimeoutMs: number;
  /** Server-authoritative base URL for safe portal links (§21). */
  baseUrl: string;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getNotificationConfig(): NotificationRuntimeConfig {
  const apiKey = process.env.MAILJET_API_KEY?.trim() ?? "";
  const secretKey = process.env.MAILJET_SECRET_KEY?.trim() ?? "";
  const fromEmail = process.env.MAILJET_FROM_EMAIL?.trim() ?? "";
  return {
    enabled: process.env.NOTIFICATIONS_ENABLED === "true",
    providerConfigured:
      apiKey.length > 0 && secretKey.length > 0 && fromEmail.length > 0,
    maxAttempts: readIntEnv("NOTIFICATIONS_MAX_ATTEMPTS", 3),
    sendTimeoutMs: readIntEnv("NOTIFICATIONS_SEND_TIMEOUT_MS", 10_000),
    baseUrl: (
      process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:3000"
    ).replace(/\/+$/, ""),
  };
}

/** True only when sends may leave the server: master switch ON and the
 * provider fully configured. Queuing is always allowed — sending is not. */
export function isDeliveryActive(config: NotificationRuntimeConfig): boolean {
  return config.enabled && config.providerConfigured;
}
