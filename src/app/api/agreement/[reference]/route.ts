import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAgreementView } from "@/server/services/agreement";

/**
 * GET /api/agreement/[reference] — the Responsibility & Reward Agreement
 * stage view: the agreement content and version, the candidate's decision
 * state, and whether they are eligible to act. Reading records the stage
 * entry (idempotent, server-side) — viewing never implies acceptance.
 * Unknown references get the same neutral 404 as every other lookup.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getAgreementView(normalizeReferenceNumber(reference));
  });
}
