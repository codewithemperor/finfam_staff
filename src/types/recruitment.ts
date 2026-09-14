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

/**
 * State of a single stage inside the recruitment progress component.
 * `locked` marks a future stage the candidate cannot enter yet — progress
 * is informational, never navigation.
 */
export type StageState = "completed" | "current" | "upcoming" | "locked";

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

/* -------------------------------------------------------------------------
 * Unified recruitment journey — one application, one reference, one journey
 * ---------------------------------------------------------------------- */

/** State of one stage on the unified journey screen. */
export type JourneyStageState = "completed" | "current" | "locked";

/** One stage of the journey as the unified application screen renders it. */
export interface JourneyStageView {
  id: RecruitmentStageId;
  label: string;
  state: JourneyStageState;
}

/** The ONE primary action available for the candidate's current stage. */
export interface JourneyNextAction {
  label: string;
  href: string;
}

/** Assessment record summary (read-only) once an attempt was submitted. */
export interface JourneyAssessmentSummary {
  attemptNumber: number;
  submittedAt: string;
  passed: boolean;
  marksAwarded: number;
  totalMarks: number;
}

/**
 * Safe journey view returned by GET /api/journey/[reference] and rendered
 * by the unified application screen. Derived by the server from persisted
 * state (CandidateStatus + stage records) — the client never decides which
 * stage is current. Contains only what the candidate already knows plus
 * their own progress; no PII beyond the name they supplied.
 */
export interface RecruitmentJourneyView {
  referenceNumber: string;
  fullName: string;
  roleTitle: string;
  status: CandidateStatusId;
  submittedAt: string;
  /** Every stage in journey order with completed/current/locked state. */
  stages: JourneyStageView[];
  /** The stage the candidate is on (null only for a finished journey). */
  currentStage: RecruitmentStageId | null;
  /** The one obvious next action — null when the next stage is not open yet. */
  nextAction: JourneyNextAction | null;
  /** Honest "what happens next" copy when no action is available yet. */
  upcomingNote: string | null;
  /** Concrete resume detail for the current stage, e.g. "4 of 8 sections read". */
  currentStageDetail: string | null;
  /** Present once an assessment attempt has been submitted (record view). */
  assessmentResult: JourneyAssessmentSummary | null;
  events: CandidateStageEvent[];
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
