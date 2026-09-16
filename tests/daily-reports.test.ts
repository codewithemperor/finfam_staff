/**
 * Stage 8 — Daily Reporting & Accountability (end-to-end, real dev server).
 *
 * Drives REAL staff members through activation → OTP login → onboarding
 * completion, then exercises the reporting APIs over real HTTP with direct
 * Prisma assertions for the persistence invariants:
 *
 *   - eligibility (onboarding gate → 403 FORBIDDEN, never 401/404)
 *   - identity (session-only; extra identity-ish body fields are ignored)
 *   - create-or-get + 4-way concurrent create → exactly one row
 *   - Africa/Lagos date rules (today default, backdate window, future 422)
 *   - draft full-replace saves with per-field validation (never clamped)
 *   - one-way submission latch (repeat + 4-way concurrent → ONE submittedAt)
 *   - submitted = permanently read-only (409 on PATCH)
 *   - ownership (foreign report ids are plain 404 — never 403/409)
 *   - exactly-once DAILY_REPORT_SUBMITTED receipt (dedupeKey) queued with
 *     the winning submission and left PENDING while notifications are off
 *   - month-bounded paginated history + today state
 *   - schema keys === config metric names (form/validation can't drift)
 *   - DAILY_REPORT_SUBMITTED template renders the approved receipt copy
 *
 * Boundary: these tests also pin what must NOT exist — no payroll/
 * earnings/commission fields anywhere in the report surface.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  DAILY_REPORT_CATEGORIES,
  DAILY_REPORT_MAX_COUNT,
  DAILY_REPORT_METRIC_NAMES,
  DAILY_REPORT_PAGE_SIZE,
} from "@/config/daily-report";
import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import { lagosDateISOToUtcMidnight, lagosTodayISO } from "@/lib/dates/lagos";
import { dailyReportDraftSchema } from "@/lib/validation/daily-report";
import {
  NOTIFICATION_TEMPLATE_VERSION,
  renderNotificationEmail,
} from "@/server/notifications/notification-templates";

import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
  type ApiResult,
} from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import {
  driveToActivation,
  fetchRaw,
  loginAsStaff,
} from "./helpers/journey";

/* ----------------------------------------------------------------- */
/* Local HTTP helpers (the shared helper only speaks GET/POST)        */
/* ----------------------------------------------------------------- */

const BASE_URL =
  process.env.FLOW_TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  cookie: string,
): Promise<ApiResult<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = await response.json().catch(() => null);
  return { status: response.status, body: parsed as ApiResult<T>["body"] };
}

/* ----------------------------------------------------------------- */
/* Shared fixtures                                                    */
/* ----------------------------------------------------------------- */

const METRIC_NAMES = [...DAILY_REPORT_METRIC_NAMES] as string[];

/** A full valid draft body with distinct non-zero values. */
function sampleMetrics(seed = 1): Record<string, number> {
  return Object.fromEntries(
    METRIC_NAMES.map((name, index) => [name, ((seed + index) % 12) + 1]),
  );
}

/** Date N days before today (Africa/Lagos; negative N = future), YYYY-MM-DD. */
function daysAgo(n: number): string {
  const today = lagosTodayISO();
  const utcMidnight = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return new Date(utcMidnight - n * 86_400_000).toISOString().slice(0, 10);
}

interface StaffFixture {
  email: string;
  referenceNumber: string;
  staffId: string;
  staffRowId: string;
  cookie: string;
  todayReportId?: string;
  yesterdayReportId?: string;
  dayMinus2ReportId?: string;
}

const createdEmails: string[] = [];

/** Drive one candidate all the way through completed onboarding. */
async function driveFullyOnboardedStaff(label: string): Promise<StaffFixture> {
  const driven = await driveToActivation(label);
  createdEmails.push(driven.email);

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

  return {
    email: driven.email,
    referenceNumber: driven.referenceNumber,
    staffId: driven.staffId,
    staffRowId: staffRow.id,
    cookie,
  };
}

let staffA: StaffFixture;
let staffB: StaffFixture;
let staffC: StaffFixture;

beforeAll(async () => {
  await assertServerUp();
  staffA = await driveFullyOnboardedStaff("reports-a");
  staffB = await driveFullyOnboardedStaff("reports-b");

  // Staff C stops at activation — the eligibility tests use this account
  // while its onboarding is still INCOMPLETE.
  const drivenC = await driveToActivation("reports-c");
  createdEmails.push(drivenC.email);
  const { cookie } = await loginAsStaff(drivenC.email, "reports-c login");
  const rowC = await db.staff.findUnique({
    where: { staffId: drivenC.staffId },
    select: { id: true },
  });
  staffC = {
    email: drivenC.email,
    referenceNumber: drivenC.referenceNumber,
    staffId: drivenC.staffId,
    staffRowId: rowC!.id,
    cookie,
  };
}, 300_000);

afterAll(async () => {
  await cleanupTestCandidates(createdEmails);
});

/* ----------------------------------------------------------------- */
/* 1. Eligibility — the onboarding gate is 403 FORBIDDEN              */
/* ----------------------------------------------------------------- */

describe("eligibility gate (onboarding incomplete → 403 FORBIDDEN)", () => {
  it("GET /api/staff/reports is 403 FORBIDDEN before onboarding completes", async () => {
    const result = await apiRequest("GET", "/api/staff/reports", undefined, staffC.cookie);
    expectFail(result, 403, "FORBIDDEN", "list before onboarding");
  });

  it("POST create-or-get is 403 before onboarding completes", async () => {
    const result = await apiRequest("POST", "/api/staff/reports", {}, staffC.cookie);
    expectFail(result, 403, "FORBIDDEN", "create before onboarding");
  });

  it("PATCH is eligibility-first: 403 before ownership is even considered", async () => {
    const result = await apiPatch(
      `/api/staff/reports/${staffB.todayReportId ?? "cuid-not-owned"}`,
      sampleMetrics(),
      staffC.cookie,
    );
    const error = expectFail(result, 403, "FORBIDDEN", "patch before onboarding");
    // The message routes the user to onboarding — never to the login screen.
    expect(error.message.toLowerCase()).toContain("onboarding");
  });

  it("POST submit is 403 before onboarding completes", async () => {
    const result = await apiRequest(
      "POST",
      `/api/staff/reports/${staffB.todayReportId ?? "cuid-not-owned"}/submit`,
      {},
      staffC.cookie,
    );
    expectFail(result, 403, "FORBIDDEN", "submit before onboarding");
  });
});

/* ----------------------------------------------------------------- */
/* 2. Create-or-get + Africa/Lagos date rules                         */
/* ----------------------------------------------------------------- */

describe("create-or-get and Africa/Lagos date rules", () => {
  it("POST with an empty body creates TODAY's draft (Africa/Lagos default)", async () => {
    const data = expectOk<{
      report: {
        id: string;
        reportDate: string;
        status: string;
        version: string;
        metrics: Record<string, number>;
      };
      created: boolean;
    }>(await apiRequest("POST", "/api/staff/reports", {}, staffA.cookie), 200, "create today");

    expect(data.created).toBe(true);
    expect(data.report.reportDate).toBe(lagosTodayISO());
    expect(data.report.status).toBe("DRAFT");
    expect(data.report.version).toBe("1.0");
    for (const name of METRIC_NAMES) {
      expect(data.report.metrics[name]).toBe(0);
    }
    staffA.todayReportId = data.report.id;
  });

  it("a second POST for today returns the SAME row with created:false", async () => {
    const data = expectOk<{ report: { id: string }; created: boolean }>(
      await apiRequest("POST", "/api/staff/reports", {}, staffA.cookie),
      200,
      "create today again",
    );
    expect(data.created).toBe(false);
    expect(data.report.id).toBe(staffA.todayReportId!);
  });

  it("identity is session-only: identity-ish body fields are ignored", async () => {
    const yesterday = daysAgo(1);
    const data = expectOk<{ report: { id: string; reportDate: string }; created: boolean }>(
      await apiRequest(
        "POST",
        "/api/staff/reports",
        {
          reportDate: yesterday,
          staffId: staffB.staffId,
          email: staffB.email,
          reference: staffB.referenceNumber,
          accountId: staffB.staffRowId,
        },
        staffA.cookie,
      ),
      200,
      "create yesterday with hostile identity fields",
    );
    expect(data.created).toBe(true);
    expect(data.report.reportDate).toBe(yesterday);
    const row = await db.dailyReport.findUnique({
      where: { id: data.report.id },
      select: { staffId: true },
    });
    expect(row?.staffId).toBe(staffA.staffRowId);
    staffA.yesterdayReportId = data.report.id;
  });

  it("future dates are rejected (422 VALIDATION_ERROR)", async () => {
    const result = await apiRequest(
      "POST",
      "/api/staff/reports",
      { reportDate: daysAgo(-1) },
      staffA.cookie,
    );
    const error = expectFail(result, 422, "VALIDATION_ERROR", "future date");
    expect(error.fields?.reportDate).toBeTruthy();
  });

  it("dates beyond the 7-day backdate window are rejected; day 7 is allowed", async () => {
    const tooOld = await apiRequest(
      "POST",
      "/api/staff/reports",
      { reportDate: daysAgo(8) },
      staffA.cookie,
    );
    expectFail(tooOld, 422, "VALIDATION_ERROR", "8 days back");

    const edge = expectOk<{ report: { id: string }; created: boolean }>(
      await apiRequest("POST", "/api/staff/reports", { reportDate: daysAgo(7) }, staffA.cookie),
      200,
      "7 days back allowed",
    );
    expect(edge.created).toBe(true);
    // Not needed for later tests — remove to keep the history assertions tight.
    await db.dailyReport.delete({ where: { id: edge.report.id } });
  });

  it("malformed dates are rejected with a field error", async () => {
    const result = await apiRequest(
      "POST",
      "/api/staff/reports",
      { reportDate: "2026-9-16" },
      staffA.cookie,
    );
    expectFail(result, 422, "VALIDATION_ERROR", "malformed date");
  });

  it("4 concurrent create-or-get calls for one date produce EXACTLY one row", async () => {
    const date = daysAgo(2);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        fetchRaw("POST", "/api/staff/reports", { reportDate: date }, staffA.cookie),
      ),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    const ids = new Set(
      responses.map(
        (r) => (r.body as { data: { report: { id: string } } }).data.report.id,
      ),
    );
    expect(ids.size).toBe(1);

    const rows = await db.dailyReport.findMany({
      where: {
        staffId: staffA.staffRowId,
        reportDate: lagosDateISOToUtcMidnight(date),
      },
    });
    expect(rows.length).toBe(1);
    staffA.dayMinus2ReportId = [...ids][0];
  });
});

/* ----------------------------------------------------------------- */
/* 3. Draft saves — full-replace, per-field validation, never clamped */
/* ----------------------------------------------------------------- */

describe("draft saves (PATCH /api/staff/reports/[id])", () => {
  it("saves a full set of metrics and the trimmed summary; status stays DRAFT", async () => {
    const metrics = sampleMetrics(3);
    const patched = await apiPatch<{
      status: string;
      metrics: Record<string, number>;
      activitySummary: string | null;
    }>(
      `/api/staff/reports/${staffA.todayReportId}`,
      { ...metrics, activitySummary: "  Community outreach at the market.  " },
      staffA.cookie,
    );
    expect(patched.status).toBe(200);
    const data = (patched.body as { ok: true; data: { status: string; metrics: Record<string, number>; activitySummary: string | null } }).data;

    expect(data.status).toBe("DRAFT");
    for (const [name, value] of Object.entries(metrics)) {
      expect(data.metrics[name]).toBe(value);
    }
    expect(data.activitySummary).toBe("Community outreach at the market.");
  });

  it("zeros are valid; an emptied summary persists as null", async () => {
    const zeros = Object.fromEntries(METRIC_NAMES.map((name) => [name, 0]));
    const patched = await apiPatch<{ metrics: Record<string, number>; activitySummary: string | null }>(
      `/api/staff/reports/${staffA.todayReportId}`,
      { ...zeros, activitySummary: "" },
      staffA.cookie,
    );
    expect(patched.status).toBe(200);
    const data = (patched.body as { ok: true; data: { metrics: Record<string, number>; activitySummary: string | null } }).data;

    expect(data.activitySummary).toBeNull();
    for (const name of METRIC_NAMES) expect(data.metrics[name]).toBe(0);
  });

  it("rejects out-of-range counts with field errors — never silently clamped", async () => {
    for (const invalid of [DAILY_REPORT_MAX_COUNT + 1, -1, 3.5, "7"]) {
      const result = await apiPatch(
        `/api/staff/reports/${staffA.todayReportId}`,
        { ...sampleMetrics(), individualsContacted: invalid },
        staffA.cookie,
      );
      const error = expectFail(result, 422, "VALIDATION_ERROR", `invalid count ${String(invalid)}`);
      expect(error.fields?.individualsContacted).toBeTruthy();
    }
    const row = await db.dailyReport.findUnique({
      where: { id: staffA.todayReportId },
      select: { individualsContacted: true },
    });
    expect(row?.individualsContacted).toBe(0);
  });

  it("rejects a summary longer than 1000 characters", async () => {
    const result = await apiPatch(
      `/api/staff/reports/${staffA.todayReportId}`,
      { ...sampleMetrics(), activitySummary: "x".repeat(1001) },
      staffA.cookie,
    );
    const error = expectFail(result, 422, "VALIDATION_ERROR", "summary too long");
    expect(error.fields?.activitySummary).toBeTruthy();
  });

  it("a foreign report id is a plain 404 — never 403 or 409", async () => {
    // Staff B creates a draft; staff A must not even learn it exists.
    const bReport = expectOk<{ report: { id: string } }>(
      await apiRequest("POST", "/api/staff/reports", {}, staffB.cookie),
      200,
      "B creates report",
    );
    staffB.todayReportId = bReport.report.id;

    const patched = await apiPatch(
      `/api/staff/reports/${staffB.todayReportId}`,
      sampleMetrics(),
      staffA.cookie,
    );
    expectFail(patched, 404, "NOT_FOUND", "A patches B's report");

    const read = await apiRequest(
      "GET",
      `/api/staff/reports/${staffB.todayReportId}`,
      undefined,
      staffA.cookie,
    );
    expectFail(read, 404, "NOT_FOUND", "A reads B's report");

    const submitted = await apiRequest(
      "POST",
      `/api/staff/reports/${staffB.todayReportId}/submit`,
      {},
      staffA.cookie,
    );
    expectFail(submitted, 404, "NOT_FOUND", "A submits B's report");
  });

  it("unknown report ids are 404", async () => {
    const patched = await apiPatch(
      "/api/staff/reports/cuid-does-not-exist",
      sampleMetrics(),
      staffA.cookie,
    );
    expectFail(patched, 404, "NOT_FOUND", "unknown id patch");
  });
});

/* ----------------------------------------------------------------- */
/* 4. Submission — one-way latch, exactly-once receipt                */
/* ----------------------------------------------------------------- */

describe("submission (POST /api/staff/reports/[id]/submit)", () => {
  it("submits the draft; submittedAt stamped once; receipt queued with the transaction", async () => {
    const metrics = sampleMetrics(5);
    const saved = await apiPatch(
      `/api/staff/reports/${staffA.yesterdayReportId}`,
      metrics,
      staffA.cookie,
    );
    expect(saved.status).toBe(200);

    const data = expectOk<{
      report: { status: string; submittedAt: string | null };
      alreadySubmitted: boolean;
    }>(
      await apiRequest(
        "POST",
        `/api/staff/reports/${staffA.yesterdayReportId}/submit`,
        {},
        staffA.cookie,
      ),
      200,
      "submit",
    );
    expect(data.alreadySubmitted).toBe(false);
    expect(data.report.status).toBe("SUBMITTED");
    expect(data.report.submittedAt).toBeTruthy();

    const row = await db.dailyReport.findUnique({
      where: { id: staffA.yesterdayReportId },
    });
    expect(row?.status).toBe("SUBMITTED");
    expect(row?.submittedAt).toBeTruthy();
    expect(row?.individualsContacted).toBe(metrics.individualsContacted);

    const receipts = await db.notificationDelivery.findMany({
      where: { dedupeKey: `DAILY_REPORT_SUBMITTED:${staffA.yesterdayReportId}` },
    });
    expect(receipts.length).toBe(1);
    expect(receipts[0].status).toBe("PENDING"); // notifications disabled in dev
    expect(receipts[0].type).toBe("DAILY_REPORT_SUBMITTED");
    expect(receipts[0].templateVersion).toBe(NOTIFICATION_TEMPLATE_VERSION);
  });

  it("repeat submit is idempotent: SAME submittedAt, still exactly one receipt", async () => {
    const first = await db.dailyReport.findUnique({
      where: { id: staffA.yesterdayReportId },
      select: { submittedAt: true },
    });

    const data = expectOk<{ report: { submittedAt: string | null }; alreadySubmitted: boolean }>(
      await apiRequest(
        "POST",
        `/api/staff/reports/${staffA.yesterdayReportId}/submit`,
        {},
        staffA.cookie,
      ),
      200,
      "repeat submit",
    );
    expect(data.alreadySubmitted).toBe(true);
    expect(new Date(data.report.submittedAt ?? "").getTime()).toBe(
      first!.submittedAt!.getTime(),
    );

    const receipts = await db.notificationDelivery.findMany({
      where: { dedupeKey: `DAILY_REPORT_SUBMITTED:${staffA.yesterdayReportId}` },
    });
    expect(receipts.length).toBe(1);
  });

  it("PATCH after submission is 409 CONFLICT — submitted reports are permanently read-only", async () => {
    const patched = await apiPatch(
      `/api/staff/reports/${staffA.yesterdayReportId}`,
      sampleMetrics(),
      staffA.cookie,
    );
    expectFail(patched, 409, "CONFLICT", "patch submitted");
  });

  it("4 concurrent submits: exactly one winner, one submittedAt, one receipt", async () => {
    const before = new Date(Date.now() - 1000);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        fetchRaw(
          "POST",
          `/api/staff/reports/${staffA.dayMinus2ReportId}/submit`,
          {},
          staffA.cookie,
        ),
      ),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    const alreadySubmitted = responses.filter(
      (r) => (r.body as { data: { alreadySubmitted: boolean } }).data.alreadySubmitted,
    );
    expect(alreadySubmitted.length).toBe(3);

    const row = await db.dailyReport.findUnique({
      where: { id: staffA.dayMinus2ReportId },
    });
    expect(row?.status).toBe("SUBMITTED");
    expect(row!.submittedAt!.getTime()).toBeGreaterThan(before.getTime());

    const receipts = await db.notificationDelivery.findMany({
      where: { dedupeKey: `DAILY_REPORT_SUBMITTED:${staffA.dayMinus2ReportId}` },
    });
    expect(receipts.length).toBe(1);
  });

  it("submitting an unknown id is 404", async () => {
    const result = await apiRequest(
      "POST",
      "/api/staff/reports/cuid-does-not-exist/submit",
      {},
      staffA.cookie,
    );
    expectFail(result, 404, "NOT_FOUND", "submit unknown");
  });
});

/* ----------------------------------------------------------------- */
/* 5. Reads — detail, month history, today state                      */
/* ----------------------------------------------------------------- */

describe("reads (detail + month history)", () => {
  it("GET detail returns the full owned report", async () => {
    const data = expectOk<{ id: string; status: string }>(
      await apiRequest(
        "GET",
        `/api/staff/reports/${staffA.yesterdayReportId}`,
        undefined,
        staffA.cookie,
      ),
      200,
      "detail",
    );
    expect(data.id).toBe(staffA.yesterdayReportId!);
    expect(data.status).toBe("SUBMITTED");
  });

  it("GET list: month-bounded, newest first, paginated, with today's state", async () => {
    const data = expectOk<{
      month: string;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      reports: { id: string; reportDate: string }[];
      today: { date: string; state: string; reportId: string | null };
    }>(await apiRequest("GET", "/api/staff/reports", undefined, staffA.cookie), 200, "list");

    expect(data.month).toBe(lagosTodayISO().slice(0, 7));
    expect(data.pageSize).toBe(DAILY_REPORT_PAGE_SIZE);
    expect(data.today.date).toBe(lagosTodayISO());
    expect(data.today.state).toBe("DRAFT"); // today's report is still a draft
    expect(data.today.reportId).toBe(staffA.todayReportId!);

    // Newest first.
    const dates = data.reports.map((r) => r.reportDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("GET list ?month= filters; empty months are honest empty states", async () => {
    const data = expectOk<{
      month: string;
      total: number;
      reports: unknown[];
      today: { state: string };
    }>(
      await apiRequest("GET", "/api/staff/reports?month=2001-01", undefined, staffA.cookie),
      200,
      "empty month",
    );
    expect(data.total).toBe(0);
    expect(data.reports.length).toBe(0);
    // Today's state is independent of the filtered month.
    expect(data.today.state).toBe("DRAFT");
  });

  it("GET list rejects a malformed month and page 0 (422)", async () => {
    const badMonth = await apiRequest(
      "GET",
      "/api/staff/reports?month=banana",
      undefined,
      staffA.cookie,
    );
    expectFail(badMonth, 422, "VALIDATION_ERROR", "bad month");

    const badPage = await apiRequest(
      "GET",
      "/api/staff/reports?page=0",
      undefined,
      staffA.cookie,
    );
    expectFail(badPage, 422, "VALIDATION_ERROR", "page 0");
  });

  it("unauthenticated calls are 401 UNAUTHORIZED on every route", async () => {
    const list = await apiRequest("GET", "/api/staff/reports");
    expectFail(list, 401, "UNAUTHORIZED", "no-cookie list");

    const create = await apiRequest("POST", "/api/staff/reports", {});
    expectFail(create, 401, "UNAUTHORIZED", "no-cookie create");

    const patched = await apiPatch("/api/staff/reports/whatever", {}, "ff_staff_session=bogus");
    expectFail(patched, 401, "UNAUTHORIZED", "bogus-cookie patch");

    const submit = await apiRequest("POST", "/api/staff/reports/whatever/submit", {});
    expectFail(submit, 401, "UNAUTHORIZED", "no-cookie submit");
  });

  it("staff B's list never contains staff A's reports", async () => {
    const data = expectOk<{ reports: { id: string }[] }>(
      await apiRequest("GET", "/api/staff/reports", undefined, staffB.cookie),
      200,
      "B list",
    );
    expect(data.reports.map((r) => r.id)).toEqual([staffB.todayReportId!]);
  });
});

/* ----------------------------------------------------------------- */
/* 6. Schema parity, boundaries, receipt template                     */
/* ----------------------------------------------------------------- */

describe("schema parity, boundaries and the receipt template", () => {
  it("validation schema keys === config metric names (form can't drift)", () => {
    const shapeKeys = Object.keys(dailyReportDraftSchema.shape).filter(
      (key) => key !== "activitySummary",
    );
    expect(shapeKeys.sort()).toEqual([...METRIC_NAMES].sort());
    expect(METRIC_NAMES.length).toBe(9);
    expect(DAILY_REPORT_CATEGORIES.length).toBe(4);
  });

  it("the report surface carries NO payroll/earnings/verification fields", () => {
    const forbidden = [
      "payroll", "earnings", "commission", "salary", "amount", "verified", "approved",
    ];
    const names = [...METRIC_NAMES, "activitySummary"].join("|").toLowerCase();
    for (const word of forbidden) {
      expect(names.includes(word)).toBe(false);
    }
  });

  it("DAILY_REPORT_SUBMITTED renders the approved receipt copy (no metrics digest)", () => {
    const email = renderNotificationEmail(
      "DAILY_REPORT_SUBMITTED",
      {
        candidateId: "c1",
        candidateName: "Ada Obi",
        recipientEmail: "ada@example.com",
        referenceNumber: "FF-ABCD23",
        staffId: "FF-STF-00001",
        reportDate: lagosTodayISO(),
        submittedAt: new Date().toISOString(),
      },
      "https://finfam.example",
    );
    expect(email.subject).toBe("Your FinFam daily report has been received");
    expect(email.text).toContain("daily activity report");
    expect(email.html).toContain("/staff/reports");
    // No metric values in the receipt — the portal is the authoritative view.
    expect(email.text.toLowerCase()).not.toContain("individuals contacted");
    expect(email.text.toLowerCase()).not.toContain("established members");
    // Never a reminder.
    expect(email.text.toLowerCase()).not.toContain("reminder");
    expect(email.html.toLowerCase()).not.toContain("overdue");
  });
});
