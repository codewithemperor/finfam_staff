import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getStaffAdminDetail } from "@/server/services/admin-directory";

/**
 * GET /api/admin/staff/[id] — full read-only detail for one Staff member
 * (Stage 11, brief §21). The id is the opaque internal Staff row id used
 * in admin URLs (brief §44); unknown ids are a plain 404 — visibility is
 * granted by the valid Admin session, never by guessing URLs (§45).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    await requireAdminSession();
    const { id } = await context.params;
    return getStaffAdminDetail(id);
  });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}
