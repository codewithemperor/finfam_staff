import type { NextRequest } from "next/server";

import { apiFail, apiOk, readJsonBody } from "@/lib/api/response";
import { AppError, GENERIC_ERROR_MESSAGE, validationError } from "@/lib/errors";
import { logServerError } from "@/lib/log";
import { getFieldErrors } from "@/lib/validation/application";
import { verifyCodeSchema } from "@/lib/validation/staff-auth";
import {
  STAFF_SESSION_COOKIE,
  staffSessionCookieOptions,
} from "@/lib/auth/session";
import { verifyLoginCode } from "@/server/services/staff-auth";

/**
 * POST /api/staff/auth/verify — Stage 7 email-OTP step 2.
 *
 * Verifies the code (single-use, expiring, attempt-limited, latest-only)
 * and creates ONE DB-backed session. The opaque token is set on THIS
 * response as an HttpOnly / SameSite=Lax / Path=/ cookie (Secure in
 * production) — it never touches localStorage (brief §12/§14).
 *
 * Built outside `handleApiRequest` so the session cookie can be attached to
 * the same response that reports success; error mapping is identical.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const parsed = verifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Enter the 6-digit login code from your email.",
        getFieldErrors(parsed.error),
      );
    }

    const verified = await verifyLoginCode(parsed.data.email, parsed.data.code);

    const response = apiOk({ next: "/staff" });
    response.cookies.set({
      name: STAFF_SESSION_COOKIE,
      value: verified.token,
      ...staffSessionCookieOptions(verified.expiresAt),
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return apiFail(error.code, error.message, error.status, error.fields);
    }
    logServerError("api/staff/auth/verify", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500);
  }
}
