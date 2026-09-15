import type { ActivationSection } from "@/types/recruitment";

/**
 * FinFam Staff Activation — stage 5 content and identity constants
 * (CLIENT-SAFE).
 *
 * Approved Stage 5 MVP decisions (docs/CONTENT-QUESTIONS.md §29–§32):
 * - Activation rule: Option E — the candidate reviews what activation means
 *   and explicitly activates their staff profile in the portal. Opening the
 *   stage never activates anything. No manual administrator approval.
 * - Staff ID format: `FF-STF-NNNN`, server-generated from a transactional
 *   singleton sequence seeded at 0, so the first Staff ID is FF-STF-0001.
 *   Unique, sequential, zero-padded to at least four digits, immutable once
 *   assigned, never client-supplied, never from count(*). A future format
 *   change must never modify already-assigned Staff IDs.
 * - Access model: the existing recruitment-reference access model is
 *   retained for the MVP (an explicitly accepted limitation — activation is
 *   the most consequential reference-only action; OTP/authentication is a
 *   recommended future hardening phase, not part of this stage).
 * - Reversibility: activation is one-way. No deactivate/revoke/reassign
 *   workflow exists in the portal (future administrative/business process).
 * - The FinFam Identity Card is NOT part of this stage — only the Staff ID
 *   number is assigned here.
 * - WhatsApp/onboarding details belong to Stage 6; this content only says
 *   that official communication follows during onboarding.
 *
 * Versioning is deliberately lightweight: `ACTIVATION_META.version` is
 * pinned on the Staff row at activation so the confirmed acknowledgement
 * wording stays auditable, without a full immutable content registry — the
 * activation screen is a short transition step, not a signed document.
 * If the content ever grows into a substantial legal/policy document,
 * promote it to an append-only registry (the appointment pattern).
 */
export const ACTIVATION_META = {
  version: "1.0",
} as const;

/**
 * The acknowledgement the candidate must explicitly confirm before the
 * Activate action opens (approved Stage 5 wording, brief §4/§23).
 */
export const ACTIVATION_ACKNOWLEDGEMENT_LABEL =
  "I confirm that I am ready to activate my FinFam staff profile and proceed to onboarding.";

/** Official Staff ID format (approved Stage 5 MVP convention). */
export const STAFF_ID_PREFIX = "FF-STF-";

/** Zero-padding width of the numeric part; longer numbers grow naturally. */
export const STAFF_ID_MIN_DIGITS = 4;

/** Singleton row that backs Staff ID allocation (seeded by migration). */
export const STAFF_ID_SEQUENCE_NAME = "STAFF_ID";

/**
 * Supporting copy under the page heading (brief §23).
 */
export const ACTIVATION_INTRO =
  "Complete this step to activate your FinFam staff profile and receive your Staff ID.";

/**
 * The activation screen sections, in order. Rendered as plain, readable
 * typography — the same block philosophy as the agreement and the
 * appointment letter, not cards. Content is drawn strictly from the
 * approved brief: nothing about December 2026 requirements, identity-card
 * visuals or WhatsApp details is invented here.
 */
export const ACTIVATION_SECTIONS: ActivationSection[] = [
  {
    id: "what-activation-means",
    title: "What activation means",
    blocks: [
      {
        type: "paragraph",
        text: "Activation is the point where your recruitment journey ends and your FinFam staff identity begins.",
      },
      {
        type: "list",
        items: [
          "Your recruitment has been successfully completed — every stage is recorded on your application.",
          "Activation creates your FinFam staff profile.",
          "A permanent Staff ID is assigned to you when you activate, and it does not change.",
          "Onboarding follows immediately after activation.",
        ],
      },
    ],
  },
  {
    id: "provisional-appointment",
    title: "Your provisional appointment",
    blocks: [
      {
        type: "alert",
        tone: "warning",
        title: "Your appointment remains provisional",
        text: "Your Provisional Letter of Appointment remains provisional and subject to the performance expectations set out in it. The expected confirmation in December 2026 remains subject to the stated performance requirements.",
      },
    ],
  },
  {
    id: "communication",
    title: "Communication and onboarding",
    blocks: [
      {
        type: "paragraph",
        text: "Official staff communication and your first work instructions are provided during onboarding, which begins once your staff profile is active.",
      },
    ],
  },
];
