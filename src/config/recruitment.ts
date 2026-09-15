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
    // Persisted stage id is OFFER; the candidate-facing stage is the
    // Responsibility & Reward Agreement (see prisma/schema.prisma).
    label: "Agreement",
    description: "Review and accept your Responsibility & Reward Agreement.",
  },
  {
    id: "APPOINTMENT",
    label: "Appointment",
    description: "Receive your provisional appointment.",
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
      "Your application has been received. Your orientation is ready — start the Staff Orientation Workshop online whenever you like. Your progress is saved as you go.",
  },
  ORIENTATION_PENDING: {
    id: "ORIENTATION_PENDING",
    label: "Orientation pending",
    tone: "neutral",
    stage: "ORIENTATION",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your orientation covers how FinFam works, your role, and the standards expected from every team member. Work through the sections in order — your progress is saved as you go.",
  },
  ORIENTATION_COMPLETED: {
    id: "ORIENTATION_COMPLETED",
    label: "Orientation completed",
    tone: "success",
    stage: "ORIENTATION",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "You have completed orientation. Your assessment is ready when you are — it has 30 multiple-choice questions and a 70% pass mark, and your answers are saved as you go.",
  },
  ASSESSMENT_PENDING: {
    id: "ASSESSMENT_PENDING",
    label: "Assessment pending",
    tone: "neutral",
    stage: "ASSESSMENT",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your assessment is ready. It has 30 multiple-choice questions and a 70% pass mark. Your answers are saved as you go, so you can leave and return.",
  },
  ASSESSMENT_PASSED: {
    id: "ASSESSMENT_PASSED",
    label: "Assessment passed",
    tone: "success",
    stage: "ASSESSMENT",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "Congratulations — you passed the assessment and your result has been recorded. Your next step is to review your Responsibility & Reward Agreement: the role's responsibilities, support package, reward structure and the standards expected from every FinFam team member.",
  },
  ASSESSMENT_FAILED: {
    id: "ASSESSMENT_FAILED",
    label: "Assessment not passed",
    tone: "danger",
    stage: "ASSESSMENT",
    // The stage interaction is not over: the interim policy allows a retake
    // (docs/CONTENT-QUESTIONS.md §6), so the assessment stays current.
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "You did not meet the pass mark this time. You can retake the assessment when you are ready. The final retake policy is being finalised.",
  },
  OFFER_PENDING: {
    id: "OFFER_PENDING",
    // Persisted status is OFFER_PENDING; candidate-facing stage is the
    // Responsibility & Reward Agreement.
    label: "Agreement pending",
    tone: "neutral",
    stage: "OFFER",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Your Responsibility & Reward Agreement is ready. Read each section carefully — it sets out your role, responsibilities, support package, reward structure and the professional standards expected from every FinFam team member. When you are ready, accept it to move your application forward.",
  },
  OFFER_ACCEPTED: {
    id: "OFFER_ACCEPTED",
    label: "Agreement accepted",
    tone: "success",
    stage: "OFFER",
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "Thank you for accepting. Your Provisional Letter of Appointment is ready — open it to read your appointment as a Remote Staff, including your role, compensation policy and the expectations that come with it.",
  },
  OFFER_DECLINED: {
    id: "OFFER_DECLINED",
    label: "Agreement declined",
    tone: "danger",
    stage: "OFFER",
    // A declined agreement is a recorded decision, NOT a completed stage:
    // the journey must stay at the agreement and never advance toward an
    // appointment (docs/CONTENT-QUESTIONS.md §16).
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "You have declined the Responsibility & Reward Agreement, so your application cannot move forward. If this was a mistake, please contact the recruitment team as soon as possible.",
  },
  APPOINTMENT_ISSUED: {
    id: "APPOINTMENT_ISSUED",
    label: "Appointment issued",
    tone: "success",
    stage: "APPOINTMENT",
    // Issuance completes the appointment stage: the journey moves on to
    // Activation as the current stage. The issued letter itself stays
    // available as a read-only record (the one-way-lock exception).
    stageCompleted: true,
    journeyComplete: false,
    nextStep:
      "Congratulations — your Provisional Letter of Appointment has been issued and stays available on this page. One final step remains: Staff Activation. Continue to review what activation means and activate your FinFam staff profile to receive your Staff ID.",
  },
  ACTIVATION_PENDING: {
    id: "ACTIVATION_PENDING",
    label: "Activation pending",
    tone: "neutral",
    stage: "ACTIVATION",
    stageCompleted: false,
    journeyComplete: false,
    nextStep:
      "Staff activation is in progress. Review what activation means, then confirm you are ready — activating completes your recruitment, creates your FinFam staff profile and assigns your permanent Staff ID.",
  },
  APPROVED_STAFF: {
    id: "APPROVED_STAFF",
    label: "Approved staff",
    tone: "success",
    stage: "ACTIVATION",
    stageCompleted: true,
    journeyComplete: true,
    nextStep:
      "Your staff profile is active and your recruitment is complete. Your Staff Onboarding is ready in the section below — complete it to review your communication instructions, staff resources, reporting expectations and first-work guidance.",
  },
};

/**
 * Map a candidate status onto per-stage states for the progress rails.
 *
 * Mirrors the unified journey derivation (journey.ts → deriveStageStates)
 * so every rail agrees with the journey screen: a status whose stage was
 * just completed (e.g. OFFER_ACCEPTED, APPOINTMENT_ISSUED) marks its own
 * stage completed and points the current stage at the NEXT one (the
 * appointment, then activation); APPLICANT's application is already
 * submitted, so orientation is current for them too.
 */
export function getStageStates(
  status: CandidateStatusId,
): Record<RecruitmentStageId, "completed" | "current" | "upcoming"> {
  const def = CANDIDATE_STATUS_DETAILS[status];
  const mappedIndex = RECRUITMENT_STAGES.findIndex((s) => s.id === def.stage);
  const applicationIndex = RECRUITMENT_STAGES.findIndex(
    (s) => s.id === "APPLICATION",
  );

  // Last stage index that counts as completed.
  const completedBoundary =
    status === "APPLICANT"
      ? applicationIndex
      : def.stageCompleted
        ? mappedIndex
        : mappedIndex - 1;

  // The current stage is the first stage AFTER the completed boundary.
  const currentIndex = def.journeyComplete
    ? -1
    : status === "APPLICANT"
      ? RECRUITMENT_STAGES.findIndex((s) => s.id === "ORIENTATION")
      : def.stageCompleted
        ? mappedIndex + 1
        : mappedIndex;

  return Object.fromEntries(
    RECRUITMENT_STAGES.map((stage, index) => [
      stage.id,
      def.journeyComplete || index <= completedBoundary
        ? "completed"
        : index === currentIndex
          ? "current"
          : "upcoming",
    ]),
  ) as Record<RecruitmentStageId, "completed" | "current" | "upcoming">;
}
