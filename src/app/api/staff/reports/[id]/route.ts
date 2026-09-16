import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { dailyReportDraftSchema } from "@/lib/validation/daily-report";
import {
  getDailyReportDetail,
  saveDailyReportDraft,
} from "@/server/services/daily-reports";

/**
 * One daily report API (Stage 8).
 *
 * The report id comes from the URL path; ownership comes from the session.
 * A foreign report id is a plain 404 — existence is never disclosed.
 * Submitted reports are permanently read-only: PATCH is 409, and the GET
 * detail remains available for the read-only view.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/staff/reports/[id] — one owned report (editor hydration or read-only detail). */
export async function GET(_request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const { id } = await context.params;
    return getDailyReportDetail(session, id);
  });
}

/**
 * PATCH /api/staff/reports/[id] — full-replace save of a DRAFT. Zeros are
 * valid; values are never silently clamped (0..999 integers only); the
 * optional activitySummary is trimmed plain text ≤ 1000 chars.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const { id } = await context.params;

    const body = await readJsonBody(request);
    const parsed = dailyReportDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "We couldn't save your report. Check the highlighted fields and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return saveDailyReportDraft(session, id, parsed.data);
  });
}
