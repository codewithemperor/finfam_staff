/**
 * Admin console test helpers (Stage 11).
 *
 * Same philosophy as the rest of the suite: everything drives the REAL
 * dev server over HTTP — bootstrap runs as a real subprocess, OTP login
 * uses the ADMIN_AUTH_DEV_CODE_ECHO development response, and cleanup
 * deletes exactly the rows the tests created (admin rows cascade; the
 * staff/candidate fixtures are cleaned via cleanupTestCandidates by the
 * caller).
 */
import { db } from "@/lib/db";
import { apiRequest, expectOk, BASE_URL } from "./api";
import { fetchRaw } from "./journey";

export const ADMIN_TEST_EMAIL_PREFIX = "admin-test-";

let adminEmailCounter = 0;

/** A fresh, unique admin email for one test. */
export function uniqueAdminEmail(label: string): string {
  adminEmailCounter += 1;
  return `${ADMIN_TEST_EMAIL_PREFIX}${label}-${Date.now()}-${adminEmailCounter}@test.example.com`;
}

/**
 * Delete admin accounts created by tests (codes/sessions cascade).
 *
 * The audit log is append-only with an onDelete: Restrict actor FK — that
 * integrity property is the product behaviour under test. Test cleanup
 * therefore first removes ONLY the audit rows authored by these test
 * actors (fixture cleanup, never a product path), then the accounts.
 */
export async function cleanupAdmins(emails: string[]): Promise<number> {
  if (emails.length === 0) return 0;
  const actors = await db.adminAccount.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const actorIds = actors.map((a) => a.id);
  if (actorIds.length > 0) {
    await db.adminAuditEvent.deleteMany({ where: { actorId: { in: actorIds } } });
  }
  const result = await db.adminAccount.deleteMany({
    where: { email: { in: emails } },
  });
  return result.count;
}

export interface BootstrapResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the bootstrap CLI as a real subprocess (approved brief §55) — the
 * operational provisioning path is itself part of the surface under test.
 */
export function runBootstrap(args: string[]): BootstrapResult {
  const proc = Bun.spawnSync(
    ["bash", "scripts/bootstrap-admin.sh", ...args],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    },
  );
  const stdoutOf = (): string =>
    typeof proc.stdout === "function"
      ? proc.stdout().toString()
      : Buffer.from(proc.stdout as unknown as Uint8Array).toString();
  const stderrOf = (): string =>
    typeof proc.stderr === "function"
      ? proc.stderr().toString()
      : Buffer.from(proc.stderr as unknown as Uint8Array).toString();
  return {
    exitCode: proc.exitCode ?? 1,
    stdout: stdoutOf(),
    stderr: stderrOf(),
  };
}

/** Step over the 60s resend cooldown by backdating the latest code row. */
async function stepCooldown(accountId: string): Promise<void> {
  const latest = await db.adminLoginCode.findFirst({
    where: { accountId },
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

/**
 * Complete email-OTP login for an admin and return the raw
 * `ff_admin_session` cookie pair. Requires ADMIN_AUTH_DEV_CODE_ECHO=true
 * on the dev server (sandbox/test env). Steps over the cooldown when the
 * account already has codes.
 */
export async function loginAsAdmin(
  email: string,
  label = "login",
): Promise<{ cookie: string; setCookie: string }> {
  const account = await db.adminAccount.findUnique({
    where: { email },
    select: { id: true },
  });
  if (account) await stepCooldown(account.id);

  const requestCode = expectOk<{ message: string; devCode?: string }>(
    await apiRequest("POST", "/api/admin/auth/request-code", { email }),
    200,
    `[${label}] admin request-code`,
  );
  if (!requestCode.devCode) {
    throw new Error(
      "ADMIN_AUTH_DEV_CODE_ECHO is not enabled on the dev server — the Stage 11 suite requires it (sandbox .env).",
    );
  }

  const verify = await fetchRaw("POST", "/api/admin/auth/verify", {
    email,
    code: requestCode.devCode,
  });
  if (verify.status !== 200) {
    throw new Error(
      `[${label}] admin verify failed: ${verify.status} ${JSON.stringify(verify.body)}`,
    );
  }

  const setCookie = verify.setCookie;
  if (!setCookie) {
    throw new Error("Expected a Set-Cookie header on the admin verify response");
  }
  const match = /ff_admin_session=([^;]+)/.exec(setCookie);
  if (!match) {
    throw new Error(`No ff_admin_session cookie in: ${setCookie}`);
  }
  return { cookie: `ff_admin_session=${match[1]}`, setCookie };
}

export interface AdminRawResult {
  status: number;
  body: unknown;
  setCookie: string | null;
}

/**
 * Raw request with ARBITRARY headers — needed for the same-origin tests
 * (Origin/Referer manipulation at the HTTP boundary, brief §61).
 */
export async function adminRawRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  path: string,
  opts: {
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<AdminRawResult> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(opts.body === undefined ? {} : { "content-type": "application/json" }),
      ...(opts.cookie === undefined ? {} : { cookie: opts.cookie }),
      ...(opts.headers ?? {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(20_000),
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return {
    status: response.status,
    body: parsed,
    setCookie: response.headers.get("set-cookie"),
  };
}
