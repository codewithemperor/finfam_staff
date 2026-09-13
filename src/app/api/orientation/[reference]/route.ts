import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getOrientationView } from "@/server/services/orientation";

/**
 * GET /api/orientation/[reference] — a candidate's orientation state for
 * their reference number. Returns only candidate-visible information.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getOrientationView(normalizeReferenceNumber(reference));
  });
}
