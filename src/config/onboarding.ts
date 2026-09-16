import type { OnboardingStep } from "@/types/recruitment";

/**
 * FinFam Staff Onboarding — Section 7 content v2.1 (Stage 7/8, CLIENT-SAFE).
 *
 * "Section 7 — Immediate Onboarding & Resumption Instructions" is now the
 * AUTHORITATIVE onboarding content (approved brief §26–§37). It is served
 * through BOTH doors that share the one StaffOnboarding state:
 *
 * - the authenticated Staff Portal: /staff/onboarding (primary), and
 * - the legacy recruitment reference route: /onboarding/[reference]
 *   (kept working during Stage 7 — two doors, one state).
 *
 * Approved v2.0 decisions (docs/CONTENT-QUESTIONS.md §33–§36, §40 and the
 * approved Stage 7 brief):
 * - Eight sequential, config-driven steps with stable ids. v1.0 ids were
 *   welcome/communication/resources/engagement/reporting/standards/ready;
 *   v2.0 remaps to intro/communication/verification/resources/orientation/
 *   assignment/accountability/ready to mirror Section 7 exactly. Persisted
 *   step rows of any earlier id remain as historical records and are simply
 *   no longer part of the completion checklist (pre-production: no rows).
 * - WhatsApp: the official onboarding number has NOT been supplied, so
 *   `whatsappNumber` is null (an ONBOARDING_WHATSAPP_NUMBER env override is
 *   read server-side when configured) and the UI shows honest pending copy
 *   — never a fabricated number or fake verification. The scripted first
 *   message is used VERBATIM (brief §29). When the number is supplied, a
 *   plain wa.me link with the pre-filled message is rendered — no WhatsApp
 *   API, no chatbot, no automatic verification (§29/§30).
 * - WhatsApp contact is NOT a hard completion gate (§30): the portal cannot
 *   truthfully verify it. Verification (step 3) is split into
 *   system-derived checks (rendered from the server-computed payload) and
 *   external onboarding actions (never auto-ticked).
 * - Staff resources: LIST ONLY the five supplied categories. No resource
 *   assets exist, so nothing is downloadable and nothing is fabricated
 *   (§32).
 * - The final staff orientation (§33) is concise operational resumption
 *   guidance — it does NOT recreate the FSOW.
 * - Daily accountability (§35) EXPLAINS the four reporting categories.
 *   v2.0 said the reporting tool itself was not part of the portal yet;
 *   v2.1 (Stage 8) points that closing line at the Daily Reports tool that
 *   now EXISTS in the Staff Portal — the step list, order and completion
 *   semantics are otherwise unchanged, and historical acknowledgement
 *   wording (pinned per row) is unaffected.
 * - Versioning stays lightweight: `ONBOARDING_META.version` is pinned on
 *   the StaffOnboarding row at entry (and re-pinned at completion) so the
 *   acknowledgement wording stays auditable.
 */
export const ONBOARDING_META = {
  version: "2.1",
} as const;

/**
 * The single final operational acknowledgement (approved Stage 7 wording,
 * brief §37 — replaces the v1.0 label). This is NOT another agreement or
 * acceptance — it confirms the onboarding and resumption instructions were
 * reviewed.
 */
export const ONBOARDING_ACKNOWLEDGEMENT_LABEL =
  "I have reviewed my FinFam onboarding and resumption instructions and understand the communication, member-support, reporting, professional, and assignment expectations for my role.";

/**
 * Official staff onboarding WhatsApp contact. null = NOT SUPPLIED YET (the
 * honest state — brief §28). The server prefers the ONBOARDING_WHATSAPP_NUMBER
 * environment override when configured (configuration-only enablement);
 * this constant remains the code fallback. When a number is set, the
 * communication step renders a real "Contact FinFam Onboarding Team" wa.me
 * link with `message` pre-filled — exactly this text (brief §29).
 */
export const ONBOARDING_WHATSAPP: {
  number: string | null;
  message: string;
} = {
  number: null,
  message:
    "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
};

/** Stable step ids in the approved Section 7 order (brief §26). */
export const ONBOARDING_STEP_IDS = [
  "intro",
  "communication",
  "verification",
  "resources",
  "orientation",
  "assignment",
  "accountability",
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
 * The eight Section 7 onboarding steps, in order. Rendered as plain,
 * readable typography — the same block philosophy as the activation screen,
 * not cards. Content is drawn strictly from the approved brief: no invented
 * contacts, no fake resources, no fake verification, no reporting product.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "intro",
    title: "Welcome to the FinFam Team",
    summary:
      "Your recruitment is complete — onboarding and resumption come next.",
    blocks: [
      {
        type: "paragraph",
        text: "Welcome to the FinFam Team. Your recruitment is complete and you are now part of the FinFam Remote Team. Your next responsibility is to complete onboarding and begin work as a FinFam Growth Ambassador.",
      },
      {
        type: "paragraph",
        text: "Two descriptions of your role are used, and they stand side by side — one does not replace the other:",
      },
      {
        type: "facts",
        items: [
          { label: "Appointment designation", value: "Remote Staff" },
          { label: "Operational role", value: "FinFam Growth Ambassador" },
        ],
      },
      {
        type: "paragraph",
        text: "Onboarding walks you through your official communication channel, your staff verification, the resources you will receive, a short operational orientation, and the assignment you are beginning. Work through each section in order — your progress is saved as you go, so you can leave and return.",
      },
    ],
  },
  {
    id: "communication",
    title: "Join FinFam Staff Communication Channel",
    summary:
      "Contact the designated onboarding team through WhatsApp within 24 hours.",
    blocks: [
      {
        type: "paragraph",
        text: "Within 24 hours of receiving your appointment letter, contact the designated FinFam onboarding team through WhatsApp.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Your first message to the onboarding team",
        text: "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
      },
      {
        type: "paragraph",
        text: "When the official FinFam onboarding number is configured on this portal, a \"Contact FinFam Onboarding Team\" button will open WhatsApp with this message pre-filled — you will not need to compose it yourself.",
      },
      {
        type: "paragraph",
        text: "Your official staff onboarding contact will be provided here once confirmed. Until then, keep this message ready — the onboarding team will confirm your identity, appointment status, assigned staff details and communication-channel access when you reach them.",
      },
      {
        type: "list",
        items: [
          "Contacting the onboarding team is a real-world step — it does not block or delay completing onboarding here.",
          "Future announcements and staff communication will also come through official FinFam channels.",
        ],
      },
    ],
  },
  {
    id: "verification",
    title: "Staff Verification",
    summary:
      "What FinFam has already verified, and what happens externally.",
    blocks: [
      {
        type: "paragraph",
        text: "The onboarding team confirms staff identity, appointment status, assigned staff details and communication-channel access. Part of this is already verified by the FinFam system, from your actual records:",
      },
      {
        type: "list",
        items: [
          "Identity record — created when your staff profile was activated.",
          "Appointment issued — your provisional letter of appointment.",
          "Staff ID assigned — your permanent FF-STF number.",
          "Staff profile active — your current activation status.",
        ],
      },
      {
        type: "paragraph",
        text: "The remaining checks are external onboarding actions: they happen between you and the onboarding team (WhatsApp contact and communication-group access). This portal does not pretend to verify them — completing your onboarding here never claims you have joined a group.",
      },
    ],
  },
  {
    id: "resources",
    title: "Receive Staff Resources",
    summary:
      "What you receive through your approved staff communication channel.",
    blocks: [
      {
        type: "paragraph",
        text: "As a FinFam staff member you will receive:",
      },
      {
        type: "list",
        items: [
          "FinFam Staff Communication Group",
          "Marketing Resources",
          "Customer Education Materials",
          "Approved Marketing Guidelines",
          "Reporting Instructions",
        ],
      },
      {
        type: "paragraph",
        text: "These resources will be made available through your approved Staff communication/onboarding channel — they are not downloadable from this portal. The onboarding team will guide you on receiving and using them.",
      },
    ],
  },
  {
    id: "orientation",
    title: "Complete Final Staff Orientation",
    summary:
      "A concise operational briefing — your recruitment orientation already happened.",
    blocks: [
      {
        type: "paragraph",
        text: "This is your operational resumption guidance — a short briefing on how the work is done day to day. Your FinFam Staff Orientation Workshop from recruitment remains the full reference.",
      },
      {
        type: "list",
        items: [
          "Using FinFam marketing materials — use approved materials and follow the approved marketing guidelines.",
          "Communicating with prospects — introduce FinFam accurately and respectfully, to individuals and groups.",
          "Supporting members professionally — guide members politely, protect their privacy, never ask for balances or login details.",
          "Submitting daily reports — report your activity accurately and on time.",
          "Tracking achievements — keep track of your own activity and progress.",
        ],
      },
    ],
  },
  {
    id: "assignment",
    title: "Begin Your FinFam Assignment",
    summary:
      "Your active operational work: community building and member support.",
    blocks: [
      {
        type: "paragraph",
        text: "This step marks the move from onboarding into active operational work. Your assignment has two parts:",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Community Building Activities",
        text: "Creating prospect lists · engaging individuals and groups · introducing FinFam opportunities appropriately · supporting new members.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Member Support Activities",
        text: "Guiding members · encouraging savings consistency · supporting member engagement.",
      },
      {
        type: "paragraph",
        text: "Your Responsibility & Reward Agreement remains the authoritative statement of how you represent FinFam — this briefing summarises where your day-to-day work begins.",
      },
    ],
  },
  {
    id: "accountability",
    title: "Daily Accountability",
    summary:
      "The activity categories FinFam staff report on each day.",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam staff work is accountable. Your daily reporting covers four categories:",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Prospects",
        text: "Individuals contacted · groups approached · follow-up activities.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Member Growth",
        text: "New registrations · Established Members created.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Savings Activities",
        text: "First deposits achieved · savings goals activated.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Community Activities",
        text: "Member engagement · connections built.",
      },
      {
        type: "paragraph",
        text: "You submit your daily report in the Staff Portal under Daily Reports — one report per working day, covering these four categories. Your first-work instructions explain when your reporting routine begins.",
      },
    ],
  },
  {
    id: "ready",
    title: "Ready to Begin",
    summary:
      "Why this work matters, and the final acknowledgement.",
    blocks: [
      {
        type: "paragraph",
        text: "As a FinFam staff member you help people build better saving habits, access opportunities, grow financially, and build stronger futures. Your professionalism, consistency and commitment contribute directly to FinFam's success.",
      },
      {
        type: "paragraph",
        text: "Completing onboarding confirms you have reviewed your communication instructions, verification, resources, operational orientation, assignment and reporting expectations.",
      },
      {
        type: "list",
        items: [
          "Your recruitment remains complete and your Staff ID unchanged.",
          "Your onboarding record will show as completed in the Staff Portal.",
          "You are ready to begin your FinFam assignment.",
        ],
      },
      {
        type: "tagline",
        lines: [
          "Welcome to FinFam",
          "Together, We Are Building Africa's Leading Digital Cooperative Ecosystem.",
          "WE SAVE.",
          "WE GROW.",
          "WE PROSPER.",
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
