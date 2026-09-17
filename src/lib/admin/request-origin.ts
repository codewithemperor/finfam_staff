import "server-only";

import type { NextRequest } from "next/server";

import { AppError } from "@/lib/errors";

/**
 * Same-origin verification for privileged admin writes (Stage 11, approved
 * brief §40) — defence-in-depth on top of the existing posture (HttpOnly
 * session cookie, SameSite=Lax, JSON-only APIs), applied ONLY to the two
 * privileged admin mutation endpoints. Existing Staff APIs are untouched
 * (§41): no broad CSRF refactoring in this stage.
 *
 * Policy (fail closed for browser-originated mutations):
 *   - A browser POST always carries an `Origin` header (same-origin fetch
 *     included). If `Origin` is present it must match a trusted origin.
 *   - If `Origin` is absent but `Referer` is present (older browsers /
 *     some navigation flows), the Referer origin must match.
 *   - If NEITHER header is present, the request is treated as
 *     non-verifiable and REJECTED (§61: "missing browser origin according
 *     to chosen server policy" — we fail closed).
 *   - Trusted origins: the server-authoritative APP_BASE_URL (never
 *     derived from client input) and the request's own host origin, so the
 *     check also holds when the console is served from an alternate
 *     configured host.
 *
 * A failure throws FORBIDDEN (403) — it never falls through to the
 * business action.
 */

const SAME_ORIGIN_FAILURE_MESSAGE =
  "This action cannot be verified from this origin. Reload the Admin console and try again.";

function trustedOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();

  const configured = process.env.APP_BASE_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Ignore a malformed APP_BASE_URL — the request-host origin still
      // applies and a misconfiguration must not open the check up.
    }
  }

  try {
    origins.add(request.nextUrl.origin);
  } catch {
    // NextRequest always exposes an origin; guarded for completeness.
  }

  return origins;
}

function urlOriginOrNone(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Fail closed: no verifiable browser origin at all.
  if (!origin && !referer) {
    throw new AppError("FORBIDDEN", SAME_ORIGIN_FAILURE_MESSAGE, {
      status: 403,
    });
  }

  const candidate = origin ?? referer;
  const candidateOrigin = urlOriginOrNone(candidate);
  if (!candidateOrigin) {
    // Malformed Origin/Referer — never guess.
    throw new AppError("FORBIDDEN", SAME_ORIGIN_FAILURE_MESSAGE, {
      status: 403,
    });
  }

  if (!trustedOrigins(request).has(candidateOrigin)) {
    throw new AppError("FORBIDDEN", SAME_ORIGIN_FAILURE_MESSAGE, {
      status: 403,
    });
  }
}
