import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { agreementAcceptSchema } from "@/lib/validation/agreement";
import { normalizeReferenceNumber } from "@/lib/reference";
import { acceptAgreement } from "@/server/services/agreement";

/**
 * POST /api/agreement/[reference]/accept — explicitly accept the
 * Responsibility & Reward Agreement. The request must carry the literal
 * acknowledgement and the version the candidate reviewed. Eligibility,
 * stage guards, idempotency and the transactional state transition are
 * enforced by the service.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = agreementAcceptSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't record your acceptance. Check the acknowledgement and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return acceptAgreement(normalizeReferenceNumber(reference), parsed.data);
  });
}
