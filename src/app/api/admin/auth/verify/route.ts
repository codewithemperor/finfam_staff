import type { NextRequest } from "next/server";

import { apiFail, apiOk, readJsonBody } from "@/lib/api/response";
import { AppError, GENERIC_ERROR_MESSAGE, validationError } from "@/lib/errors";
import { logServerError } from "@/lib/log";
import { getFieldErrors } from "@/lib/validation/application";
import { adminVerifyCodeSchema } from "@/lib/validation/admin";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from "@/lib/auth/admin-session";
import { verifyAdminLoginCode } from "@/server/services/admin-auth";

/**
 * POST /api/admin/auth/verify — Stage 11 admin email-OTP step 2.
 *
 * Verifies the code (single-use, expiring, attempt-limited, latest-only)
 * and creates ONE DB-backed admin session. The opaque token is set on THIS
 * response as an HttpOnly / SameSite=Lax / Path=/ cookie (Secure in
 * production) under `ff_admin_session` — a structurally separate domain
 * from the Staff cookie (approved brief §3/§11). It never touches
 * localStorage.
 *
 * Built outside `handleApiRequest` so the session cookie can be attached to
 * the same response that reports success; error mapping is identical to the
 * Staff verify route.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const parsed = adminVerifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Enter the 6-digit sign-in code from your email.",
        getFieldErrors(parsed.error),
      );
    }

    const verified = await verifyAdminLoginCode(
      parsed.data.email,
      parsed.data.code,
    );

    const response = apiOk({ next: "/admin" });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: verified.token,
      ...adminSessionCookieOptions(verified.expiresAt),
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return apiFail(error.code, error.message, error.status, error.fields);
    }
    logServerError("api/admin/auth/verify", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500);
  }
}
