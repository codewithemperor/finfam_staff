import { cookies } from "next/headers";

import { apiFail, apiOk } from "@/lib/api/response";
import { AppError, GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import { logServerError } from "@/lib/log";
import {
  STAFF_SESSION_COOKIE,
  staffSessionClearOptions,
} from "@/lib/auth/session";
import { revokeStaffSession } from "@/server/services/staff-auth";

/**
 * POST /api/staff/auth/logout — Stage 7 logout (brief §15).
 *
 * REVOKES the DB session row first — deleting the cookie alone is never
 * trusted — then clears the cookie on the response. Idempotent: logging out
 * without (or with an already-revoked) session still succeeds.
 */
export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(STAFF_SESSION_COOKIE)?.value;
    if (token) {
      await revokeStaffSession(token);
    }

    const response = apiOk({ next: "/staff/login" });
    response.cookies.set({
      name: STAFF_SESSION_COOKIE,
      value: "",
      ...staffSessionClearOptions(),
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return apiFail(error.code, error.message, error.status, error.fields);
    }
    logServerError("api/staff/auth/logout", error);
    return apiFail("INTERNAL", GENERIC_ERROR_MESSAGE, 500);
  }
}
