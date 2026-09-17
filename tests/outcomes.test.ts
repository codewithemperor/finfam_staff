/**
 * FinFam flow test — ALTERNATIVE OUTCOMES on the same real APIs.
 *
 * A second candidate takes a different path through the journey:
 *
 *   registration → assessment attempted BEFORE orientation (409 guard)
 *   → orientation completed → assessment attempt #1 FAILED (all wrong)
 *   → honest FAILED status + journey result → retake (interim policy)
 *   → attempt #2 PASSED → journey PAUSED at the agreement stage
 *
 * It then proves the staff-side boundaries from the wrong side:
 * onboarding reads are honest (eligible:false) and every onboarding,
 * activation and appointment write is refused before activation.
 *
 * Requires the dev server (`bun run dev`) — see tests/helpers/api.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { ASSESSMENT_META } from "@/config/assessment";
import { ONBOARDING_META } from "@/config/onboarding";
import { ORIENTATION_SECTION_IDS } from "@/config/orientation";
import { loadAnswerKey } from "./helpers/answer-key";
import {
  apiRequest,
  assertServerUp,
  BASE_URL,
  expectFail,
  expectOk,
} from "./helpers/api";
import { cleanupTestCandidates, db, uniqueEmail } from "./helpers/db";

import type {
  AgreementView,
  AppointmentView,
  AssessmentView,
  OnboardingView,
  OrientationView,
  RecruitmentJourneyView,
} from "@/types/recruitment";

const fullName = "Outcome Test Candidate";
const phone = "0803 000 0002";
const city = "Abuja";

let email = "";
let reference = "";
let attemptOneQuestionOrder: string[] = [];

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

async function getOrientationSnapshot() {
  return db.candidate.findUnique({
    where: { referenceNumber: reference },
    select: {
      status: true,
      orientation: {
        select: {
          id: true,
          completedAt: true,
          acknowledgedAt: true,
          currentSectionId: true,
          sections: {
            orderBy: { sectionId: "asc" },
            select: { id: true, sectionId: true, completedAt: true },
          },
        },
      },
      agreement: { select: { id: true } },
      appointment: { select: { id: true } },
      staff: { select: { id: true } },
    },
  });
}

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(email ? [email] : []);
  if (removed > 0) {
    console.log(`[outcomes] cleanup: removed ${removed} test candidate(s)`);
  }
});

async function completeOrientation(): Promise<void> {
  for (const sectionId of ORIENTATION_SECTION_IDS) {
    expectOk<OrientationView>(
      await apiRequest("POST", `/api/orientation/${reference}/sections`, {
        sectionId,
      }),
      200,
      `section ${sectionId}`,
    );
  }
  const completed = expectOk<OrientationView>(
    await apiRequest("POST", `/api/orientation/${reference}/complete`, {
      acknowledgement: true,
    }),
    200,
    "orientation complete",
  );
  expect(completed.status).toBe("ORIENTATION_COMPLETED");
}

describe("Stage 0 — Registration", () => {
  it("registers the second candidate", async () => {
    email = uniqueEmail("outcomes");
    const data = expectOk<{ referenceNumber: string; status: string }>(
      await apiRequest("POST", "/api/applications", {
        fullName,
        email,
        phone,
        city,
        roleTitle: "Staff Member",
        consent: true,
      }),
      200,
      "register",
    );
    reference = data.referenceNumber;
    expect(data.status).toBe("APPLICANT");
  });
});

describe("Stage 2 — Assessment guards before orientation", () => {
  it("refuses to start the assessment before orientation is complete (409)", async () => {
    const error = expectFail(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      409,
      "CONFLICT",
      "assessment before orientation",
    );
    expect(error.message).toMatch(/orientation/i);
  });
});

describe("Stage 1 — Orientation", () => {
  it("completes all sections in order, then acknowledges completion", async () => {
    await completeOrientation();
  });
});

describe("Stage 2 — Outcome A: failing the assessment", () => {
  it("starts attempt #1 (→ ASSESSMENT_PENDING)", async () => {
    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "start attempt 1",
    );
    expect(data.attempt?.attemptNumber).toBe(1);
    expect(data.status).toBe("ASSESSMENT_PENDING");
    expect(data.attempt?.questions).toHaveLength(ASSESSMENT_META.totalQuestions);
    attemptOneQuestionOrder = (await getAttemptQuestionRows(1)).map(
      (row) => row.questionId,
    );
  });

  it("answers every question WRONG and submits → FAILED (0%)", async () => {
    const key = await loadAnswerKey();
    const questionRows = await getAttemptQuestionRows(1);
    for (const row of questionRows) {
      const wrongOption = (key[row.questionId] + 1) % 4;
      expectOk<{ answeredCount: number }>(
        await apiRequest("POST", `/api/assessment/${reference}/answers`, {
          questionId: row.id,
          selectedOption: wrongOption,
        }),
        200,
        `wrong answer ${row.questionId}`,
      );
    }

    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "submit failing attempt",
    );
    expect(data.status).toBe("ASSESSMENT_FAILED");
    expect(data.result?.passed).toBe(false);
    expect(data.result?.percentage).toBe(0);
    expect(data.result?.marksAwarded).toBe(0);
    expect(data.result?.totalMarks).toBe(ASSESSMENT_META.totalMarks);
  });

  it("records the honest FAILED outcome on the journey (FAILED event, result view)", async () => {
    const data = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "journey after failure",
    );
    expect(data.status).toBe("ASSESSMENT_FAILED");
    expect(data.assessmentResult?.passed).toBe(false);
    // Next action honestly resumes the assessment (retake policy is config-driven).
    expect(data.nextAction?.href).toBe(`/assessment/${reference}`);
  });

  it("allows read-only orientation review after failure without reopening stages", async () => {
    const before = await getOrientationSnapshot();
    expect(before?.status).toBe("ASSESSMENT_FAILED");
    expect(before?.orientation?.completedAt).not.toBeNull();

    const assessmentPage = await fetch(`${BASE_URL}/assessment/${reference}`, {
      signal: AbortSignal.timeout(20_000),
    });
    expect(assessmentPage.status).toBe(200);
    expect(await assessmentPage.text()).toContain("Review Orientation");

    const overview = await fetch(`${BASE_URL}/orientation/${reference}`, {
      signal: AbortSignal.timeout(20_000),
    });
    expect(overview.status).toBe(200);
    expect(await overview.text()).toContain("read-only");

    const firstSection = await fetch(
      `${BASE_URL}/orientation/${reference}/${ORIENTATION_SECTION_IDS[0]}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    expect(firstSection.status).toBe(200);
    expect(await firstSection.text()).toContain("Review mode");

    const after = await getOrientationSnapshot();
    expect(after?.status).toBe("ASSESSMENT_FAILED");
    expect(after?.orientation?.id).toBe(before?.orientation?.id);
    expect(after?.orientation?.completedAt?.toISOString()).toBe(
      before?.orientation?.completedAt?.toISOString(),
    );
    expect(after?.orientation?.acknowledgedAt?.toISOString()).toBe(
      before?.orientation?.acknowledgedAt?.toISOString(),
    );
    expect(after?.orientation?.currentSectionId).toBe(
      before?.orientation?.currentSectionId,
    );
    expect(after?.orientation?.sections.map((section) => section.sectionId)).toEqual(
      before?.orientation?.sections.map((section) => section.sectionId),
    );
    expect(after?.agreement).toBeNull();
    expect(after?.appointment).toBeNull();
    expect(after?.staff).toBeNull();

    const agreement = expectOk<AgreementView>(
      await apiRequest("GET", `/api/agreement/${reference}`),
      200,
      "agreement remains blocked",
    );
    expect(agreement.status).toBe("ASSESSMENT_FAILED");
    expect(agreement.eligible).toBe(false);
    expect(agreement.decision).toBeNull();
  });
});

describe("Stage 2 — Outcome B: the retake passes", () => {
  it("starts attempt #2 under the interim retake policy (allowRetakeAfterFailure)", async () => {
    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "start attempt 2",
    );
    expect(data.attempt?.attemptNumber).toBe(2);
    expect(data.attempt?.questions).toHaveLength(ASSESSMENT_META.totalQuestions);
    expect(data.attempt?.answers).toHaveLength(0);
    expect((await getAttemptQuestionRows(2)).map((row) => row.questionId)).not.toEqual(
      attemptOneQuestionOrder,
    );
  });

  it("answers everything correctly and submits → PASSED (attemptCount 2)", async () => {
    const key = await loadAnswerKey();
    const questionRows = await getAttemptQuestionRows(2);
    for (const row of questionRows.reverse()) {
      expectOk(
        await apiRequest("POST", `/api/assessment/${reference}/answers`, {
          questionId: row.id,
          selectedOption: key[row.questionId],
        }),
        200,
        `correct answer ${row.questionId}`,
      );
    }

    const data = expectOk<AssessmentView>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "submit passing retake",
    );
    expect(data.status).toBe("ASSESSMENT_PASSED");
    expect(data.result?.passed).toBe(true);
    expect(data.result?.attemptNumber).toBe(2);
    expect(data.attemptCount).toBe(2);
  });
});

describe("Journey paused mid-way — a different, honest outcome", () => {
  it("stops at the agreement stage with the correct next action", async () => {
    const data = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "paused journey",
    );
    expect(data.status).toBe("ASSESSMENT_PASSED");
    expect(data.nextAction?.href).toBe(`/agreement/${reference}`);
    expect(data.staffRecord).toBeNull();
    expect(data.onboarding).toBeNull();
  });
});

describe("Staff-side boundaries are enforced from the wrong side", () => {
  it("onboarding read is honest for a non-staff candidate (eligible:false, no record)", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "onboarding as non-staff",
    );
    expect(data.eligible).toBe(false);
    expect(data.staff).toBeNull();
    expect(data.onboarding).toBeNull();
  });

  it("refuses onboarding step writes for a non-staff candidate (409)", async () => {
    const error = expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
        stepId: "welcome",
      }),
      409,
      "CONFLICT",
      "onboarding step as non-staff",
    );
    expect(error.message).toMatch(/current recruitment stage/i);
  });

  it("refuses onboarding completion for a non-staff candidate (409)", async () => {
    expectFail(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      409,
      "CONFLICT",
      "onboarding completion as non-staff",
    );
  });

  it("refuses activation before the appointment exists (409)", async () => {
    expectFail(
      await apiRequest("POST", `/api/activation/${reference}/activate`, {
        acknowledgement: true,
        version: "1.0",
      }),
      409,
      "CONFLICT",
      "activation too early",
    );
  });

  it("appointment open is a no-op read before the agreement (nothing issued)", async () => {
    const data = expectOk<AppointmentView>(
      await apiRequest("GET", `/api/appointment/${reference}`),
      200,
      "appointment as non-accepted",
    );
    expect(data.issued).toBe(false);
    expect(data.appointment).toBeNull();
  });

  it("no staff or onboarding rows were written for this candidate", async () => {
    const candidate = await db.candidate.findUnique({
      where: { referenceNumber: reference },
      select: {
        status: true,
        staff: { select: { id: true } },
        agreement: { select: { id: true } },
      },
    });
    expect(candidate?.status).toBe("ASSESSMENT_PASSED");
    expect(candidate?.staff).toBeNull();
    expect(candidate?.agreement).toBeNull();
  });
});

describe("Agreement is still open from here (journey resumable)", () => {
  it("opening the agreement transitions lazily to OFFER_PENDING", async () => {
    const data = expectOk<AgreementView>(
      await apiRequest("GET", `/api/agreement/${reference}`),
      200,
      "open agreement lazily",
    );
    expect(data.status).toBe("OFFER_PENDING");
    expect(data.eligible).toBe(true);
  });
});
