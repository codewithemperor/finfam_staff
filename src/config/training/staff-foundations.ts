import type { TrainingCourseContent } from "@/types/staff-training";

import {
  DAILY_REPORT_CATEGORIES,
  DAILY_REPORT_SELF_REPORTED_NOTICE,
} from "@/config/daily-report";

/**
 * FinFam Staff Foundations — the ONE approved Stage 9 training course
 * (CLIENT-SAFE). Version 1.0 is built STRICTLY from already-approved
 * FinFam material (brief §4):
 *
 * - approved Staff Onboarding & Resumption content (src/config/onboarding.ts)
 * - approved FSOW Orientation (src/config/orientation.ts)
 * - approved Responsibility & Reward Agreement principles (src/config/agreement.ts)
 * - the implemented Daily Reporting definitions (src/config/daily-report.ts)
 *   — Lesson 5 imports the category labels/helpers and the self-reported
 *   notice so Training can NEVER drift from the real reporting form
 *   (brief §10).
 *
 * HARD RULES (brief §4/§12/§55): no invented product benefits, financial
 * returns, guarantees, escalation contacts, marketing claims, prospect
 * scripts, support channels, compensation interpretations or operating
 * policies. No ₦650, no commission/payroll/bonus/earnings arithmetic, no
 * quiz, no certificate. Where approved material does not support a
 * statement, the statement is absent (open items live in
 * docs/CONTENT-QUESTIONS.md).
 *
 * Lesson 5 constructs its category blocks FROM DAILY_REPORT_CATEGORIES at
 * module load — the labels and helper meanings below are literally the
 * reporting form's, by reference, not by duplication.
 */

/** Versioned registry entry — a future 2.0 would be ADDED, never replacing 1.0 (brief §23/§50). */
export const STAFF_FOUNDATIONS_VERSIONS: Record<
  string,
  TrainingCourseContent
> = {
  "1.0": {
    id: "staff-foundations",
    version: "1.0",
    title: "FinFam Staff Foundations",
    description:
      "Foundational training for representing FinFam professionally, communicating with prospects, supporting members, using approved materials, reporting your daily activity and protecting member trust.",
    required: true,
    lessons: [
      /* -------------------------------------------------------------- */
      /* Lesson 1 — Professional FinFam Representation                   */
      /* -------------------------------------------------------------- */
      {
        id: "professional-representation",
        title: "Professional FinFam Representation",
        summary: "Represent FinFam accurately and professionally.",
        blocks: [
          {
            type: "paragraph",
            text: "FinFam staff work is people work. You represent FinFam to members and prospective members, and the way you present yourself protects the trust members place in FinFam. For many members, you are the person they will actually deal with.",
          },
          {
            type: "facts",
            items: [
              { label: "Appointment designation", value: "Remote Staff" },
              {
                label: "Operational role",
                value: "FinFam Growth Ambassador",
              },
            ],
          },
          {
            type: "paragraph",
            text: "Two descriptions of your role are used, and they stand side by side — one does not replace the other. Your appointment letter carries the designation; your day-to-day work is described by the operational role.",
          },
          { type: "heading", text: "Your core responsibilities" },
          {
            type: "list",
            items: [
              "Community building — introducing FinFam to new people and helping grow the FinFam community.",
              "Supporting consistent savings — helping members start, and keep up, their savings and contributions.",
              "Building strong member relationships — staying in regular, respectful contact with the members you serve.",
              "Customer care and member support — answering questions accurately and helping members resolve issues.",
            ],
          },
          { type: "heading", text: "Represent FinFam professionally" },
          {
            type: "list",
            items: [
              "Communicate professionally — polite, clear and honest in every member interaction, on every channel.",
              "Give clear and accurate information — describe FinFam exactly as it is.",
              "Take customer care seriously — respond promptly and follow up until questions and concerns are resolved.",
              "Maintain member trust — your professionalism, consistency and commitment are part of what members rely on.",
            ],
          },
          {
            type: "alert",
            tone: "accent",
            title: "Accuracy over enthusiasm",
            text: "Never misrepresent FinFam products or services. Never exaggerate, never promise outcomes and never over-promise to close a conversation. Represent FinFam truthfully in every interaction.",
          },
          {
            type: "paragraph",
            text: "These standards are conditions of the role, not suggestions. They protect members, protect you and protect FinFam.",
          },
        ],
      },

      /* -------------------------------------------------------------- */
      /* Lesson 2 — Communicating With Prospects                         */
      /* -------------------------------------------------------------- */
      {
        id: "communicating-with-prospects",
        title: "Communicating With Prospects",
        summary:
          "Introduce FinFam respectfully and honestly — never with pressure.",
        blocks: [
          {
            type: "paragraph",
            text: "Introducing FinFam to new people is a core part of your role — and it is done respectfully, accurately and without pressure, whether you are speaking with one person or with a group.",
          },
          { type: "heading", text: "Approaching people respectfully" },
          {
            type: "list",
            items: [
              "Approach individuals and groups politely, and respect it when someone is not interested.",
              "Introduce FinFam accurately — what it is and what it offers, exactly as FinFam defines it.",
              "Answer questions honestly. If you do not know an answer, say so and ask for guidance rather than guessing.",
              "Follow up professionally — keep your contact respectful, clear and welcome.",
            ],
          },
          {
            type: "alert",
            tone: "warning",
            title: "Never promise what you cannot confirm",
            text: "Never apply pressure. Never give guarantees. Never invent financial-return claims. Never promise an amount, a timeline or an outcome you have not had confirmed in writing.",
          },
          { type: "heading", text: "When you are unsure" },
          {
            type: "paragraph",
            text: "Point people to current, official FinFam information rather than quoting from memory, and ask for guidance through your approved FinFam channels rather than guessing. An accurate \u201cI will confirm that for you\u201d protects the person you are speaking with, and it protects you.",
          },
          {
            type: "paragraph",
            text: "This lesson teaches principles, not a script. Speak in your own words within these principles — never present invented claims, invented benefits or invented promises as FinFam's.",
          },
        ],
      },

      /* -------------------------------------------------------------- */
      /* Lesson 3 — Supporting FinFam Members                            */
      /* -------------------------------------------------------------- */
      {
        id: "supporting-members",
        title: "Supporting FinFam Members",
        summary:
          "Support members professionally and protect their information.",
        blocks: [
          {
            type: "paragraph",
            text: "Supporting members well is at the heart of the Growth Ambassador role. Most days you will be helping people start, understand and stay consistent with FinFam.",
          },
          { type: "heading", text: "How you support members" },
          {
            type: "list",
            items: [
              "Supporting registration appropriately — help new members register in their own name, with their own knowledge and consent.",
              "Supporting first-deposit journeys — help members make their first deposit and understand what happens next.",
              "Encouraging consistent saving habits — a member who saves regularly gets far more from FinFam than one who saves once and stops.",
              "Member engagement — stay in regular, respectful contact with the members you serve.",
              "Helping members understand approved FinFam processes — point members to current, official information rather than quoting from memory.",
            ],
          },
          { type: "heading", text: "Professional support" },
          {
            type: "paragraph",
            text: "You are not expected to have every answer memorised — but you are expected to respond politely and promptly, give honest answers and follow up until a question is resolved. When a question is beyond what you know, escalate it for guidance rather than inventing an answer.",
          },
          {
            type: "alert",
            tone: "warning",
            title: "Protect member account information",
            text: "Never request a member's login credentials. Never request account details you do not need for a legitimate FinFam purpose. Never request a member's account balances.",
          },
        ],
      },

      /* -------------------------------------------------------------- */
      /* Lesson 4 — Using Approved Marketing Materials                   */
      /* -------------------------------------------------------------- */
      {
        id: "approved-materials",
        title: "Using Approved Marketing Materials",
        summary: "Use only approved FinFam materials, as provided.",
        blocks: [
          {
            type: "paragraph",
            text: "FinFam provides working materials so that members and prospects receive official, accurate information. Using them correctly is part of protecting FinFam's approved representation.",
          },
          { type: "heading", text: "Using approved materials" },
          {
            type: "list",
            items: [
              "Use approved FinFam materials — the identity card, branded shirt design, customisable marketing flyers and the approved marketing guidelines.",
              "Use ready-made designs as provided, personalising them only the way FinFam allows.",
              "Do not improperly alter official designs.",
              "Do not create your own materials claiming to represent FinFam.",
              "Use resources supplied through approved FinFam channels — official materials reach you through your approved staff communication/onboarding channel.",
            ],
          },
          {
            type: "paragraph",
            text: "The Staff Resources page lists the resource categories FinFam provides. Training explains their correct use; Resources is where supplied materials are listed when they are available.",
          },
        ],
        relatedLinks: [
          { href: "/staff/resources", label: "Open Staff Resources" },
        ],
      },

      /* -------------------------------------------------------------- */
      /* Lesson 5 — Daily Reporting & Accountability                     */
      /*                                                                 */
      /* Category labels, helper meanings and the self-reported notice   */
      /* are IMPORTED from src/config/daily-report.ts — Training and the */
      /* reporting form cannot drift apart (brief §10).                  */
      /* -------------------------------------------------------------- */
      {
        id: "daily-reporting",
        title: "Daily Reporting & Accountability",
        summary: "Submit an honest Daily Report every working day.",
        blocks: [
          {
            type: "paragraph",
            text: "Your work is accountable. Each working day you submit one Daily Report in the Staff Portal covering four categories:",
          },
          ...DAILY_REPORT_CATEGORIES.flatMap((category) => [
            { type: "heading" as const, text: category.legend },
            {
              type: "list" as const,
              items: category.fields.map(
                (field) => `${field.label} — ${field.helper}`,
              ),
            },
          ]),
          { type: "heading", text: "How daily reporting works" },
          {
            type: "list",
            items: [
              "One Daily Report per staff member per calendar date (Africa/Lagos).",
              "Counts are whole numbers — enter what actually happened.",
              "An all-zero report is acceptable — report honestly, including on quiet days.",
              "An optional activity summary can capture context the counts cannot.",
              "Save Draft keeps a working copy; Review & Submit finalises it.",
              "A submitted report is permanently read-only — it cannot be edited or deleted.",
              "You may report for today or backdate up to 7 days.",
              "There is currently no clock deadline for submitting your report.",
              "A submission receipt is sent to your registered email address.",
              "You submit your report under Staff Portal \u2192 Daily Reports.",
            ],
          },
          {
            type: "alert",
            tone: "accent",
            title: "Self-reported activity",
            text: DAILY_REPORT_SELF_REPORTED_NOTICE,
          },
          {
            type: "paragraph",
            text: "These figures are your own reported activity — accurate reporting is part of professional accountability, and your report must reflect what actually happened.",
          },
        ],
        relatedLinks: [{ href: "/staff/reports", label: "Open Daily Reports" }],
      },

      /* -------------------------------------------------------------- */
      /* Lesson 6 — Privacy, Conduct & Fraud Prevention                  */
      /* -------------------------------------------------------------- */
      {
        id: "privacy-conduct-fraud",
        title: "Privacy, Conduct & Fraud Prevention",
        summary: "Honest reporting, member privacy and professional conduct.",
        blocks: [
          {
            type: "paragraph",
            text: "This lesson covers the standards that protect members, protect you and protect FinFam. It summarises the principles you already accepted in your Responsibility & Reward Agreement and your orientation — the Agreement remains the authoritative document.",
          },
          { type: "heading", text: "Honest reporting" },
          {
            type: "list",
            items: [
              "Report accurately — your Daily Report must reflect what actually happened.",
              "Never fabricate Daily Report activity — no inflated numbers and no activity that did not happen.",
              "Never create fake accounts, and never register members without their knowledge and consent.",
              "Never misrepresent FinFam products, services or outcomes.",
            ],
          },
          { type: "heading", text: "Member privacy" },
          {
            type: "list",
            items: [
              "Use member information only for legitimate FinFam purposes.",
              "Never share member information with anyone who should not have it.",
              "Never request login credentials, unnecessary account details or account balances.",
              "Use approved communication practices in every member interaction.",
            ],
          },
          { type: "heading", text: "Professional conduct" },
          {
            type: "list",
            items: [
              "Communicate politely, clearly and honestly on every channel.",
              "Follow FinFam policies and processes as they are communicated to you.",
              "Raise problems early rather than conceal them — an honest mistake reported early is handled very differently from one that is covered up.",
            ],
          },
          {
            type: "alert",
            tone: "warning",
            title: "Fraud and misrepresentation",
            text: "Fraud or misrepresentation in any form ends a staff member's engagement with FinFam. There is no acceptable version of it. If you are ever unsure whether something is acceptable, stop and ask before you act.",
          },
        ],
      },
    ],
  },
};

/** The version new enrollments pin at first open (brief §5: "1.0"). */
export const STAFF_FOUNDATIONS_CURRENT_VERSION = "1.0";
