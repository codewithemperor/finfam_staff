import type {
  CandidateStatusId,
  RecruitmentStageId,
  StatusTone,
} from "@/types/recruitment";

/**
 * Recruitment stage and status metadata.
 *
 * This is the single source of truth for the candidate-facing journey:
 * labels, ordering, status→stage mapping and "what happens next" copy
 * (see README → Conventions → One next action).
 *
 * NOTE: the full state machine (which transitions are allowed and when) is
 * finalized in the planning phase — this file only defines presentation.
 */

export interface StageDefinition {
  id: RecruitmentStageId;
  /** Short label used in the progress stepper. */
  label: string;
  /** One-line explanation shown under the stepper. */
  description: string;
}

export const RECRUITMENT_STAGES: StageDefinition[] = [
  {
    id: "APPLICATION",
    label: "Application",
    description: "Complete and submit your application form.",
  },
  {
    id: "ORIENTATION",
    label: "Orientation",
    description: "Complete the online staff orientation workshop.",
  },
  {
    id: "ASSESSMENT",
    label: "Assessment",
    description: "Complete the automated assessment.",
  },
  {
    id: "OFFER",
    label: "Offer",
    description: "Review and respond to your offer.",
  },
  {
    id: "APPOINTMENT",
    label: "Appointment",
    description: "Download your appointment letter.",
  },
  {
    id: "ACTIVATION",
    label: "Activation",
    description: "Receive your staff ID and onboarding details.",
  },
];

export function getStageDefinition(id: RecruitmentStageId): StageDefinition {
  const stage = RECRUITMENT_STAGES.find((s) => s.id === id);
  if (!stage) {
    throw new Error(`Unknown recruitment stage: ${id}`);
  }
  return stage;
}

export interface StatusDefinition {
  id: CandidateStatusId;
  /** Human-readable label shown on the status badge. */
  label: string;
  /** Visual tone for the badge. */
  tone: StatusTone;
  /** The stage this status belongs to. */
  stage: RecruitmentStageId;
  /**
   * Whether the mapped stage should be shown as completed (true) or as the
   * candidate's current stage (false) in the progress stepper.
   */
  stageCompleted: boolean;
  /** True when the whole journey is finished (all stages completed). */
  journeyComplete: boolean;
  /** What the candidate should expect next — answers "what happens now?". */
  nextStep: string;
}

export const CANDIDATE_STATUS_DETAILS: Record<CandidateStatusId, StatusDefinition> = {
  APPLICANT: {
    id: "APPLICANT",
    label: "Application submitted",
    tone: "neutral",
    stage: "APPLICATION",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your application has been received. We will contact you with orientation details once your application is reviewed.",
  },
  ORIENTATION_PENDING: {
    id: "ORIENTATION_PENDING",
    label: "Orientation pending",
    tone: "neutral",
    stage: "ORIENTATION",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your orientation is ready. Start the Staff Orientation Workshop online — it covers how FinFam works, your role, and the standards expected from every team member. Your progress is saved as you go.",
  },
  ORIENTATION_COMPLETED: {
    id: "ORIENTATION_COMPLETED",
    label: "Orientation completed",
    tone: "success",
    stage: "ORIENTATION",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "You have completed orientation. Your assessment will be available shortly.",
  },
  ASSESSMENT_PENDING: {
    id: "ASSESSMENT_PENDING",
    label: "Assessment pending",
    tone: "neutral",
    stage: "ASSESSMENT",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your assessment is ready. You will be able to start it from this page once it opens.",
  },
  ASSESSMENT_PASSED: {
    id: "ASSESSMENT_PASSED",
    label: "Assessment passed",
    tone: "success",
    stage: "ASSESSMENT",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "Congratulations — you passed the assessment. Your offer is being prepared.",
  },
  ASSESSMENT_FAILED: {
    id: "ASSESSMENT_FAILED",
    label: "Assessment not passed",
    tone: "danger",
    stage: "ASSESSMENT",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "You did not meet the pass mark for this assessment. The recruitment team will contact you about re-application options.",
  },
  OFFER_PENDING: {
    id: "OFFER_PENDING",
    label: "Offer pending",
    tone: "neutral",
    stage: "OFFER",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your offer is ready for review. Please read the responsibility and reward policy before responding.",
  },
  OFFER_ACCEPTED: {
    id: "OFFER_ACCEPTED",
    label: "Offer accepted",
    tone: "success",
    stage: "OFFER",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "Thank you for accepting. Your appointment letter is being generated.",
  },
  OFFER_DECLINED: {
    id: "OFFER_DECLINED",
    label: "Offer declined",
    tone: "danger",
    stage: "OFFER",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "You have declined the offer. If this was a mistake, please contact the recruitment team as soon as possible.",
  },
  APPOINTMENT_ISSUED: {
    id: "APPOINTMENT_ISSUED",
    label: "Appointment issued",
    tone: "success",
    stage: "APPOINTMENT",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your appointment letter is ready to download from this page.",
  },
  ACTIVATION_PENDING: {
    id: "ACTIVATION_PENDING",
    label: "Activation pending",
    tone: "neutral",
    stage: "ACTIVATION",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your staff ID is being created. You will be contacted once your account is activated.",
  },
  APPROVED_STAFF: {
    id: "APPROVED_STAFF",
    label: "Approved staff",
    tone: "success",
    stage: "ACTIVATION",
    stageCompleted: true,
    journeyComplete: true,
    nextStep:
      "You are fully activated. Your onboarding instructions and support contacts are available below.",
  },
};

/**
 * Map a candidate status onto per-stage states for the progress stepper.
 */
export function getStageStates(
  status: CandidateStatusId,
): Record<RecruitmentStageId, "completed" | "current" | "upcoming"> {
  const def = CANDIDATE_STATUS_DETAILS[status];
  const currentIndex = RECRUITMENT_STAGES.findIndex((s) => s.id === def.stage);
  const completionBoundary = def.stageCompleted ? currentIndex : currentIndex - 1;

  return Object.fromEntries(
    RECRUITMENT_STAGES.map((stage, index) => [
      stage.id,
      def.journeyComplete || index <= completionBoundary
        ? "completed"
        : index === currentIndex
          ? "current"
          : "upcoming",
    ]),
  ) as Record<RecruitmentStageId, "completed" | "current" | "upcoming">;
}
