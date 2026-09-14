import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getActivationView } from "@/server/services/activation";

/**
 * GET /api/activation/[reference] — the Staff Activation stage view: what
 * activation means, the candidate's appointment context, and whether the
 * explicit activation is actionable. Reading records the stage entry
 * (APPOINTMENT_ISSUED → ACTIVATION_PENDING, idempotent, server-side) —
 * viewing never activates anything and never creates a Staff row. After
 * activation the same GET returns the read-only staff record. Candidates
 * not yet at the activation stage get an honest eligible:false view.
 * Unknown references get the same neutral 404 as every other lookup.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getActivationView(normalizeReferenceNumber(reference));
  });
}
