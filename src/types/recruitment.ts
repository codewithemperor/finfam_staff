/**
 * Recruitment domain types shared by client and server.
 *
 * These string unions mirror the Prisma enums (prisma/schema.prisma) so that
 * client code never has to import @prisma/client. Keep them in sync — the
 * server service layer validates incoming values at the boundary.
 */

export const RECRUITMENT_STAGE_IDS = [
  "APPLICATION",
  "ORIENTATION",
  "ASSESSMENT",
  "OFFER",
  "APPOINTMENT",
  "ACTIVATION",
] as const;

export type RecruitmentStageId = (typeof RECRUITMENT_STAGE_IDS)[number];

export const CANDIDATE_STATUS_IDS = [
  "APPLICANT",
  "ORIENTATION_PENDING",
  "ORIENTATION_COMPLETED",
  "ASSESSMENT_PENDING",
  "ASSESSMENT_PASSED",
  "ASSESSMENT_FAILED",
  "OFFER_PENDING",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "APPOINTMENT_ISSUED",
  "ACTIVATION_PENDING",
  "APPROVED_STAFF",
] as const;

export type CandidateStatusId = (typeof CANDIDATE_STATUS_IDS)[number];

export const STAGE_EVENT_TYPES = [
  "ENTERED",
  "COMPLETED",
  "FAILED",
  "NOTE",
] as const;

export type StageEventTypeId = (typeof STAGE_EVENT_TYPES)[number];

/** State of a single stage inside the recruitment progress component. */
export type StageState = "completed" | "current" | "upcoming";

/** Visual tone used by status badges and alerts. */
export type StatusTone = "neutral" | "success" | "warning" | "danger";

/** A single timeline entry on the candidate status page. */
export interface CandidateStageEvent {
  id: string;
  stage: RecruitmentStageId;
  type: StageEventTypeId;
  description: string | null;
  occurredAt: string; // ISO string — dates are serialized across the API
}

/** Candidate data returned by GET /api/candidates/[reference]. */
export interface CandidateStatusView {
  referenceNumber: string;
  fullName: string;
  roleTitle: string;
  status: CandidateStatusId;
  submittedAt: string;
  events: CandidateStageEvent[];
}

/** Payload returned by POST /api/applications. */
export interface ApplicationSubmissionResult {
  referenceNumber: string;
  status: CandidateStatusId;
  submittedAt: string;
}
