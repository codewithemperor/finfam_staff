import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getAdminReportDetail } from "@/server/services/admin-reports";

/**
 * GET /api/admin/reports/[reportId] — read-only detail of ONE SUBMITTED
 * daily report (Stage 11, brief §25). Unknown ids AND drafts answer the
 * same plain 404 — drafts are hidden, not acknowledged (§23/§45). There
 * are deliberately no mutation methods on this route (§26).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    await requireAdminSession();
    const { reportId } = await context.params;
    return getAdminReportDetail(reportId);
  });
}

interface RouteContext {
  params: Promise<{ reportId: string }>;
}
