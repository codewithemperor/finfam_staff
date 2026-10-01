/**
 * FinFam Staff Orientation Workshop (FSOW) — stage content.
 *
 * Single source of truth for orientation sections: ids (also used as URL
 * slugs and persisted in the database), titles, and the content blocks each
 * section renders. Candidate *progress* lives in the database; this file is
 * only content.
 *
 * Rules for this file (see the stage brief):
 * - Direct, human sentences. No marketing copy, no invented corporate claims.
 * - Reward figures and the Established Member threshold are NOT published in
 *   orientation. Candidates receive the confirmed structure later in the
 *   recruitment process.
 * - The fraud section is serious policy content, presented calmly.
 */

export type OrientationBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  /**
   * Persistent, important context rendered as a HeroUI Alert. Used sparingly:
   * deferred reward details (section 5) and the fraud policy (section 8).
   */
  | { type: "alert"; tone: "accent" | "warning"; title: string; text: string };

export interface OrientationSection {
  /** Stable id — URL slug and the value persisted in orientation_sections. */
  id: string;
  title: string;
  /** One-line description shown in the overview section list. */
  summary: string;
  /** "In this section" — the points a candidate should take away. */
  keyPoints: string[];
  blocks: OrientationBlock[];
}

export const ORIENTATION_SECTIONS: OrientationSection[] = [
  {
    id: "about-finfam",
    title: "About FinFam",
    summary: "What FinFam is and why it exists.",
    keyPoints: [
      "FINFAM means Financially Blessed Family",
      "A government-registered digital cooperative ecosystem",
      "Built to help people save, grow and prosper",
      "You are part of the support system members rely on",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "FINFAM means Financially Blessed Family. It is a government-registered digital cooperative ecosystem built around one purpose: helping individuals, families, entrepreneurs and businesses save, grow and prosper.",
      },
      { type: "heading", text: "What FinFam exists to do" },
      {
        type: "list",
        items: [
          "Save — members set money aside regularly, through structured savings instead of saving only what is left over.",
          "Grow — members work towards growth over time through the opportunities the ecosystem provides.",
          "Prosper — the long-term goal: financial stability that members can sustain and pass on to their families.",
        ],
      },
      { type: "heading", text: "What this means for members" },
      {
        type: "paragraph",
        text: "FinFam operates as a community. Members join to build better financial habits with support from other members and from FinFam staff. As a staff member, you are part of that support system — for many members, you are the person they will actually deal with.",
      },
      {
        type: "paragraph",
        text: "Because FinFam is a registered cooperative, members trust it with their money and their personal information. Everything else in this workshop — your role, the standards, the rules — exists to protect that trust.",
      },
    ],
  },
  {
    id: "products-services",
    title: "Products & services",
    summary: "The services members use — and how to talk about them.",
    keyPoints: [
      "Structured savings are the core service",
      "Support and growth opportunities exist for members",
      "A member community holds the ecosystem together",
      "Represent products exactly as FinFam defines them",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "FinFam provides members with a small set of connected services. You do not need to master every detail today — training will go deeper — but you should understand what FinFam offers before you explain it to anyone.",
      },
      { type: "heading", text: "Structured savings" },
      {
        type: "paragraph",
        text: "The core of FinFam. Members save towards their goals on a regular schedule. Consistency is what makes it work, and helping members stay consistent is a big part of your job (you will see this again in the next section).",
      },
      { type: "heading", text: "Financial support opportunities" },
      {
        type: "paragraph",
        text: "FinFam provides opportunities for members to receive financial support. The conditions for support are set out in FinFam's member policies — as staff, never promise an amount, a timeline or an outcome you have not had confirmed.",
      },
      { type: "heading", text: "Growth opportunities" },
      {
        type: "paragraph",
        text: "Ways for members to grow what they set aside over time. The details and conditions are published by FinFam and may change, so always point members to the current, official information rather than quoting from memory.",
      },
      { type: "heading", text: "Member community" },
      {
        type: "paragraph",
        text: "Members are part of a community that encourages consistent saving and supports one another. Much of your work will happen inside this community — building it, serving it and keeping it healthy.",
      },
      {
        type: "paragraph",
        text: "One rule applies to every service: represent it exactly as FinFam defines it. If you are not sure what to tell a member, ask rather than guess.",
      },
    ],
  },
  {
    id: "your-role",
    title: "Your role",
    summary: "What a Marketing & Customer Care Executive actually does.",
    keyPoints: [
      "Your role: Marketing & Customer Care Executive",
      "Four responsibilities: community, savings consistency, customer care, member support",
      "You are often the human face of FinFam",
      "These responsibilities are how your work is evaluated",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "Your role is Marketing & Customer Care Executive. In practice the work has four parts, and most days you will do some combination of them.",
      },
      { type: "heading", text: "Community building" },
      {
        type: "paragraph",
        text: "You build and maintain a strong member network. That means reaching new members, keeping in touch with existing ones, and being a consistent, recognisable presence in your community.",
      },
      { type: "heading", text: "Savings consistency" },
      {
        type: "paragraph",
        text: "You support members in maintaining consistent savings habits. A member who saves small amounts regularly gets far more from FinFam than one who saves once and stops. Helping members stay consistent is one of the most valuable things you do.",
      },
      { type: "heading", text: "Customer care" },
      {
        type: "paragraph",
        text: "You support members and respond professionally to questions and concerns. You are not expected to have every answer memorised — but you are expected to respond politely and promptly, give honest answers, and follow up until a question is resolved.",
      },
      { type: "heading", text: "Member support" },
      {
        type: "paragraph",
        text: "You help members understand and navigate the FinFam experience — how savings work, where to find information, what to do when something is unclear. For most members, you are the human face of FinFam.",
      },
      {
        type: "paragraph",
        text: "These four responsibilities are the basis of how your work is understood and evaluated. The monitoring section later in this workshop explains what that looks like.",
      },
    ],
  },
  {
    id: "support-package",
    title: "Your support package",
    summary: "The tools and materials FinFam provides to help you work.",
    keyPoints: [
      "Identity Card — confirms you represent FinFam",
      "Branded shirt design for official activities",
      "Customisable marketing flyers",
      "Orientation and training resources",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "FinFam supports you with practical working materials. As a team member you are provided with the following:",
      },
      {
        type: "list",
        items: [
          "Identity Card — confirms you represent FinFam. Keep it with you when working, never lend it out, and never use it for anything outside your role.",
          "Branded shirt design — a recognisable shirt design for official activities, so members can identify FinFam staff.",
          "Customisable marketing flyers — ready-made flyer designs you can personalise with your own details when promoting FinFam in your community.",
          "Orientation and training resources — materials like this workshop, plus ongoing training, to keep your knowledge current.",
        ],
      },
      {
        type: "paragraph",
        text: "These items are tools for your work. Use them as provided — do not alter official designs or create your own materials claiming to represent FinFam.",
      },
    ],
  },
  {
    id: "reward-structure",
    title: "Reward structure",
    summary: "How rewards work — and when the confirmed structure is shared.",
    keyPoints: [
      "Rewards are attached to the responsibilities of the role",
      "Figures and thresholds are shared later in the recruitment process",
      "The confirmed structure arrives in writing before acceptance",
      "Your written agreement is what counts",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "FinFam staff are rewarded for the work they do. How rewards are calculated, and what qualifies you for them, is set out in the Responsibility & Reward Agreement — a document you receive at the offer stage, before you commit to anything.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Review the confirmed structure later",
        text: "The exact reward amount to earn and the savings threshold to become an Established Member will be shared with you in subsequent sections. This orientation does not publish figures, and no figure you may have seen elsewhere should be treated as final. You will receive the confirmed structure through this recruitment process before you are asked to accept any offer.",
      },
      {
        type: "paragraph",
        text: "What you can rely on today: the role carries real, measurable responsibilities, and the reward structure attached to them will be clearly documented before you accept it. If anyone quotes you figures that differ from your written agreement, the written agreement is what counts.",
      },
    ],
  },
  {
    id: "professional-standards",
    title: "Professional standards",
    summary: "The conduct expected from every FinFam team member.",
    keyPoints: [
      "Professional communication in every interaction",
      "Accurate reporting and personal accountability",
      "Member information is protected, always",
      "Represent products truthfully — no exaggeration",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "Every FinFam team member works to the same professional standards. These are conditions of the role, not suggestions.",
      },
      {
        type: "list",
        items: [
          "Communicate professionally — polite, clear and honest in every member interaction, on every channel.",
          "Take customer care seriously — respond promptly and follow up until questions and concerns are resolved.",
          "Report accurately — your reports must reflect what actually happened, including when the numbers are low.",
          "Stay accountable — you are responsible for your own activity, and for raising problems early rather than hiding them.",
          "Protect member information — member details are used for FinFam business only, never shared or used outside your role.",
          "Follow FinFam policies — apply policies and processes exactly as written, including updates as they are issued.",
          "Represent products truthfully — describe FinFam products and services exactly as they are. Never exaggerate, never promise outcomes, never leave out conditions to close a sale.",
        ],
      },
    ],
  },
  {
    id: "monitoring-accountability",
    title: "Monitoring & accountability",
    summary: "How your work is measured, and how policy updates reach you.",
    keyPoints: [
      "Daily reporting is part of the routine",
      "Performance is evaluated regularly",
      "Service quality may be checked with secret shoppers",
      "Policies get updated — review and apply them",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "Your work as a staff member is measurable, and FinFam measures it. This section explains what that means in practice. It is a normal part of a professional role — not a sign of distrust.",
      },
      { type: "heading", text: "How performance is monitored" },
      {
        type: "list",
        items: [
          "Daily reporting — you report your activity and results as part of your routine work.",
          "Evaluation — your activity, your reporting accuracy and the quality of your member care are reviewed regularly.",
          "Secret shoppers — from time to time FinFam checks service quality by having people interact with staff as ordinary members. These checks are anonymous and used for evaluation.",
        ],
      },
      {
        type: "paragraph",
        text: "Monitoring exists because FinFam is trusted with members' money. Consistent, accurate and honest work is what keeps that trust — and it is exactly what evaluation looks for.",
      },
      { type: "heading", text: "Policy updates" },
      {
        type: "paragraph",
        text: "FinFam's policies and operational guidelines are updated from time to time — for example when products, processes or requirements change. Updates are communicated through official FinFam channels.",
      },
      {
        type: "paragraph",
        text: "As a staff member you are expected to review updates and apply them from the moment they take effect. If an update is unclear, ask before you act rather than continuing with an outdated version.",
      },
    ],
  },
  {
    id: "fraud-misrepresentation",
    title: "Fraud & misrepresentation",
    summary: "Conduct that ends engagement with FinFam — read carefully.",
    keyPoints: [
      "No fake accounts, false reports or fabricated activity",
      "No misrepresenting products to members",
      "No misuse of member information or account access",
      "Violations end engagement with FinFam",
    ],
    blocks: [
      {
        type: "paragraph",
        text: "This is the most serious section of the workshop. Fraud or misrepresentation in any form ends a staff member's engagement with FinFam.",
      },
      {
        type: "alert",
        tone: "warning",
        title: "Prohibited conduct",
        text: "The conduct listed below is treated as fraud against FinFam and its members and leads to dismissal. There is no acceptable version of it.",
      },
      { type: "heading", text: "You must never" },
      {
        type: "list",
        items: [
          "Create fake accounts, or register members who do not exist or did not agree to join.",
          "Submit false reports — including inflated numbers or activity that did not happen.",
          "Misrepresent FinFam products or services — what they do, what they cost, or what they guarantee.",
          "Misuse member information — share it, use it for yourself, or use it beyond the purpose the member gave it for.",
          "Misuse passwords or account access — your own or a member's.",
          "Fabricate activity or performance — including arranging artificial member behaviour to create results.",
        ],
      },
      {
        type: "paragraph",
        text: "If you are ever unsure whether something is acceptable, stop and ask before you act. An honest mistake that is reported early is handled very differently from one that is covered up.",
      },
    ],
  },
];

export const ORIENTATION_SECTION_IDS = ORIENTATION_SECTIONS.map((s) => s.id);

export function getOrientationSection(
  id: string,
): OrientationSection | undefined {
  return ORIENTATION_SECTIONS.find((section) => section.id === id);
}

/** Copy used by the completion confirmation modal. */
export const ORIENTATION_ACKNOWLEDGEMENT_LABEL =
  "I confirm that I have read every section of this orientation and that I understand the professional standards and integrity rules expected of every FinFam team member.";
