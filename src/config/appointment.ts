import type { AppointmentContent } from "@/types/recruitment";

/**
 * FinFam Provisional Letter of Appointment — stage 4 content (CLIENT-SAFE).
 *
 * HYBRID HISTORICAL-INTEGRITY MODEL (approved Stage 4 design):
 *
 * 1. The candidate-specific snapshot lives on the Appointment row
 *    (printedName, roleTitle, appointmentReference, issuedAt, version) —
 *    written once at issuance, never mutated afterwards.
 * 2. The letter TEXT lives HERE, in an append-only version registry.
 *    APPOINTMENT_META.version is the CURRENT pointer used for NEW
 *    issuances; an issued appointment always resolves its text from the
 *    version PINNED ON ITS ROW, so a letter issued under v1.0 remains
 *    byte-for-byte reproducible as v1.0 forever.
 *
 * Rules for changing letter wording:
 * - NEVER edit the body of a version that has been issued.
 * - Append a new version entry (e.g. "1.1") and move the
 *   APPOINTMENT_META.version pointer to it. Old entries stay untouched.
 * - A missing registry version for a persisted appointment is an
 *   integrity failure and must fail loudly (the service enforces this),
 *   never silently fall back to the current version.
 *
 * Content source (v1.0): the official Provisional Letter of Appointment
 * dated September 1, 2026 (Ref: FFL/HR/PLA/012) as reconciled during the
 * Stage 3 content pass — the confirmed earning formula, Established
 * Member definition, non-cumulative bonus tiers, worked examples, the
 * 200-member target, payment timing, referral-link tracking rule, the
 * privacy rule and the December 2026 provisional/confirmation note.
 *
 * Approved Stage 4 MVP business defaults (documented, changeable without
 * touching historical appointments — see docs/CONTENT-QUESTIONS.md):
 * - Official appointment role: "Marketing & Customer Care Executive".
 *   Remote work describes the work arrangement, not the role.
 * - Letter date = the server-issued timestamp (§23). No hard-coded
 *   September 1, 2026 — that date belongs to the sample document only.
 * - Signatory: "Management, FinFam" text-only (§24). No named officers.
 * - No signature or logo assets exist; none are invented (§25). If an
 *   official logo asset is supplied later it may be added to the
 *   letterhead rendering without altering this registry.
 * - December 2026 confirmation is CONTENT ONLY — no workflow exists
 *   and none may be built from this text (§28).
 * - No unconfirmed claims are included (e.g. the ₦500 cashback item, §10;
 *   "payment automation in progress" is not part of the confirmed
 *   September 1, 2026 letter, so it is omitted rather than asserted).
 */
export const APPOINTMENT_META = {
  version: "1.2",
} as const;

/** Official appointment designation used in the letter (approved default). */
export const APPOINTMENT_ROLE_TITLE = "Marketing & Customer Care Executive";

/** Issuing organisation as printed in the letterhead. */
export const APPOINTMENT_ORGANISATION =
  "FinFam Multipurpose Cooperative Society Limited";

/** Document title printed under the letterhead. */
export const APPOINTMENT_DOCUMENT_TITLE = "Provisional Letter of Appointment";

/**
 * Text-only closing (§5/§23 of the Stage 4 brief). No signature images —
 * none have been supplied and none may be invented.
 */
export const APPOINTMENT_SIGNATORY_LINES = ["Management", "FinFam"];

/** Official letter-reference format prefix (server-allocated number follows). */
export const APPOINTMENT_REFERENCE_PREFIX = "FFL/HR/PLA/";

/** Zero-padding width of the numeric part; longer numbers grow naturally. */
export const APPOINTMENT_REFERENCE_MIN_DIGITS = 3;

/**
 * Append-only letter-content registry. Key = content version pinned on
 * issued Appointment rows. Existing versions must never be modified in
 * place; new wording is added as a new version.
 */
export const APPOINTMENT_CONTENT_VERSIONS: Record<string, AppointmentContent> = {
  "1.0": {
    subject: "Provisional Letter of Appointment – Marketing & Customer Care Executive",
    body: [
      {
        type: "paragraph",
        text: "FinFam Multipurpose Cooperative Society Limited is pleased to offer you a provisional appointment as a Marketing & Customer Care Executive of the cooperative. You will work remotely. This appointment is provisional and is subject to the performance expectations set out in this letter.",
      },
      {
        type: "subheading",
        text: "Your role",
      },
      {
        type: "paragraph",
        text: "Your primary responsibility is to grow FinFam's community and look after the members you bring in. In particular, the role involves:",
      },
      {
        type: "list",
        items: [
          "Growing FinFam's community.",
          "Onboarding new members.",
          "Guiding members on how FinFam works.",
          "Supporting members as they save and participate.",
          "Operating in line with FinFam's mission.",
        ],
      },
      {
        type: "subheading",
        text: "Compensation and incentive policy",
      },
      {
        type: "paragraph",
        text: "Your monthly earnings follow one formula:",
      },
      {
        type: "paragraph",
        text: "Monthly Earnings = Established Members × ₦650 + Applicable Target Bonus.",
      },
      {
        type: "paragraph",
        text: "A member qualifies as an Established Member when, during their first month, they complete all three of the following:",
      },
      {
        type: "list",
        items: [
          "Membership signup.",
          "A first deposit.",
          "Savings of not less than ₦5,000 maintained during their first month.",
        ],
      },
      {
        type: "paragraph",
        text: "The applicable target bonus is set by how many Established Members you have in the month:",
      },
      {
        type: "list",
        items: [
          "0–99 Established Members — ₦0 target bonus.",
          "100–199 Established Members — ₦10,000 target bonus.",
          "200 or more Established Members — ₦20,000 target bonus.",
        ],
      },
      {
        type: "alert",
        tone: "accent",
        title: "Bonuses are not cumulative — one tier applies per month",
        text: "For example: 100 Established Members = ₦75,000 (100 × ₦650 + ₦10,000); 200 Established Members = ₦150,000 (200 × ₦650 + ₦20,000); 300 Established Members = ₦215,000 (300 × ₦650 + ₦20,000).",
      },
      {
        type: "paragraph",
        text: "Your monthly target is 200 Established Members. The target is not an earning ceiling — every Established Member above 200 continues to attract ₦650.",
      },
      {
        type: "paragraph",
        text: "Monthly earnings are paid at month end, or no later than the first week of the following month.",
      },
      {
        type: "subheading",
        text: "Your referral link",
      },
      {
        type: "paragraph",
        text: "You must use your referral link when bringing members to FinFam. The link is how the members you bring in are tracked; the link itself does not generate commission — your earnings come from your Established Members, as set out above.",
      },
      {
        type: "subheading",
        text: "Member privacy and professional conduct",
      },
      {
        type: "paragraph",
        text: "You must never request a member's account balances or login details. You are also expected to uphold the professional standards already set out in your Responsibility & Reward Agreement, including honest representation of FinFam and careful protection of member information.",
      },
      {
        type: "subheading",
        text: "Community impact",
      },
      {
        type: "paragraph",
        text: "The role supports responsible financial habits, community growth and meaningful member impact. Your performance is about more than raw registration numbers — the quality of the members you bring in and the value they actually receive matter.",
      },
      {
        type: "subheading",
        text: "Annual recognition",
      },
      {
        type: "paragraph",
        text: "Annual recognition and rewards become applicable from December 2026. Top performers and community builders may be eligible, and further details will be communicated to you before then.",
      },
      {
        type: "subheading",
        text: "Provisional appointment",
      },
      {
        type: "paragraph",
        text: "This appointment is provisional and subject to performance review. Confirmation is expected in December 2026 upon meeting the required expectations; those expectations will be communicated to you by FinFam.",
      },
    ],
  },
  "1.1": {
    subject: "Provisional Letter of Appointment – Marketing & Customer Care Executive",
    body: [
      {
        type: "paragraph",
        text: "FinFam Multipurpose Cooperative Society Limited is pleased to offer you a provisional appointment as a Marketing & Customer Care Executive of the cooperative. You will work remotely. This appointment is provisional and is subject to the performance expectations set out in this letter.",
      },
      {
        type: "subheading",
        text: "Your role",
      },
      {
        type: "paragraph",
        text: "Your primary responsibility is to grow FinFam's community and look after the members you bring in. In particular, the role involves:",
      },
      {
        type: "list",
        items: [
          "Growing FinFam's community.",
          "Onboarding new members.",
          "Guiding members on how FinFam works.",
          "Supporting members as they save and participate.",
          "Operating in line with FinFam's mission.",
        ],
      },
      {
        type: "subheading",
        text: "Compensation and incentive policy",
      },
      {
        type: "paragraph",
        text: "Your monthly earnings follow one formula:",
      },
      {
        type: "paragraph",
        text: "Monthly Earnings = Established Members × ₦650 + Applicable Target Bonus.",
      },
      {
        type: "paragraph",
        text: "A member qualifies as an Established Member when, during their first month, they complete all three of the following:",
      },
      {
        type: "list",
        items: [
          "Membership signup.",
          "A first deposit.",
          "Savings of not less than ₦5,000 maintained during their first month.",
        ],
      },
      {
        type: "subheading",
        text: "3. MILESTONE BONUSES",
      },
      {
        type: "paragraph",
        text: "Bonuses are progressive by achievement level and are not cumulative. You qualify for only one bonus tier per month.",
      },
      {
        type: "paragraph",
        text: "Established Members and Applicable Bonus",
      },
      {
        type: "list",
        items: [
          "Established Members: 0–99 — Applicable Bonus: ₦0",
          "Established Members: 100–199 — Applicable Bonus: ₦10,000",
          "Established Members: 200 and above — Applicable Bonus: ₦20,000",
        ],
      },
      {
        type: "subheading",
        text: "Earnings Examples",
      },
      {
        type: "list",
        items: [
          "100 Members: 100 × ₦650 + ₦10,000 = ₦75,000",
          "200 Members: 200 × ₦650 + ₦20,000 = ₦150,000",
          "300 Members: 300 × ₦650 + ₦20,000 = ₦215,000",
        ],
      },
      {
        type: "paragraph",
        text: "Your monthly target is 200 Established Members. The target is not an earning ceiling — every Established Member above 200 continues to attract ₦650.",
      },
      {
        type: "paragraph",
        text: "Monthly earnings are paid at month end, or no later than the first week of the following month.",
      },
      {
        type: "subheading",
        text: "Your referral link",
      },
      {
        type: "paragraph",
        text: "You must use your referral link when bringing members to FinFam. The link is how the members you bring in are tracked; the link itself does not generate commission — your earnings come from your Established Members, as set out above.",
      },
      {
        type: "subheading",
        text: "Member privacy and professional conduct",
      },
      {
        type: "paragraph",
        text: "You must never request a member's account balances or login details. You are also expected to uphold the professional standards already set out in your Responsibility & Reward Agreement, including honest representation of FinFam and careful protection of member information.",
      },
      {
        type: "subheading",
        text: "Community impact",
      },
      {
        type: "paragraph",
        text: "The role supports responsible financial habits, community growth and meaningful member impact. Your performance is about more than raw registration numbers — the quality of the members you bring in and the value they actually receive matter.",
      },
      {
        type: "subheading",
        text: "Annual recognition",
      },
      {
        type: "paragraph",
        text: "Annual recognition and rewards become applicable from December 2026. Top performers and community builders may be eligible, and further details will be communicated to you before then.",
      },
      {
        type: "subheading",
        text: "Provisional appointment",
      },
      {
        type: "paragraph",
        text: "This appointment is provisional and subject to performance review. Confirmation is expected in December 2026 upon meeting the required expectations; those expectations will be communicated to you by FinFam.",
      },
    ],
  },
  "1.2": {
    subject: "Provisional Letter of Appointment – Marketing & Customer Care Executive",
    body: [
      {
        type: "paragraph",
        text: "FinFam Multipurpose Cooperative Society Limited is pleased to offer you a provisional appointment as a Marketing & Customer Care Executive of the cooperative. This appointment is provisional and is subject to the performance expectations set out in this letter.",
      },
      {
        type: "subheading",
        text: "Your role",
      },
      {
        type: "paragraph",
        text: "Your primary responsibility is to grow FinFam's community and look after the members you bring in. In particular, the role involves:",
      },
      {
        type: "list",
        items: [
          "Growing FinFam's community.",
          "Onboarding new members.",
          "Guiding members on how FinFam works.",
          "Supporting members as they save and participate.",
          "Operating in line with FinFam's mission.",
        ],
      },
      {
        type: "subheading",
        text: "Compensation and incentive policy",
      },
      {
        type: "paragraph",
        text: "Your monthly earnings follow one formula:",
      },
      {
        type: "paragraph",
        text: "Monthly Earnings = Established Members × ₦650 + Applicable Target Bonus.",
      },
      {
        type: "paragraph",
        text: "A member qualifies as an Established Member when, during their first month, they complete all three of the following:",
      },
      {
        type: "list",
        items: [
          "Membership signup.",
          "A first deposit.",
          "Savings of not less than ₦5,000 maintained during their first month.",
        ],
      },
      {
        type: "subheading",
        text: "3. MILESTONE BONUSES",
      },
      {
        type: "paragraph",
        text: "Bonuses are progressive by achievement level and are not cumulative. You qualify for only one bonus tier per month.",
      },
      {
        type: "paragraph",
        text: "Established Members and Applicable Bonus",
      },
      {
        type: "list",
        items: [
          "Established Members: 0–99 — Applicable Bonus: ₦0",
          "Established Members: 100–199 — Applicable Bonus: ₦10,000",
          "Established Members: 200 and above — Applicable Bonus: ₦20,000",
        ],
      },
      {
        type: "subheading",
        text: "Earnings Examples",
      },
      {
        type: "list",
        items: [
          "100 Members: 100 × ₦650 + ₦10,000 = ₦75,000",
          "200 Members: 200 × ₦650 + ₦20,000 = ₦150,000",
          "300 Members: 300 × ₦650 + ₦20,000 = ₦215,000",
        ],
      },
      {
        type: "paragraph",
        text: "Your monthly target is 200 Established Members. The target is not an earning ceiling — every Established Member above 200 continues to attract ₦650.",
      },
      {
        type: "paragraph",
        text: "Monthly earnings are paid at month end, or no later than the first week of the following month.",
      },
      {
        type: "subheading",
        text: "Your referral link",
      },
      {
        type: "paragraph",
        text: "You must use your referral link when bringing members to FinFam. The link is how the members you bring in are tracked; the link itself does not generate commission — your earnings come from your Established Members, as set out above.",
      },
      {
        type: "subheading",
        text: "Member privacy and professional conduct",
      },
      {
        type: "paragraph",
        text: "You must never request a member's account balances or login details. You are also expected to uphold the professional standards already set out in your Responsibility & Reward Agreement, including honest representation of FinFam and careful protection of member information.",
      },
      {
        type: "subheading",
        text: "Community impact",
      },
      {
        type: "paragraph",
        text: "The role supports responsible financial habits, community growth and meaningful member impact. Your performance is about more than raw registration numbers — the quality of the members you bring in and the value they actually receive matter.",
      },
      {
        type: "subheading",
        text: "Annual recognition",
      },
      {
        type: "paragraph",
        text: "Annual recognition and rewards become applicable from December 2026. Top performers and community builders may be eligible, and further details will be communicated to you before then.",
      },
      {
        type: "subheading",
        text: "Provisional appointment",
      },
      {
        type: "paragraph",
        text: "This appointment is provisional and subject to performance review. Confirmation is expected in December 2026 upon meeting the required expectations; those expectations will be communicated to you by FinFam.",
      },
    ],
  },
};

/**
 * Resolve letter content for a pinned version. Returns null when the
 * version is not in the registry — callers must treat that as an
 * integrity failure (never fall back to the current pointer).
 */
export function getAppointmentContent(
  version: string,
): AppointmentContent | null {
  return APPOINTMENT_CONTENT_VERSIONS[version] ?? null;
}
