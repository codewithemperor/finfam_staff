/**
 * Stage 7 — Staff Portal integration tests: first-login gating, Section 7
 * content (brief §56), TWO DOORS / ONE onboarding state (brief §55),
 * cross-Staff authorization (brief §54) and historical-data integrity
 * (brief §58).
 *
 * Requires the dev server (`bun run dev`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  ONBOARDING_ACKNOWLEDGEMENT_LABEL,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import { STAFF_RESOURCE_CATEGORIES } from "@/config/staff-portal";
import type { OnboardingView, RecruitmentJourneyView } from "@/types/recruitment";

import { apiRequest, assertServerUp, expectFail, expectOk } from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import { driveToActivation, fetchRaw, loginAsStaff } from "./helpers/journey";

const EMAILS: string[] = [];

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(EMAILS);
  console.log(`[staff-portal] cleanup: removed ${removed} test candidate(s)`);
});

describe("Stage 7 — first-login gating & Section 7 content", () => {
  let email = "";
  let staffId = "";
  let cookie = "";

  beforeAll(async () => {
    const staff = await driveToActivation("portal-gating");
    EMAILS.push(staff.email);
    email = staff.email;
    staffId = staff.staffId;
    cookie = (await loginAsStaff(email, "gating login")).cookie;
  });

  it("a fresh account's first portal onboarding open starts at the intro step", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookie),
      200,
      "portal first open",
    );
    expect(data.eligible).toBe(true);
    expect(data.onboarding?.state).toBe("IN_PROGRESS");
    expect(data.onboarding?.currentStepId).toBe(ONBOARDING_STEP_IDS[0]);
    expect(data.onboarding?.steps).toHaveLength(0);
    expect(data.content.version).toBe(ONBOARDING_META.version);
  });

  it("the Section 7 v2.0 content is served exactly as approved", async () => {
    const data = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookie),
      200,
      "portal content view",
    );

    // 1. Step set and titles mirror Section 7 (brief §26–§36).
    expect(data.content.steps.map((s) => s.id)).toEqual([...ONBOARDING_STEP_IDS]);
    const titles = data.content.steps.map((s) => s.title);
    expect(titles).toContain("Welcome to the FinFam Team");
    expect(titles).toContain("Join FinFam Staff Communication Channel");
    expect(titles).toContain("Staff Verification");
    expect(titles).toContain("Receive Staff Resources");
    expect(titles).toContain("Complete Final Staff Orientation");
    expect(titles).toContain("Begin Your FinFam Assignment");
    expect(titles).toContain("Daily Accountability");
    expect(titles).toContain("Ready to Begin");

    // 2. Intro: designation vs operational role shown SEPARATELY (§27).
    const intro = data.content.steps[0]!;
    const facts = intro.blocks.find((b) => b.type === "facts");
    expect(facts?.type).toBe("facts");
    if (facts?.type === "facts") {
      expect(facts.items).toContainEqual({
        label: "Appointment designation",
        value: "Remote Staff",
      });
      expect(facts.items).toContainEqual({
        label: "Operational role",
        value: "FinFam Growth Ambassador",
      });
    }

    // 3. WhatsApp pending state + the EXACT pre-filled message (§28/§29).
    expect(data.content.whatsappNumber).toBeNull();
    expect(data.content.whatsappMessage).toBe(
      "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.",
    );

    // 4. Verification: server-derived system checks + external actions (§31).
    expect(data.verification?.systemChecks.map((c) => c.label)).toEqual([
      "Identity record",
      "Appointment issued",
      "Staff ID assigned",
      "Staff profile active",
    ]);
    expect(
      data.verification?.systemChecks.find((c) => c.id === "staff-id-assigned")
        ?.detail,
    ).toBe(staffId);
    expect(data.verification?.externalActions.map((a) => a.label)).toEqual([
      "Contact onboarding team",
      "Communication-group access",
    ]);

    // 5. Resources: exactly the five supplied categories (§32).
    const resources = data.content.steps.find((s) => s.id === "resources")!;
    const list = resources.blocks.find((b) => b.type === "list");
    expect(list?.type).toBe("list");
    if (list?.type === "list") {
      expect(list.items).toEqual([...STAFF_RESOURCE_CATEGORIES]);
    }

    // 6. Final orientation bullets (§33) — operational, not the FSOW.
    const orientation = data.content.steps.find((s) => s.id === "orientation")!;
    const orientationList = orientation.blocks.find((b) => b.type === "list");
    expect(orientationList?.type).toBe("list");
    if (orientationList?.type === "list") {
      expect(orientationList.items.join(" ")).toContain("marketing materials");
      expect(orientationList.items.join(" ")).toContain("daily reports");
    }

    // 7. Assignment: the two activity groups (§34).
    const assignment = data.content.steps.find((s) => s.id === "assignment")!;
    const assignmentTitles = assignment.blocks
      .filter((b) => b.type === "alert")
      .map((b) => (b.type === "alert" ? b.title : ""));
    expect(assignmentTitles).toContain("Community Building Activities");
    expect(assignmentTitles).toContain("Member Support Activities");

    // 8. Daily accountability: the four categories (§35).
    const accountability = data.content.steps.find(
      (s) => s.id === "accountability",
    )!;
    const accountabilityTitles = accountability.blocks
      .filter((b) => b.type === "alert")
      .map((b) => (b.type === "alert" ? b.title : ""));
    expect(accountabilityTitles).toEqual([
      "Prospects",
      "Member Growth",
      "Savings Activities",
      "Community Activities",
    ]);

    // 9. Mission reminder + closing typography (§36).
    const ready = data.content.steps.find((s) => s.id === "ready")!;
    const allReadyText = JSON.stringify(ready.blocks);
    expect(allReadyText).toContain("build better saving habits");
    const tagline = ready.blocks.find((b) => b.type === "tagline");
    expect(tagline?.type).toBe("tagline");
    if (tagline?.type === "tagline") {
      expect(tagline.lines).toEqual([
        "Welcome to FinFam",
        "Together, We Are Building Africa's Leading Digital Cooperative Ecosystem.",
        "WE SAVE.",
        "WE GROW.",
        "WE PROSPER.",
      ]);
    }

    // 10. The exact final acknowledgement + version (§37).
    expect(data.content.acknowledgementLabel).toBe(
      ONBOARDING_ACKNOWLEDGEMENT_LABEL,
    );
  });

  it("completing onboarding closes the ONE state for BOTH doors", async () => {
    for (const stepId of ONBOARDING_STEP_IDS.filter((id) => id !== "ready")) {
      expectOk<OnboardingView>(
        await apiRequest(
          "POST",
          "/api/staff/onboarding/steps",
          { stepId },
          cookie,
        ),
        200,
        `portal step ${stepId}`,
      );
    }
    const completed = expectOk<OnboardingView>(
      await apiRequest(
        "POST",
        "/api/staff/onboarding/complete",
        { acknowledgement: true, version: ONBOARDING_META.version },
        cookie,
      ),
      200,
      "portal complete",
    );
    expect(completed.onboarding?.state).toBe("COMPLETED");

    // The LEGACY door sees the same completion immediately.
    const legacy = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookie),
      200,
      "portal view after completion",
    );
    expect(legacy.onboarding?.state).toBe("COMPLETED");
    expect(legacy.onboarding?.steps.map((s) => s.id)).toEqual([
      ...ONBOARDING_STEP_IDS,
    ]);

    // Exactly one completion email; one start email (from the first open).
    const candidateRow = await db.candidate.findUnique({
      where: { email },
      select: { id: true },
    });
    expect(
      await db.notificationDelivery.count({
        where: { candidateId: candidateRow!.id, type: "ONBOARDING_STARTED" },
      }),
    ).toBe(1);
    expect(
      await db.notificationDelivery.count({
        where: { candidateId: candidateRow!.id, type: "ONBOARDING_COMPLETED" },
      }),
    ).toBe(1);
  });
});

describe("Stage 7 — two doors, one state (brief §55)", () => {
  let email = "";
  let reference = "";
  let staffRowId = "";
  let cookie = "";

  beforeAll(async () => {
    const staff = await driveToActivation("portal-doors");
    EMAILS.push(staff.email);
    email = staff.email;
    reference = staff.referenceNumber;
    const row = await db.staff.findUnique({
      where: { staffId: staff.staffId },
      select: { id: true },
    });
    staffRowId = row!.id;
    cookie = (await loginAsStaff(email, "doors login")).cookie;
  });

  it("legacy first, portal next — progress is identical in both directions", async () => {
    // Door 1: the legacy reference route starts onboarding.
    const legacyStart = expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "legacy first open",
    );
    expect(legacyStart.onboarding?.currentStepId).toBe(ONBOARDING_STEP_IDS[0]);

    // Legacy completes step 1.
    await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
      stepId: ONBOARDING_STEP_IDS[0],
    });

    // Door 2: the authenticated portal resumes EXACTLY there.
    const portal = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookie),
      200,
      "portal resume",
    );
    expect(portal.onboarding?.steps.map((s) => s.id)).toEqual([
      ONBOARDING_STEP_IDS[0],
    ]);
    expect(portal.onboarding?.currentStepId).toBe(ONBOARDING_STEP_IDS[1]);

    // Portal completes step 2; the legacy door sees it instantly.
    await apiRequest(
      "POST",
      "/api/staff/onboarding/steps",
      { stepId: ONBOARDING_STEP_IDS[1] },
      cookie,
    );
    const legacyAgain = expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "legacy sees portal progress",
    );
    expect(legacyAgain.onboarding?.steps.map((s) => s.id)).toEqual([
      ONBOARDING_STEP_IDS[0],
      ONBOARDING_STEP_IDS[1],
    ]);

    // One record, no duplicates.
    expect(
      await db.staffOnboarding.count({ where: { staffId: staffRowId } }),
    ).toBe(1);
  });

  it("reverse direction: completing through the legacy door is visible through the portal", async () => {
    await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
      stepId: ONBOARDING_STEP_IDS[2],
    });
    const portal = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookie),
      200,
      "portal sees legacy progress",
    );
    expect(portal.onboarding?.steps.map((s) => s.id)).toContain(
      ONBOARDING_STEP_IDS[2],
    );
  });

  it("skip-ahead and unknown steps are refused through the portal door too", async () => {
    expectFail(
      await apiRequest(
        "POST",
        "/api/staff/onboarding/steps",
        { stepId: "ready" },
        cookie,
      ),
      422,
      "VALIDATION_ERROR",
      "portal skip-ahead",
    );
    expectFail(
      await apiRequest(
        "POST",
        "/api/staff/onboarding/steps",
        { stepId: "not-a-step" },
        cookie,
      ),
      422,
      "VALIDATION_ERROR",
      "portal unknown step",
    );
  });
});

describe("Stage 7 — cross-Staff authorization (brief §54)", () => {
  let cookieA = "";
  let staffA = { email: "", staffId: "", referenceNumber: "" };
  let staffB = { email: "", staffId: "", referenceNumber: "" };

  beforeAll(async () => {
    staffA = await driveToActivation("portal-auth-a");
    staffB = await driveToActivation("portal-auth-b");
    EMAILS.push(staffA.email, staffB.email);
    cookieA = (await loginAsStaff(staffA.email, "A login")).cookie;
    await loginAsStaff(staffB.email, "B login");
  });

  it("each session resolves ONLY its own identity", async () => {
    const meA = expectOk<{ staffId: string; email: string }>(
      await apiRequest("GET", "/api/staff/me", undefined, cookieA),
      200,
      "me A",
    );
    expect(meA.staffId).toBe(staffA.staffId);
    expect(meA.email).toBe(staffA.email);
    const serializedA = JSON.stringify(meA);
    expect(serializedA).not.toContain(staffB.staffId);
    expect(serializedA).not.toContain(staffB.email);
  });

  it("A cannot reach B's identity — query, body and URL manipulation all fail", async () => {
    // Staff ID guessing via query string: identity still comes from the
    // session, so the response is A's — B's data appears nowhere.
    const meWithB = expectOk<{ staffId: string; email: string }>(
      await apiRequest(
        "GET",
        `/api/staff/me?staffId=${encodeURIComponent(staffB.staffId)}`,
        undefined,
        cookieA,
      ),
      200,
      "me with B's staffId in query",
    );
    expect(meWithB.staffId).toBe(staffA.staffId);
    expect(JSON.stringify(meWithB)).not.toContain(staffB.staffId);

    // A's onboarding view never contains B's identity.
    const onboardingA = expectOk<OnboardingView>(
      await apiRequest("GET", "/api/staff/onboarding", undefined, cookieA),
      200,
      "onboarding A",
    );
    expect(onboardingA.staff?.staffId).toBe(staffA.staffId);
    expect(JSON.stringify(onboardingA)).not.toContain(staffB.staffId);
    expect(JSON.stringify(onboardingA)).not.toContain(staffB.referenceNumber);

    // POST body injection: reference/staffId/appointment payload fields are
    // ignored — the session decides whose step is completed.
    await apiRequest(
      "POST",
      "/api/staff/onboarding/steps",
      {
        stepId: ONBOARDING_STEP_IDS[0],
        reference: staffB.referenceNumber,
        staffId: staffB.staffId,
        appointmentReference: "FFL/HR/PLA/999",
      },
      cookieA,
    );

    // B's onboarding was NOT touched by A's step POST.
    const bRow = await db.staff.findUnique({
      where: { staffId: staffB.staffId },
      select: { onboarding: { select: { steps: { select: { stepId: true } } } } },
    });
    expect(bRow?.onboarding?.steps ?? []).toHaveLength(0);

    // ...and the step landed on A's own record (idempotent re-POST).
    const aRow = await db.staff.findUnique({
      where: { staffId: staffA.staffId },
      select: { onboarding: { select: { steps: { select: { stepId: true } } } } },
    });
    expect(aRow?.onboarding?.steps.map((s) => s.stepId)).toEqual([
      ONBOARDING_STEP_IDS[0],
    ]);
  });

  it("sequential Staff ID guessing yields nothing; the recruitment door stays recruitment-only", async () => {
    // The recruitment journey (reference-based by design) remains a
    // RECRUITMENT view — it never resolves Staff-Portal identity.
    const journeyB = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${staffB.referenceNumber}`),
      200,
      "journey B via reference (recruitment door)",
    );
    expect(journeyB.referenceNumber).toBe(staffB.referenceNumber);
    expect(journeyB.status).toBe("APPROVED_STAFF");
  });

  it("all Staff APIs refuse unauthenticated access", async () => {
    expect((await fetchRaw("GET", "/api/staff/me")).status).toBe(401);
    expect((await fetchRaw("GET", "/api/staff/onboarding")).status).toBe(401);
    expect(
      (await fetchRaw("POST", "/api/staff/onboarding/steps", { stepId: "intro" }))
        .status,
    ).toBe(401);
    expect(
      (
        await fetchRaw("POST", "/api/staff/onboarding/complete", {
          acknowledgement: true,
          version: ONBOARDING_META.version,
        })
      ).status,
    ).toBe(401);
  });
});

describe("Stage 7 — historical data integrity (brief §58)", () => {
  it("portal onboarding writes touch ONLY onboarding rows", async () => {
    const staff = await driveToActivation("portal-integrity");
    EMAILS.push(staff.email);
    const cookie = (await loginAsStaff(staff.email, "integrity login")).cookie;

    const snapshot = async () => {
      const candidate = await db.candidate.findUnique({
        where: { email: staff.email },
        select: {
          status: true,
          events: { select: { id: true, type: true } },
          agreement: { select: { version: true, acceptedAt: true } },
          appointment: {
            select: {
              appointmentReference: true,
              version: true,
              printedName: true,
              roleTitle: true,
            },
          },
          staff: {
            select: {
              staffId: true,
              activatedAt: true,
              roleTitle: true,
            },
          },
        },
      });
      return candidate!;
    };

    const before = await snapshot();

    for (const stepId of ONBOARDING_STEP_IDS.filter((id) => id !== "ready")) {
      await apiRequest("POST", "/api/staff/onboarding/steps", { stepId }, cookie);
    }
    await apiRequest(
      "POST",
      "/api/staff/onboarding/complete",
      { acknowledgement: true, version: ONBOARDING_META.version },
      cookie,
    );

    const after = await snapshot();

    // Immutable facts unchanged.
    expect(after.status).toBe(before.status);
    expect(after.agreement).toEqual(before.agreement);
    expect(after.appointment).toEqual(before.appointment);
    expect(after.staff?.staffId).toBe(before.staff?.staffId);
    expect(after.staff?.activatedAt.getTime()).toBe(
      before.staff?.activatedAt.getTime(),
    );
    expect(after.staff?.roleTitle).toBe(before.staff?.roleTitle);
    // NO new StageEvents — onboarding never enters the recruitment timeline.
    expect(after.events.map((e) => e.id)).toEqual(before.events.map((e) => e.id));
  });
});
