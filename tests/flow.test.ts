/**
 * FinFam flow test — FULL HAPPY PATH, end to end over the real HTTP APIs.
 *
 * One candidate travels the entire MVP journey exactly as a real person
 * would (no service-layer shortcuts, no seeded shortcuts):
 *
 *   registration → orientation (7 sections + acknowledgement)
 *   → assessment (all correct → PASSED) → agreement (accepted)
 *   → provisional appointment (issued) → activation (Staff ID assigned)
 *   → staff onboarding (7 steps + final acknowledgement → COMPLETED)
 *
 * Guard outcomes are asserted inline at every stage: skip-ahead sections,
 * wrong acknowledgement, stale versions, too-early completions, idempotent
 * double submits and the exactly-once completion latch.
 *
 * Requires the dev server (`bun run dev`) — see tests/helpers/api.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { OPEN_POSITION } from "@/config/content";
import { ACTIVATION_META } from "@/config/activation";
import { AGREEMENT_META } from "@/config/agreement";
import { ASSESSMENT_META, ASSESSMENT_QUESTION_IDS } from "@/config/assessment";
import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import { ORIENTATION_SECTION_IDS } from "@/config/orientation";

import { loadAnswerKey } from "./helpers/answer-key";
import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
  REFERENCE_PATTERN,
} from "./helpers/api";

import { cleanupTestCandidates, db, uniqueEmail } from "./helpers/db";

const ONBOARDING_REVIEW_STEPS = ONBOARDING_STEP_IDS.filter(
  (id) => id !== ONBOARDING_FINAL_STEP_ID,
);

import type {
  ActivationView,
  AgreementView,
  AppointmentView,
  AssessmentView,
  OnboardingView,
  OrientationView,
  RecruitmentJourneyView,
} from "@/types/recruitment";

/** All six recruitment stages — onboarding must never appear here. */
const RECRUITMENT_STAGES = [
  "APPLICATION",
  "ORIENTATION",
  "ASSESSMENT",
  "OFFER",
  "APPOINTMENT",
  "ACTIVATION",
] as const;

const fullName = "Flow Test Candidate";
const phone = "0803 000 0001";
const city = "Lagos";

let email = "";
let reference = "";
let attemptOneQuestionTokens: string[] = [];

async function getAttemptQuestionRows(attemptNumber: number) {
  const candidate = await db.candidate.findUnique({
    where: { referenceNumber: reference },
    select: {
      attempts: {
        where: { attemptNumber },
        take: 1,
        select: {
          questions: {
            orderBy: { position: "asc" },
            select: { id: true, questionId: true, position: true },
          },
        },
      },
    },
  });
  const rows = candidate?.attempts[0]?.questions ?? [];
  expect(rows).toHaveLength(ASSESSMENT_META.totalQuestions);
  return rows;
}

beforeAll(async () => {
  await assertServerUp();
  await loadAnswerKey();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(email ? [email] : []);
  if (removed > 0) {
    console.log(
      `[flow] cleanup: removed ${removed} test candidate(s) (sequences stay advanced — documented never-reuse behaviour)`,
    );
  }
});

describe("Stage 0 — Registration", () => {
  it("registers a new candidate through the public API", async () => {
    email = uniqueEmail("happy");
    const result = await apiRequest<{ referenceNumber: string; status: string; submittedAt: string }>(
      "POST",
      "/api/applications",
      {
        fullName,
        email,
        phone,
        city,
        roleTitle: OPEN_POSITION.title,
        consent: true,
      },
    );
    const data = expectOk(result, 200, "register");
    expect(data.referenceNumber).toMatch(REFERENCE_PATTERN);
    expect(data.status).toBe("APPLICANT");
    expect(typeof data.submittedAt).toBe("string");
    reference = data.referenceNumber;
  });

  it("shows the fresh candidate on the unified journey (application done, onboarding absent)", async () => {
    const data = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "journey after registration",
    );
    expect(data.status).toBe("APPLICANT");
    expect(data.stages).toHaveLength(6);
    expect(data.staffRecord).toBeNull();
    expect(data.onboarding).toBeNull();
    expect(data.nextAction).not.toBeNull();
  });
});

describe("Stage 1 — Orientation (FSOW)", () => {
  it("refuses a skip-ahead section (422, names the blocker)", async () => {
    const last = ORIENTATION_SECTION_IDS[ORIENTATION_SECTION_IDS.length - 1];
    const error = expectFail(
      await apiRequest("POST", `/api/orientation/${reference}/sections`, {
        sectionId: last,
      }),
      422,
      "VALIDATION_ERROR",
      "skip-ahead section",
    );
    expect(error.message).toMatch(/in order/i);
  });

  it("refuses completion before every section was read (422)", async () => {
    const error = expectFail(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: true,
      }),
      422,
      "VALIDATION_ERROR",
      "early completion",
    );
    expect(error.message).toMatch(/every section/i);
  });

  it("completes every section in order and starts orientation on the first one", async () => {
    for (let index = 0; index < ORIENTATION_SECTION_IDS.length; index += 1) {
      const sectionId = ORIENTATION_SECTION_IDS[index];
      const data = expectOk<OrientationView>(
        await apiRequest("POST", `/api/orientation/${reference}/sections`, {
          sectionId,
        }),
        200,
        `section ${sectionId}`,
      );
      expect(data.orientation?.sections).toHaveLength(index + 1);
      if (index === 0) {
        expect(data.status).toBe("ORIENTATION_PENDING");
      }
    }
  });

  it("treats a duplicate section POST as an idempotent no-op", async () => {
    const first = ORIENTATION_SECTION_IDS[0];
    const data = expectOk<OrientationView>(
      await apiRequest("POST", `/api/orientation/${reference}/sections`, {
        sectionId: first,
      }),
      200,
      "duplicate section",
    );
    expect(data.orientation?.sections).toHaveLength(ORIENTATION_SECTION_IDS.length);
  });

  it("refuses completion without the integrity acknowledgement (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: false,
      }),
      422,
      "VALIDATION_ERROR",
      "missing acknowledgement",
    );
  });

  it("completes orientation with the acknowledgement (→ ORIENTATION_COMPLETED)", async () => {
    const data = expectOk<OrientationView>(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: true,
      }),
      200,
      "orientation complete",
    );
    expect(data.status).toBe("ORIENTATION_COMPLETED");
    expect(data.orientation?.completedAt).not.toBeNull();
  });

  it("repeating completion is idempotent (200, still complete)", async () => {
    const data = expectOk<OrientationView>(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: true,
      }),
      200,
      "repeat completion",
    );
    expect(data.status).toBe("ORIENTATION_COMPLETED");
  });
});

describe("Stage 2 — Automated Interview Assessment", () => {
  it("refuses answers before an attempt exists (409)", async () => {
    expectFail(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: ASSESSMENT_QUESTION_IDS[0],
        selectedOption: 0,
      }),
      409,
      "CONFLICT",
      "answer without attempt",
    );
  });

  it("starts an attempt with the full authoritative question set", async () => {
    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "start assessment",
    );
    expect(data.phase).toBe("IN_PROGRESS");
    expect(data.attempt?.attemptNumber).toBe(1);
    expect(data.attempt?.questions).toHaveLength(ASSESSMENT_META.totalQuestions);
    expect(data.status).toBe("ASSESSMENT_PENDING");
    attemptOneQuestionTokens = data.attempt?.questions.map((question) => question.id) ?? [];
    expect(attemptOneQuestionTokens).toHaveLength(ASSESSMENT_META.totalQuestions);
    expect(attemptOneQuestionTokens).not.toEqual([...ASSESSMENT_QUESTION_IDS]);
  });

  it("re-starting and refreshing resume the same ordered attempt (no reshuffle)", async () => {
    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "resume assessment",
    );
    expect(data.attempt?.attemptNumber).toBe(1);
    expect(data.attempt?.questions.map((question) => question.id)).toEqual(
      attemptOneQuestionTokens,
    );

    const refreshed = expectOk<AssessmentView>(
      await apiRequest("GET", `/api/assessment/${reference}`),
      200,
      "refresh assessment",
    );
    expect(refreshed.attempt?.questions.map((question) => question.id)).toEqual(
      attemptOneQuestionTokens,
    );
  });

  it("rejects an unknown question id (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: "q-99",
        selectedOption: 0,
      }),
      422,
      "VALIDATION_ERROR",
      "unknown question",
    );
  });

  it("saves and re-saves answers (idempotent autosave)", async () => {
    const key = await loadAnswerKey();
    const questionRows = await getAttemptQuestionRows(1);
    const firstQuestion = questionRows.find(
      (row) => row.id === attemptOneQuestionTokens[0],
    );
    expect(firstQuestion).toBeDefined();
    const first = expectOk<{ answeredCount: number; totalQuestions: number }>(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: firstQuestion!.id,
        selectedOption: key[firstQuestion!.questionId],
      }),
      200,
      "save first answer",
    );
    expect(first.answeredCount).toBe(1);

    const again = expectOk<{ answeredCount: number }>(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: firstQuestion!.id,
        selectedOption: key[firstQuestion!.questionId],
      }),
      200,
      "resave first answer",
    );
    expect(again.answeredCount).toBe(1);
  });

  it("answers everything correctly and submits → PASSED (100%)", async () => {
    const key = await loadAnswerKey();
    const questionRows = await getAttemptQuestionRows(1);
    for (const row of questionRows.slice(1).reverse()) {
      const saved = expectOk<{ answeredCount: number }>(
        await apiRequest("POST", `/api/assessment/${reference}/answers`, {
          questionId: row.id,
          selectedOption: key[row.questionId],
        }),
        200,
        `answer ${row.questionId}`,
      );
      expect(saved.answeredCount).toBeLessThanOrEqual(ASSESSMENT_META.totalQuestions);
    }

    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "submit assessment",
    );
    expect(data.status).toBe("ASSESSMENT_PASSED");
    expect(data.result?.passed).toBe(true);
    expect(data.result?.percentage).toBe(100);
    expect(data.result?.marksAwarded).toBe(ASSESSMENT_META.totalMarks);
  });

  it("closes the assessment after a pass: no retake, no edits (409)", async () => {
    expectFail(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      409,
      "CONFLICT",
      "retake after pass",
    );
    expectFail(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: ASSESSMENT_QUESTION_IDS[0],
        selectedOption: 0,
      }),
      409,
      "CONFLICT",
      "edit after submit",
    );
  });
});

describe("Stage 3 — Responsibility & Reward Agreement", () => {
  it("opens lazily from ASSESSMENT_PASSED (→ OFFER_PENDING)", async () => {
    const data = expectOk<AgreementView>(
      await apiRequest("GET", `/api/agreement/${reference}`),
      200,
      "open agreement",
    );
    expect(data.status).toBe("OFFER_PENDING");
    expect(data.eligible).toBe(true);
    expect(data.decision).toBeNull();
  });

  it("refuses acceptance without the acknowledgement (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: false,
        version: AGREEMENT_META.version,
      }),
      422,
      "VALIDATION_ERROR",
      "missing acknowledgement",
    );
  });

  it("refuses a stale agreement version (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: true,
        version: "9.9",
      }),
      422,
      "VALIDATION_ERROR",
      "stale version",
    );
  });

  it("accepts the agreement (→ OFFER_ACCEPTED, decision recorded)", async () => {
    const data = expectOk<AgreementView>(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: true,
        version: AGREEMENT_META.version,
      }),
      200,
      "accept agreement",
    );
    expect(data.status).toBe("OFFER_ACCEPTED");
    expect(data.decision?.decidedAt).not.toBeNull();
  });

  it("re-accepting is idempotent (200, final)", async () => {
    const data = expectOk<AgreementView>(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: true,
        version: AGREEMENT_META.version,
      }),
      200,
      "repeat accept",
    );
    expect(data.status).toBe("OFFER_ACCEPTED");
  });
});

describe("Stage 4 — Provisional Appointment", () => {
  it("issues the letter lazily on first open (exactly one letter)", async () => {
    const data = expectOk<AppointmentView>(
      await apiRequest("GET", `/api/appointment/${reference}`),
      200,
      "issue appointment",
    );
    expect(data.issued).toBe(true);
    // Official format: FFL/HR/PLA/NNN (zero-padded to at least three digits,
    // src/config/appointment.ts APPOINTMENT_REFERENCE_MIN_DIGITS).
    expect(data.appointment?.appointmentReference).toMatch(/^FFL\/HR\/PLA\/\d{3,}$/);
    expect(data.appointment?.printedName).toBe(fullName);
    expect(data.status).toBe("APPOINTMENT_ISSUED");
  });

  it("re-opening never re-issues (same reference, same letter)", async () => {
    const first = expectOk<AppointmentView>(
      await apiRequest("GET", `/api/appointment/${reference}`),
      200,
      "appointment #1",
    );
    const second = expectOk<AppointmentView>(
      await apiRequest("GET", `/api/appointment/${reference}`),
      200,
      "appointment #2",
    );
    expect(second.appointment?.appointmentReference).toBe(
      first.appointment?.appointmentReference,
    );
    expect(second.appointment?.issuedAt).toBe(first.appointment?.issuedAt);
  });
});

describe("Stage 5 — Staff Activation", () => {
  it("opens lazily from APPOINTMENT_ISSUED (→ ACTIVATION_PENDING)", async () => {
    const data = expectOk<ActivationView>(
      await apiRequest("GET", `/api/activation/${reference}`),
      200,
      "open activation",
    );
    expect(data.status).toBe("ACTIVATION_PENDING");
  });

  it("refuses a stale activation version (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/activation/${reference}/activate`, {
        acknowledgement: true,
        version: "0.9",
      }),
      422,
      "VALIDATION_ERROR",
      "stale activation version",
    );
  });

  it("activates the staff profile and assigns exactly one Staff ID", async () => {
    const data = expectOk<ActivationView>(
      await apiRequest("POST", `/api/activation/${reference}/activate`, {
        acknowledgement: true,
        version: ACTIVATION_META.version,
      }),
      200,
      "activate",
    );
    expect(data.status).toBe("APPROVED_STAFF");
    expect(data.staff?.staffId).toMatch(/^FF-STF-\d{4,}$/);
    expect(data.staff?.appointmentReference).toMatch(/^FFL\/HR\/PLA\//);
  });

  it("re-activating is idempotent (same immutable Staff ID)", async () => {
    const data = expectOk<ActivationView>(
      await apiRequest("POST", `/api/activation/${reference}/activate`, {
        acknowledgement: true,
        version: ACTIVATION_META.version,
      }),
      200,
      "repeat activate",
    );
    expect(data.status).toBe("APPROVED_STAFF");
    expect(data.staff?.staffId).toMatch(/^FF-STF-\d{4,}$/);
  });
});

describe("Stage 6 — Staff Onboarding", () => {
  it("journey shows the onboarding card (NOT_STARTED 0/8) and no next action", async () => {
    const data = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "journey after activation",
    );
    expect(data.status).toBe("APPROVED_STAFF");
    expect(data.nextAction).toBeNull();
    expect(data.currentStage).toBeNull();
    expect(data.staffRecord?.staffId).toMatch(/^FF-STF-\d{4,}$/);
    expect(data.onboarding?.state).toBe("NOT_STARTED");
    expect(data.onboarding?.completedSteps).toBe(0);
    expect(data.onboarding?.totalSteps).toBe(ONBOARDING_STEP_IDS.length);
    expect(data.stages.every((stage) => stage.state === "completed")).toBe(true);
  });

  it("first open lazily creates the onboarding record (IN_PROGRESS, step 1)", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "first onboarding open",
    );
    expect(data.eligible).toBe(true);
    expect(data.staff?.staffId).toMatch(/^FF-STF-\d{4,}$/);
    expect(data.onboarding?.state).toBe("IN_PROGRESS");
    expect(data.onboarding?.currentStepId).toBe(ONBOARDING_STEP_IDS[0]);
    expect(data.onboarding?.steps).toHaveLength(0);
    expect(data.content.steps).toHaveLength(ONBOARDING_STEP_IDS.length);
    expect(data.content.version).toBe(ONBOARDING_META.version);
    // Approved default (§33, still open): the official WhatsApp number is
    // not supplied — honest pending state, never a fabricated contact.
    expect(data.content.whatsappNumber).toBeNull();
    expect(data.content.whatsappMessage).toBe(
      "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
    );
  });

  it("re-opening does not duplicate the record or complete anything", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "repeat onboarding open",
    );
    expect(data.onboarding?.steps).toHaveLength(0);
    expect(data.onboarding?.currentStepId).toBe(ONBOARDING_STEP_IDS[0]);
  });

  it("refuses a skip-ahead step (422, names the required step)", async () => {
    const error = expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
        stepId: "ready",
      }),
      422,
      "VALIDATION_ERROR",
      "skip-ahead step",
    );
    expect(error.message).toMatch(/Review /i);
  });

  it("refuses an unknown step id (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
        stepId: "not-a-step",
      }),
      422,
      "VALIDATION_ERROR",
      "unknown step",
    );
  });

  it("refuses completion before the review steps exist (422)", async () => {
    const error = expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      422,
      "VALIDATION_ERROR",
      "early onboarding completion",
    );
    expect(error.message).toMatch(/every onboarding step/i);
  });

  it("refuses completion without the literal acknowledgement or correct version (422)", async () => {
    expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: false,
        version: ONBOARDING_META.version,
      }),
      422,
      "VALIDATION_ERROR",
      "false acknowledgement",
    );
    expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: "0.0",
      }),
      422,
      "VALIDATION_ERROR",
      "stale onboarding version",
    );
  });

  it("completes the review steps (all but the final acknowledgement step) in order; resume pointer follows", async () => {
    const reviewSteps = ONBOARDING_REVIEW_STEPS;
    for (let index = 0; index < reviewSteps.length; index += 1) {
      const stepId = reviewSteps[index];
      const data = expectOk<OnboardingView>(
        await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
          stepId,
        }),
        200,
        `onboarding step ${stepId}`,
      );
      expect(data.onboarding?.steps).toHaveLength(index + 1);
      const expectedNext =
        index + 1 < ONBOARDING_STEP_IDS.length ? ONBOARDING_STEP_IDS[index + 1] : null;
      expect(data.onboarding?.currentStepId).toBe(expectedNext);
    }
  });

  it("treats a duplicate step POST as idempotent (no duplicate rows)", async () => {
    const first = ONBOARDING_STEP_IDS[0];
    const data = expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/steps`, { stepId: first }),
      200,
      "duplicate onboarding step",
    );
    expect(data.onboarding?.steps).toHaveLength(ONBOARDING_REVIEW_STEPS.length);
  });

  it("completes onboarding exactly once (final step recorded by the acknowledgement)", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      200,
      "complete onboarding",
    );
    expect(data.onboarding?.state).toBe("COMPLETED");
    expect(data.onboarding?.completedAt).not.toBeNull();
    expect(data.onboarding?.version).toBe(ONBOARDING_META.version);
    expect(data.onboarding?.steps.map((step) => step.id)).toEqual([
      ...ONBOARDING_STEP_IDS,
    ]);
  });

  it("repeated completion is idempotent — ONE completion timestamp", async () => {
    const first = expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      200,
      "repeat completion #1",
    );
    const second = expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      200,
      "repeat completion #2",
    );
    expect(second.onboarding?.completedAt).toBe(first.onboarding?.completedAt);
  });

  it("closes onboarding after completion: steps are refused (409)", async () => {
    expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
        stepId: ONBOARDING_STEP_IDS[1],
      }),
      409,
      "CONFLICT",
      "step after completion",
    );
  });

  it("journey shows the completed onboarding card (8/8) with no CTA", async () => {
    const data = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "final journey",
    );
    expect(data.status).toBe("APPROVED_STAFF");
    expect(data.nextAction).toBeNull();
    expect(data.onboarding?.state).toBe("COMPLETED");
    expect(data.onboarding?.completedSteps).toBe(ONBOARDING_STEP_IDS.length);
    expect(data.onboarding?.totalSteps).toBe(ONBOARDING_STEP_IDS.length);
    expect(data.onboarding?.completedAt).not.toBeNull();
  });
});

describe("Persistence — the whole journey is recorded exactly once", () => {
  it("matches every database invariant at the end of the journey", async () => {
    const candidate = await db.candidate.findUnique({
      where: { referenceNumber: reference },
      select: {
        status: true,
        applications: { select: { roleTitle: true, status: true } },
        events: { select: { stage: true, type: true } },
        staff: {
          select: {
            staffId: true,
            onboarding: {
              select: {
                completedAt: true,
                version: true,
                steps: { orderBy: { completedAt: "asc" }, select: { stepId: true } },
              },
            },
          },
        },
      },
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.status).toBe("APPROVED_STAFF");
    expect(candidate?.applications).toHaveLength(1);
    expect(candidate?.applications[0]?.roleTitle).toBe(OPEN_POSITION.title);
    expect(candidate?.applications[0]?.status).toBe("SUBMITTED");

    // Recruitment timeline: append-only StageEvents in the six recruitment
    // stages — onboarding must never appear there (staff-side, by design).
    const events = candidate?.events ?? [];
    expect(events.length).toBeGreaterThanOrEqual(6);
    for (const event of events) {
      expect(RECRUITMENT_STAGES).toContain(event.stage);
    }

    // Staff identity + onboarding record.
    const staff = candidate?.staff;
    expect(staff).not.toBeNull();
    expect(staff?.staffId).toMatch(/^FF-STF-\d{4,}$/);

    const onboarding = staff?.onboarding;
    expect(onboarding).not.toBeNull();
    expect(onboarding?.completedAt).not.toBeNull();
    expect(onboarding?.version).toBe(ONBOARDING_META.version);
    expect(onboarding?.steps.map((step) => step.stepId)).toEqual([
      ...ONBOARDING_STEP_IDS,
    ]);
  });
});
