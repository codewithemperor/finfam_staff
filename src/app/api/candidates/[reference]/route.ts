import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getCandidateStatus } from "@/server/services/candidates";

/**
 * GET /api/candidates/[reference] — candidate status lookup by reference
 * number (e.g. FF-4KD9PW). Returns only candidate-visible information.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getCandidateStatus(normalizeReferenceNumber(reference));
  });
}
