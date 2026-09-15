import type { OnboardingStep } from "@/types/recruitment";

/**
 * FinFam Staff Onboarding — stage 6 content and channel constants
 * (CLIENT-SAFE).
 *
 * Approved Stage 6 MVP decisions (docs/CONTENT-QUESTIONS.md §33–§36 and the
 * approved implementation brief):
 * - Onboarding is STAFF-SIDE operational state: it adds no CandidateStatus
 *   value, no RecruitmentStage value and no StageEvent. APPROVED_STAFF
 *   remains the terminal recruitment result.
 * - Seven sequential, config-driven steps with stable ids (persisted in
 *   staff_onboarding_steps). Do not reorder them casually after launch.
 * - WhatsApp: the official onboarding number has NOT been supplied, so
 *   `whatsappNumber` is null and the UI shows honest pending copy — never a
 *   fabricated number, wa.me link, disabled fake button or group invite.
 *   The scripted first message from the business material is used verbatim
 *   as an INSTRUCTION (what to send). When the official number is supplied,
 *   setting it here is a configuration-only change that enables a real
 *   "Contact Onboarding Team" link.
 * - WhatsApp contact is NOT a completion gate, and there is no human
 *   verification gate: portal onboarding is an automated operational
 *   briefing backed by persisted recruitment records.
 * - Staff resources: list-only. No resource assets exist in the project, so
 *   nothing is downloadable and no placeholder files/links are fabricated.
 * - The FinFam Identity Card is out of scope (Stage 5 assigned only the
 *   Staff ID number); it is listed as a resource and may later be built by
 *   a separate staff feature.
 * - Daily reporting is EXPLAINED only — the reporting product belongs to a
 *   future Staff Platform.
 *
 * Versioning is deliberately lightweight: `ONBOARDING_META.version` is
 * pinned on the StaffOnboarding row at entry (and re-pinned at completion)
 * so the confirmed acknowledgement wording stays auditable, without a full
 * immutable content registry — this is an operational briefing, not a
 * signed document.
 */
export const ONBOARDING_META = {
  version: "1.0",
} as const;

/**
 * The single final operational acknowledgement (approved Stage 6 wording,
 * brief §16). This is NOT another agreement or acceptance — it confirms the
 * onboarding instructions were reviewed.
 */
export const ONBOARDING_ACKNOWLEDGEMENT_LABEL =
  "I have reviewed the FinFam onboarding instructions and understand the communication, reporting, customer-support, and professional expectations for my role.";

/**
 * Official staff onboarding WhatsApp contact. null = NOT SUPPLIED YET (the
 * honest state). When the business confirms the number, set it here and the
 * communication step automatically renders the real "Contact Onboarding
 * Team" link with `whatsappMessage` pre-filled.
 */
export const ONBOARDING_WHATSAPP: {
  number: string | null;
  message: string;
} = {
  number: null,
  message:
    "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
};

/** Stable step ids in the approved order (brief §6). */
export const ONBOARDING_STEP_IDS = [
  "welcome",
  "communication",
  "resources",
  "engagement",
  "reporting",
  "standards",
  "ready",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

/**
 * The final step — its review is completed BY the acknowledgement itself
 * (POST /complete records it in the same transaction as the completion
 * latch), so the onboarding page never shows a "Continue" action on it.
 */
export const ONBOARDING_FINAL_STEP_ID: OnboardingStepId = "ready";

/**
 * The seven onboarding steps, in order. Rendered as plain, readable
 * typography — the same block philosophy as the activation screen, not
 * cards. Content is drawn strictly from the approved brief: no invented
 * contacts, no fake resources, no reporting product claims.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to FinFam staff onboarding",
    summary: "Your recruitment is complete — onboarding prepares you to begin work.",
    blocks: [
      {
        type: "paragraph",
        text: "Your recruitment process is complete. Onboarding prepares you to begin your FinFam assignment.",
      },
      {
        type: "paragraph",
        text: "Your staff identity has already been created and will not change. Onboarding walks you through how FinFam staff communicate, the resources you will receive, what your first work involves, and how accountability works day to day.",
      },
      {
        type: "list",
        items: [
          "Your Staff ID, designation and appointment reference are shown on this page — they come from your permanent staff record.",
          "Work through each section in order. Your progress is saved as you go, so you can leave and return.",
          "After the final section you will confirm one short acknowledgement to complete your onboarding.",
        ],
      },
    ],
  },
  {
    id: "communication",
    title: "Communication & support",
    summary: "The official staff onboarding channel and how to reach the team.",
    blocks: [
      {
        type: "paragraph",
        text: "Official staff communication and onboarding support are handled through the designated FinFam onboarding team, contacted via WhatsApp.",
      },
      {
        type: "paragraph",
        text: "Within 24 hours of receiving your appointment letter, contact the onboarding team and send them this message:",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Your first message to the onboarding team",
        text: "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
      },
      {
        type: "paragraph",
        text: "Your official staff onboarding contact will be provided here once confirmed. Until then, keep this message ready — the onboarding team will confirm your identity, appointment status and staff details when you reach them.",
      },
      {
        type: "list",
        items: [
          "The onboarding team is your route for onboarding questions and support.",
          "Future announcements and staff communication will also come through official FinFam channels.",
          "Contacting the onboarding team is a real-world step — it does not block or delay completing onboarding here.",
        ],
      },
    ],
  },
  {
    id: "resources",
    title: "Staff resources",
    summary: "What FinFam staff receive through the onboarding team.",
    blocks: [
      {
        type: "paragraph",
        text: "Resources provided through onboarding may include:",
      },
      {
        type: "list",
        items: [
          "FinFam Identity Card",
          "FinFam branded shirt design",
          "Customisable marketing flyers",
          "Orientation and training materials",
          "Customer education materials",
          "Approved marketing guidelines",
          "Reporting instructions",
        ],
      },
      {
        type: "paragraph",
        text: "These resources are provided through the appropriate onboarding/support channel — they are not downloadable from this portal. The onboarding team will guide you on receiving and using them.",
      },
    ],
  },
  {
    id: "engagement",
    title: "Customer & member engagement",
    summary: "What your first work as a FinFam staff member involves.",
    blocks: [
      {
        type: "paragraph",
        text: "Your first work focuses on people: finding them, introducing FinFam appropriately, and supporting them as they join and save.",
      },
      {
        type: "list",
        items: [
          "Build prospect lists of people you can introduce FinFam to.",
          "Engage individuals and groups respectfully and appropriately.",
          "Introduce FinFam accurately — what it is, how savings work, what members gain.",
          "Support new members through registration.",
          "Encourage and support first deposits.",
          "Encourage consistent savings habits among members.",
          "Provide ongoing member support and engagement.",
        ],
      },
      {
        type: "paragraph",
        text: "This is an operational summary — your orientation workshop and your Responsibility & Reward Agreement remain the full reference for how you represent FinFam.",
      },
    ],
  },
  {
    id: "reporting",
    title: "Daily reporting & accountability",
    summary: "The activity categories FinFam staff report on.",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam staff work is accountable. You will be expected to report on your daily activity across three categories:",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Community Building",
        text: "Prospects contacted · groups engaged · new members joined · Established Members.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Savings Activation",
        text: "First deposits supported · savings goals set · support provided to savers.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Community Connections",
        text: "Referrals encouraged · member engagement · relationship-building activities.",
      },
      {
        type: "paragraph",
        text: "How and where to submit your daily reports will be explained by the onboarding team as part of your first-work instructions.",
      },
    ],
  },
  {
    id: "standards",
    title: "Professional standards reminder",
    summary: "The expectations you already accepted — kept short.",
    blocks: [
      {
        type: "paragraph",
        text: "A short reminder of the standards you accepted in your Responsibility & Reward Agreement. They apply to your daily work as staff:",
      },
      {
        type: "list",
        items: [
          "Be professional in every member and prospect interaction.",
          "Report accurately — never inflate or invent activity.",
          "Respect privacy and handle member information responsibly.",
          "Never create fake accounts or misrepresent FinFam.",
          "Never request a member's account balances.",
          "Never request a member's login details.",
        ],
      },
      {
        type: "paragraph",
        text: "Your Responsibility & Reward Agreement remains the authoritative statement of these expectations — this is a reminder, not a replacement.",
      },
    ],
  },
  {
    id: "ready",
    title: "Ready to begin",
    summary: "What completing onboarding means, and the final acknowledgement.",
    blocks: [
      {
        type: "paragraph",
        text: "Completing onboarding confirms you have reviewed your communication instructions, resources, first-work expectations, reporting categories and professional standards.",
      },
      {
        type: "list",
        items: [
          "Your recruitment remains complete and your Staff ID unchanged.",
          "Your onboarding record will show as completed on your application page.",
          "You are ready to begin your FinFam assignment.",
        ],
      },
      {
        type: "paragraph",
        text: "When you are ready, confirm the acknowledgement below and complete your onboarding.",
      },
    ],
  },
];

/** Look up a step by its stable config id (mirror getOrientationSection). */
export function getOnboardingStep(
  stepId: string,
): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
}
