import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminStaffListQuerySchema } from "@/lib/validation/admin";
import { listStaffDirectory } from "@/server/services/admin-directory";
import { db } from "@/lib/db";

/**
 * GET /api/admin/staff — paginated Staff directory (Stage 11, brief §18).
 *
 * Requires an Admin session. Query params are whitelisted (q/status/page —
 * brief §19); the response carries NO secrets (no hashes, tokens, OTP
 * data or sensitive identifiers ever leave the service, brief §18).
 *
 * Authenticated list reads opportunistically refresh the session's
 * lastSeenAt (fire-and-forget, same pattern as the Staff Portal's
 * /api/staff/me) — never awaited, never able to fail the request.
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      ...(searchParams.get("q") ? { q: searchParams.get("q") ?? undefined } : {}),
      ...(searchParams.get("status")
        ? { status: searchParams.get("status") ?? undefined }
        : {}),
      ...(searchParams.get("page")
        ? { page: searchParams.get("page") ?? undefined }
        : {}),
    };
    const parsed = adminStaffListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw validationError(
        "The staff directory filters are not valid.",
        getFieldErrors(parsed.error),
      );
    }

    void db.adminSession
      .update({
        where: { id: session.session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);

    return listStaffDirectory({
      q: parsed.data.q,
      status: parsed.data.status,
      page: parsed.data.page,
    });
  });
}
