import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAppointmentView } from "@/server/services/appointment";

/**
 * GET /api/appointment/[reference] — the Provisional Appointment stage
 * view. For an eligible (OFFER_ACCEPTED) candidate this lazily issues the
 * letter exactly once and returns it; afterwards every read returns the
 * same issued record unchanged (read-only). Candidates not yet at the
 * appointment stage get an honest issued:false view — reading never
 * issues anything for them. Unknown references get the same neutral 404
 * as every other lookup. There is deliberately no issue API and no PDF
 * download API: issuance is lazy, and printing uses the browser.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getAppointmentView(normalizeReferenceNumber(reference));
  });
}
