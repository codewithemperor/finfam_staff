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

/* -------------------------------------------------------------------------
 * Orientation (FSOW) — stage 1 after the application
 * ---------------------------------------------------------------------- */

/** Server-persisted state of one completed orientation section. */
export interface OrientationCompletedSection {
  id: string;
  completedAt: string; // ISO string — dates are serialized across the API
}

/**
 * Orientation progress for one candidate, as returned by the orientation
 * API/service. Section *content* lives in src/config/orientation.ts; this
 * payload is only the candidate's state. `orientation` is null when the
 * candidate has not completed any section yet.
 */
export interface OrientationView {
  referenceNumber: string;
  fullName: string;
  status: CandidateStatusId;
  orientation: {
    /** Resume point — the section the candidate is currently on. */
    currentSectionId: string | null;
    /** Set once the candidate explicitly completed the workshop. */
    completedAt: string | null;
    acknowledgedAt: string | null;
    sections: OrientationCompletedSection[];
  } | null;
}

/* -------------------------------------------------------------------------
 * Automated Interview Assessment — stage 2 after orientation
 * ---------------------------------------------------------------------- */

/**
 * One assessment question as the CLIENT may see it: id, text, options.
 * Never includes the correct answer, insights, or any scoring metadata —
 * the answer key is server-only (src/server/assessment-content.ts).
 */
export interface SafeAssessmentQuestion {
  id: string;
  /** 1-based position within the attempt's persisted order. */
  index: number;
  text: string;
  options: string[];
  category: string;
}

/** The candidate's saved answer for one question (0-based option index). */
export interface SavedAssessmentAnswer {
  questionId: string;
  selectedOption: number;
}

/**
 * An active (not yet submitted) attempt. Questions come back in the
 * attempt's persisted order — the client must never supply ordering.
 */
export interface AssessmentAttemptState {
  attemptNumber: number;
  startedAt: string;
  questions: SafeAssessmentQuestion[];
  answers: SavedAssessmentAnswer[];
}

/** Final result of a submitted attempt — computed server-side only. */
export interface AssessmentResultState {
  attemptNumber: number;
  submittedAt: string;
  correctCount: number;
  marksAwarded: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
}

/** Everything the assessment hub needs to render one of its phases. */
export interface AssessmentView {
  referenceNumber: string;
  fullName: string;
  status: CandidateStatusId;
  /** True when the candidate has explicitly completed orientation. */
  orientationCompleted: boolean;
  phase: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  /** Present only while an attempt is active. */
  attempt: AssessmentAttemptState | null;
  /** Present only after a submission (the latest attempt's result). */
  result: AssessmentResultState | null;
  /** Attempt history summary — supports the (unresolved) retry policy. */
  attemptCount: number;
}
