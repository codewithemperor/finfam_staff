/**
 * HTTP helper for the flow test suite.
 *
 * Tests drive the REAL running dev server (bun run dev → port 3000) —
 * the same stack a candidate uses. Nothing is mocked: validation,
 * envelopes, status codes and persistence are all exercised end to end.
 *
 * Every FinFam API response uses the shared envelope
 * `{ ok: true, data }` or `{ ok: false, error: { code, message, fields? } }`.
 */

export const BASE_URL = process.env.FLOW_TEST_BASE_URL ?? "http://127.0.0.1:3000";

/** Official application reference format (src/lib/reference.ts). */
export const REFERENCE_PATTERN = /^FF-[A-HJ-KM-NP-Z2-9]{6}$/;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

export interface ApiResult<T> {
  status: number;
  body: ApiEnvelope<T>;
}

export async function apiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
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

  return { status: response.status, body: parsed as ApiEnvelope<T> };
}

/** Assert a success response and return its data payload. */
export function expectOk<T>(
  result: ApiResult<T>,
  expectedStatus = 200,
  label = "",
): T {
  const where = label ? ` (${label})` : "";
  if (result.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus}${where}, got ${result.status}: ${JSON.stringify(result.body)}`,
    );
  }
  if (!result.body.ok) {
    throw new Error(
      `Expected ok:true${where}, got error: ${JSON.stringify(result.body)}`,
    );
  }
  return result.body.data;
}

/** Assert an error response and return the error body. */
export function expectFail<T>(
  result: ApiResult<T>,
  expectedStatus: number,
  expectedCode?: string,
  label = "",
): ApiErrorBody {
  const where = label ? ` (${label})` : "";
  if (result.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus}${where}, got ${result.status}: ${JSON.stringify(result.body)}`,
    );
  }
  if (result.body.ok) {
    throw new Error(
      `Expected an error envelope${where}, got ok:true: ${JSON.stringify(result.body)}`,
    );
  }
  if (expectedCode && result.body.error.code !== expectedCode) {
    throw new Error(
      `Expected code "${expectedCode}"${where}, got "${result.body.error.code}": ${result.body.error.message}`,
    );
  }
  return result.body.error;
}

/**
 * Fail fast (with an actionable message) when the dev server is not up.
 * Run at the start of every suite: these tests are end-to-end by design.
 *
 * GET /api/health answers 200 with `{ status: "ok", database: "connected" }`
 * (a bare status payload, deliberately not the standard envelope).
 */
export async function assertServerUp(): Promise<void> {
  let result: ApiResult<unknown>;
  try {
    result = await apiRequest("GET", "/api/health");
  } catch (error) {
    throw new Error(
      `The FinFam dev server is not reachable at ${BASE_URL}. ` +
        "Start it first with `bun run dev`, then re-run `bun run test`. " +
        `(Original error: ${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const payload = result.body as {
    ok?: boolean;
    data?: { status?: string };
    status?: string;
  };
  const healthy =
    result.status === 200 &&
    (payload.status === "ok" || (payload.ok === true && payload.data?.status === "ok"));

  if (!healthy) {
    throw new Error(
      `The dev server at ${BASE_URL} answered the health check unexpectedly: ` +
        `${result.status} ${JSON.stringify(result.body)}`,
    );
  }
}
