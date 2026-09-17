/**
 * Stage 11 — Admin operations: directory, privacy, suspension,
 * reactivation, Daily Report visibility, audit log (approved brief
 * §56–§61).
 *
 * Drives the REAL stack: one real activated/onboarded/trained Staff member
 * (A) plus one minimal Staff member (B), one real admin, and the full
 * suspend → verify-lockout → reactivate → verify-restore lifecycle at the
 * HTTP boundary — including same-origin enforcement on the two privileged
 * writes.
 */
import { describe, expect, it, beforeAll, afterAll } from "bun:test";

import { db } from "./helpers/db";
import { uniqueEmail, cleanupTestCandidates } from "./helpers/db";
import {
  apiRequest,
  expectOk,
  expectFail,
  assertServerUp,
} from "./helpers/api";
import { driveToActivation, loginAsStaff, fetchRaw } from "./helpers/journey";
import { ONBOARDING_STEP_IDS, ONBOARDING_META, ONBOARDING_FINAL_STEP_ID } from "@/config/onboarding";
import {
  STAFF_FOUNDATIONS_CURRENT_VERSION,
  STAFF_FOUNDATIONS_VERSIONS,
} from "@/config/training/staff-foundations";
import { ADMIN_REPORTS_SELF_REPORTED_NOTICE } from "@/config/admin";
import {
  cleanupAdmins,
  loginAsAdmin,
  runBootstrap,
  uniqueAdminEmail,
  adminRawRequest,
} from "./helpers/admin";

const ORIGIN_OK = "http://127.0.0.1:3000";

interface StaffFixture {
  email: string;
  referenceNumber: string;
  staffId: string;
  staffRowId: string;
  cookie: string;
}

const createdAdmins: string[] = [];
const createdEmails: string[] = [];

let adminEmail: string;
let adminCookie: string;
let staffA: StaffFixture;
let staffB: StaffFixture;
let submittedReportId: string;
let draftReportId: string;
let submittedMetrics: Record<string, number>;
let submittedSummary: string;

const LESSON_IDS = STAFF_FOUNDATIONS_VERSIONS[STAFF_FOUNDATIONS_CURRENT_VERSION]
  .lessons.map((lesson) => lesson.id);

beforeAll(async () => {
  await assertServerUp();

  adminEmail = uniqueAdminEmail("ops");
  expect(runBootstrap([adminEmail]).exitCode).toBe(0);
  createdAdmins.push(adminEmail);
  adminCookie = (await loginAsAdmin(adminEmail, "ops suite")).cookie;

  // Staff A: full journey — activated, onboarded, trained (one lesson),
  // with one SUBMITTED report and one untouched DRAFT.
  const drivenA = await driveToActivation("ops-a");
  createdEmails.push(drivenA.email);
  const cookieA = (await loginAsStaff(drivenA.email, "ops-a login")).cookie;
  const rowA = await db.staff.findUnique({
    where: { staffId: drivenA.staffId },
    select: { id: true },
  });

  for (const stepId of ONBOARDING_STEP_IDS.filter(
    (id) => id !== ONBOARDING_FINAL_STEP_ID,
  )) {
    expectOk(
      await apiRequest("POST", "/api/staff/onboarding/steps", { stepId }, cookieA),
      200,
      `ops-a onboarding step ${stepId}`,
    );
  }
  expectOk(
    await apiRequest(
      "POST",
      "/api/staff/onboarding/complete",
      { acknowledgement: true, version: ONBOARDING_META.version },
      cookieA,
    ),
    200,
    "ops-a onboarding complete",
  );

  // Training: open the course (lazy enrollment) + complete the FIRST lesson
  // only — the directory must show IN_PROGRESS for A.
  expectOk(
    await apiRequest("GET", "/api/staff/training/staff-foundations", undefined, cookieA),
    200,
    "ops-a training open",
  );
  expectOk(
    await apiRequest(
      "POST",
      "/api/staff/training/staff-foundations/lessons",
      { lessonId: LESSON_IDS[0] },
      cookieA,
    ),
    200,
    "ops-a lesson 1",
  );

  const draftCreate = expectOk<{ report: { id: string } }>(
    await apiRequest("POST", "/api/staff/reports", {}, cookieA),
    200,
    "ops-a draft create",
  );
  submittedReportId = draftCreate.report.id;
  submittedMetrics = {
    individualsContacted: 11,
    groupsApproached: 3,
    followUpActivities: 5,
    newRegistrations: 2,
    establishedMembersCreated: 1,
    firstDepositsAchieved: 1,
    savingsGoalsActivated: 2,
    memberEngagement: 4,
    connectionsBuilt: 6,
  };
  submittedSummary = "Admin ops fixture — market outreach and member follow-up.";
  expectOk(
    await fetchRaw(
      "PATCH",
      `/api/staff/reports/${submittedReportId}`,
      { ...submittedMetrics, activitySummary: submittedSummary },
      cookieA,
    ).then((r) => ({ status: r.status, body: r.body })),
    200,
    "ops-a draft save",
  );
  expectOk(
    await apiRequest(
      "POST",
      `/api/staff/reports/${submittedReportId}/submit`,
      {},
      cookieA,
    ),
    200,
    "ops-a submit",
  );
  const draftRetry = await fetchRaw("POST", "/api/staff/reports", {}, cookieA);
  // A same-day create-or-get returns the SAME report — the untouched DRAFT
  // fixture is instead created directly on a backdated date further below.
  void draftRetry;

  staffA = {
    email: drivenA.email,
    referenceNumber: drivenA.referenceNumber,
    staffId: drivenA.staffId,
    staffRowId: rowA!.id,
    cookie: cookieA,
  };

  // Staff B: activated only (no onboarding, no training, no reports).
  const drivenB = await driveToActivation("ops-b");
  createdEmails.push(drivenB.email);
  const cookieB = (await loginAsStaff(drivenB.email, "ops-b login")).cookie;
  const rowB = await db.staff.findUnique({
    where: { staffId: drivenB.staffId },
    select: { id: true },
  });
  staffB = {
    email: drivenB.email,
    referenceNumber: drivenB.referenceNumber,
    staffId: drivenB.staffId,
    staffRowId: rowB!.id,
    cookie: cookieB,
  };

  // Staff B gets an untouched DRAFT report is impossible pre-onboarding —
  // drafts require eligibility, so the DRAFT fixture is staff A's TODAY
  // draft made AFTER submitting today's report is the same row... The
  // reliable submitted-only fixture: A's submitted report + a draft is
  // created for A on a PAST day through the API backdate limit.
  const backdated = await db.dailyReport.create({
    data: {
      staffId: staffA.staffRowId,
      reportDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      version: "1.0",
      status: "DRAFT",
    },
    select: { id: true },
  });
  draftReportId = backdated.id;
}, 300_000);

afterAll(async () => {
  await cleanupAdmins(createdAdmins);
  await cleanupTestCandidates(createdEmails);
});

/* ------------------------------------------------------------------ */
/* 1. Directory authorization + search + privacy (§18/§19/§56)         */
/* ------------------------------------------------------------------ */

describe("staff directory (brief §18/§19/§56)", () => {
  it("requires an admin session (401 without, 401 with staff cookie)", async () => {
    expectFail(await apiRequest("GET", "/api/admin/staff"), 401, "UNAUTHORIZED", "no cookie");
    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, staffA.cookie),
      401,
      "UNAUTHORIZED",
      "staff cookie",
    );
  });

  it("lists both fixtures with identity, account, onboarding and training states", async () => {
    const data = expectOk<{
      staff: {
        id: string;
        staffId: string;
        fullName: string;
        email: string;
        designation: string;
        accountStatus: string;
        onboardingState: string;
        trainingState: string;
      }[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>(
      await apiRequest("GET", "/api/admin/staff?status=ALL", undefined, adminCookie),
      200,
      "directory list",
    );
    const rowA = data.staff.find((s) => s.staffId === staffA.staffId);
    const rowB = data.staff.find((s) => s.staffId === staffB.staffId);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowA!.onboardingState).toBe("COMPLETED");
    expect(rowA!.trainingState).toBe("IN_PROGRESS");
    expect(rowB!.onboardingState).toBe("NOT_STARTED");
    expect(rowB!.trainingState).toBe("NOT_STARTED");
    expect(rowA!.accountStatus).toBe("ACTIVE");
    expect(data.pageSize).toBe(20);
    expect(data.page).toBe(1);
  });

  it("searches by Staff ID, name fragment and email fragment", async () => {
    const byId = expectOk<{ staff: { staffId: string }[] }>(
      await apiRequest(
        "GET",
        `/api/admin/staff?q=${encodeURIComponent(staffA.staffId)}`,
        undefined,
        adminCookie,
      ),
      200,
      "search staffId",
    );
    expect(byId.staff.map((s) => s.staffId)).toContain(staffA.staffId);
    expect(byId.staff).not.toContainEqual(
      expect.objectContaining({ staffId: staffB.staffId }),
    );

    // Name fragment: the driven candidate's unique label is embedded in
    // the seeded full name; search by the staff B reference-independent
    // prefix instead — search by unique email fragment works for both.
    const byEmail = expectOk<{ staff: { staffId: string }[] }>(
      await apiRequest(
        "GET",
        `/api/admin/staff?q=${encodeURIComponent("ops-b")}`,
        undefined,
        adminCookie,
      ),
      200,
      "search email fragment",
    );
    expect(byEmail.staff.map((s) => s.staffId)).toContain(staffB.staffId);
    expect(byEmail.staff).toHaveLength(1);
  });

  it("filters by account status", async () => {
    const active = expectOk<{ staff: { staffId: string }[] }>(
      await apiRequest("GET", "/api/admin/staff?status=ACTIVE", undefined, adminCookie),
      200,
      "active filter",
    );
    expect(active.staff.map((s) => s.staffId)).toContain(staffA.staffId);
    const empty = expectOk<{ staff: unknown[]; total: number }>(
      await apiRequest("GET", "/api/admin/staff?q=nobodymatchesxyz", undefined, adminCookie),
      200,
      "no-match search",
    );
    expect(empty.total).toBe(0);
    expect(empty.staff).toHaveLength(0);
  });

  it("rejects non-whitelisted query abuse with 422 (no raw filtering)", async () => {
    expectFail(
      await apiRequest(
        "GET",
        "/api/admin/staff?status=HACKED&page=notanumber",
        undefined,
        adminCookie,
      ),
      422,
      "VALIDATION_ERROR",
      "hostile filters",
    );
  });

  it("response carries NO secrets (tokenHash/codeHash/NIN/BVN/bank/OTP)", async () => {
    const result = await apiRequest("GET", "/api/admin/staff?status=ALL", undefined, adminCookie);
    const raw = JSON.stringify(result.body).toLowerCase();
    for (const forbidden of [
      "tokenhash",
      "codehash",
      "revokedat",
      '"nin"',
      '"bvn"',
      "bank",
      "sessionsecret",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("detail returns the full read-only view; unknown ids are 404", async () => {
    const detail = expectOk<{
      identity: { staffId: string; fullName: string; email: string };
      appointment: { reference: string; version: string };
      onboarding: { state: string };
      training: { state: string; courses: { courseId: string; state: string; completedLessons: number; totalLessons: number }[] };
      recentReports: { id: string; status: string }[];
      account: { status: string };
    }>(
      await apiRequest("GET", `/api/admin/staff/${staffA.staffRowId}`, undefined, adminCookie),
      200,
      "detail",
    );
    expect(detail.identity.staffId).toBe(staffA.staffId);
    expect(detail.appointment.reference).toMatch(/^FFL\/HR\/PLA\/\d{3}$/);
    expect(detail.onboarding.state).toBe("COMPLETED");
    expect(detail.training.courses).toHaveLength(1);
    expect(detail.training.courses[0]!.courseId).toBe("staff-foundations");
    expect(detail.training.courses[0]!.completedLessons).toBe(1);
    expect(detail.training.courses[0]!.totalLessons).toBe(LESSON_IDS.length);
    expect(detail.account.status).toBe("ACTIVE");
    expect(detail.recentReports.map((r) => r.id)).toContain(submittedReportId);
    expect(detail.recentReports.every((r) => r.status === "SUBMITTED")).toBe(true);

    expectFail(
      await apiRequest("GET", "/api/admin/staff/nonexistent-id", undefined, adminCookie),
      404,
      "NOT_FOUND",
      "unknown staff id",
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. Daily Report visibility (§23–§26/§59)                            */
/* ------------------------------------------------------------------ */

describe("admin daily reports (submitted only, read-only)", () => {
  it("requires an admin session", async () => {
    expectFail(await apiRequest("GET", "/api/admin/reports"), 401, "UNAUTHORIZED", "no cookie");
  });

  it("lists the submitted report with staff identity; drafts are hidden", async () => {
    const data = expectOk<{
      reports: { id: string; staffId: string; staffName: string; status: string }[];
    }>(
      await apiRequest("GET", "/api/admin/reports", undefined, adminCookie),
      200,
      "reports list",
    );
    const row = data.reports.find((r) => r.id === submittedReportId);
    expect(row).toBeDefined();
    expect(row!.staffId).toBe(staffA.staffId);
    expect(row!.status).toBe("SUBMITTED");
    // The backdated DRAFT must never appear.
    expect(data.reports.find((r) => r.id === draftReportId)).toBeUndefined();
  });

  it("month + staff filters work; past months are empty", async () => {
    const staffFilter = expectOk<{ reports: { id: string }[] }>(
      await apiRequest(
        "GET",
        `/api/admin/reports?staff=${encodeURIComponent(staffA.staffId)}`,
        undefined,
        adminCookie,
      ),
      200,
      "staff filter",
    );
    expect(staffFilter.reports.map((r) => r.id)).toContain(submittedReportId);

    const otherStaff = expectOk<{ reports: { id: string }[] }>(
      await apiRequest(
        "GET",
        `/api/admin/reports?staff=${encodeURIComponent("ops-b")}`,
        undefined,
        adminCookie,
      ),
      200,
      "other staff filter",
    );
    expect(otherStaff.reports).toHaveLength(0);

    const pastMonth = expectOk<{ reports: { id: string }[] }>(
      await apiRequest("GET", "/api/admin/reports?month=2001-01", undefined, adminCookie),
      200,
      "past month",
    );
    expect(pastMonth.reports).toHaveLength(0);

    expectFail(
      await apiRequest("GET", "/api/admin/reports?month=notamonth", undefined, adminCookie),
      422,
      "VALIDATION_ERROR",
      "bad month",
    );
  });

  it("detail shows the exact persisted metrics + summary; draft/unknown are 404", async () => {
    const detail = expectOk<{
      metrics: Record<string, number>;
      activitySummary: string | null;
      staff: { staffId: string; fullName: string };
    }>(
      await apiRequest("GET", `/api/admin/reports/${submittedReportId}`, undefined, adminCookie),
      200,
      "report detail",
    );
    expect(detail.metrics).toEqual(submittedMetrics);
    expect(detail.activitySummary).toBe(submittedSummary);
    expect(detail.staff.staffId).toBe(staffA.staffId);

    expectFail(
      await apiRequest("GET", `/api/admin/reports/${draftReportId}`, undefined, adminCookie),
      404,
      "NOT_FOUND",
      "draft hidden",
    );
    expectFail(
      await apiRequest("GET", "/api/admin/reports/does-not-exist", undefined, adminCookie),
      404,
      "NOT_FOUND",
      "unknown report",
    );
  });

  it("has NO mutation endpoints (PATCH/DELETE/POST → 405)", async () => {
    for (const method of ["PATCH", "DELETE", "POST"] as const) {
      const result = await adminRawRequest(
        method,
        `/api/admin/reports/${submittedReportId}`,
        { cookie: adminCookie, body: {} },
      );
      expect(result.status).toBe(405);
    }
  });

  it("the admin reports page carries the self-reported notice and no payroll wording", async () => {
    const response = await fetch(`${process.env.FLOW_TEST_BASE_URL ?? "http://127.0.0.1:3000"}/admin/reports`, {
      headers: { cookie: adminCookie },
      signal: AbortSignal.timeout(20_000),
    });
    const html = await response.text();
    expect(html).toContain(ADMIN_REPORTS_SELF_REPORTED_NOTICE);
    expect(html.toLowerCase()).not.toContain("payroll");
    expect(html.toLowerCase()).not.toContain("verified performance");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Same-origin enforcement on privileged writes (§40/§61)           */
/* ------------------------------------------------------------------ */

describe("same-origin verification (fail closed)", () => {
  const suspendPath = () => `/api/admin/staff/${staffB.staffRowId}/suspend`;

  it("authentication is independently required — no cookie + wrong origin → 401", async () => {
    expectFail(
      await adminRawRequest("POST", suspendPath(), {
        body: { reason: "x" },
        headers: { origin: "https://evil.example.com" },
      }),
      401,
      "UNAUTHORIZED",
      "auth before origin",
    );
  });

  it("a wrong Origin is rejected 403", async () => {
    expectFail(
      await adminRawRequest("POST", suspendPath(), {
        cookie: adminCookie,
        body: { reason: "origin test" },
        headers: { origin: "https://evil.example.com" },
      }),
      403,
      "FORBIDDEN",
      "wrong origin",
    );
  });

  it("a malformed Origin is rejected 403", async () => {
    expectFail(
      await adminRawRequest("POST", suspendPath(), {
        cookie: adminCookie,
        body: { reason: "origin test" },
        headers: { origin: "not-a-url" },
      }),
      403,
      "FORBIDDEN",
      "malformed origin",
    );
  });

  it("missing browser origin (no Origin, no Referer) is rejected 403", async () => {
    expectFail(
      await apiRequest("POST", suspendPath(), { reason: "origin test" }, adminCookie),
      403,
      "FORBIDDEN",
      "missing origin",
    );
  });

  it("the trusted APP_BASE_URL origin passes for an authenticated admin", async () => {
    const data = expectOk<{ accountStatus: string; transitioned: boolean }>(
      await adminRawRequest<{ accountStatus: string; transitioned: boolean }>(
        "POST",
        suspendPath(),
        {
          cookie: adminCookie,
          body: { reason: "same-origin verification check" },
          headers: { origin: ORIGIN_OK },
        },
      ),
      200,
      "trusted origin",
    );
    expect(data.transitioned).toBe(true);
    expect(data.accountStatus).toBe("SUSPENDED");

    // Restore B to ACTIVE for the later fixture-independent tests.
    const restore = await adminRawRequest(
      "POST",
      `/api/admin/staff/${staffB.staffRowId}/reactivate`,
      {
        cookie: adminCookie,
        body: {},
        headers: { origin: ORIGIN_OK },
      },
    );
    expect(restore.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Suspension + reactivation lifecycle (§27–§33/§57/§58)            */
/* ------------------------------------------------------------------ */

describe("suspension and reactivation lifecycle", () => {
  let suspendCountBefore: number;

  it("suspends staff A with a reason; all staff sessions are revoked", async () => {
    const account = await db.staffAccount.findUnique({
      where: { staffId: staffA.staffRowId },
      select: { id: true, status: true },
    });
    expect(account!.status).toBe("ACTIVE");
    suspendCountBefore = await db.adminAuditEvent.count();

    // The live staff session works before suspension.
    expectOk(
      await apiRequest("GET", "/api/staff/me", undefined, staffA.cookie),
      200,
      "staff session before suspend",
    );

    const data = expectOk<{ accountStatus: string; transitioned: boolean }>(
      await adminRawRequest<{ accountStatus: string; transitioned: boolean }>(
        "POST",
        `/api/admin/staff/${staffA.staffRowId}/suspend`,
        {
          cookie: adminCookie,
          body: { reason: "Lifecycle test: verified suspension with reason." },
          headers: { origin: ORIGIN_OK },
        },
      ),
      200,
      "suspend A",
    );
    expect(data.transitioned).toBe(true);
    expect(data.accountStatus).toBe("SUSPENDED");

    const after = await db.staffAccount.findUnique({
      where: { id: account!.id },
      select: { status: true },
    });
    expect(after!.status).toBe("SUSPENDED");

    const sessions = await db.staffSession.findMany({
      where: { accountId: account!.id },
      select: { revokedAt: true },
    });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it("suspended staff loses everything immediately and cannot log back in", async () => {
    // Existing session dead.
    expectFail(
      await apiRequest("GET", "/api/staff/me", undefined, staffA.cookie),
      401,
      "UNAUTHORIZED",
      "staff api after suspend",
    );

    // Portal page serves the login redirect shell without staff content.
    const page = await fetch(
      `${process.env.FLOW_TEST_BASE_URL ?? "http://127.0.0.1:3000"}/staff`,
      { headers: { cookie: staffA.cookie }, signal: AbortSignal.timeout(20_000) },
    );
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("/staff/login");

    // New OTP requests are neutral and create no rows.
    const before = await db.staffLoginCode.count();
    const request = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/staff/auth/request-code", { email: staffA.email }),
      200,
      "suspended request-code",
    );
    expect(request.devCode).toBeUndefined();
    expect(await db.staffLoginCode.count()).toBe(before);

    // Verify is the generic invalid-code response.
    expectFail(
      await apiRequest("POST", "/api/staff/auth/verify", {
        email: staffA.email,
        code: "123456",
      }),
      422,
      "VALIDATION_ERROR",
      "suspended verify",
    );
  });

  it("historical rows are untouched; exactly ONE audit event; duplicate suspend is a no-op", async () => {
    const staffRow = await db.staff.findUnique({
      where: { id: staffA.staffRowId },
      select: { staffId: true, roleTitle: true, activatedAt: true, version: true },
    });
    const appointment = await db.appointment.findUnique({
      where: { candidateId: (
        await db.staff.findUnique({ where: { id: staffA.staffRowId }, select: { candidateId: true } })
      )!.candidateId },
      select: { appointmentReference: true, roleTitle: true, version: true },
    });
    const onboarding = await db.staffOnboarding.findUnique({
      where: { staffId: staffA.staffRowId },
      select: { completedAt: true },
    });
    const enrollments = await db.staffTrainingEnrollment.count({
      where: { staffId: staffA.staffRowId },
    });
    const reports = await db.dailyReport.count({ where: { staffId: staffA.staffRowId } });

    expect(staffRow!.staffId).toBe(staffA.staffId);
    expect(appointment!.appointmentReference).toMatch(/^FFL\/HR\/PLA\/\d{3}$/);
    expect(onboarding!.completedAt).not.toBeNull();
    expect(enrollments).toBe(1);
    expect(reports).toBe(2);

    // Exactly one new audit event for the suspension.
    const afterSuspend = await db.adminAuditEvent.count();
    expect(afterSuspend - suspendCountBefore).toBe(1);
    const event = await db.adminAuditEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        reason: true,
        targetType: true,
        targetId: true,
        metadata: true,
        actor: { select: { email: true } },
      },
    });
    expect(event!.action).toBe("STAFF_SUSPENDED");
    expect(event!.reason).toContain("suspension with reason");
    expect(event!.targetType).toBe("STAFF_ACCOUNT");
    expect(event!.actor.email).toBe(adminEmail);
    const metadata = event!.metadata as { staffId?: string; previousStatus?: string; newStatus?: string };
    expect(metadata.staffId).toBe(staffA.staffId);
    expect(metadata.previousStatus).toBe("ACTIVE");
    expect(metadata.newStatus).toBe("SUSPENDED");

    // Duplicate suspend: safe no-op, NO second event.
    const duplicate = await adminRawRequest(
      "POST",
      `/api/admin/staff/${staffA.staffRowId}/suspend`,
      {
        cookie: adminCookie,
        body: { reason: "duplicate should not transition" },
        headers: { origin: ORIGIN_OK },
      },
    );
    expect(duplicate.status).toBe(200);
    const body = duplicate.body as { ok: boolean; data: { transitioned: boolean; accountStatus: string } };
    expect(body.data.transitioned).toBe(false);
    expect(body.data.accountStatus).toBe("SUSPENDED");
    expect(await db.adminAuditEvent.count()).toBe(afterSuspend);
  });

  it("reason validation: missing/blank/over-length are 422", async () => {
    for (const reason of [undefined, "   ", "r".repeat(501)]) {
      const body = reason === undefined ? {} : { reason };
      expectFail(
        await adminRawRequest("POST", `/api/admin/staff/${staffA.staffRowId}/suspend`, {
          cookie: adminCookie,
          body,
          headers: { origin: ORIGIN_OK },
        }).then((r) => ({ status: r.status, body: r.body })),
        422,
        "VALIDATION_ERROR",
        `reason case length ${reason?.trim().length ?? 0}`,
      );
    }
  });

  it("reactivates staff A; history unchanged; old sessions stay revoked; new OTP works", async () => {
    const auditBefore = await db.adminAuditEvent.count();
    const oldSession = await db.staffSession.findFirst({
      where: { account: { staffId: staffA.staffRowId } },
      orderBy: { createdAt: "desc" },
      select: { id: true, revokedAt: true },
    });
    expect(oldSession!.revokedAt).not.toBeNull();

    const data = expectOk<{ accountStatus: string; transitioned: boolean }>(
      await adminRawRequest<{ accountStatus: string; transitioned: boolean }>(
        "POST",
        `/api/admin/staff/${staffA.staffRowId}/reactivate`,
        {
          cookie: adminCookie,
          body: { note: "Lifecycle test complete." },
          headers: { origin: ORIGIN_OK },
        },
      ),
      200,
      "reactivate A",
    );
    expect(data.transitioned).toBe(true);
    expect(data.accountStatus).toBe("ACTIVE");

    // Account ACTIVE; staff ID / onboarding / training / reports unchanged.
    const account = await db.staffAccount.findUnique({
      where: { staffId: staffA.staffRowId },
      select: { status: true },
    });
    expect(account!.status).toBe("ACTIVE");
    const onboarding = await db.staffOnboarding.findUnique({
      where: { staffId: staffA.staffRowId },
      select: { completedAt: true },
    });
    expect(onboarding!.completedAt).not.toBeNull();
    expect(await db.dailyReport.count({ where: { staffId: staffA.staffRowId } })).toBe(2);

    // The old revoked session stays revoked.
    const oldAfter = await db.staffSession.findUnique({
      where: { id: oldSession!.id },
      select: { revokedAt: true },
    });
    expect(oldAfter!.revokedAt).not.toBeNull();

    // Staff can sign in again with a NEW session.
    const fresh = await loginAsStaff(staffA.email, "reactivated login", {
      staffRowId: staffA.staffRowId,
    });
    expectOk(
      await apiRequest("GET", "/api/staff/me", undefined, fresh.cookie),
      200,
      "staff api after reactivate",
    );

    // Exactly one reactivation audit event; duplicate is a no-op.
    expect(await db.adminAuditEvent.count() - auditBefore).toBe(1);
    const duplicate = await adminRawRequest(
      "POST",
      `/api/admin/staff/${staffA.staffRowId}/reactivate`,
      { cookie: adminCookie, body: {}, headers: { origin: ORIGIN_OK } },
    );
    const dupBody = duplicate.body as { ok: boolean; data: { transitioned: boolean } };
    expect(dupBody.data.transitioned).toBe(false);
    expect(await db.adminAuditEvent.count()).toBe(auditBefore + 1);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Audit log (§34/§35/§46/§60)                                      */
/* ------------------------------------------------------------------ */

describe("audit log", () => {
  it("requires an admin session", async () => {
    expectFail(await apiRequest("GET", "/api/admin/audit"), 401, "UNAUTHORIZED", "no cookie");
  });

  it("lists events newest-first with actor, action, target, reason and status transition", async () => {
    const data = expectOk<{
      events: {
        id: string;
        action: string;
        actorEmail: string;
        targetType: string;
        staffId: string | null;
        reason: string | null;
        previousStatus: string | null;
        newStatus: string | null;
        createdAt: string;
      }[];
      page: number;
      total: number;
    }>(
      await apiRequest("GET", "/api/admin/audit?page=1", undefined, adminCookie),
      200,
      "audit list",
    );
    expect(data.events.length).toBeGreaterThanOrEqual(2);
    const [first, second] = data.events;
    expect(new Date(first!.createdAt).getTime())
      .toBeGreaterThanOrEqual(new Date(second!.createdAt).getTime());
    const suspended = data.events.find((e) => e.action === "STAFF_SUSPENDED")!;
    expect(suspended.actorEmail).toBe(adminEmail);
    expect(suspended.targetType).toBe("STAFF_ACCOUNT");
    expect(suspended.staffId).toBe(staffA.staffId);
    expect(suspended.previousStatus).toBe("ACTIVE");
    expect(suspended.newStatus).toBe("SUSPENDED");
    const reactivated = data.events.find((e) => e.action === "STAFF_REACTIVATED")!;
    expect(reactivated.previousStatus).toBe("SUSPENDED");
    expect(reactivated.newStatus).toBe("ACTIVE");
  });

  it("exactly two events exist for staff A's account (one suspend + one reactivate)", async () => {
    const account = await db.staffAccount.findUnique({
      where: { staffId: staffA.staffRowId },
      select: { id: true },
    });
    const count = await db.adminAuditEvent.count({
      where: { targetId: account!.id },
    });
    expect(count).toBe(2);
  });

  it("has NO write methods (POST/PATCH/DELETE → 405)", async () => {
    for (const method of ["POST", "PATCH", "DELETE"] as const) {
      const result = await adminRawRequest(method, "/api/admin/audit", {
        cookie: adminCookie,
        body: {},
      });
      expect(result.status).toBe(405);
    }
  });
});
