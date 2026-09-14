import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAssessmentView } from "@/server/services/assessment";

/**
 * GET /api/assessment/[reference] — the candidate's assessment state:
 * eligibility, phase, active attempt (safe question data + saved answers)
 * or the persisted result. Never includes answers, insights or scoring data.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getAssessmentView(normalizeReferenceNumber(reference));
  });
}
