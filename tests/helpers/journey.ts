/**
 * Stage 7 journey driver — drives a REAL candidate from registration to
 * APPROVED_STAFF through the actual HTTP APIs (the same happy path the
 * flow suite exercises, compressed into one awaitable helper), then logs
 * into the Staff Portal via the email-OTP flow (dev echo enabled in the
 * sandbox: STAFF_AUTH_DEV_CODE_ECHO=true + NOTIFICATIONS_ENABLED=false).
 *
 * Only for test files; imports server config (safe under the suite's
 * --conditions react-server runtime).
 */
import { ASSESSMENT_META, ASSESSMENT_QUESTION_IDS, ASSESSMENT_QUESTIONS } from "@/config/assessment";
import { ACTIVATION_META } from "@/config/activation";
import { AGREEMENT_META } from "@/config/agreement";
import { OPEN_POSITION } from "@/config/content";
import { ORIENTATION_SECTION_IDS } from "@/config/orientation";

import {
  apiRequest,
  BASE_URL,
  expectOk,
  REFERENCE_PATTERN,
  type ApiEnvelope,
} from "./api";
import { db, uniqueEmail } from "./db";
import { loadAnswerKey } from "./answer-key";
import type { ActivationView, AssessmentView } from "@/types/recruitment";

export const STAFF_TEST_PROFILE = {
  fullName: "Stage Seven Test Staff",
  phone: "0803 000 0007",
  city: "Lagos",
} as const;

export interface DrivenStaff {
  email: string;
  referenceNumber: string;
  staffId: string;
}

/** Register → orientation → assessment → agreement → appointment (+ activate). */
export async function driveToActivation(
  label: string,
  options: { activate?: boolean } = { activate: true },
): Promise<DrivenStaff> {
  const email = uniqueEmail(label);

  const registered = expectOk<{ referenceNumber: string; status: string }>(
    await apiRequest("POST", "/api/applications", {
      ...STAFF_TEST_PROFILE,
      email,
      roleTitle: OPEN_POSITION.title,
      consent: true,
    }),
    200,
    `[${label}] register`,
  );
  if (!REFERENCE_PATTERN.test(registered.referenceNumber)) {
    throw new Error(`Unexpected reference: ${registered.referenceNumber}`);
  }
  const reference = registered.referenceNumber;

  for (const sectionId of ORIENTATION_SECTION_IDS) {
    expectOk(
      await apiRequest("POST", `/api/orientation/${reference}/sections`, {
        sectionId,
      }),
      200,
      `[${label}] orientation section ${sectionId}`,
    );
  }
  expectOk(
    await apiRequest("POST", `/api/orientation/${reference}/complete`, {
      acknowledgement: true,
    }),
    200,
    `[${label}] orientation complete`,
  );

  const started = expectOk<AssessmentView>(
    await apiRequest("POST", `/api/assessment/${reference}/start`, {}),
    200,
    `[${label}] assessment start`,
  );
  const key = await loadAnswerKey();
  const attemptQuestions = started.attempt?.questions ?? [];
  for (const safeQ of attemptQuestions) {
    const configQ = ASSESSMENT_QUESTIONS.find((q) => q.text === safeQ.text);
    if (!configQ) {
      throw new Error(`Cannot find config question for: ${safeQ.text}`);
    }
    expectOk(
      await apiRequest("POST", `/api/assessment/${reference}/answers`, {
        questionId: safeQ.id,
        selectedOption: key[configQ.id],
      }),
      200,
      `[${label}] answer ${configQ.id}`,
    );
  }
  expectOk(
    await apiRequest("POST", `/api/assessment/${reference}/submit`, {}),
    200,
    `[${label}] assessment submit`,
  );

  expectOk(
    await apiRequest("POST", `/api/agreement/${reference}/accept`, {
      acknowledgement: true,
      version: AGREEMENT_META.version,
    }),
    200,
    `[${label}] agreement accept`,
  );

  // The first open issues the letter lazily and exactly once.
  expectOk(
    await apiRequest("GET", `/api/appointment/${reference}`),
    200,
    `[${label}] appointment issue`,
  );

  if (options.activate === false) {
    return { email, referenceNumber: reference, staffId: "" };
  }

  const activated = expectOk<ActivationView>(
    await apiRequest("POST", `/api/activation/${reference}/activate`, {
      acknowledgement: true,
      version: ACTIVATION_META.version,
    }),
    200,
    `[${label}] activate`,
  );
  if (!activated.staff) {
    throw new Error(`[${label}] activation did not return the Staff record`);
  }

  return { email, referenceNumber: reference, staffId: activated.staff.staffId };
}

/** Raw fetch that also returns the Set-Cookie header (for cookie capture).
 * Generic like apiRequest: the parsed body is the shared API envelope. */
export async function fetchRaw<T = unknown>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<{ status: number; body: ApiEnvelope<T>; setCookie: string | null }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(
      `${method} ${path} → ${response.status}: response was not JSON`,
    );
  }
  return {
    status: response.status,
    body: parsed as ApiEnvelope<T>,
    setCookie: response.headers.get("set-cookie"),
  };
}

/** Extract the ff_staff_session cookie pair from a Set-Cookie header. */
export function extractSessionCookie(setCookie: string | null): string {
  if (!setCookie) {
    throw new Error("Expected a Set-Cookie header on the verify response");
  }
  const match = /ff_staff_session=([^;]+)/.exec(setCookie);
  if (!match) {
    throw new Error(`No ff_staff_session cookie in: ${setCookie}`);
  }
  return `ff_staff_session=${match[1]}`;
}

/**
 * Complete email-OTP login for a driven Staff member and return the raw
 * cookie pair for subsequent authenticated requests. Requires the dev
 * server to run with STAFF_AUTH_DEV_CODE_ECHO=true (sandbox/test env).
 *
 * `opts.staffRowId` (Staff ROW id) steps over the 60s resend cooldown by
 * backdating the previous code — needed when a test logs in repeatedly as
 * the same Staff member. Cooldown stepping is itself part of the policy
 * under test in staff-auth.test.ts.
 */
export async function loginAsStaff(
  email: string,
  label = "login",
  opts: { staffRowId?: string } = {},
): Promise<{
  cookie: string;
  setCookie: string;
}> {
  if (opts.staffRowId) {
    const account = await db.staffAccount.findUnique({
      where: { staffId: opts.staffRowId },
      select: { id: true },
    });
    if (account) {
      const latest = await db.staffLoginCode.findFirst({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      });
      if (latest) {
        await db.staffLoginCode.update({
          where: { id: latest.id },
          data: {
            createdAt: new Date(latest.createdAt.getTime() - 61_000),
          },
        });
      }
    }
  }

  const requestCode = expectOk<{ message: string; devCode?: string }>(
    await apiRequest("POST", "/api/staff/auth/request-code", { email }),
    200,
    `[${label}] request-code`,
  );
  if (!requestCode.devCode) {
    throw new Error(
      "STAFF_AUTH_DEV_CODE_ECHO is not enabled on the dev server — the test suite requires it (sandbox .env).",
    );
  }

  const verify = await fetchRaw("POST", "/api/staff/auth/verify", {
    email,
    code: requestCode.devCode,
  });
  if (verify.status !== 200) {
    throw new Error(
      `[${label}] verify failed: ${verify.status} ${JSON.stringify(verify.body)}`,
    );
  }
  const cookie = extractSessionCookie(verify.setCookie);
  return { cookie, setCookie: verify.setCookie ?? "" };
}
