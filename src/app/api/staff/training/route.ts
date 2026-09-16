import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { getTrainingOverview } from "@/server/services/staff-training";

/**
 * Staff Training collection API (Stage 9).
 *
 * Identity is derived EXCLUSIVELY from the session cookie — no staffId,
 * reference, email or accountId is ever accepted from the browser. Every
 * rule (eligibility, state derivation, sequencing) lives in the
 * staff-training service; this handler only delegates.
 */

/**
 * GET /api/staff/training — the course overview for the authenticated
 * Staff member. Strictly READ-ONLY (brief §33): it must NOT lazily create
 * an enrollment. Returns each course's derived state (NOT_STARTED /
 * IN_PROGRESS / COMPLETED), pinned or current version, completed/total
 * lessons and the completion date where present.
 */
export async function GET(_request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    return getTrainingOverview(session);
  });
}
