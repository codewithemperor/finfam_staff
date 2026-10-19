/**
 * Stage 10 — Staff Identity Card integration tests: session-only identity
 * (brief §25), approved card content (brief §14–§24), sensitive-data
 * exclusions (brief §16), query-manipulation immunity (brief §39),
 * Staff-A/Staff-B isolation (brief §38), Home/Profile integration without
 * a nav item (brief §12/§13/§30/§31), the reused print architecture
 * (brief §26/§27) and ZERO-database-write integrity (brief §40).
 *
 * Requires the dev server (`bun run dev`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { format } from "date-fns";

import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import {
  STAFF_ID_CARD_DISCLAIMER,
  STAFF_ID_CARD_LABEL,
  STAFF_ID_CARD_TEMPLATE_VERSION,
} from "@/config/staff-id-card";
import { STAFF_PORTAL_OPERATIONAL_ROLE } from "@/config/staff-portal";

import { BASE_URL, apiRequest, assertServerUp, expectOk } from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import { driveToActivation, loginAsStaff } from "./helpers/journey";

const EMAILS: string[] = [];

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(EMAILS);
  console.log(`[staff-id-card] cleanup: removed ${removed} test candidate(s)`);
});

/** Page-level fetch that does NOT follow redirects (for gating checks). */
async function fetchPage(path: string, cookie?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const html = response.status === 200 ? await response.text() : "";
  return {
    status: response.status,
    location: response.headers.get("location"),
    html,
  };
}

/** Drive a candidate all the way to a COMPLETED onboarding (for /staff). */
async function driveFullyOnboardedStaff(label: string) {
  const driven = await driveToActivation(label);
  EMAILS.push(driven.email);
  const { cookie } = await loginAsStaff(driven.email, `${label} login`);
  const staffRow = await db.staff.findUnique({
    where: { staffId: driven.staffId },
    select: { id: true },
  });
  if (!staffRow) throw new Error(`[${label}] no Staff row for ${driven.staffId}`);
  for (const stepId of ONBOARDING_STEP_IDS.filter(
    (id) => id !== ONBOARDING_FINAL_STEP_ID,
  )) {
    expectOk(
      await apiRequest("POST", "/api/staff/onboarding/steps", { stepId }, cookie),
      200,
      `[${label}] onboarding step ${stepId}`,
    );
  }
  expectOk(
    await apiRequest(
      "POST",
      "/api/staff/onboarding/complete",
      { acknowledgement: true, version: ONBOARDING_META.version },
      cookie,
    ),
    200,
    `[${label}] onboarding complete`,
  );
  return { ...driven, rowId: staffRow.id, cookie };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Stage 10 — /staff/id-card authorization (brief §25/§38)", () => {
  it("blocks unauthenticated visitors — Next 16 serves the login redirect shell", async () => {
    // Next 16/Turbopack serves server-component redirects as HTTP 200 with
    // a client-side redirect payload (verified against /staff/profile):
    // the login target is present and the protected content is not.
    const page = await fetchPage("/staff/id-card");
    expect(page.status).toBe(200);
    expect(page.html).toContain("/staff/login");
    expect(page.html).not.toContain("View Staff ID Card");
    expect(page.html).not.toContain("Identity reference only");
  });

  it("blocks suspended staff — the existing session chain is the revocation system", async () => {
    const suspended = await driveToActivation("idcard-suspended");
    EMAILS.push(suspended.email);
    const suspendedCookie = (
      await loginAsStaff(suspended.email, "idcard suspended login")
    ).cookie;
    const staffRow = await db.staff.findUnique({
      where: { staffId: suspended.staffId },
      select: { id: true },
    });
    if (!staffRow) throw new Error("no Staff row for suspension fixture");
    await db.staffAccount.update({
      where: { staffId: staffRow.id },
      data: { status: "SUSPENDED" },
    });

    const page = await fetchPage("/staff/id-card", suspendedCookie);
    expect(page.status).toBe(200); // login redirect shell (see above)
    expect(page.html).toContain("/staff/login");
    expect(page.html).not.toContain("View Staff ID Card");
    expect(page.html).not.toContain(suspended.staffId);
  });
});

describe("Stage 10 — card content & identity fields (brief §14–§24)", () => {
  let staffA = {
    email: "",
    referenceNumber: "",
    staffId: "",
    rowId: "",
    cookie: "",
  };

  beforeAll(async () => {
    const driven = await driveToActivation("idcard-a");
    EMAILS.push(driven.email);
    await db.candidate.update({
      where: { email: driven.email },
      data: {
        passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      },
    });
    const cookie = (await loginAsStaff(driven.email, "idcard A login")).cookie;
    const staffRow = await db.staff.findUnique({
      where: { staffId: driven.staffId },
      select: { id: true, activatedAt: true },
    });
    if (!staffRow) throw new Error("no Staff row for idcard A");
    staffA = {
      email: driven.email,
      referenceNumber: driven.referenceNumber,
      staffId: driven.staffId,
      rowId: staffRow.id,
      cookie,
    };
  });

  it("renders the card from the session chain with the approved fields", async () => {
    const page = await fetchPage("/staff/id-card", staffA.cookie);
    expect(page.status).toBe(200);
    const html = page.html;

    expect(html).toContain("Staff ID Card"); // page h1
    expect(html).toContain(STAFF_ID_CARD_LABEL); // card heading
    expect(html).toMatch(/FF-STF-\d{4}/);
    expect(html).toContain(staffA.staffId);
    expect(html).toMatch(
      new RegExp(STAFF_PORTAL_OPERATIONAL_ROLE.replace("&", "(&amp;|&)")),
    );
    expect(html).toContain("Role");
    expect(html).toContain("Work");
    expect(html).toContain("Activated");
    expect(html).not.toContain("Identity reference only");
    expect(html).not.toContain(`Card template v${STAFF_ID_CARD_TEMPLATE_VERSION}`);
    expect(html).toContain(STAFF_ID_CARD_DISCLAIMER);
  });

  it("shows the activation date exactly as persisted (Staff.activatedAt)", async () => {
    const staffRow = await db.staff.findUnique({
      where: { id: staffA.rowId },
      select: { activatedAt: true },
    });
    if (!staffRow) throw new Error("Staff row disappeared");
    const page = await fetchPage("/staff/id-card", staffA.cookie);
    expect(page.html).toContain(
      format(staffRow.activatedAt, "d MMMM yyyy"),
    );
  });

  it("keeps the reused print architecture: print button, card target and hidden chrome", async () => {
    const page = await fetchPage("/staff/id-card", staffA.cookie);
    const html = page.html;

    expect(html).toContain("Print / Save as PDF");
    expect(html).toContain('data-testid="staff-id-card"');
    expect(html).toContain('data-testid="staff-id-card-back"');
    expect(html).toContain("Property of FinFam");
    expect(html).toContain("or the nearest police station");
    expect(html).not.toContain("Authorized Signatory");
    // Page-level supporting copy + the shell chrome all opt out of print.
    expect(countOccurrences(html, "print:hidden")).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Back to Profile");
  });

  it("contains NO sensitive fields on the card — and renders passport photo on card", async () => {
    const page = await fetchPage("/staff/id-card", staffA.cookie);
    const html = page.html;

    // Scope the forbidden-field checks to the CARD FACE: the page's
    // supporting copy legitimately says what the card is NOT (e.g. it
    // names NIN in "What it is not"), which is honest copy, not a field.
    const cardStart = html.indexOf('data-testid="staff-id-card"');
    expect(cardStart).toBeGreaterThan(-1);
    const cardHtml = html.slice(cardStart, html.indexOf("</section>", cardStart));

    // Identity/email leakage — the card never shows email or phone.
    expect(cardHtml).not.toMatch(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    );
    expect(cardHtml).not.toContain("0803 000 0007");

    // Government/financial identifiers — most do not exist in the schema;
    // the card must not introduce them either.
    expect(cardHtml).not.toMatch(/\bNIN\b/i);
    expect(cardHtml).not.toMatch(/\bBVN\b/i);
    expect(cardHtml).not.toContain("bank");

    // No fake credentials or decorative security furniture on the card.
    expect(cardHtml).not.toMatch(/\bQR\b/i);
    expect(cardHtml).not.toMatch(/expir/i);
    expect(cardHtml).not.toMatch(/signature/i);

    // Page-level: the concrete sensitive values never render anywhere.
    expect(html).not.toContain(staffA.email);
    expect(html).not.toContain(staffA.referenceNumber);
    expect(html).not.toContain("FFL-");
    expect(cardHtml).toContain("<img"); // passport photo is rendered
  });

  it("prompts the staff to upload a passport photo when not yet provided", async () => {
    const fresh = await driveToActivation("idcard-nopassport");
    EMAILS.push(fresh.email);
    const { cookie: freshCookie } = await loginAsStaff(
      fresh.email,
      "idcard no passport login",
    );
    const page = await fetchPage("/staff/id-card", freshCookie);
    expect(page.status).toBe(200);
    expect(page.html).toContain("Passport Photograph Required");
    expect(page.html).not.toContain('data-testid="staff-id-card"');
  });
});

describe("Stage 10 — query manipulation & cross-staff isolation (brief §38/§39)", () => {
  let staffA = { staffId: "", referenceNumber: "", email: "", cookie: "" };
  let staffB = { staffId: "", referenceNumber: "", email: "" };

  beforeAll(async () => {
    const a = await driveToActivation("idcard-iso-a");
    EMAILS.push(a.email);
    await db.candidate.update({
      where: { email: a.email },
      data: {
        passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      },
    });
    staffA = {
      staffId: a.staffId,
      referenceNumber: a.referenceNumber,
      email: a.email,
      cookie: (await loginAsStaff(a.email, "isolation A login")).cookie,
    };
    const b = await driveToActivation("idcard-iso-b");
    EMAILS.push(b.email);
    staffB = {
      staffId: b.staffId,
      referenceNumber: b.referenceNumber,
      email: b.email,
    };
  });

  it("?staffId=, ?reference= and ?email= cannot change the card identity", async () => {
    const manipulated = await fetchPage(
      `/staff/id-card?staffId=${encodeURIComponent(staffB.staffId)}&reference=${encodeURIComponent(staffB.referenceNumber)}&email=${encodeURIComponent(staffB.email)}`,
      staffA.cookie,
    );
    expect(manipulated.status).toBe(200);

    // Next 16 embeds the REQUEST'S query string in its RSC flight payload
    // (client-router machinery, inside <script> tags). The assertions
    // therefore run on the rendered document with scripts stripped: the
    // card and the page body show ONLY Staff A's identity.
    const documentHtml = manipulated.html.replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    );
    const cardStart = documentHtml.indexOf('data-testid="staff-id-card"');
    expect(cardStart).toBeGreaterThan(-1);
    const cardHtml = documentHtml.slice(
      cardStart,
      documentHtml.indexOf("</section>", cardStart),
    );
    expect(cardHtml).toContain(staffA.staffId);
    expect(cardHtml).not.toContain(staffB.staffId);
    expect(cardHtml).not.toContain(staffB.referenceNumber);
    expect(cardHtml).not.toContain(staffB.email);
    expect(documentHtml).not.toContain(staffB.staffId);
    expect(documentHtml).not.toContain(staffB.referenceNumber);
    expect(documentHtml).not.toContain(staffB.email);
  });

  it("Staff A's card never contains Staff B's identity anywhere", async () => {
    const page = await fetchPage("/staff/id-card", staffA.cookie);
    expect(page.status).toBe(200);
    expect(page.html).toContain(staffA.staffId);
    expect(page.html).not.toContain(staffB.staffId);
    expect(page.html).not.toContain(staffB.referenceNumber);
    expect(page.html).not.toContain(staffB.email);
  });

  it("creates NO /api/staff/id-card route — the API decision holds (brief §32)", async () => {
    const withCookie = await fetchPage("/api/staff/id-card", staffA.cookie);
    expect(withCookie.status).toBe(404);
  });
});

describe("Stage 10 — Home/Profile integration, no nav item (brief §12/§13/§30/§31)", () => {
  let staff = { staffId: "", cookie: "" };

  beforeAll(async () => {
    const onboarded = await driveFullyOnboardedStaff("idcard-home");
    staff = { staffId: onboarded.staffId, cookie: onboarded.cookie };
  });

  it("Home identity card gains exactly ONE id-card action and the nav stays unchanged", async () => {
    const page = await fetchPage("/staff", staff.cookie);
    expect(page.status).toBe(200);
    expect(page.html).toContain("View Staff ID Card");
    expect(countOccurrences(page.html, 'href="/staff/id-card"')).toBe(1);
    // The 7 approved destinations are all present in the nav.
    for (const label of [
      "Home",
      "Daily Reports",
      "Training",
      "My Appointment",
      "Onboarding",
      "Resources",
      "Profile",
    ]) {
      expect(page.html).toContain(label);
    }
  });

  it("Profile gains the read-only ID-card section with its own action", async () => {
    const page = await fetchPage("/staff/profile", staff.cookie);
    expect(page.status).toBe(200);
    expect(page.html).toContain("Staff ID Card");
    expect(page.html).toContain("View Staff ID Card");
    expect(countOccurrences(page.html, 'href="/staff/id-card"')).toBe(1);
  });
});

describe("Stage 10 — historical data integrity (brief §40: ZERO database rows)", () => {
  it("ordinary Resources/ID-card/Home/Profile activity writes nothing", async () => {
    const onboarded = await driveFullyOnboardedStaff("idcard-integrity");
    const cookie = onboarded.cookie;

    const snapshot = async () => ({
      candidates: await db.candidate.count(),
      staff: await db.staff.count(),
      staffAccounts: await db.staffAccount.count(),
      staffSessions: await db.staffSession.count(),
      staffLoginCodes: await db.staffLoginCode.count(),
      appointments: await db.appointment.count(),
      stageEvents: await db.stageEvent.count(),
      onboardings: await db.staffOnboarding.count(),
      onboardingSteps: await db.staffOnboardingStep.count(),
      dailyReports: await db.dailyReport.count(),
      enrollments: await db.staffTrainingEnrollment.count(),
      lessonProgress: await db.staffTrainingLessonProgress.count(),
      notifications: await db.notificationDelivery.count(),
    });

    const before = await snapshot();
    for (const path of [
      "/staff",
      "/staff/resources",
      "/staff/id-card",
      "/staff/profile",
    ]) {
      const page = await fetchPage(path, cookie);
      expect(page.status).toBe(200);
    }
    const after = await snapshot();
    expect(after).toEqual(before);
  });
});
