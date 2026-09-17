import "server-only";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { sha256Hex } from "@/lib/auth/hash";

/**
 * Sliding-window rate limiting for UNAUTHENTICATED public mutation and
 * recovery endpoints (production-readiness remediation §14/§15).
 *
 * Design — deliberately consistent with the existing OTP request-window
 * limiter (staff-auth.ts / admin-auth.ts: DB count over a rolling window
 * → AppError RATE_LIMITED 429), so abuse damping behaves identically and
 * survives multiple app instances behind one database. No in-process
 * memory, no extra infrastructure.
 *
 * Protected buckets (minimum required by the remediation brief):
 *   - "applications"          → POST /api/applications
 *   - "recruitment-recovery"  → POST /api/recruitment/recover-reference
 *   - "onboarding-reference"  → legacy reference-gated onboarding writes
 *
 * Privacy: the client IP is NEVER stored — only sha256("<bucket>:<ip>").
 * Rows older than the window are pruned on every enforcement call, so the
 * table self-cleans and stays small.
 *
 * Limits are environment-tunable (the sandbox/test suite raises them; see
 * .env / .env.example). Code defaults are CONSERVATIVE. Even with these
 * limits, production deployments SHOULD additionally enforce IP throttling
 * at the reverse proxy / edge for request floods of any shape — that is an
 * EXTERNAL ACTION REQUIRED item in the deployment runbook (one app-level
 * counter is a damping control, not a DDoS defence).
 */

export type PublicRateLimitBucket =
  | "applications"
  | "recruitment-recovery"
  | "onboarding-reference";

const RATE_LIMITED_MESSAGE =
  "Too many requests from this network. Please wait a few minutes and try again.";

/** Default/production limits: conservative, generous to real applicants. */
const BUCKET_DEFAULTS: Record<PublicRateLimitBucket, { max: number; windowMs: number }> = {
  // A real applicant submits one (maybe two) applications; duplicates are
  // rejected 409 anyway. 5 per 10 min per network stops bulk spam.
  applications: { max: 5, windowMs: 10 * 60_000 },
  // Recovery is an exact 3-field match oracle; 5 per 10 min makes brute
  // forcing infeasible while never blocking a genuine forgotten-reference
  // user who corrects a typo a couple of times.
  "recruitment-recovery": { max: 5, windowMs: 10 * 60_000 },
  // The legacy reference door: 8 steps + complete per journey; a small
  // per-network budget stops scripted onboarding-state probing.
  "onboarding-reference": { max: 30, windowMs: 10 * 60_000 },
};

const BUCKET_ENV_MAX: Record<PublicRateLimitBucket, string> = {
  applications: "APPLICATION_RATE_LIMIT_MAX",
  "recruitment-recovery": "RECOVERY_RATE_LIMIT_MAX",
  "onboarding-reference": "ONBOARDING_REFERENCE_RATE_LIMIT_MAX",
};

const BUCKET_ENV_WINDOW: Record<PublicRateLimitBucket, string> = {
  applications: "APPLICATION_RATE_LIMIT_WINDOW_MS",
  "recruitment-recovery": "RECOVERY_RATE_LIMIT_WINDOW_MS",
  "onboarding-reference": "ONBOARDING_REFERENCE_RATE_LIMIT_WINDOW_MS",
};

function readPositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Effective limit/window for a bucket (env override → code default). */
export function publicRateLimitConfig(bucket: PublicRateLimitBucket): {
  max: number;
  windowMs: number;
} {
  const defaults = BUCKET_DEFAULTS[bucket];
  return {
    max: readPositiveInt(process.env[BUCKET_ENV_MAX[bucket]]) ?? defaults.max,
    windowMs:
      readPositiveInt(process.env[BUCKET_ENV_WINDOW[bucket]]) ??
      defaults.windowMs,
  };
}

/**
 * Client identity for the limiter. With a proxy chain, the LAST (rightmost)
 * entry of x-forwarded-for is the one appended by the proxy closest to this
 * server — the spoof-resistant choice: a client-supplied fake entry appears
 * LEFT of it and is ignored. Direct connections fall back to the socket
 * peer (Next exposes it via x-forwarded-for, e.g. "::ffff:127.0.0.1") or
 * "loopback". The value is only ever persisted hashed (clientKeyFor).
 *
 * Deployment note (runbook): a trusted reverse proxy should OVERWRITE (not
 * append to) a client-supplied x-forwarded-for, so the rightmost entry is
 * always the value the trusted proxy observed.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const last = entries[entries.length - 1];
    if (last) return last;
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "loopback";
}

/** Hashed per-bucket client key (the ONLY client identifier persisted). */
export function clientKeyFor(bucket: PublicRateLimitBucket, ip: string): string {
  return sha256Hex(`${bucket}:${ip}`);
}

/**
 * Enforce the sliding-window limit for one bucket. Records an event for
 * THIS request when allowed; throws AppError("RATE_LIMITED", 429) when the
 * budget for the window is exhausted (mapped to the standard envelope by
 * handleApiRequest).
 */
export async function enforcePublicRateLimit(
  request: Request,
  bucket: PublicRateLimitBucket,
): Promise<void> {
  const { max, windowMs } = publicRateLimitConfig(bucket);
  const clientKey = clientKeyFor(bucket, clientIpFromRequest(request));
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  await db.$transaction(async (tx) => {
    // Opportunistic prune: drop this client's expired rows (self-cleaning;
    // no other retention job exists or is needed).
    await tx.rateLimitEvent.deleteMany({
      where: { bucket, clientKey, createdAt: { lt: windowStart } },
    });

    const recent = await tx.rateLimitEvent.count({
      where: { bucket, clientKey, createdAt: { gte: windowStart } },
    });
    if (recent >= max) {
      // Rolls back the transaction — no event is recorded for a rejected
      // request, so the caller's next window is not extended by retries.
      throw new AppError("RATE_LIMITED", RATE_LIMITED_MESSAGE, { status: 429 });
    }

    await tx.rateLimitEvent.create({ data: { bucket, clientKey } });
  });
}
