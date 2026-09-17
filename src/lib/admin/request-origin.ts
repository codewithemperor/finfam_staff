import "server-only";

import type { NextRequest } from "next/server";

import { AppError } from "@/lib/errors";
import {
  ProductionConfigError,
  isProduction,
  resolveAppBaseUrl,
} from "@/server/config/production";

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
 *   - Trusted origins (production-readiness remediation §12): in
 *     PRODUCTION the canonical APP_BASE_URL origin is AUTHORITATIVE — a
 *     forwarded/alternate request Host is never trusted as equivalent, so
 *     a hostile proxy header cannot widen the check. In DEVELOPMENT the
 *     documented local fallback additionally trusts the request's own
 *     host origin so the check keeps working on alternate local hosts.
 *
 * A failure throws FORBIDDEN (403) — it never falls through to the
 * business action.
 */

const SAME_ORIGIN_FAILURE_MESSAGE =
  "This action cannot be verified from this origin. Reload the Admin console and try again.";

function trustedOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();

  // Canonical origin from server configuration. In production this is the
  // ONLY trusted origin; resolveAppBaseUrl() throws ProductionConfigError
  // when the deployment is misconfigured — we treat that as "no trusted
  // origins" so EVERY candidate fails closed (403) rather than falling
  // back to a client-controlled value.
  try {
    origins.add(new URL(resolveAppBaseUrl()).origin);
  } catch (error) {
    if (!(error instanceof ProductionConfigError)) {
      // A genuinely unexpected failure still must not open the check up.
    }
  }

  if (!isProduction()) {
    // Development-only fallback: the request's own host origin, so local
    // alternate-host testing keeps working. NEVER applied in production
    // (remediation §12: forwarded Host values are not the canonical origin).
    try {
      origins.add(request.nextUrl.origin);
    } catch {
      // NextRequest always exposes an origin; guarded for completeness.
    }
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
  if (!candidate) {
    // Unreachable after the check above; kept as a narrowing guard so the
    // parser below always receives a string (remediation §10).
    throw new AppError("FORBIDDEN", SAME_ORIGIN_FAILURE_MESSAGE, {
      status: 403,
    });
  }
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
