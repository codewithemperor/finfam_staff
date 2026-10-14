/**
 * Stage 7 — Email OTP + Staff Session tests (brief §52/§53).
 *
 * Drives the REAL HTTP auth APIs end to end (with the sandbox's
 * STAFF_AUTH_DEV_CODE_ECHO=true so codes are observable) and verifies the
 * database directly for the properties the API cannot show: hashed codes at
 * rest, single-use latches, attempt budgets, session revocation and expiry.
 *
 * Approved policy (brief §6/§59): 6 digits · 10-min expiry · 5 failed
 * attempts · 60s resend cooldown · 5 codes / 15 minutes · 7-day sessions.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { sha256Hex } from "@/lib/auth/hash";

import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
} from "./helpers/api";
import { cleanupTestCandidates, db } from "./helpers/db";
import { driveToActivation, fetchRaw, loginAsStaff } from "./helpers/journey";

const EMAILS: string[] = [];

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(EMAILS);
  console.log(`[staff-auth] cleanup: removed ${removed} test candidate(s)`);
});

async function latestCode(staffRowId: string) {
  const account = await db.staffAccount.findUnique({
    where: { staffId: staffRowId },
    select: { id: true },
  });
  if (!account) throw new Error("account missing");
  return db.staffLoginCode.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
  });
}

async function backdateLastCode(staffRowId: string, ms: number) {
  const code = await latestCode(staffRowId);
  if (!code) throw new Error("code missing");
  await db.staffLoginCode.update({
    where: { id: code.id },
    data: {
      createdAt: new Date(code.createdAt.getTime() - ms),
      expiresAt: new Date(code.expiresAt.getTime() - ms),
    },
  });
  return code;
}

describe("Stage 7 — Email OTP", () => {
  let email = "";
  let staffRowId = "";
  /** Request a fresh code, stepping over the 60s resend cooldown via DB
   * backdating (the cooldown is time-based — healing proves the clock rule).
   * Keeps every prior code INSIDE the 15-minute rate window unless the test
   * explicitly pushes them out. */
  async function requestCodeFresh(
    email: string,
    opts: { outsideWindow?: boolean } = {},
  ) {
    if (opts.outsideWindow) {
      // Push every earlier code outside the 15-minute rate window so this
      // request is unconstrained by it (used after the rate-limit test).
      const account = await db.staffAccount.findUnique({
        where: { staffId: staffRowId },
        select: { id: true },
      });
      await db.staffLoginCode.updateMany({
        where: { accountId: account!.id },
        data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
      });
    } else {
      await backdateLastCode(staffRowId, 61 * 1000);
    }
    return expectOk<{ message: string; devCode?: string }>(
      await apiRequest("POST", "/api/staff/auth/request-code", { email }),
      200,
      "request code (cooldown stepped over)",
    );
  }

  beforeAll(async () => {
    const staff = await driveToActivation("auth-otp");
    EMAILS.push(staff.email);
    email = staff.email;
    const row = await db.staff.findUnique({
      where: { staffId: staff.staffId },
      select: { id: true },
    });
    staffRowId = row!.id;
  });

  it("unknown email returns a field error and creates NOTHING", async () => {
    const unknown = `nobody-${Date.now()}@test.example.com`;
    const error = expectFail(
      await apiRequest("POST", "/api/staff/auth/request-code", {
        email: unknown,
      }),
      422,
      "VALIDATION_ERROR",
      "unknown email request",
    );
    expect(error.fields?.email).toMatch(
      /No active FinFam Staff account/i,
    );
    // No notification row was queued for a non-account email.
    expect(
      await db.notificationDelivery.count({
        where: { recipientEmail: unknown },
      }),
    ).toBe(0);
  });

  it("valid request returns the dev code, stores ONLY the hash, queues one OTP email", async () => {
    const data = expectOk<{ message: string; devCode?: string }>(
      await apiRequest("POST", "/api/staff/auth/request-code", { email }),
      200,
      "request code",
    );
    expect(data.devCode).toMatch(/^\d{6}$/);

    const code = await latestCode(staffRowId);
    expect(code).not.toBeNull();
    expect(code?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(code?.codeHash).not.toBe(data.devCode);
    // Hashed at rest: sha256(code) === stored hash; plaintext never stored.
    expect(code?.codeHash).toBe(sha256Hex(data.devCode!));
    expect(code?.consumedAt).toBeNull();
    expect(code?.attemptCount).toBe(0);
    // ~10 minute expiry.
    const ttlMs = code!.expiresAt.getTime() - code!.createdAt.getTime();
    expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000);

    expect(
      await db.notificationDelivery.count({
        where: { recipientEmail: email, type: "STAFF_LOGIN_CODE" },
      }),
    ).toBe(1);
  });

  it("resend cooldown: an immediate second request is 429; time still heals it", async () => {
    const blocked = await fetchRaw("POST", "/api/staff/auth/request-code", {
      email,
    });
    expect(blocked.status).toBe(429);

    // Backdate beyond the 60s cooldown — the same request now succeeds and
    // replaces the old code (replacement logic: only latest is verifiable).
    const ok = await requestCodeFresh(email);
    expect(ok.devCode).toMatch(/^\d{6}$/);
  });

  it("request rate limit: the 6th code inside the window is 429; outside the window it is allowed", async () => {
    // We already have 2 codes in the window. requestCodeFresh steps over
    // the cooldown with a 61s backdate, which keeps every predecessor
    // INSIDE the 15-minute window — so the window fills up.
    for (let i = 0; i < 3; i += 1) {
      await requestCodeFresh(email);
    }
    // 5 codes inside the window now — the next must be refused.
    const limited = await fetchRaw("POST", "/api/staff/auth/request-code", {
      email,
    });
    expect(limited.status).toBe(429);

    // Push ALL codes outside the 15-minute window — a fresh request works.
    const account = await db.staffAccount.findUnique({
      where: { staffId: staffRowId },
      select: { id: true },
    });
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    await db.staffLoginCode.updateMany({
      where: { accountId: account!.id, createdAt: { gte: windowStart } },
      data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
    });
    const ok = await requestCodeFresh(email);
    expect(ok.devCode).toMatch(/^\d{6}$/);
  });

  it("wrong code is refused and the attempt is counted; the correct code still works after one miss", async () => {
    const good = await requestCodeFresh(email, { outsideWindow: true });
    expect(good.devCode).toMatch(/^\d{6}$/);

    const wrong = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: good.devCode === "000000" ? "111111" : "000000",
    });
    expect(wrong.status).toBe(422);

    expect((await latestCode(staffRowId))?.attemptCount).toBe(1);

    const right = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: good.devCode!,
    });
    expect(right.status).toBe(200);
  });

  it("five failed attempts kill the code — even the correct answer then fails", async () => {
    await requestCodeFresh(email, { outsideWindow: true }); // superseded; only the latest verifies
    const refreshed = await requestCodeFresh(email, { outsideWindow: true });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await fetchRaw("POST", "/api/staff/auth/verify", {
        email,
        code: refreshed.devCode === "999999" ? "888888" : "999999",
      });
      expect(wrong.status).toBe(422);
    }
    expect((await latestCode(staffRowId))?.attemptCount).toBe(5);

    // Budget exhausted: the CORRECT code is dead now too.
    const dead = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: refreshed.devCode!,
    });
    expect(dead.status).toBe(422);
  });

  it("expired code is refused", async () => {
    const issued = await requestCodeFresh(email, { outsideWindow: true });
    await backdateLastCode(staffRowId, 11 * 60 * 1000);

    const expired = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: issued.devCode!,
    });
    expect(expired.status).toBe(422);
  });

  it("consumed code is single-use: a reused code fails and creates no second session", async () => {
    const issued = await requestCodeFresh(email, { outsideWindow: true });

    const first = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: issued.devCode!,
    });
    expect(first.status).toBe(200);
    expect((await latestCode(staffRowId))?.consumedAt).not.toBeNull();

    const sessionsBefore = await db.staffSession.count({
      where: { account: { staffId: staffRowId } },
    });

    const reused = await fetchRaw("POST", "/api/staff/auth/verify", {
      email,
      code: issued.devCode!,
    });
    expect(reused.status).toBe(422);
    expect(
      await db.staffSession.count({
        where: { account: { staffId: staffRowId } },
      }),
    ).toBe(sessionsBefore);
  });

  it("concurrent verification with the same code creates exactly ONE session", async () => {
    await requestCodeFresh(email, { outsideWindow: true }); // superseded
    const refreshed = await requestCodeFresh(email, { outsideWindow: true });

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        fetchRaw("POST", "/api/staff/auth/verify", {
          email,
          code: refreshed.devCode!,
        }),
      ),
    );
    const successes = results.filter((r) => r.status === 200);
    expect(successes).toHaveLength(1);

    const consumed = await latestCode(staffRowId);
    expect(consumed?.consumedAt).not.toBeNull();
  });

  it("verification for an unknown email never reveals existence", async () => {
    const unknown = `ghost-${Date.now()}@test.example.com`;
    const wrong = await fetchRaw("POST", "/api/staff/auth/verify", {
      email: unknown,
      code: "123456",
    });
    expect(wrong.status).toBe(422);
    expect(JSON.stringify(wrong.body)).not.toContain("no account");
    expect(JSON.stringify(wrong.body)).not.toContain("not registered");
  });
});

describe("Stage 7 — Sessions", () => {
  let email = "";
  let staffRowId = "";
  let cookie = "";
  let rawSetCookie = "";

  beforeAll(async () => {
    const staff = await driveToActivation("auth-session");
    EMAILS.push(staff.email);
    email = staff.email;
    const row = await db.staff.findUnique({
      where: { staffId: staff.staffId },
      select: { id: true },
    });
    staffRowId = row!.id;
    const login = await loginAsStaff(email, "session login");
    cookie = login.cookie;
    rawSetCookie = login.setCookie;
  });

  it("login sets an HttpOnly, SameSite=Lax, Path=/ session cookie", () => {
    expect(rawSetCookie).toContain("HttpOnly");
    expect(rawSetCookie).toMatch(/SameSite=Lax/i);
    expect(rawSetCookie).toContain("Path=/");
    // Secure only in production; the sandbox runs over http.
    expect(rawSetCookie).not.toContain("Secure");
  });

  it("/api/staff/me resolves the identity chain from the session", async () => {
    const me = await fetchRaw("GET", "/api/staff/me", undefined, cookie);
    expect(me.status).toBe(200);
    const body = me.body as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.designation).toBe("Marketing & Customer Care Executive");
    expect(body.data.workArrangement).toBe("Remote");
    expect(String(body.data.staffId)).toMatch(/^FF-STF-\d{4,}$/);
  });

  it("no cookie, garbage cookie, and manipulated cookies are all rejected", async () => {
    expect((await fetchRaw("GET", "/api/staff/me")).status).toBe(401);
    expect(
      (
        await fetchRaw(
          "GET",
          "/api/staff/me",
          undefined,
          "ff_staff_session=garbage",
        )
      ).status,
    ).toBe(401);
    // sha256 collision games: a random hex token resolves to nothing.
    expect(
      (
        await fetchRaw(
          "GET",
          "/api/staff/me",
          undefined,
          `ff_staff_session=${"a".repeat(43)}A`,
        )
      ).status,
    ).toBe(401);
  });

  it("the session token is stored only as a hash", async () => {
    const token = cookie.split("=")[1]!;
    const sessionRow = await db.staffSession.findFirst({
      where: { account: { staffId: staffRowId } },
      orderBy: { createdAt: "desc" },
    });
    expect(sessionRow).not.toBeNull();
    expect(sessionRow?.tokenHash).toBe(sha256Hex(token));
    expect(sessionRow?.tokenHash).not.toBe(token);
  });

  it("logout revokes the DB session and clears the cookie", async () => {
    const logout = await fetchRaw(
      "POST",
      "/api/staff/auth/logout",
      undefined,
      cookie,
    );
    expect(logout.status).toBe(200);

    const sessionRow = await db.staffSession.findFirst({
      where: { account: { staffId: staffRowId } },
      orderBy: { createdAt: "desc" },
    });
    expect(sessionRow?.revokedAt).not.toBeNull();

    expect(
      (await fetchRaw("GET", "/api/staff/me", undefined, cookie)).status,
    ).toBe(401);
    expect(logout.setCookie ?? "").toContain("Max-Age=0");
  });

  it("expired sessions are rejected even while the cookie is replayed", async () => {
    const login = await loginAsStaff(email, "expiry login", { staffRowId });
    await db.staffSession.updateMany({
      where: { account: { staffId: staffRowId }, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await fetchRaw("GET", "/api/staff/me", undefined, login.cookie)).status,
    ).toBe(401);
  });

  it("a suspended account loses portal access immediately", async () => {
    const login = await loginAsStaff(email, "suspend login", { staffRowId });
    await db.staffAccount.update({
      where: { staffId: staffRowId },
      data: { status: "SUSPENDED" },
    });
    expect(
      (await fetchRaw("GET", "/api/staff/me", undefined, login.cookie)).status,
    ).toBe(401);
    await db.staffAccount.update({
      where: { staffId: staffRowId },
      data: { status: "ACTIVE" },
    });
    expect(
      (await fetchRaw("GET", "/api/staff/me", undefined, login.cookie)).status,
    ).toBe(200);
  });
});
