import { cookies } from "next/headers";

import { apiFail, apiOk } from "@/lib/api/response";
import { AppError, GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionClearOptions,
} from "@/lib/auth/admin-session";
import { revokeAdminSession } from "@/server/services/admin-auth";

/**
 * POST /api/admin/auth/logout — Stage 11 admin logout.
 *
 * REVOKES the DB admin session row first — deleting the cookie alone is
 * never trusted — then clears the `ff_admin_session` cookie on the
 * response. Idempotent: logging out without (or with an already-revoked)
 * session still succeeds. Staff sessions are untouched: the two domains
 * are structurally separate (approved brief §3).
 */
export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_SESSION_COOKIE)?.value;
    if (token) {
      await revokeAdminSession(token);
    }

    const response = apiOk({ next: "/admin/login" });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: "",
      ...adminSessionClearOptions(),
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return apiFail(error.code, error.message, error.status, error.fields);
    }
    console.error("[api] Unhandled error:", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500);
  }
}
