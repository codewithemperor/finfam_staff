import "server-only";

import {
  ASSESSMENT_QUESTIONS,
  type AssessmentQuestion,
} from "@/config/assessment";

/**
 * FinFam Automated Interview Assessment — SERVER-ONLY content and policy.
 *
 * This module is guarded by `server-only`: importing it from any client
 * component fails the build instead of leaking the answer key into the
 * browser bundle. Only the assessment service (src/server/services) and
 * server route handlers may import from here.
 *
 * The client receives question text and options (src/config/assessment.ts)
 * and NOTHING else — no correct answers, no insights, no scoring metadata.
 */

export interface AssessmentQuestionKey {
  /** Index (0–3) of the correct option in the question's options array. */
  correctIndex: 0 | 1 | 2 | 3;
  /**
   * Explanation shown to the business/review tooling only — NOT returned to
   * candidates. Explanation visibility after submission is an unresolved
   * business decision (docs/CONTENT-QUESTIONS.md §8): while retakes are
   * unresolved, revealing answers could leak them across attempts.
   */
  insight: string;
}

/**
 * Answer key, aligned with ASSESSMENT_QUESTIONS by id. Every answer is
 * strictly derivable from the FinFam Staff Orientation Workshop content
 * (src/config/orientation.ts).
 */
export const ASSESSMENT_ANSWER_KEY: Record<string, AssessmentQuestionKey> = {
  "q-01": {
    correctIndex: 0,
    insight: "FINFAM means Financially Blessed Family.",
  },
  "q-02": {
    correctIndex: 1,
    insight:
      "FinFam is a government-registered digital cooperative ecosystem.",
  },
  "q-03": {
    correctIndex: 0,
    insight:
      "FinFam exists to help individuals, families, entrepreneurs and businesses save, grow and prosper.",
  },
  "q-04": {
    correctIndex: 2,
    insight:
      "Prosper is the long-term goal: financial stability that members can sustain and pass on to their families.",
  },
  "q-05": {
    correctIndex: 1,
    insight:
      "Because FinFam is a registered cooperative, members trust it with their money and their personal information.",
  },
  "q-06": {
    correctIndex: 3,
    insight: "Structured savings are the core of FinFam.",
  },
  "q-07": {
    correctIndex: 1,
    insight:
      "Members save towards their goals on a regular schedule — consistency is what makes structured savings work.",
  },
  "q-08": {
    correctIndex: 2,
    insight:
      "The conditions for financial support are set out in FinFam's member policies — never promise an amount, a timeline or an outcome you have not had confirmed.",
  },
  "q-09": {
    correctIndex: 0,
    insight:
      "Growth opportunity details are published by FinFam and may change — always point members to the current, official information rather than quoting from memory.",
  },
  "q-10": {
    correctIndex: 3,
    insight:
      "Represent every service exactly as FinFam defines it. If you are not sure what to tell a member, ask rather than guess.",
  },
  "q-11": {
    correctIndex: 1,
    insight:
      "The role is Marketing & Customer Care Executive.",
  },
  "q-12": {
    correctIndex: 2,
    insight:
      "The role is also called FinFam Growth Ambassador — it is the same role.",
  },
  "q-13": {
    correctIndex: 2,
    insight:
      "The four responsibilities are community building, savings consistency, customer care and member support.",
  },
  "q-14": {
    correctIndex: 1,
    insight:
      "A member who saves small amounts regularly gets far more from FinFam than one who saves once and stops.",
  },
  "q-15": {
    correctIndex: 3,
    insight:
      "You are not expected to have every answer memorised — you are expected to respond politely and promptly, give honest answers, and follow up until a question is resolved.",
  },
  "q-16": {
    correctIndex: 1,
    insight:
      "The professional standards are conditions of the role, not suggestions.",
  },
  "q-17": {
    correctIndex: 0,
    insight:
      "Reports must reflect what actually happened, including when the numbers are low.",
  },
  "q-18": {
    correctIndex: 3,
    insight:
      "Stay accountable: you are responsible for your own activity, and for raising problems early rather than hiding them.",
  },
  "q-19": {
    correctIndex: 0,
    insight:
      "Member details are used for FinFam business only — never shared or used outside your role.",
  },
  "q-20": {
    correctIndex: 0,
    insight:
      "Describe FinFam products and services exactly as they are. Never exaggerate, never promise outcomes, never leave out conditions to close a sale.",
  },
  "q-21": {
    correctIndex: 3,
    insight:
      "Daily reporting — you report your activity and results as part of your routine work.",
  },
  "q-22": {
    correctIndex: 0,
    insight:
      "From time to time FinFam checks service quality by having people interact with staff as ordinary members. These checks are anonymous and used for evaluation.",
  },
  "q-23": {
    correctIndex: 1,
    insight:
      "Review policy updates and apply them from the moment they take effect. If an update is unclear, ask before you act.",
  },
  "q-24": {
    correctIndex: 1,
    insight:
      "Creating fake accounts, or registering members who do not exist or did not agree to join, is treated as fraud.",
  },
  "q-25": {
    correctIndex: 2,
    insight:
      "Submitting false reports — including inflated numbers or activity that did not happen — is prohibited conduct that leads to dismissal.",
  },
  "q-26": {
    correctIndex: 3,
    insight:
      "Misrepresenting FinFam products — including promising what they do not guarantee — is prohibited.",
  },
  "q-27": {
    correctIndex: 3,
    insight:
      "Misuse of passwords or account access — your own or a member's — is prohibited conduct.",
  },
  "q-28": {
    correctIndex: 0,
    insight:
      "Fabricating activity or performance — including arranging artificial member behaviour — is fraud. There is no acceptable version of it.",
  },
  "q-29": {
    correctIndex: 1,
    insight:
      "An honest mistake that is reported early is handled very differently from one that is covered up.",
  },
  "q-30": {
    correctIndex: 1,
    insight:
      "If you are ever unsure whether something is acceptable, stop and ask before you act.",
  },
};

/**
 * Attempt policy — deliberately centralised so the final business rules can
 * be applied by changing values here, without touching the service or UI.
 *
 * The supplied material says a candidate scoring below 70% "may retry or may
 * be disqualified according to policy" — no final policy has been confirmed.
 * The interim behaviour (retakes allowed, no cap) is documented in
 * docs/CONTENT-QUESTIONS.md and is labelled "being finalised" in the UI.
 */
export const ASSESSMENT_POLICY = {
  /**
   * Whether a candidate with a failed attempt may start a new attempt.
   * When the business confirms the final policy, set this to false (or add a
   * maxAttempts cap) — the service and UI read this value.
   */
  allowRetakeAfterFailure: true,
  /**
   * Maximum number of attempts a candidate may take (including the first).
   * null = no cap implemented yet — an explicitly documented interim state,
   * NOT a confirmed business rule.
   */
  maxAttempts: null as number | null,
  /**
   * Submission rule: candidates may submit with unanswered questions; each
   * unanswered question is scored as incorrect. The confirmation modal
   * states this explicitly. Whether the business instead wants to require
   * all 30 answers is an open question (docs/CONTENT-QUESTIONS.md §7).
   */
  allowSubmissionWithUnanswered: true,
} as const;

/** Total marks available across the whole assessment. */
export const ASSESSMENT_TOTAL_MARKS = ASSESSMENT_QUESTIONS.length * 5;

/** Percentage at or above which an attempt passes. */
export const ASSESSMENT_PASS_PERCENT = 70;

/**
 * The authoritative question set in its canonical order. Attempts persist a
 * per-attempt order question-by-question, so active attempts resume without
 * reshuffling while the approved bank and answer key remain unchanged.
 */
export function getAuthoritativeQuestions(): AssessmentQuestion[] {
  return ASSESSMENT_QUESTIONS;
}

/**
 * Score a set of selected options against the answer key. Runs exclusively
 * on the server — never trust client-submitted correctness.
 */
export function scoreAttempt(
  selections: Record<string, number>,
): {
  correctCount: number;
  marksAwarded: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
} {
  let correctCount = 0;

  for (const question of ASSESSMENT_QUESTIONS) {
    const selected = selections[question.id];
    const key = ASSESSMENT_ANSWER_KEY[question.id];
    if (
      key &&
      typeof selected === "number" &&
      selected === key.correctIndex
    ) {
      correctCount += 1;
    }
  }

  const marksAwarded = correctCount * 5;
  const percentage = (marksAwarded / ASSESSMENT_TOTAL_MARKS) * 100;

  return {
    correctCount,
    marksAwarded,
    totalMarks: ASSESSMENT_TOTAL_MARKS,
    percentage,
    passed: percentage >= ASSESSMENT_PASS_PERCENT,
  };
}
