/**
 * FinFam notification service tests — Mailjet transactional email (Part A).
 *
 * Four layers, mirroring brief §27–§29:
 *
 * 1. ADAPTER (unit): Mailjet v3.1 request construction + response/failure
 *    mapping with an injectable fetch — no network, no credentials.
 * 2. TEMPLATES (unit): all ten lifecycle emails render subject/text/HTML,
 *    escape hostile names, carry only safe fields and safe links.
 * 3. LIVE MATRIX (§28): one candidate drives the REAL APIs through the
 *    whole journey while the suite asserts exactly-once queued rows per
 *    lifecycle event — duplicates, repeats, retakes and concurrent
 *    issuance/activation included. The dev server runs with notifications
 *    DISABLED, so rows stay PENDING and no network call can ever occur.
 * 4. FAILURE/RETRY (§29): against an in-process FAKE Mailjet — a provider
 *    failure leaves the business state untouched and the row FAILED; a
 *    retry reuses the SAME delivery record; concurrent retries send exactly
 *    once; the attempt budget and the disabled mode are honoured.
 *
 * Requires the dev server (`bun run dev`) — see tests/helpers/api.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { ASSESSMENT_META, ASSESSMENT_QUESTION_IDS } from "@/config/assessment";
import { AGREEMENT_META } from "@/config/agreement";
import { ACTIVATION_META } from "@/config/activation";
import {
  ONBOARDING_FINAL_STEP_ID,
  ONBOARDING_META,
  ONBOARDING_STEP_IDS,
} from "@/config/onboarding";
import { ORIENTATION_SECTION_IDS } from "@/config/orientation";
import {
  buildMailjetMessage,
  sendViaMailjet,
  type OutgoingEmailMessage,
} from "@/server/notifications/providers/mailjet";
import {
  NOTIFICATION_TEMPLATE_VERSION,
  renderNotificationEmail,
} from "@/server/notifications/notification-templates";
import {
  entityIdFromDedupeKey,
  buildDedupeKey,
  getNotificationConfig,
} from "@/server/notifications/notification-types";
import {
  retryNotification,
  retryPendingNotifications,
  sendNotification,
} from "@/server/notifications/notification-service";

import { loadAnswerKey } from "./helpers/answer-key";
import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
} from "./helpers/api";
import { cleanupTestCandidates, db, uniqueEmail } from "./helpers/db";

import type {
  OnboardingView,
  RecruitmentJourneyView,
} from "@/types/recruitment";
import type {
  NotificationDelivery,
  NotificationType,
  Prisma,
} from "@prisma/client";

/* ------------------------------------------------------------------ */
/* Fake Mailjet — an in-process stand-in for the Send API.             */
/* ------------------------------------------------------------------ */

interface FakeMailjet {
  baseUrl: string;
  setMode(mode: "ok" | "error_500"): void;
  requestCount(): number;
  lastBody(): Record<string, unknown> | null;
  stop(): Promise<void>;
}

async function startFakeMailjet(): Promise<FakeMailjet> {
  let mode: "ok" | "error_500" = "ok";
  let requests = 0;
  let lastBody: Record<string, unknown> | null = null;

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests += 1;
      try {
        lastBody = (await request.json()) as Record<string, unknown>;
      } catch {
        lastBody = null;
      }
      if (mode === "error_500") {
        return new Response(JSON.stringify({ Messages: [] }), { status: 500 });
      }
      return Response.json({
        Messages: [
          { Status: "success", To: [{ MessageID: 4820233749028 }] },
        ],
      });
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}/v3.1/send`,
    setMode(next) {
      mode = next;
    },
    requestCount: () => requests,
    lastBody: () => lastBody,
    stop: async () => {
      server.stop(true);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Env save/restore — the failure/retry layer drives the notification  */
/* service IN-PROCESS, so it reconfigures the environment per section. */
/* ------------------------------------------------------------------ */

const ENV_KEYS = [
  "NOTIFICATIONS_ENABLED",
  "NOTIFICATIONS_MAX_ATTEMPTS",
  "MAILJET_API_KEY",
  "MAILJET_SECRET_KEY",
  "MAILJET_FROM_EMAIL",
  "MAILJET_FROM_NAME",
  "MAILJET_API_URL",
  "APP_BASE_URL",
] as const;

const savedEnv = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined): void {
  if (!savedEnv.has(key)) {
    savedEnv.set(key, process.env[key]);
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

/* ------------------------------------------------------------------ */
/* 1. Mailjet adapter (unit)                                          */
/* ------------------------------------------------------------------ */

describe("Mailjet adapter — request construction", () => {
  it("builds a v3.1 message with From/To/Subject/Text/HTML/CustomID", () => {
    const message: OutgoingEmailMessage = {
      to: "candidate@test.example.com",
      subject: "Subject line",
      text: "Text body",
      html: "<p>HTML body</p>",
      customId: "APPLICATION_RECEIVED:abc123",
    };
    const body = buildMailjetMessage(message, {
      fromEmail: "no-reply@finfam.test",
      fromName: "FinFam Recruitment",
    });

    expect(body.From.Email).toBe("no-reply@finfam.test");
    expect(body.From.Name).toBe("FinFam Recruitment");
    expect(body.To).toHaveLength(1);
    expect(body.To[0]?.Email).toBe("candidate@test.example.com");
    expect(body.Subject).toBe("Subject line");
    expect(body.TextPart).toBe("Text body");
    expect(body.HTMLPart).toBe("<p>HTML body</p>");
    expect(body.CustomID).toBe("APPLICATION_RECEIVED:abc123");
  });

  it("omits CustomID when not supplied", () => {
    const body = buildMailjetMessage(
      { to: "a@b.test", subject: "s", text: "t", html: "<p>h</p>" },
      { fromEmail: "no-reply@finfam.test", fromName: "FinFam" },
    );
    expect(body.CustomID).toBeUndefined();
  });
});

describe("Mailjet adapter — response and failure mapping", () => {
  const message: OutgoingEmailMessage = {
    to: "candidate@test.example.com",
    subject: "s",
    text: "t",
    html: "<p>h</p>",
  };

  function fetchOk(json: unknown, status = 200): typeof fetch {
    return (async () =>
      new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;
  }

  it("maps a v3.1 success response and captures the message id", async () => {
    const result = await sendViaMailjet(message, {
      apiKey: "key-123",
      secretKey: "secret-456",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: fetchOk({
        Messages: [
          { Status: "success", To: [{ MessageID: 4820233749028 }] },
        ],
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("4820233749028");
    }
  });

  it("sends HTTP Basic credentials server-side", async () => {
    let seenAuth: string | null = null;
    const spyFetch = (async (
      _url: unknown,
      init?: { headers?: Record<string, string> },
    ) => {
      seenAuth = init?.headers?.authorization ?? null;
      return new Response(
        JSON.stringify({
          Messages: [{ Status: "success", To: [{ MessageID: 1 }] }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await sendViaMailjet(message, {
      apiKey: "key-123",
      secretKey: "secret-456",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: spyFetch,
    });

    expect(seenAuth as string | null).toBe(
      `Basic ${Buffer.from("key-123:secret-456").toString("base64")}`,
    );
  });

  it("treats a per-message provider rejection as a failure", async () => {
    const result = await sendViaMailjet(message, {
      apiKey: "k",
      secretKey: "s",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: fetchOk({ Messages: [{ Status: "error", To: [] }] }),
    });
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_REJECTED" });
  });

  it("maps an HTTP 500 to a safe error without echoing the body", async () => {
    const result = await sendViaMailjet(message, {
      apiKey: "key-123",
      secretKey: "secret-456",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: (async () =>
        new Response('{"error":"internal with key-123 secret-456"}', {
          status: 500,
        })) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "HTTP_500" });
    if (!result.ok) {
      expect(result.errorMessage).not.toContain("key-123");
      expect(result.errorMessage).not.toContain("secret-456");
    }
  });

  it("maps timeouts and network failures to safe transport errors", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const timeout = await sendViaMailjet(message, {
      apiKey: "k",
      secretKey: "s",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: (async () => {
        throw abortError;
      }) as unknown as typeof fetch,
    });
    expect(timeout).toMatchObject({ ok: false, errorCode: "TIMEOUT" });

    const network = await sendViaMailjet(message, {
      apiKey: "k",
      secretKey: "s",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    expect(network).toMatchObject({ ok: false, errorCode: "NETWORK_ERROR" });
    if (!network.ok) {
      expect(network.errorMessage).not.toContain("ECONNREFUSED");
    }
  });

  it("flags an unreadable 2xx response", async () => {
    const result = await sendViaMailjet(message, {
      apiKey: "k",
      secretKey: "s",
      fromEmail: "no-reply@finfam.test",
      fetchImpl: (async () =>
        new Response("not json", { status: 200 })) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({
      ok: false,
      errorCode: "PROVIDER_RESPONSE_INVALID",
    });
  });
});

/* ------------------------------------------------------------------ */
/* 2. Templates (unit)                                                */
/* ------------------------------------------------------------------ */

  const BASE_PAYLOAD = {
  candidateId: "cand_1",
  // The FIRST name token carries the hostile payload so the heading — the
  // one place a name is rendered — genuinely exercises HTML escaping.
  candidateName: "<script>alert(1)</script> Ada",
  referenceNumber: "FF-AB2CD3",
  recipientEmail: "ada@test.example.com",
} as const;

describe("Notification templates", () => {
  const baseUrl = "https://portal.finfam.test";

  function payloadFor<T extends keyof typeof SAMPLE_PAYLOADS>(
    type: T,
  ): (typeof SAMPLE_PAYLOADS)[T] {
    return SAMPLE_PAYLOADS[type];
  }

  const SAMPLE_PAYLOADS = {
    APPLICATION_RECEIVED: { ...BASE_PAYLOAD, roleTitle: "Staff Member" },
    ORIENTATION_COMPLETED: { ...BASE_PAYLOAD, roleTitle: "Staff Member" },
    ASSESSMENT_PASSED: {
      ...BASE_PAYLOAD,
      attemptNumber: 2,
      percentage: 93.3,
      passed: true,
      retakeAllowed: true,
    },
    ASSESSMENT_FAILED: {
      ...BASE_PAYLOAD,
      attemptNumber: 1,
      percentage: 20,
      passed: false,
      retakeAllowed: true,
    },
    AGREEMENT_ACCEPTED: { ...BASE_PAYLOAD, agreementVersion: "1.0" },
    APPOINTMENT_ISSUED: {
      ...BASE_PAYLOAD,
      appointmentReference: "FFL/HR/PLA/013",
      designation: "Remote Staff",
      issuedAt: "2026-09-15T10:00:00.000Z",
    },
    STAFF_ACTIVATED: {
      ...BASE_PAYLOAD,
      staffId: "FF-STF-0099",
      designation: "Remote Staff",
      activatedAt: "2026-09-15T11:00:00.000Z",
    },
    ONBOARDING_STARTED: {
      ...BASE_PAYLOAD,
      staffId: "FF-STF-0099",
      designation: "Remote Staff",
    },
    ONBOARDING_COMPLETED: {
      ...BASE_PAYLOAD,
      staffId: "FF-STF-0099",
      designation: "Remote Staff",
    },
    STAFF_ACCOUNT_CREATED: { ...BASE_PAYLOAD, staffId: "FF-STF-0099" },
    STAFF_LOGIN_CODE: {
      ...BASE_PAYLOAD,
      staffId: "FF-STF-0099",
      loginCode: "482913",
      expiresAt: "2026-09-15T12:10:00.000Z",
    },
  } as const;

  it("renders subject, text and HTML for every lifecycle key", () => {
    for (const type of Object.keys(
      SAMPLE_PAYLOADS,
    ) as (keyof typeof SAMPLE_PAYLOADS)[]) {
      const email = renderNotificationEmail(
        type,
        payloadFor(type),
        baseUrl,
      );
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.text.length).toBeGreaterThan(0);
      expect(email.html).toContain("FinFam");
      expect(email.html).toContain(BASE_PAYLOAD.referenceNumber);
      // The application reference is the anchor of every email.
      expect(email.text).toContain(BASE_PAYLOAD.referenceNumber);
    }
  });

  it("escapes hostile payload values in the HTML part", () => {
    const email = renderNotificationEmail(
      "APPLICATION_RECEIVED",
      payloadFor("APPLICATION_RECEIVED"),
      baseUrl,
    );
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("carries the safe portal link with APP_BASE_URL and the reference", () => {
    const email = renderNotificationEmail(
      "APPLICATION_RECEIVED",
      payloadFor("APPLICATION_RECEIVED"),
      baseUrl,
    );
    expect(email.html).toContain(`${baseUrl}/application/FF-AB2CD3`);
    expect(email.text).toContain(`${baseUrl}/application/FF-AB2CD3`);
  });

  it("never promises a retake unless the policy allows it", () => {
    const allowed = renderNotificationEmail(
      "ASSESSMENT_FAILED",
      payloadFor("ASSESSMENT_FAILED"),
      baseUrl,
    );
    expect(allowed.text).toContain("may retake");

    const blocked = renderNotificationEmail(
      "ASSESSMENT_FAILED",
      { ...payloadFor("ASSESSMENT_FAILED"), retakeAllowed: false },
      baseUrl,
    );
    expect(blocked.text).toContain("no retake is available");
  });

  it("keeps answer keys, NIN/BVN/bank fields and credentials out of emails", () => {
    for (const type of Object.keys(
      SAMPLE_PAYLOADS,
    ) as (keyof typeof SAMPLE_PAYLOADS)[]) {
      const email = renderNotificationEmail(
        type,
        payloadFor(type),
        baseUrl,
      );
      const haystack = `${email.subject}\n${email.text}\n${email.html}`.toLowerCase();
      for (const banned of [
        "bvn",
        "bank account",
        "answer key",
        "correct answer",
      ]) {
        expect(haystack).not.toContain(banned);
      }
      // No credential-assignment patterns and no raw secret-looking tokens.
      expect(haystack).not.toMatch(/password\s*[:=]/);
      expect(haystack).not.toMatch(/\b[0-9a-f]{32,}\b/);
    }
  });

  it("recruitment emails never link the Staff Portal; Stage 7 emails link /staff/login", () => {
    // Recruitment-stage emails keep the recruitment portal as their only
    // destination — the Staff Portal must not be reachable from them.
    for (const type of [
      "STAFF_ACTIVATED",
      "ONBOARDING_STARTED",
      "ONBOARDING_COMPLETED",
    ] as const) {
      const email = renderNotificationEmail(type, payloadFor(type), baseUrl);
      expect(email.html).not.toContain("/staff/");
      expect(email.text).not.toContain("/staff/");
    }

    // Stage 7 emails (account ready, OTP) point to the authenticated
    // sign-in page — the approved post-revision architecture (brief §44/§9).
    const accountEmail = renderNotificationEmail(
      "STAFF_ACCOUNT_CREATED",
      payloadFor("STAFF_ACCOUNT_CREATED"),
      baseUrl,
    );
    expect(accountEmail.html).toContain("/staff/login");
    expect(accountEmail.text).toContain("/staff/login");
    expect(accountEmail.subject).toBe("Your FinFam Staff Portal is ready");

    const codeEmail = renderNotificationEmail(
      "STAFF_LOGIN_CODE",
      payloadFor("STAFF_LOGIN_CODE"),
      baseUrl,
    );
    expect(codeEmail.html).toContain("/staff/login");
    expect(codeEmail.subject).toBe("Your FinFam Staff Portal login code");
    // The OTP email carries the code and its expiry — and nothing secret
    // beyond that (no password, no reusable credential).
    expect(codeEmail.html).toContain("482913");
    expect(codeEmail.text).toContain("482913");
    expect(codeEmail.text).toMatch(/10 minutes/);
  });
});

describe("Notification configuration and dedupe keys", () => {
  it("reads the runtime configuration from the environment at call time", () => {
    setEnv("NOTIFICATIONS_ENABLED", "true");
    setEnv("MAILJET_API_KEY", "k");
    setEnv("MAILJET_SECRET_KEY", "s");
    setEnv("MAILJET_FROM_EMAIL", "no-reply@finfam.test");
    const active = getNotificationConfig();
    expect(active.enabled).toBe(true);
    expect(active.providerConfigured).toBe(true);

    setEnv("NOTIFICATIONS_ENABLED", "false");
    const disabled = getNotificationConfig();
    expect(disabled.enabled).toBe(false);

    setEnv("NOTIFICATIONS_ENABLED", "true");
    setEnv("MAILJET_API_KEY", "");
    const unconfigured = getNotificationConfig();
    expect(unconfigured.providerConfigured).toBe(false);
  });

  it('builds and parses "<TYPE>:<entityId>" dedupe keys', () => {
    const key = buildDedupeKey("STAFF_ACTIVATED", "staff_row_1");
    expect(key).toBe("STAFF_ACTIVATED:staff_row_1");
    expect(entityIdFromDedupeKey("STAFF_ACTIVATED", key)).toBe("staff_row_1");
  });

  it("pins the template registry version", () => {
    // v2.0: Stage 7 added the STAFF_LOGIN_CODE + updated STAFF_ACCOUNT_CREATED
    // templates. v2.1: Stage 8 added the DAILY_REPORT_SUBMITTED receipt
    // (registry versions are pinned on delivery rows at enqueue).
    expect(NOTIFICATION_TEMPLATE_VERSION).toBe("2.1");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Live verification matrix (§28) — real APIs, dev server disabled */
/* ------------------------------------------------------------------ */

const fullName = "Notification Test Candidate";
const phone = "0803 000 0004";
const city = "Ibadan";

let email = "";
let reference = "";

async function deliveryRows(
  where: Prisma.NotificationDeliveryWhereInput,
): Promise<NotificationDelivery[]> {
  return db.notificationDelivery.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
}

async function candidateIdOf(referenceNumber: string): Promise<string> {
  const candidate = await db.candidate.findUniqueOrThrow({
    where: { referenceNumber },
    select: { id: true },
  });
  return candidate.id;
}

describe("Live notification matrix (§28) — one candidate, whole journey", () => {
  let candidateId = "";

  beforeAll(async () => {
    await assertServerUp();
    await loadAnswerKey();
  });
  // NOTE: cleanup deliberately does NOT happen here — the failure/retry
  // describe below reuses this candidate's queued rows and runs last.

  it("registration queues exactly one APPLICATION_RECEIVED email", async () => {
    email = uniqueEmail("notif");
    const data = expectOk<{ referenceNumber: string }>(
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
    candidateId = await candidateIdOf(reference);

    // Candidate-scoped: other suites may register their own candidates
    // concurrently, so the global table is never an assertion target.
    const rows = await deliveryRows({
      candidateId,
      type: "APPLICATION_RECEIVED",
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.candidateId).toBe(candidateId);
    expect(row.dedupeKey).toBe(buildDedupeKey("APPLICATION_RECEIVED", candidateId));
    expect(row.recipientEmail).toBe(email);
    expect(row.templateVersion).toBe(NOTIFICATION_TEMPLATE_VERSION);
    expect(row.provider).toBe("mailjet");
    // Dev server runs with NOTIFICATIONS_ENABLED=false — the row is queued
    // but nothing is ever sent and no network call ever leaves (§26).
    expect(row.status).toBe("PENDING");
    expect(row.attemptCount).toBe(0);
    expect(row.sentAt).toBeNull();
  });

  it("a duplicate application rejection queues no email", async () => {
    const before = (await deliveryRows({ candidateId })).length;
    expectFail<unknown>(
      await apiRequest("POST", "/api/applications", {
        fullName: "Same Email Again",
        email,
        phone,
        city,
        roleTitle: "Staff Member",
        consent: true,
      }),
      409,
      "CONFLICT",
      "duplicate application",
    );
    expect(await deliveryRows({ candidateId })).toHaveLength(before);
  });

  it("an incomplete orientation has no completion email", async () => {
    const rows = await deliveryRows({
      candidateId,
      type: "ORIENTATION_COMPLETED",
    });
    expect(rows).toHaveLength(0);
  });

  it("completing orientation queues exactly one completion email (repeats never duplicate)", async () => {
    for (const sectionId of ORIENTATION_SECTION_IDS) {
      expectOk(
        await apiRequest("POST", `/api/orientation/${reference}/sections`, {
          sectionId,
        }),
        200,
        `section ${sectionId}`,
      );
    }
    expectOk(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: true,
      }),
      200,
      "orientation complete",
    );
    // Duplicate completion — still exactly one.
    expectOk(
      await apiRequest("POST", `/api/orientation/${reference}/complete`, {
        acknowledgement: true,
      }),
      200,
      "orientation repeat",
    );

    const rows = await deliveryRows({
      candidateId,
      type: "ORIENTATION_COMPLETED",
    });
    expect(rows).toHaveLength(1);
  });

  it("a failed attempt queues one attempt-keyed failure email; the retake queues one pass email", async () => {
    // Fail attempt #1 deliberately.
    expectOk<unknown>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "start attempt 1",
    );
    const key = await loadAnswerKey();
    for (const questionId of ASSESSMENT_QUESTION_IDS) {
      const wrongOption = (key[questionId] + 1) % 4;
      expectOk(
        await apiRequest("POST", `/api/assessment/${reference}/answers`, {
          questionId,
          selectedOption: wrongOption,
        }),
        200,
        `wrong answer ${questionId}`,
      );
    }
    expectOk<unknown>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "submit failing attempt",
    );

    const failedRows = await deliveryRows({
      candidateId,
      type: "ASSESSMENT_FAILED",
    });
    expect(failedRows).toHaveLength(1);
    const failedKey = failedRows[0]!.dedupeKey;
    expect(failedKey.startsWith("ASSESSMENT_FAILED:")).toBe(true);
    // Attempt-specific dedupe: the id belongs to attempt #1.
    const attempt1Id = entityIdFromDedupeKey("ASSESSMENT_FAILED", failedKey);
    const attempt1 = await db.assessmentAttempt.findUnique({
      where: { id: attempt1Id },
      select: { attemptNumber: true },
    });
    expect(attempt1?.attemptNumber).toBe(1);

    // Re-submitting a submitted attempt is an idempotent no-op — no email.
    expectOk<unknown>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "duplicate submit",
    );
    expect(
      await deliveryRows({ candidateId, type: "ASSESSMENT_FAILED" }),
    ).toHaveLength(1);

    // Retake → pass: a DIFFERENT, attempt-keyed email.
    expectOk<unknown>(
      await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
      200,
      "start attempt 2",
    );
    for (const questionId of ASSESSMENT_QUESTION_IDS) {
      expectOk(
        await apiRequest("POST", `/api/assessment/${reference}/answers`, {
          questionId,
          selectedOption: key[questionId],
        }),
        200,
        `correct answer ${questionId}`,
      );
    }
    expectOk<unknown>(
      await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
      200,
      "submit passing retake",
    );

    const passedRows = await deliveryRows({
      candidateId,
      type: "ASSESSMENT_PASSED",
    });
    expect(passedRows).toHaveLength(1);
    const attempt2Id = entityIdFromDedupeKey(
      "ASSESSMENT_PASSED",
      passedRows[0]!.dedupeKey,
    );
    expect(attempt2Id).not.toBe(attempt1Id);
  });

  it("accepting the agreement queues exactly one email (repeat accept never duplicates)", async () => {
    // Lazily open the agreement (OFFER_PENDING), then accept.
    expectOk<unknown>(
      await apiRequest("GET", `/api/agreement/${reference}`),
      200,
      "open agreement",
    );
    expectOk<unknown>(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: true,
        version: AGREEMENT_META.version,
      }),
      200,
      "accept agreement",
    );
    expectOk<unknown>(
      await apiRequest("POST", `/api/agreement/${reference}/accept`, {
        acknowledgement: true,
        version: AGREEMENT_META.version,
      }),
      200,
      "repeat accept",
    );

    const rows = await deliveryRows({ candidateId, type: "AGREEMENT_ACCEPTED" });
    expect(rows).toHaveLength(1);
  });

  it("concurrent first opens of the appointment issue exactly one email", async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("GET", `/api/appointment/${reference}`),
      ),
    );
    for (const response of responses) {
      expectOk<unknown>(response, 200, "concurrent appointment open");
    }

    const rows = await deliveryRows({ candidateId, type: "APPOINTMENT_ISSUED" });
    expect(rows).toHaveLength(1);
    // Re-opening afterwards is a read-only record — still one.
    expectOk<unknown>(
      await apiRequest("GET", `/api/appointment/${reference}`),
      200,
      "appointment re-open",
    );
    expect(await deliveryRows({ candidateId, type: "APPOINTMENT_ISSUED" })).toHaveLength(1);
  });

  it("concurrent activations queue exactly one STAFF_ACTIVATED email", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest("POST", `/api/activation/${reference}/activate`, {
          acknowledgement: true,
          version: ACTIVATION_META.version,
        }),
      ),
    );
    for (const result of results) {
      expectOk<unknown>(result, 200, "concurrent activation");
    }

    const rows = await deliveryRows({ candidateId, type: "STAFF_ACTIVATED" });
    expect(rows).toHaveLength(1);

    // Stage 7: the winning activation ALSO provisioned the StaffAccount and
    // queued exactly ONE STAFF_ACCOUNT_CREATED email (same transaction).
    const accountRows = await deliveryRows({
      candidateId,
      type: "STAFF_ACCOUNT_CREATED",
    });
    expect(accountRows).toHaveLength(1);
  });

  it("onboarding start queues one email; steps queue none; completion queues one", async () => {
    // First open lazily creates the record — the STARTED email.
    expectOk<OnboardingView>(
      await apiRequest("GET", `/api/onboarding/${reference}`),
      200,
      "onboarding first open",
    );

    const startedRows = await deliveryRows({
      candidateId,
      type: "ONBOARDING_STARTED",
    });
    expect(startedRows).toHaveLength(1);

    // Steps: deliberately NO email per step (§7/§8). v2.0 review steps are
    // every configured step except the final "ready" acknowledgement step.
    for (const stepId of ONBOARDING_STEP_IDS.filter(
      (id) => id !== ONBOARDING_FINAL_STEP_ID,
    )) {
      expectOk<OnboardingView>(
        await apiRequest("POST", `/api/onboarding/${reference}/steps`, {
          stepId,
        }),
        200,
        `step ${stepId}`,
      );
      const total = await deliveryRows({ candidateId });
      expect(total).toHaveLength(9); // 8 events so far + nothing new
    }

    expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      200,
      "complete onboarding",
    );
    // Duplicate completion — still one completion email.
    expectOk<OnboardingView>(
      await apiRequest("POST", `/api/onboarding/${reference}/complete`, {
        acknowledgement: true,
        version: ONBOARDING_META.version,
      }),
      200,
      "repeat completion",
    );

    const completedRows = await deliveryRows({
      candidateId,
      type: "ONBOARDING_COMPLETED",
    });
    expect(completedRows).toHaveLength(1);
  });

  it("the journey end-state has exactly the ten lifecycle emails — STAFF_ACCOUNT_CREATED exactly once", async () => {
    const journey = expectOk<RecruitmentJourneyView>(
      await apiRequest("GET", `/api/journey/${reference}`),
      200,
      "final journey",
    );
    expect(journey.status).toBe("APPROVED_STAFF");
    expect(journey.onboarding?.state).toBe("COMPLETED");

    const rows = await deliveryRows({ candidateId });
    expect(rows).toHaveLength(10);
    const types = rows.map((row) => row.type).sort();
    const expectedTypes: NotificationType[] = [
      "AGREEMENT_ACCEPTED",
      "APPLICATION_RECEIVED",
      "APPOINTMENT_ISSUED",
      "ASSESSMENT_FAILED",
      "ASSESSMENT_PASSED",
      "ONBOARDING_COMPLETED",
      "ONBOARDING_STARTED",
      "ORIENTATION_COMPLETED",
      "STAFF_ACTIVATED",
      "STAFF_ACCOUNT_CREATED",
    ].sort() as NotificationType[];
    expect(types).toEqual(expectedTypes);
    // Stage 7: the account-created email fired exactly once, at activation.
    expect(
      rows.filter((row) => row.type === "STAFF_ACCOUNT_CREATED"),
    ).toHaveLength(1);
    // Everything stayed PENDING: the dev server has notifications disabled.
    for (const row of rows) {
      expect(row.status).toBe("PENDING");
      expect(row.attemptCount).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4. Failure & retry (§29) — in-process service + fake Mailjet       */
/* ------------------------------------------------------------------ */

describe("Failure and retry (§29) — provider outage never corrupts state", () => {
  let fake: FakeMailjet;
  let probeDeliveryId = "";
  let probeDedupeKey = "";

  beforeAll(async () => {
    await assertServerUp();
    fake = await startFakeMailjet();

    // Reconfigure THIS process (the dev server stays disabled and safe).
    setEnv("NOTIFICATIONS_ENABLED", "true");
    setEnv("NOTIFICATIONS_MAX_ATTEMPTS", "3");
    setEnv("MAILJET_API_KEY", "test-key");
    setEnv("MAILJET_SECRET_KEY", "test-secret");
    setEnv("MAILJET_FROM_EMAIL", "no-reply@test.example.com");
    setEnv("MAILJET_FROM_NAME", "FinFam Test");
    setEnv("MAILJET_API_URL", fake.baseUrl);
    setEnv("APP_BASE_URL", "https://portal.finfam.test");
  });

  afterAll(async () => {
    if (fake) {
      await fake.stop();
    }
    await cleanupTestCandidates(email ? [email] : []);
  });

  it("takes a real queued delivery row from the journey candidate", async () => {
    const candidate = await db.candidate.findUniqueOrThrow({
      where: { referenceNumber: reference },
      select: { id: true, status: true },
    });
    const row = await db.notificationDelivery.findUniqueOrThrow({
      where: {
        dedupeKey: buildDedupeKey("APPLICATION_RECEIVED", candidate.id),
      },
    });
    probeDeliveryId = row.id;
    probeDedupeKey = row.dedupeKey;
    expect(row.status).toBe("PENDING");
    expect(row.attemptCount).toBe(0);
  });

  it("a provider failure marks the row FAILED and leaves the business state untouched", async () => {
    fake.setMode("error_500");
    const before = await db.candidate.findUniqueOrThrow({
      where: { referenceNumber: reference },
      select: { status: true, staff: { select: { staffId: true } } },
    });

    const outcome = await retryNotification(probeDeliveryId);
    expect(outcome).toBe("FAILED");

    const row = await db.notificationDelivery.findUniqueOrThrow({
      where: { id: probeDeliveryId },
    });
    expect(row.status).toBe("FAILED");
    expect(row.attemptCount).toBe(1);
    expect(row.lastAttemptAt).not.toBeNull();
    expect(row.lastErrorCode).toBe("HTTP_500");
    expect(row.sentAt).toBeNull();

    // The business transaction is untouched: recruitment state identical.
    const after = await db.candidate.findUniqueOrThrow({
      where: { referenceNumber: reference },
      select: { status: true, staff: { select: { staffId: true } } },
    });
    expect(after).toEqual(before);
  });

  it("a retry reuses the SAME delivery record — no duplicate is created", async () => {
    fake.setMode("ok");
    const outcome = await retryNotification(probeDeliveryId);
    expect(outcome).toBe("SENT");

    const rows = await db.notificationDelivery.findMany({
      where: { dedupeKey: probeDedupeKey },
    });
    // Exactly ONE row for this lifecycle event — the retry drove the
    // existing record, it did not queue another (§29).
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.id).toBe(probeDeliveryId);
    expect(row.status).toBe("SENT");
    expect(row.sentAt).not.toBeNull();
    expect(row.attemptCount).toBe(2);
    expect(row.providerMessageId).toBe("4820233749028");
    expect(row.lastErrorCode).toBeNull();
    expect(row.lastErrorMessage).toBeNull();

    // The fake Mailjet received a well-formed send for this row.
    const body = fake.lastBody() as {
      From?: { Email?: string };
      To?: Array<{ Email?: string }>;
      Subject?: string;
      CustomID?: string;
    };
    expect(body.CustomID).toBe(probeDedupeKey);
    expect(body.To?.[0]?.Email).toBeTruthy();
    expect(body.From?.Email).toBe("no-reply@test.example.com");
    expect((body.Subject ?? "").length).toBeGreaterThan(0);

    // Sending an already-SENT row is a no-op.
    const again = await sendNotification(probeDeliveryId);
    expect(again).toBe("SKIPPED");
    const stillOne = await db.notificationDelivery.findMany({
      where: { dedupeKey: probeDedupeKey },
    });
    expect(stillOne).toHaveLength(1);
    expect(stillOne[0]!.attemptCount).toBe(2);
  });

  it("concurrent retries of one row perform exactly one provider send", async () => {
    const row = await db.notificationDelivery.findUniqueOrThrow({
      where: {
        dedupeKey: buildDedupeKey(
          "ORIENTATION_COMPLETED",
          (
            await db.candidate.findUniqueOrThrow({
              where: { referenceNumber: reference },
              select: { id: true },
            })
          ).id,
        ),
      },
    });
    // Reset the row to a fresh queued state.
    await db.notificationDelivery.update({
      where: { id: row.id },
      data: { status: "PENDING", attemptCount: 0, sentAt: null },
    });

    const requestsBefore = fake.requestCount();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => sendNotification(row.id)),
    );
    const sent = outcomes.filter((o) => o === "SENT").length;
    const skipped = outcomes.filter((o) => o === "SKIPPED").length;

    expect(sent).toBe(1);
    expect(skipped).toBe(5);
    expect(fake.requestCount() - requestsBefore).toBe(1);

    const updated = await db.notificationDelivery.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe("SENT");
    expect(updated.attemptCount).toBe(1);
  });

  it("respects the bounded attempt budget (never retries forever)", async () => {
    const row = await db.notificationDelivery.findUniqueOrThrow({
      where: {
        dedupeKey: buildDedupeKey(
          "AGREEMENT_ACCEPTED",
          (
            await db.agreement.findUniqueOrThrow({
              where: {
                candidateId: (
                  await db.candidate.findUniqueOrThrow({
                    where: { referenceNumber: reference },
                    select: { id: true },
                  })
                ).id,
              },
              select: { id: true },
            })
          ).id,
        ),
      },
    });
    await db.notificationDelivery.update({
      where: { id: row.id },
      data: { status: "FAILED", attemptCount: 3 },
    });

    const requestsBefore = fake.requestCount();
    const outcome = await retryNotification(row.id);
    expect(outcome).toBe("SKIPPED");
    expect(fake.requestCount()).toBe(requestsBefore);
  });

  it("a disabled switch suppresses delivery entirely (no network, row stays queued)", async () => {
    setEnv("NOTIFICATIONS_ENABLED", "false");
    const requestsBefore = fake.requestCount();

    const row = await db.notificationDelivery.findUniqueOrThrow({
      where: {
        dedupeKey: buildDedupeKey(
          "APPOINTMENT_ISSUED",
          (
            await db.appointment.findUniqueOrThrow({
              where: {
                candidateId: (
                  await db.candidate.findUniqueOrThrow({
                    where: { referenceNumber: reference },
                    select: { id: true },
                  })
                ).id,
              },
              select: { id: true },
            })
          ).id,
        ),
      },
    });
    await db.notificationDelivery.update({
      where: { id: row.id },
      data: { status: "PENDING", attemptCount: 0 },
    });

    const outcome = await retryNotification(row.id);
    expect(outcome).toBe("SUPPRESSED");
    expect(fake.requestCount()).toBe(requestsBefore);

    const updated = await db.notificationDelivery.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe("PENDING");
    expect(updated.attemptCount).toBe(0);

    // The batch retry honours the switch too.
    const batch = await retryPendingNotifications({ limit: 10 });
    expect(batch.considered).toBe(0);
  });

  it("the batch retry re-drives every queued row within the budget", async () => {
    setEnv("NOTIFICATIONS_ENABLED", "true");

    // ONBOARDING_STARTED/COMPLETED + STAFF_ACTIVATED rows are still queued
    // (PENDING, attemptCount 0) from the disabled dev-server journey.
    const candidateId = (
      await db.candidate.findUniqueOrThrow({
        where: { referenceNumber: reference },
        select: { id: true },
      })
    ).id;
    const queued = await db.notificationDelivery.findMany({
      where: { candidateId, status: "PENDING" },
      select: { id: true },
    });
    expect(queued.length).toBeGreaterThanOrEqual(3);

    const batch = await retryPendingNotifications({ limit: 20 });
    expect(batch.considered).toBeGreaterThanOrEqual(3);
    expect(batch.sent).toBeGreaterThanOrEqual(3);
    expect(batch.failed).toBe(0);

    const stillPending = await db.notificationDelivery.findMany({
      where: { candidateId, status: { in: ["PENDING", "FAILED"] } },
      select: { id: true, attemptCount: true, status: true },
    });
    // The only rows allowed to remain unsent are the deliberately
    // budget-exhausted ones from the previous test — nothing else.
    for (const row of stillPending) {
      expect(row.attemptCount).toBe(3);
      expect(row.status).toBe("FAILED");
    }
  });
});
