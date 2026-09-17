/**
 * Production-readiness remediation — security regression suite.
 *
 * Covers the four areas the platform review identified as missing (§27)
 * plus the mandatory draft-save concurrency race (§9):
 *
 *   1. CSRF / origin enforcement on privileged admin writes (§13) —
 *      including "a Staff cookie can never authorize an Admin mutation".
 *   2. Public-route rate limiting (§14/§15) — applications, reference
 *      recovery and the legacy onboarding reference writes; hashed client
 *      keys at rest; uniform 429 envelope that leaks nothing.
 *   3. Journey payload leak protection (§29) — reference-gated GETs never
 *      expose answer keys, OTPs, credentials, bank/NIN/BVN fields, admin
 *      data or notification secrets.
 *   4. Dev OTP echo OFF (§28) — with STAFF_/ADMIN_AUTH_DEV_CODE_ECHO=false
 *      the request-code responses contain NO plaintext code and the DB
 *      stores only the sha256 hash (never the plaintext).
 *   5. Daily Report draft-vs-submit race (§9) — every serialized ordering
 *      preserves submitted immutability; a SUBMITTED report can never be
 *      mutated by a late draft save.
 *
 * All fixtures are self-created and self-cleaned (flow-test-* emails,
 * admin-test-* admins, rate_limit_events rows for this suite's buckets).
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { DAILY_REPORT_METRIC_NAMES } from "@/config/daily-report";
import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";

import { db } from "@/lib/db";
import { lagosTodayISO } from "@/lib/dates/lagos";
import { clientKeyFor, publicRateLimitConfig } from "@/lib/rate-limit";
import { requestLoginCode } from "@/server/services/staff-auth";
import { requestAdminLoginCode } from "@/server/services/admin-auth";
import {
  ONE_SHOT_NOTIFICATION_TYPES,
  isOneShotNotificationType,
} from "@/server/notifications/notification-types";

import {
  apiRequest,
  assertServerUp,
  expectOk,
} from "./helpers/api";
import {
  adminRawRequest,
  cleanupAdmins,
  loginAsAdmin,
  runBootstrap,
  uniqueAdminEmail,
} from "./helpers/admin";
import { cleanupTestCandidates } from "./helpers/db";
import { driveToActivation, loginAsStaff } from "./helpers/journey";

/* Local HTTP helper — PATCH for draft saves (shared helper speaks GET/POST). */
const BASE_URL =
  process.env.FLOW_TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  cookie: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = await response.json().catch(() => null);
  return { status: response.status, body: parsed as T };
}

/** Step over the 60s resend cooldown by backdating the latest code row. */
async function stepStaffCooldown(accountId: string): Promise<void> {
  const latest = await db.staffLoginCode.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (latest) {
    await db.staffLoginCode.update({
      where: { id: latest.id },
      data: { createdAt: new Date(latest.createdAt.getTime() - 61_000) },
    });
  }
}

/* --------------------------------------------------------------------- */
/* Shared fixtures                                                        */
/* --------------------------------------------------------------------- */

const ORIGIN_OK =
  process.env.APP_BASE_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:3000";

const METRIC_NAMES = [...DAILY_REPORT_METRIC_NAMES] as string[];

function sampleMetrics(seed: number): Record<string, number> {
  return Object.fromEntries(
    METRIC_NAMES.map((name, index) => [name, ((seed + index) % 12) + 1]),
  );
}

function daysAgo(n: number): string {
  const today = lagosTodayISO();
  const utcMidnight = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return new Date(utcMidnight - n * 86_400_000).toISOString().slice(0, 10);
}

const createdEmails: string[] = [];
const createdAdminEmails: string[] = [];

interface StaffFixture {
  email: string;
  referenceNumber: string;
  staffId: string;
  staffRowId: string;
  cookie: string;
}

/** Drive one candidate through activation → OTP login → completed onboarding. */
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

let staff: StaffFixture;

beforeAll(async () => {
  await assertServerUp();
  staff = await driveFullyOnboardedStaff("hardening-staff");
}, 240_000);

afterAll(async () => {
  await cleanupTestCandidates(createdEmails);
  await cleanupAdmins(createdAdminEmails);
});

/* --------------------------------------------------------------------- */
/* 1. CSRF / origin enforcement (§13)                                     */
/* --------------------------------------------------------------------- */

describe("CSRF origin enforcement on privileged admin writes (§13)", () => {
  const suspendPath = () => `/api/admin/staff/${staff.staffRowId}/suspend`;

  it("a STAFF session cookie can NEVER authorize an admin mutation (401)", async () => {
    // Correct origin, but the WRONG DOMAIN's cookie: authentication is
    // resolved first and independently — staff credentials are not admin
    // credentials, and the two cookie domains are structurally separate.
    const result = await adminRawRequest("POST", suspendPath(), {
      cookie: staff.cookie,
      body: { reason: "staff cookie must not work here" },
      headers: { origin: ORIGIN_OK },
    });
    expect(result.status).toBe(401);
    if (result.body.ok === false) {
      expect(result.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("valid admin auth + wrong origin → 403 (auth first, then origin)", async () => {
    const adminEmail = uniqueAdminEmail("csrf");
    createdAdminEmails.push(adminEmail);
    expect(runBootstrap([adminEmail, "--yes"]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(adminEmail, "csrf");

    const result = await adminRawRequest("POST", suspendPath(), {
      cookie,
      body: { reason: "wrong origin check" },
      headers: { origin: "https://evil.example.com" },
    });
    expect(result.status).toBe(403);
    if (result.body.ok === false) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("malformed Origin → 403 even with valid auth", async () => {
    const adminEmail = uniqueAdminEmail("csrf-malformed");
    createdAdminEmails.push(adminEmail);
    expect(runBootstrap([adminEmail, "--yes"]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(adminEmail, "csrf-malformed");

    const result = await adminRawRequest("POST", suspendPath(), {
      cookie,
      body: { reason: "malformed origin check" },
      headers: { origin: "not-a-valid-url" },
    });
    expect(result.status).toBe(403);
  });

  it("missing Origin but trusted Referer → fallback passes (business answers 404 for an unknown target)", async () => {
    const adminEmail = uniqueAdminEmail("csrf-referer");
    createdAdminEmails.push(adminEmail);
    expect(runBootstrap([adminEmail, "--yes"]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(adminEmail, "csrf-referer");

    // Unknown staff id: the origin check PASSES (otherwise 403) and the
    // business layer answers 404 — proving the fallback without mutating.
    const result = await adminRawRequest(
      "POST",
      "/api/admin/staff/unknown-row-id/suspend",
      {
        cookie,
        body: { reason: "referer fallback check" },
        headers: { referer: `${ORIGIN_OK}/admin/staff` },
      },
    );
    expect(result.status).toBe(404);
  });

  it("missing Origin but FOREIGN Referer → 403", async () => {
    const adminEmail = uniqueAdminEmail("csrf-refbad");
    createdAdminEmails.push(adminEmail);
    expect(runBootstrap([adminEmail, "--yes"]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(adminEmail, "csrf-refbad");

    const result = await adminRawRequest("POST", suspendPath(), {
      cookie,
      body: { reason: "foreign referer check" },
      headers: { referer: "https://evil.example.com/admin" },
    });
    expect(result.status).toBe(403);
  });
});

/* --------------------------------------------------------------------- */
/* 2. Public-route rate limiting (§14/§15)                                */
/* --------------------------------------------------------------------- */

describe("public-route rate limiting (§14/§15)", () => {
  /**
   * Calibrate the server-side client key: make one throwaway request, then
   * read back the clientKey the SERVER derived for this network (the test
   * process cannot know whether Next exposes the socket peer as
   * "loopback", "::ffff:127.0.0.1" etc. — the DB row is the truth).
   */
  async function calibrateClientKey(
    bucket: "applications" | "recruitment-recovery" | "onboarding-reference",
    request: () => Promise<unknown>,
  ): Promise<string> {
    await db.rateLimitEvent.deleteMany({ where: { bucket } });
    await request();
    const rows = await db.rateLimitEvent.findMany({
      where: { bucket },
      select: { clientKey: true },
    });
    expect(rows).toHaveLength(1);
    return rows[0]!.clientKey;
  }

  /** Seed max-1 events, prove request max-1 passes and request max is 429'd. */
  async function tripBucket(
    bucket: "applications" | "recruitment-recovery" | "onboarding-reference",
    request: () => Promise<{ status: number; body: unknown }>,
  ) {
    const { max } = publicRateLimitConfig(bucket);
    expect(max).toBeGreaterThanOrEqual(2);

    const clientKey = await calibrateClientKey(bucket, request);
    expect(clientKey).toMatch(/^[0-9a-f]{64}$/);
    expect(clientKey).not.toContain("loopback");

    // Deterministic start: clear the bucket, then seed max-1 events under
    // the server-derived key.
    await db.rateLimitEvent.deleteMany({ where: { bucket } });
    await db.rateLimitEvent.createMany({
      data: Array.from({ length: max - 1 }, () => ({ bucket, clientKey })),
    });

    const allowed = await request();
    expect(allowed.status).not.toBe(429);

    const blocked = await request();
    expect(blocked.status).toBe(429);
    const body = blocked.body as { ok: boolean; error?: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("RATE_LIMITED");
    // The 429 envelope carries nothing but the standard error shape.
    expect(Object.keys(body)).toEqual(["ok", "error"]);

    // Privacy: the stored client key is the sha256 hex — never a raw IP.
    const rows = await db.rateLimitEvent.findMany({
      where: { bucket, clientKey },
      select: { clientKey: true },
    });
    expect(rows.length).toBe(max);
    for (const row of rows) {
      expect(row.clientKey).toMatch(/^[0-9a-f]{64}$/);
    }

    // Cleanup — the suite never leaks limiter state into other suites.
    await db.rateLimitEvent.deleteMany({ where: { bucket } });
  }

  it("POST /api/applications trips the applications bucket", async () => {
    await tripBucket("applications", () =>
      apiRequest("POST", "/api/applications", { email: "not-an-email" }).then(
        (r) => ({ status: r.status, body: r.body as unknown }),
      ),
    );
  });

  it("POST /api/recruitment/recover-reference trips the recovery bucket", async () => {
    await tripBucket("recruitment-recovery", () =>
      apiRequest("POST", "/api/recruitment/recover-reference", {
        fullName: "Nobody Real",
        email: "nobody-real@test.example.com",
        phone: "0000000000",
      }).then((r) => ({ status: r.status, body: r.body as unknown })),
    );
  });

  it("POST /api/onboarding/[reference]/steps trips the onboarding-reference bucket", async () => {
    await tripBucket("onboarding-reference", () =>
      apiRequest("POST", "/api/onboarding/FF-000000/steps", {}).then((r) => ({
        status: r.status,
        body: r.body as unknown,
      })),
    );
  });

  it("a blocked recovery request returns the SAME uniform 429 envelope (no match disclosure)", async () => {
    const bucket = "recruitment-recovery";
    const { max } = publicRateLimitConfig(bucket);
    const clientKey = await calibrateClientKey(bucket, () =>
      apiRequest("POST", "/api/recruitment/recover-reference", {
        fullName: "Nobody Real",
        email: "nobody-real@test.example.com",
        phone: "0000000000",
      }),
    );
    await db.rateLimitEvent.deleteMany({ where: { bucket } });
    await db.rateLimitEvent.createMany({
      data: Array.from({ length: max }, () => ({ bucket, clientKey })),
    });

    const wrong = await apiRequest("POST", "/api/recruitment/recover-reference", {
      fullName: "Nobody Real",
      email: "nobody-real@test.example.com",
      phone: "0000000000",
    });
    expect(wrong.status).toBe(429);
    const body = wrong.body as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe("RATE_LIMITED");

    await db.rateLimitEvent.deleteMany({ where: { bucket } });
  });
});

/* --------------------------------------------------------------------- */
/* 3. Journey payload leak protection (§29)                               */
/* --------------------------------------------------------------------- */

describe("journey payload leak protection (§29)", () => {
  // Quoted-key markers match JSON keys only — copy text that legitimately
  // mentions e.g. "no password" can never false-positive.
  const FORBIDDEN_KEYS = [
    // Assessment internals (answer key / insights)
    '"correctindex"',
    '"insight"',
    '"iscorrect"',
    // Credentials / secrets
    '"codehash"',
    '"tokenhash"',
    '"devcode"',
    '"logincode"',
    '"password"',
    '"mailjet"',
    '"apikey"',
    // Financial / government identity (never collected, never exposed)
    '"bvn"',
    '"nin"',
    '"bankname"',
    '"accountnumber"',
    '"nextofkin"',
    // Admin-domain data
    '"actoremail"',
    '"adminaccount"',
  ];

  function assertNoLeaks(payload: unknown) {
    const serialized = JSON.stringify(payload ?? {}).toLowerCase();
    for (const marker of FORBIDDEN_KEYS) {
      expect(serialized.includes(marker)).toBe(false);
    }
    // No 6-digit plaintext OTP can ever appear in a journey payload.
    expect(serialized.match(/\b\d{6}\b/)).toBeNull();
  }

  it("reference-gated journey APIs never leak secrets (real responses)", async () => {
    const ref = staff.referenceNumber;

    const journey = await apiRequest("GET", `/api/journey/${ref}`);
    expect(journey.status).toBe(200);
    assertNoLeaks(journey.body);

    const orientation = await apiRequest("GET", `/api/orientation/${ref}`);
    expect(orientation.status).toBe(200);
    assertNoLeaks(orientation.body);

    const assessment = await apiRequest("GET", `/api/assessment/${ref}`);
    expect(assessment.status).toBe(200);
    assertNoLeaks(assessment.body);

    const candidate = await apiRequest("GET", `/api/candidates/${ref}`);
    expect(candidate.status).toBe(200);
    assertNoLeaks(candidate.body);

    const onboarding = await apiRequest("GET", `/api/onboarding/${ref}`);
    expect(onboarding.status).toBe(200);
    assertNoLeaks(onboarding.body);

    const appointment = await apiRequest("GET", `/api/appointment/${ref}`);
    expect(appointment.status).toBe(200);
    assertNoLeaks(appointment.body);

    const agreement = await apiRequest("GET", `/api/agreement/${ref}`);
    expect(agreement.status).toBe(200);
    assertNoLeaks(agreement.body);
  });

  it("an unknown reference leaks nothing but the neutral 404 envelope", async () => {
    const result = await apiRequest("GET", "/api/journey/FF-AAAAAA");
    expect(result.status).toBe(404);
    const body = result.body as { ok: boolean; error?: { message: string } };
    expect(body.ok).toBe(false);
    expect(Object.keys(body.error ?? {})).toEqual(["code", "message"]);
  });
});

/* --------------------------------------------------------------------- */
/* 4. Dev OTP echo OFF (§27-4 / §28)                                      */
/* --------------------------------------------------------------------- */

describe("dev OTP echo OFF behaviour (§28)", () => {
  // These tests drive the REAL services against the real DB. The dev server
  // keeps its own env (echo ON for the suite); here we flip the switches OFF
  // in-process to assert the production behaviour of the echo logic itself:
  // no plaintext code in the response, only a sha256 hash in the database,
  // and nowhere for a plaintext OTP to persist.

  it("staff request-code with echo OFF returns NO plaintext code", async () => {
    const previous = process.env.STAFF_AUTH_DEV_CODE_ECHO;
    process.env.STAFF_AUTH_DEV_CODE_ECHO = "false";
    try {
      const account = await db.staffAccount.findFirstOrThrow({
        where: { staff: { candidate: { referenceNumber: staff.referenceNumber } } },
        select: { id: true },
      });
      // The fixture already logged in — step over the 60s resend cooldown.
      await stepStaffCooldown(account.id);

      const result = await requestLoginCode(staff.email);
      expect(result.sent).toBe(true);
      expect(result.devCode).toBeUndefined();

      const serialized = JSON.stringify(result);
      // The response object can never carry a 6-digit code.
      expect(serialized.match(/\b\d{6}\b/)).toBeNull();

      // The DB stores ONLY the hash: the latest code row's codeHash is a
      // 64-char hex digest, never a plaintext 6-digit code.
      const row = await db.staffLoginCode.findFirstOrThrow({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        select: { codeHash: true, expiresAt: true },
      });
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.codeHash).not.toMatch(/^\d{6}$/);
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
    } finally {
      if (previous === undefined) delete process.env.STAFF_AUTH_DEV_CODE_ECHO;
      else process.env.STAFF_AUTH_DEV_CODE_ECHO = previous;
    }
  });

  it("admin request-code with echo OFF returns NO plaintext code", async () => {
    const previous = process.env.ADMIN_AUTH_DEV_CODE_ECHO;
    process.env.ADMIN_AUTH_DEV_CODE_ECHO = "false";
    const adminEmail = uniqueAdminEmail("echo-off");
    createdAdminEmails.push(adminEmail);
    try {
      expect(runBootstrap([adminEmail, "--yes"]).exitCode).toBe(0);

      const result = await requestAdminLoginCode(adminEmail);
      expect(result.sent).toBe(true);
      expect(result.devCode).toBeUndefined();
      expect(JSON.stringify(result).match(/\b\d{6}\b/)).toBeNull();

      const account = await db.adminAccount.findUniqueOrThrow({
        where: { email: adminEmail },
        select: { id: true },
      });
      const row = await db.adminLoginCode.findFirstOrThrow({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        select: { codeHash: true },
      });
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.codeHash).not.toMatch(/^\d{6}$/);
    } finally {
      if (previous === undefined) delete process.env.ADMIN_AUTH_DEV_CODE_ECHO;
      else process.env.ADMIN_AUTH_DEV_CODE_ECHO = previous;
    }
  });

  it("the delivery table has NO payload column — OTP plaintext is never persisted", async () => {
    // Structural pin: the notification_deliveries table carries no body/
    // payload/code column at all, so a plaintext one-shot OTP has nowhere
    // to be written (the production echo-off guarantee rests on this).
    const columns = (await db.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_deliveries'",
    )) as { column_name: string }[];
    const names = columns.map((c) => c.column_name.toLowerCase());
    expect(names).not.toContain("payload");
    expect(names).not.toContain("body");
    expect(names).not.toContain("code");
  });
});

/* --------------------------------------------------------------------- */
/* 5. Daily Report draft-vs-submit race (§9)                              */
/* --------------------------------------------------------------------- */

describe("Daily Report draft-vs-submit race (§9)", () => {
  it("every serialized ordering keeps the SUBMITTED report immutable", async () => {
    // Six real races across distinct report dates (today + five backdated
    // days inside the approved 7-day window). Each iteration races one
    // draft-save PATCH against one submit POST and verifies that the
    // persisted submitted state corresponds to a valid serialization:
    //   - PATCH won first  → submitted metrics = PATCH payload
    //   - submit won first → PATCH answered 409, metrics = draft values
    // Either way, a late draft save can never mutate submitted metrics.
    for (let i = 0; i < 6; i += 1) {
      const reportDate = daysAgo(i);
      const label = `race-${i}`;

      // Create-or-get the draft for this date.
      const created = expectOk<{
        report: { id: string; status: string };
        created: boolean;
      }>(
        await apiRequest("POST", "/api/staff/reports", { reportDate }, staff.cookie),
        200,
        `[${label}] create draft`,
      );
      expect(created.report.status).toBe("DRAFT");
      const reportId = created.report.id;

      // Establish known draft values (seed 1) before the race. activitySummary
      // is deliberately OMITTED (optional — null is not a valid wire value).
      const seeded = await apiPatch(
        `/api/staff/reports/${reportId}`,
        sampleMetrics(1),
        staff.cookie,
      );
      expect(seeded.status).toBe(200);

      const patchPayload = sampleMetrics(10 + i);

      // THE RACE: draft save vs submit, truly concurrent.
      const [patchResult, submitResult] = await Promise.all([
        apiPatch(`/api/staff/reports/${reportId}`, patchPayload, staff.cookie),
        apiRequest(
          "POST",
          `/api/staff/reports/${reportId}/submit`,
          undefined,
          staff.cookie,
        ),
      ]);

      expect([200, 409]).toContain(patchResult.status);
      expect(submitResult.status).toBe(200);

      const finalView = expectOk<{
        id: string;
        status: string;
        submittedAt: string | null;
        metrics: Record<string, number>;
      }>(
        await apiRequest("GET", `/api/staff/reports/${reportId}`, undefined, staff.cookie),
        200,
        `[${label}] final read`,
      );

      // The report is SUBMITTED, exactly once, with a timestamp.
      expect(finalView.status).toBe("SUBMITTED");
      expect(finalView.submittedAt).not.toBeNull();

      if (patchResult.status === 200) {
        // Serialized order: PATCH (200) → SUBMIT. Submitted metrics must be
        // exactly the PATCH payload.
        for (const name of METRIC_NAMES) {
          expect(finalView.metrics[name]).toBe(patchPayload[name]);
        }
      } else {
        // Serialized order: SUBMIT → PATCH (409). Submitted metrics must be
        // the pre-race draft values — the late PATCH changed nothing.
        const draftMetrics = sampleMetrics(1);
        for (const name of METRIC_NAMES) {
          expect(finalView.metrics[name]).toBe(draftMetrics[name]);
        }
      }

      // Immutability forever: one more late PATCH must 409 and change
      // nothing.
      const latePatch = await apiPatch(
        `/api/staff/reports/${reportId}`,
        sampleMetrics(99),
        staff.cookie,
      );
      expect(latePatch.status).toBe(409);

      const afterLatePatch = expectOk<{ metrics: Record<string, number> }>(
        await apiRequest("GET", `/api/staff/reports/${reportId}`, undefined, staff.cookie),
        200,
        `[${label}] post-late-patch read`,
      );
      for (const name of METRIC_NAMES) {
        expect(afterLatePatch.metrics[name]).toBe(finalView.metrics[name]);
      }

      // Repeat submit stays idempotent — same state, no second timestamp.
      const repeat = expectOk<{ alreadySubmitted: boolean }>(
        await apiRequest(
          "POST",
          `/api/staff/reports/${reportId}/submit`,
          undefined,
          staff.cookie,
        ),
        200,
        `[${label}] repeat submit`,
      );
      expect(repeat.alreadySubmitted).toBe(true);
    }
  });

  it("a foreign report id behaves as 404 for draft saves (ownership unchanged by the latch)", async () => {
    const unknown = await apiPatch(
      "/api/staff/reports/does-not-exist",
      sampleMetrics(3),
      staff.cookie,
    );
    expect(unknown.status).toBe(404);
  });
});

/* --------------------------------------------------------------------- */
/* Type-level guard pin (§11) — one-shot notification types               */
/* --------------------------------------------------------------------- */

describe("one-shot notification type partition (§11)", () => {
  it("STAFF_LOGIN_CODE and ADMIN_LOGIN_CODE are the one-shot types", () => {
    expect([...ONE_SHOT_NOTIFICATION_TYPES].sort()).toEqual([
      "ADMIN_LOGIN_CODE",
      "STAFF_LOGIN_CODE",
    ]);
    expect(isOneShotNotificationType("STAFF_LOGIN_CODE")).toBe(true);
    expect(isOneShotNotificationType("ADMIN_LOGIN_CODE")).toBe(true);
    expect(isOneShotNotificationType("DAILY_REPORT_SUBMITTED")).toBe(false);
    expect(isOneShotNotificationType("APPLICATION_RECEIVED")).toBe(false);
  });

  it("the batch retry worker never considers one-shot rows", async () => {
    // Seed two PENDING OTP rows (payload-less by design) and prove the
    // batch neither sends nor marks them — they are excluded upstream.
    // Delivery is "active" during the batch but pointed at a dead local
    // URL: any derivable row the batch attempts fails instantly (no real
    // network), while the one-shot rows must remain untouched.
    const candidate = await db.candidate.findUniqueOrThrow({
      where: { referenceNumber: staff.referenceNumber },
      select: { id: true, email: true },
    });
    const seeded = await db.notificationDelivery.createManyAndReturn({
      data: [
        {
          type: "STAFF_LOGIN_CODE",
          dedupeKey: "STAFF_LOGIN_CODE:hardening-pin-staff",
          candidateId: candidate.id,
          recipientEmail: candidate.email,
          templateVersion: "pin",
          provider: "mailjet",
        },
        {
          type: "ADMIN_LOGIN_CODE",
          dedupeKey: "ADMIN_LOGIN_CODE:hardening-pin-admin",
          candidateId: null,
          recipientEmail: "admin-test-pin@test.example.com",
          templateVersion: "pin",
          provider: "mailjet",
        },
      ],
      select: { id: true },
    });

    const { retryPendingNotifications } = await import(
      "@/server/notifications/notification-service"
    );
    const savedEnv = {
      NOTIFICATIONS_ENABLED: process.env.NOTIFICATIONS_ENABLED,
      MAILJET_API_KEY: process.env.MAILJET_API_KEY,
      MAILJET_SECRET_KEY: process.env.MAILJET_SECRET_KEY,
      MAILJET_FROM_EMAIL: process.env.MAILJET_FROM_EMAIL,
      MAILJET_API_URL: process.env.MAILJET_API_URL,
    };
    process.env.NOTIFICATIONS_ENABLED = "true";
    process.env.MAILJET_API_KEY = "pin";
    process.env.MAILJET_SECRET_KEY = "pin";
    process.env.MAILJET_FROM_EMAIL = "pin@test.example.com";
    // Dead end (port 1 on loopback): instant connection refusal, never a
    // real provider request.
    process.env.MAILJET_API_URL = "http://127.0.0.1:1/send";
    try {
      await retryPendingNotifications({ limit: 50 });
    } finally {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const after = await db.notificationDelivery.findMany({
      where: { id: { in: seeded.map((s) => s.id) } },
      select: { status: true, attemptCount: true },
    });
    expect(after).toHaveLength(2);
    for (const row of after) {
      // Untouched: still PENDING, zero attempts — never re-derived, never sent.
      expect(row.status).toBe("PENDING");
      expect(row.attemptCount).toBe(0);
    }

    await db.notificationDelivery.deleteMany({
      where: { id: { in: seeded.map((s) => s.id) } },
    });
  });
});
