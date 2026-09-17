/**
 * Stage 10 — Staff Resources integration tests: the registry as the single
 * source of truth (brief §3–§7), the rebuilt /staff/resources page
 * (brief §9), the NO-FAKE-DOWNLOADS hard requirement (brief §5), the
 * registry-derived home card (brief §10), the absent-API decision
 * (brief §32) and suspension behaviour via the existing session chain
 * (brief §25).
 *
 * Requires the dev server (`bun run dev`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import {
  STAFF_COMMUNICATION_REFERENCE,
  STAFF_RESOURCES,
  STAFF_RESOURCES_CATEGORIES,
  getStaffResourcesHomeSummary,
} from "@/config/staff-resources";

import { BASE_URL, apiRequest, assertServerUp, expectOk } from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import { driveToActivation, fetchRaw, loginAsStaff } from "./helpers/journey";

const EMAILS: string[] = [];

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(EMAILS);
  console.log(`[staff-resources] cleanup: removed ${removed} test candidate(s)`);
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

describe("Stage 10 — Staff Resources registry (source of truth)", () => {
  it("keeps the approved categories in the approved order (brief §7)", () => {
    expect([...STAFF_RESOURCES_CATEGORIES]).toEqual([
      "Marketing Resources",
      "Customer Education Materials",
      "Approved Marketing Guidelines",
      "Reporting Instructions",
      "Training Resources",
    ]);
  });

  it("has exactly one entry per approved category with unique ids", () => {
    expect(STAFF_RESOURCES).toHaveLength(STAFF_RESOURCES_CATEGORIES.length);
    const categories = STAFF_RESOURCES.map((entry) => entry.category);
    expect([...categories]).toEqual([...STAFF_RESOURCES_CATEGORIES]);
    expect(new Set(STAFF_RESOURCES.map((entry) => entry.id)).size).toBe(
      STAFF_RESOURCES.length,
    );
    for (const entry of STAFF_RESOURCES) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("matches the approved availability mapping exactly (brief §6)", () => {
    const byId = (id: string) =>
      STAFF_RESOURCES.find((entry) => entry.id === id)!;

    expect(byId("marketing-resources").availability).toBe("pending");
    expect(byId("customer-education-materials").availability).toBe("pending");
    expect(byId("approved-marketing-guidelines").availability).toBe("pending");

    const reporting = byId("reporting-instructions");
    expect(reporting.availability).toBe("in_portal");
    expect(reporting.href).toBe("/staff/reports");
    expect(reporting.actionLabel).toBe("Open Daily Reports");

    const training = byId("training-resources");
    expect(training.availability).toBe("in_portal");
    expect(training.href).toBe("/staff/training");
    expect(training.actionLabel).toBe("Open Staff Training");
  });

  it("contains ZERO file-backed entries, so no download action can ever render (brief §5)", () => {
    expect(
      STAFF_RESOURCES.filter((entry) => entry.availability === "available"),
    ).toHaveLength(0);
    // Belt and braces: no entry carries a file-ish action at all.
    for (const entry of STAFF_RESOURCES) {
      expect(entry.actionLabel ?? "").not.toMatch(/download/i);
    }
  });

  it("treats the Communication Group as channel context with no fabricated link (brief §6)", () => {
    const reference = STAFF_COMMUNICATION_REFERENCE as Record<string, unknown>;
    expect(reference.href).toBeUndefined();
    expect(STAFF_COMMUNICATION_REFERENCE.copy).toContain(
      "approved staff communication/onboarding channel",
    );
  });

  it("derives the home summary from registry truth — no fake counts (brief §10)", () => {
    const summary = getStaffResourcesHomeSummary();
    expect(summary.inPortal.map((r) => r.title)).toEqual([
      "Reporting Instructions",
      "Training Resources",
    ]);
    expect(summary.inPortal.map((r) => r.href)).toEqual([
      "/staff/reports",
      "/staff/training",
    ]);
    expect(summary.remainingNote).toContain(
      "approved staff communication/onboarding channel",
    );
  });
});

describe("Stage 10 — /staff/resources page (brief §9)", () => {
  let staffId = "";
  let cookie = "";

  beforeAll(async () => {
    // Session-only gate: onboarding completion is NOT required here.
    const driven = await driveToActivation("resources-page");
    EMAILS.push(driven.email);
    staffId = driven.staffId;
    cookie = (await loginAsStaff(driven.email, "resources login")).cookie;
  });

  it("blocks unauthenticated visitors — Next 16 serves the login redirect shell", async () => {
    // Next 16/Turbopack serves server-component redirects as HTTP 200 with
    // a client-side redirect payload (verified against /staff/profile):
    // the login target is present and the protected content is not.
    const page = await fetchPage("/staff/resources");
    expect(page.status).toBe(200);
    expect(page.html).toContain("/staff/login");
    expect(page.html).not.toContain("Resource categories");
    expect(page.html).not.toContain("Open Staff Training");
  });

  it("renders every approved category in approved order, with real actions only", async () => {
    const page = await fetchPage("/staff/resources", cookie);
    expect(page.status).toBe(200);
    const html = page.html;

    // Approved order (brief §7).
    const positions = STAFF_RESOURCES_CATEGORIES.map((category) =>
      html.indexOf(category),
    );
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    // Real in-portal actions, with the approved CTAs (brief §6).
    expect(html).toContain('href="/staff/training"');
    expect(html).toContain("Open Staff Training");
    expect(html).toContain('href="/staff/reports"');
    expect(html).toContain("Open Daily Reports");

    // Honest availability text for the rest (brief §4/§31).
    expect(html).toContain("Not yet supplied");
    expect(html).toContain(STAFF_COMMUNICATION_REFERENCE.title);
    expect(html).toContain("Resource categories");
  });

  it("NEVER renders fake or disabled downloads (brief §5 — hard requirement)", async () => {
    const page = await fetchPage("/staff/resources", cookie);
    expect(page.status).toBe(200);
    // Case-sensitive standalone "Download" — the honest word
    // "downloadable" in the availability note is NOT an action.
    expect(page.html).not.toMatch(/\bDownload\b/);
    expect(page.html).not.toMatch(/href="[^"]*\.pdf/i);
    expect(page.html).not.toContain(".docx");
    expect(page.html).not.toContain("/api/staff/resources");
  });

  it("creates NO /api/staff/resources route — the API decision holds (brief §32)", async () => {
    const withCookie = await fetchRaw("GET", "/api/staff/resources", undefined, cookie);
    expect(withCookie.status).toBe(404);
    const withoutCookie = await fetchRaw("GET", "/api/staff/resources");
    expect(withoutCookie.status).toBe(404);
  });

  it("keeps the honest per-account availability line", async () => {
    const page = await fetchPage("/staff/resources", cookie);
    expect(page.html).toContain(staffId);
    expect(page.html).toContain("shown honestly");
  });

  it("blocks suspended staff through the existing session chain (brief §25)", async () => {
    const suspended = await driveToActivation("resources-suspended");
    EMAILS.push(suspended.email);
    const suspendedCookie = (
      await loginAsStaff(suspended.email, "resources suspended login")
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

    const page = await fetchPage("/staff/resources", suspendedCookie);
    expect(page.status).toBe(200); // login redirect shell (see above)
    expect(page.html).toContain("/staff/login");
    expect(page.html).not.toContain("Resource categories");
    expect(page.html).not.toContain(suspended.staffId);
  });
});

describe("Stage 10 — Home Resources card derives from registry truth (brief §10)", () => {
  let cookie = "";

  beforeAll(async () => {
    const staff = await driveFullyOnboardedStaff("resources-home");
    cookie = staff.cookie;
  });

  it("shows the real in-portal resources, the honest remaining note and the approved CTA", async () => {
    const page = await fetchPage("/staff", cookie);
    expect(page.status).toBe(200);
    const html = page.html;

    expect(html).toContain("Staff Resources");
    expect(html).toContain("Training Resources");
    expect(html).toContain("Reporting Instructions");
    expect(html).toContain("Available in your portal");
    expect(html).toContain(
      "Other resource categories are not yet available in the portal",
    );
    expect(html).toContain("View Staff Resources");

    // The old Stage 7 list-only copy and CTA are gone.
    expect(html).not.toContain("See resource categories");
    expect(html).not.toContain(
      "These resources will be made available through your approved",
    );
  });
});
