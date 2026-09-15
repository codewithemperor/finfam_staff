import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { activationSchema } from "@/lib/validation/activation";
import { normalizeReferenceNumber } from "@/lib/reference";
import { activateStaff } from "@/server/services/activation";

/**
 * POST /api/activation/[reference]/activate — explicitly activate the
 * candidate's FinFam staff profile. The request must carry the literal
 * acknowledgement and the activation version the candidate reviewed.
 * Eligibility, stage guards, idempotency, the transactional state
 * transition and the Staff ID allocation are enforced by the service.
 * The Staff ID and status are NEVER accepted from the browser.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = activationSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't activate your staff profile. Check the confirmation and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return activateStaff(normalizeReferenceNumber(reference), parsed.data);
  });
}
