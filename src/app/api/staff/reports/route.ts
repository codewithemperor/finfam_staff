import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import {
  createReportSchema,
  reportListQuerySchema,
} from "@/lib/validation/daily-report";
import {
  createOrGetDailyReport,
  listDailyReports,
} from "@/server/services/daily-reports";

/**
 * Daily Reports collection API (Stage 8).
 *
 * Identity is derived EXCLUSIVELY from the session cookie — no staffId,
 * reference, email or accountId is ever accepted from the browser. Every
 * rule (eligibility, date windowing, one-report-per-date concurrency)
 * lives in the daily-reports service; this handler only parses and delegates.
 */

/**
 * GET /api/staff/reports?month=YYYY-MM&page=N — month-bounded, paginated
 * history (20 per page, newest first) plus today's Africa/Lagos state.
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();

    const params = request.nextUrl.searchParams;
    const parsedQuery = reportListQuerySchema.safeParse({
      month: params.get("month") ?? undefined,
      page: params.get("page") ?? undefined,
    });
    if (!parsedQuery.success) {
      throw validationError(
        "The report list filters are not valid.",
        getFieldErrors(parsedQuery.error),
      );
    }

    return listDailyReports(session, parsedQuery.data);
  });
}

/**
 * POST /api/staff/reports — create-or-get one report (race-safe). The
 * optional body { reportDate } defaults to Africa/Lagos today; future
 * dates and dates beyond the configured backdating window are 422. If the
 * date already holds a report (DRAFT or SUBMITTED), the EXISTING row is
 * returned unchanged with created: false — the client routes on status.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const body = await readJsonBody(request);

    // An empty body is the normal "start today's report" call.
    const parsed =
      body === null || (typeof body === "object" && Object.keys(body as object).length === 0)
        ? { success: true as const, data: {} }
        : createReportSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "The reporting date is not valid.",
        getFieldErrors(parsed.error),
      );
    }

    return createOrGetDailyReport(session, parsed.data.reportDate);
  });
}
