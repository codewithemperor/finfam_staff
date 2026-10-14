import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { declineAgreement } from "@/server/services/agreement";
import { AGREEMENT_META } from "@/config/agreement";

/**
 * POST /api/agreement/[reference]/decline — explicitly decline the
 * Responsibility & Reward Offer.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = (await readJsonBody(request).catch(() => ({}))) as { version?: string };
    const version = body.version || AGREEMENT_META.version;

    return declineAgreement(normalizeReferenceNumber(reference), { version });
  });
}
