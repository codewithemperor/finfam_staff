import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { submitDailyReport } from "@/server/services/daily-reports";

/**
 * POST /api/staff/reports/[id]/submit — finalise a DRAFT (Stage 8).
 *
 * The body is deliberately EMPTY: there is no review confirmation flag, no
 * identity input, no timestamp input and no status input to accept. The
 * one-way DRAFT → SUBMITTED latch, the exactly-once submittedAt stamp, the
 * receipt notification (queued in the winning transaction, dispatched after
 * commit) and idempotent repeats all live in the service.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const { id } = await context.params;
    return submitDailyReport(session, id);
  });
}
