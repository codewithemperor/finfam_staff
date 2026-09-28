/**
 * Stage 11 — Admin authentication & session security (approved brief §54).
 *
 * Drives the REAL HTTP stack: OTP request/verify against /api/admin/auth/*,
 * guards against /api/admin/*, and cross-domain isolation between the
 * ff_staff_session and ff_admin_session cookie domains. Everything mirrors
 * the proven staff-auth security matrix — plus the bootstrap CLI contract
 * that provisions the identity in the first place (brief §55).
 */
import { describe, expect, it, beforeAll, afterAll } from "bun:test";

import { sha256Hex } from "@/lib/auth/hash";

import { db } from "./helpers/db";
import { uniqueEmail, cleanupTestCandidates } from "./helpers/db";
import {
  apiRequest,
  expectOk,
  expectFail,
  assertServerUp,
} from "./helpers/api";
import { driveToActivation, loginAsStaff } from "./helpers/journey";
import {
  cleanupAdmins,
  loginAsAdmin,
  runBootstrap,
  uniqueAdminEmail,
  adminRawRequest,
} from "./helpers/admin";

let adminEmail: string;
let adminCookie: string;
const createdAdmins: string[] = [];
const createdEmails: string[] = [];

/** A real Staff identity for the cross-domain isolation tests. */
let staffEmail: string;
let staffCookie: string;

beforeAll(async () => {
  await assertServerUp();

  // Provision one admin through the real CLI, then sign in.
  adminEmail = uniqueAdminEmail("auth");
  const boot = runBootstrap([adminEmail]);
  expect(boot.exitCode).toBe(0);
  createdAdmins.push(adminEmail);
  adminCookie = (await loginAsAdmin(adminEmail, "auth suite")).cookie;

  // One real activated Staff member (cookie only — no onboarding needed).
  const driven = await driveToActivation("adminauth-staff");
  createdEmails.push(driven.email);
  staffEmail = driven.email;
  staffCookie = (await loginAsStaff(staffEmail, "adminauth staff login"))
    .cookie;
}, 300_000);

afterAll(async () => {
  await cleanupAdmins(createdAdmins);
  await cleanupTestCandidates(createdEmails);
});

/* ------------------------------------------------------------------ */
/* 1. Bootstrap CLI contract (§55)                                     */
/* ------------------------------------------------------------------ */

describe("bootstrap CLI (brief §55)", () => {
  it("dry run creates nothing", async () => {
    const email = uniqueAdminEmail("dryrun");
    const result = runBootstrap([email, "--dry-run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Dry run");
    const row = await db.adminAccount.findUnique({ where: { email } });
    expect(row).toBeNull();
  });

  it("unknown email creates exactly one ACTIVE AdminAccount", async () => {
    const email = uniqueAdminEmail("create");
    const result = runBootstrap([email]);
    expect(result.exitCode).toBe(0);
    createdAdmins.push(email);
    const row = await db.adminAccount.findUnique({ where: { email } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("ACTIVE");
  });

  it("rerun on an existing ACTIVE account is an idempotent no-op", () => {
    const email = uniqueAdminEmail("idem");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const second = runBootstrap([email]);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already exists");
  });

  it("REFUSES to reactivate a SUSPENDED admin account", async () => {
    const email = uniqueAdminEmail("susp");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    await db.adminAccount.update({
      where: { email },
      data: { status: "SUSPENDED" },
    });
    const result = runBootstrap([email]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("REFUSED");
    const row = await db.adminAccount.findUnique({ where: { email } });
    expect(row!.status).toBe("SUSPENDED");
  });

  it("never modifies Staff or Candidate rows", async () => {
    const staffCountBefore = await db.staff.count();
    const candidateCountBefore = await db.candidate.count();
    runBootstrap([uniqueAdminEmail("isolation")]);
    expect(await db.staff.count()).toBe(staffCountBefore);
    expect(await db.candidate.count()).toBe(candidateCountBefore);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Request-code: account validation + rate limits (§9/§54)           */
/* ------------------------------------------------------------------ */

describe("admin request-code account validation and limits", () => {
  it("unknown email returns a field error and creates no rows", async () => {
    const ghost = uniqueAdminEmail("ghost");
    const before = await db.adminLoginCode.count();
    const error = expectFail(
      await apiRequest("POST", "/api/admin/auth/request-code", {
        email: ghost,
      }),
      422,
      "VALIDATION_ERROR",
      "unknown email request",
    );
    expect(error.error.fields?.email).toMatch(
      /No active FinFam administrator account/i,
    );
    expect(await db.adminLoginCode.count()).toBe(before);
  });

  it("an ordinary Staff email returns an admin email field error", async () => {
    const before = await db.adminLoginCode.count();
    const error = expectFail(
      await apiRequest("POST", "/api/admin/auth/request-code", {
        email: staffEmail,
      }),
      422,
      "VALIDATION_ERROR",
      "staff email request",
    );
    expect(error.error.fields?.email).toMatch(
      /No active FinFam administrator account/i,
    );
    expect(await db.adminLoginCode.count()).toBe(before);
  });

  it("a valid ACTIVE admin receives a code (dev echo) — separate from the staff switch", async () => {
    // Step over any cooldown left by the beforeAll login first.
    await stepCooldownFor(adminEmail);
    const data = expectOk<{ message: string; devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", {
        email: adminEmail,
      }),
      200,
      "valid admin request",
    );
    expect(data.devCode).toMatch(/^\d{6}$/);
  });

  it("immediate resend hits the 60s cooldown (429 RATE_LIMITED)", async () => {
    const error = expectFail(
      await apiRequest("POST", "/api/admin/auth/request-code", {
        email: adminEmail,
      }),
      429,
      "RATE_LIMITED",
      "resend cooldown",
    );
    expect(error.message.toLowerCase()).toContain("wait");
  });

  it("rate-limit window: a 6th code inside 15 minutes is 429", async () => {
    const email = uniqueAdminEmail("window");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });

    // Five codes inside the window (backdating each to stay under the
    // 60s cooldown while remaining inside the 15-minute window).
    for (let i = 0; i < 5; i += 1) {
      const sent = expectOk<{ devCode?: string }>(
        await apiRequest("POST", "/api/admin/auth/request-code", { email }),
        200,
        `window code ${i + 1}`,
      );
      expect(sent.devCode).toBeDefined();
      const latest = await db.adminLoginCode.findFirst({
        where: { accountId: account!.id },
        orderBy: { createdAt: "desc" },
      });
      await db.adminLoginCode.update({
        where: { id: latest!.id },
        data: { createdAt: new Date(Date.now() - 2 * 60_000) },
      });
    }
    expectFail(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      429,
      "RATE_LIMITED",
      "window exhausted",
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. Verify: hashing, budget, expiry, latest-only, concurrency        */
/* ------------------------------------------------------------------ */

describe("admin verify security properties (§54)", () => {
  it("the code is stored ONLY as a sha256 hash with ~10-minute expiry", async () => {
    const email = uniqueAdminEmail("hash");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const sent = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "hash request",
    );
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    const latest = await db.adminLoginCode.findFirst({
      where: { accountId: account!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(latest!.codeHash).toBe(sha256Hex(sent.devCode!));
    const ttlMinutes =
      (latest!.expiresAt.getTime() - latest!.createdAt.getTime()) / 60_000;
    expect(ttlMinutes).toBeGreaterThanOrEqual(9.9);
    expect(ttlMinutes).toBeLessThanOrEqual(10.1);
  });

  it("a wrong code is the generic 422 and burns one attempt", async () => {
    const email = uniqueAdminEmail("wrong");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const sent = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "wrong request",
    );
    const wrong = sent.devCode === "000000" ? "000001" : "000000";
    const error = expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email,
        code: wrong,
      }),
      422,
      "VALIDATION_ERROR",
      "wrong code",
    );
    expect(error.message).toContain("not valid or has expired");
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    const latest = await db.adminLoginCode.findFirst({
      where: { accountId: account!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(latest!.attemptCount).toBe(1);
    // Stepping the cooldown so later tests can re-request freely.
    await db.adminLoginCode.update({
      where: { id: latest!.id },
      data: { createdAt: new Date(latest!.createdAt.getTime() - 61_000) },
    });
  });

  it("the attempt budget kills the code even for the CORRECT code", async () => {
    const email = uniqueAdminEmail("budget");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const sent = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "budget request",
    );
    for (let i = 0; i < 5; i += 1) {
      expectFail(
        await apiRequest("POST", "/api/admin/auth/verify", {
          email,
          code: "999999",
        }),
        422,
        "VALIDATION_ERROR",
        `budget attempt ${i + 1}`,
      );
    }
    expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email,
        code: sent.devCode!,
      }),
      422,
      "VALIDATION_ERROR",
      "correct code after budget",
    );
  });

  it("an expired code fails even when correct", async () => {
    const email = uniqueAdminEmail("expiry");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const sent = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "expiry request",
    );
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    const latest = await db.adminLoginCode.findFirst({
      where: { accountId: account!.id },
      orderBy: { createdAt: "desc" },
    });
    await db.adminLoginCode.update({
      where: { id: latest!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email,
        code: sent.devCode!,
      }),
      422,
      "VALIDATION_ERROR",
      "expired code",
    );
  });

  it("latest-code-only: a newer request supersedes the older code", async () => {
    const email = uniqueAdminEmail("latest");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const first = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "latest first",
    );
    await stepCooldownFor(email);
    const second = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "latest second",
    );
    expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email,
        code: first.devCode!,
      }),
      422,
      "VALIDATION_ERROR",
      "old code",
    );
    const ok = expectOk<{ next: string }>(
      await adminRawRequest<{ next: string }>(
        "POST",
        "/api/admin/auth/verify",
        {
          body: { email, code: second.devCode! },
        },
      ),
      200,
      "new code",
    );
    expect(ok.next).toBe("/admin");
  });

  it("four concurrent verifies of one code create exactly ONE session", async () => {
    const email = uniqueAdminEmail("conc");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const sent = expectOk<{ devCode?: string }>(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      200,
      "concurrent request",
    );
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        adminRawRequest("POST", "/api/admin/auth/verify", {
          body: { email, code: sent.devCode! },
        }),
      ),
    );
    const winners = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === 200,
    );
    expect(winners.length).toBe(1);
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    const sessions = await db.adminSession.count({
      where: { accountId: account!.id },
    });
    expect(sessions).toBe(1);
  });

  it("malformed verify bodies are 422 VALIDATION_ERROR", async () => {
    expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email: adminEmail,
        code: "12a456",
      }),
      422,
      "VALIDATION_ERROR",
      "non-numeric code",
    );
  });
});

/* ------------------------------------------------------------------ */
/* 4. Sessions: cookie, logout, expiry, revocation, suspension         */
/* ------------------------------------------------------------------ */

describe("admin session lifecycle (§11/§12/§54)", () => {
  it("the ff_admin_session cookie is HttpOnly, SameSite=Lax, Path=/ and NOT Secure over http", async () => {
    const email = uniqueAdminEmail("flags");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { setCookie } = await loginAsAdmin(email, "cookie flags");
    const flags = setCookie.toLowerCase();
    expect(flags).toContain("httponly");
    expect(flags).toContain("samesite=lax");
    expect(flags).toContain("path=/");
    expect(flags).not.toContain("secure");
  });

  it("the session token is stored only as a hash", async () => {
    const email = uniqueAdminEmail("hashatrest");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { setCookie } = await loginAsAdmin(email, "hash at rest");
    const token = /ff_admin_session=([^;]+)/.exec(setCookie)![1];
    const row = await db.adminSession.findUnique({
      where: { tokenHash: sha256Hex(token) },
    });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).not.toBe(token);
  });

  it("an expired session fails resolution (401)", async () => {
    const email = uniqueAdminEmail("exp-session");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(email, "expiry session");
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    await db.adminSession.updateMany({
      where: { accountId: account!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, cookie),
      401,
      "UNAUTHORIZED",
      "expired admin session",
    );
  });

  it("a revoked session fails resolution (401)", async () => {
    const email = uniqueAdminEmail("rev-session");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(email, "revoked session");
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    await db.adminSession.updateMany({
      where: { accountId: account!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, cookie),
      401,
      "UNAUTHORIZED",
      "revoked admin session",
    );
  });

  it("a SUSPENDED AdminAccount cannot request codes, verify, or use sessions", async () => {
    const email = uniqueAdminEmail("susp-admin");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { cookie } = await loginAsAdmin(email, "suspended admin");
    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });

    await db.adminAccount.update({
      where: { id: account!.id },
      data: { status: "SUSPENDED" },
    });

    // Existing session no longer resolves.
    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, cookie),
      401,
      "UNAUTHORIZED",
      "suspended admin session",
    );

    // Inactive code requests return an email field error and create NOTHING.
    const before = await db.adminLoginCode.count();
    const error = expectFail(
      await apiRequest("POST", "/api/admin/auth/request-code", { email }),
      422,
      "VALIDATION_ERROR",
      "suspended request",
    );
    expect(error.error.fields?.email).toMatch(
      /No active FinFam administrator account/i,
    );
    expect(await db.adminLoginCode.count()).toBe(before);

    // Verify is the generic invalid-code response.
    expectFail(
      await apiRequest("POST", "/api/admin/auth/verify", {
        email,
        code: "123456",
      }),
      422,
      "VALIDATION_ERROR",
      "suspended verify",
    );
  });

  it("logout revokes the DB row and clears the cookie", async () => {
    const email = uniqueAdminEmail("logout");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { cookie, setCookie } = await loginAsAdmin(email, "logout login");
    const token = /ff_admin_session=([^;]+)/.exec(setCookie)![1];

    const logout = await adminRawRequest("POST", "/api/admin/auth/logout", {
      cookie,
    });
    expect(logout.status).toBe(200);
    expect(logout.setCookie).toContain("Max-Age=0");

    const account = await db.adminAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    const session = await db.adminSession.findFirst({
      where: { accountId: account!.id, tokenHash: sha256Hex(token) },
    });
    expect(session).not.toBeNull();
    expect(session!.revokedAt).not.toBeNull();

    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, cookie),
      401,
      "UNAUTHORIZED",
      "post-logout reuse",
    );
  });
});

/* ------------------------------------------------------------------ */
/* 5. Cross-domain isolation (§3/§54)                                  */
/* ------------------------------------------------------------------ */

describe("admin/staff domain isolation", () => {
  it("unauthenticated /api/admin/staff is 401", async () => {
    expectFail(
      await apiRequest("GET", "/api/admin/staff"),
      401,
      "UNAUTHORIZED",
      "unauthenticated admin api",
    );
  });

  it("a Staff session cookie does NOT satisfy the admin guard", async () => {
    expectFail(
      await apiRequest("GET", "/api/admin/staff", undefined, staffCookie),
      401,
      "UNAUTHORIZED",
      "staff cookie on admin api",
    );
    // Even planted explicitly into the admin cookie name: an unknown token.
    const staffToken = staffCookie.replace("ff_staff_session=", "");
    expectFail(
      await apiRequest(
        "GET",
        "/api/admin/staff",
        undefined,
        `ff_admin_session=${staffToken}`,
      ),
      401,
      "UNAUTHORIZED",
      "staff token as admin cookie",
    );
  });

  it("an Admin session cookie does NOT satisfy the staff guard", async () => {
    expectFail(
      await apiRequest("GET", "/api/staff/me", undefined, adminCookie),
      401,
      "UNAUTHORIZED",
      "admin cookie on staff api",
    );
    const email = uniqueAdminEmail("isolation-admin");
    createdAdmins.push(email);
    expect(runBootstrap([email]).exitCode).toBe(0);
    const { setCookie } = await loginAsAdmin(email, "isolation login");
    const adminToken = /ff_admin_session=([^;]+)/.exec(setCookie)![1];
    expectFail(
      await apiRequest(
        "GET",
        "/api/staff/me",
        undefined,
        `ff_staff_session=${adminToken}`,
      ),
      401,
      "UNAUTHORIZED",
      "admin token as staff cookie",
    );
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Step over the resend cooldown for an admin account by email. */
async function stepCooldownFor(email: string): Promise<void> {
  const account = await db.adminAccount.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!account) return;
  const latest = await db.adminLoginCode.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (latest) {
    await db.adminLoginCode.update({
      where: { id: latest.id },
      data: { createdAt: new Date(latest.createdAt.getTime() - 61_000) },
    });
  }
}
