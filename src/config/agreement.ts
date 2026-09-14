import type { AgreementSection } from "@/types/recruitment";

/**
 * FinFam Responsibility & Reward Agreement — stage 3 content (CLIENT-SAFE).
 *
 * The formal agreement a candidate reviews and accepts after passing the
 * assessment. The `version` below is the content identifier recorded with
 * every acceptance (agreements.version) — a meaning-bearing change to any
 * section MUST bump the version so accepted versions stay auditable
 * (docs/CONTENT-QUESTIONS.md §17).
 *
 * v1.1 (current): compensation and Established Member definitions were
 * formally confirmed by the Provisional Letter of Appointment dated
 * September 1, 2026 (Ref: FFL/HR/PLA/012). The reward structure now
 * publishes the confirmed figures (₦650 per Established Member, the
 * ₦5,000 threshold, the non-cumulative bonus tiers, the 200-member
 * monthly target, the payment timing, the referral-link tracking rule
 * and the December 2026 annual-recognition note), a concise
 * "Important conditions" section was added from the same letter, and the
 * confirmed privacy rule was added to Professional conduct. Candidates
 * who already accepted v1.0 keep that version on their record — v1.1
 * applies to candidates who have not yet accepted
 * (docs/CONTENT-QUESTIONS.md §17 interim proposal).
 *
 * Rules for this file (see docs/CONTENT-QUESTIONS.md):
 * - Content is drawn strictly from the supplied FinFam material. No
 *   employment/legal terms are invented (§18) — the "Important conditions"
 *   section contains only terms the appointment letter confirms.
 * - No unconfirmed benefit claims (including the ₦500 cashback item, §10).
 */
export const AGREEMENT_META = {
  version: "1.1",
} as const;

/**
 * The acknowledgement the candidate must explicitly confirm before the
 * Accept action opens. Wording follows the Stage 3 brief and is flagged
 * for business approval (docs/CONTENT-QUESTIONS.md §18).
 */
export const AGREEMENT_ACKNOWLEDGEMENT_LABEL =
  "I have read and understood the Responsibility & Reward Agreement and agree to the responsibilities, support package, reward structure, reporting requirements, professional standards, and applicable policies described above.";

export const AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    id: "your-role",
    title: "Your role",
    blocks: [
      {
        type: "paragraph",
        text: "This agreement covers the Marketing & Customer Care Executive role — the FinFam Growth Ambassador role your application leads to. In this portal your application is recorded under the general title \"Staff Member\"; this agreement describes that role in full.",
      },
      {
        type: "paragraph",
        text: "It is a field and service role. You represent FinFam to members and prospective members, support their savings activity, and look after the relationships you build. The role carries real responsibilities toward the people who trust FinFam with their money.",
      },
    ],
  },
  {
    id: "responsibilities",
    title: "Responsibilities",
    blocks: [
      {
        type: "paragraph",
        text: "The responsibilities of the role are:",
      },
      {
        type: "list",
        items: [
          "Community building — introducing FinFam to new people and helping grow the FinFam community.",
          "Supporting consistent savings — helping members start, and keep up, their savings and contributions.",
          "Building strong member relationships — staying in regular, respectful contact with the members you serve.",
          "Customer care and member support — answering questions accurately and helping members resolve issues.",
        ],
      },
      {
        type: "paragraph",
        text: "These responsibilities are the core of the role, and the reward structure is attached to them. How you carry them out is covered by the professional conduct standards later in this agreement.",
      },
    ],
  },
  {
    id: "support-package",
    title: "Support package",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam provides the following support to help you carry out the role:",
      },
      {
        type: "list",
        items: [
          "A FinFam identity card confirming your role.",
          "A branded shirt design for official FinFam activities.",
          "Customizable marketing flyers you can use in your community.",
          "Orientation and training resources, including the Staff Orientation Workshop you have completed.",
        ],
      },
      {
        type: "paragraph",
        text: "If any additional support is made available, it will be communicated to you in writing.",
      },
    ],
  },
  {
    id: "reward-structure",
    title: "Reward structure",
    blocks: [
      {
        type: "paragraph",
        text: "Your monthly earnings follow one confirmed formula:",
      },
      {
        type: "paragraph",
        text: "Monthly earnings = Established Members × ₦650 + applicable target bonus.",
      },
      {
        type: "paragraph",
        text: "An Established Member is a member who, during their first month, completes all three of the following:",
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
        title: "Bonuses are not cumulative",
        text: "Only one bonus tier applies per month. For example: 100 Established Members earn ₦75,000 (100 × ₦650 + ₦10,000); 200 earn ₦150,000 (200 × ₦650 + ₦20,000); 300 earn ₦215,000 (300 × ₦650 + ₦20,000).",
      },
      {
        type: "paragraph",
        text: "The monthly target is 200 Established Members. The target is not a ceiling — every Established Member above 200 continues to earn ₦650.",
      },
      {
        type: "paragraph",
        text: "Monthly earnings are paid at month end, or at the latest during the first week of the following month.",
      },
      {
        type: "paragraph",
        text: "Your referral link is how the members you bring in are tracked. The link itself does not generate commissions — your earnings come from your Established Members, as described above.",
      },
      {
        type: "paragraph",
        text: "Year-end recognition of top performers and community builders takes effect from December 2026. Details will be communicated before it applies.",
      },
    ],
  },
  {
    id: "performance-accountability",
    title: "Performance & accountability",
    blocks: [
      {
        type: "paragraph",
        text: "The role is measured by the work you actually do:",
      },
      {
        type: "list",
        items: [
          "Daily reporting — you report your daily activity in the way FinFam requires.",
          "Monitoring and evaluation — your work may be reviewed by the recruitment or operations team.",
          "Quality monitoring — secret shopper checks may be used to verify service quality where applicable.",
          "Accountability — you are accountable for the accuracy of what you report and for the members you serve.",
        ],
      },
      {
        type: "paragraph",
        text: "These expectations exist so that members receive consistent service and FinFam can rely on what is reported. The exact reporting process and tools are communicated to you by the recruitment team.",
      },
    ],
  },
  {
    id: "important-conditions",
    title: "Important conditions",
    blocks: [
      {
        type: "paragraph",
        text: "Your participation under this agreement is provisional and subject to performance review. Confirmation is expected in December 2026, upon meeting the stated requirements; those requirements will be communicated to you by FinFam.",
      },
    ],
  },
  {
    id: "professional-conduct",
    title: "Professional conduct",
    blocks: [
      {
        type: "paragraph",
        text: "As a FinFam representative you must:",
      },
      {
        type: "list",
        items: [
          "Represent FinFam accurately and honestly at all times.",
          "Never create fake accounts or register members without their knowledge and consent.",
          "Never submit false or misleading reports.",
          "Never misuse member or customer information, and protect it from anyone who should not have it.",
          "Never request a member's account balances or login details.",
          "Never share your passwords or account access, or allow anyone else to use them.",
        ],
      },
      {
        type: "paragraph",
        text: "These standards protect members, protect you, and protect FinFam. They are conditions of the role, not suggestions — as covered in your orientation, fraud and misrepresentation lead to dismissal.",
      },
    ],
  },
  {
    id: "policy-updates",
    title: "Policy updates",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam may communicate relevant updates to its policies and processes from time to time. You are expected to follow the current, approved policies as they are communicated to you.",
      },
    ],
  },
];
