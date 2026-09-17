import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminReportListQuerySchema } from "@/lib/validation/admin";
import { listAdminSubmittedReports } from "@/server/services/admin-reports";

/**
 * GET /api/admin/reports — paginated list of SUBMITTED daily reports
 * across all Staff (Stage 11, brief §23/§24).
 *
 * Strictly read-only — there is no POST/PATCH/DELETE on this route and no
 * correction workflow exists. Query params are whitelisted
 * (month/staff/page); drafts are never included; every view carries the
 * self-reported framing (§25).
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      ...(searchParams.get("month")
        ? { month: searchParams.get("month") ?? undefined }
        : {}),
      ...(searchParams.get("staff")
        ? { staff: searchParams.get("staff") ?? undefined }
        : {}),
      ...(searchParams.get("page")
        ? { page: searchParams.get("page") ?? undefined }
        : {}),
    };
    const parsed = adminReportListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw validationError(
        "The report list filters are not valid.",
        getFieldErrors(parsed.error),
      );
    }

    return listAdminSubmittedReports({
      month: parsed.data.month,
      staff: parsed.data.staff,
      page: parsed.data.page,
    });
  });
}
