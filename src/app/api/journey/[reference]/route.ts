import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getRecruitmentJourney } from "@/server/services/journey";

/**
 * GET /api/journey/[reference] — the unified recruitment journey view for
 * one application: current stage, completed stages, locked stages and the
 * one next action. The stage is decided by the server from persisted state;
 * the client never selects it. Unknown references get the same neutral
 * 404 as every other lookup.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getRecruitmentJourney(normalizeReferenceNumber(reference));
  });
}
