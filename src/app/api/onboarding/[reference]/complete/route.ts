import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { onboardingCompleteSchema } from "@/lib/validation/onboarding";
import { normalizeReferenceNumber } from "@/lib/reference";
import { completeOnboarding } from "@/server/services/onboarding";

/**
 * POST /api/onboarding/[reference]/complete — explicitly complete staff
 * onboarding. The request must carry the literal acknowledgement and the
 * onboarding version the staff member reviewed. Eligibility, the
 * all-steps-completed requirement, the exactly-once completion (conditional
 * latch on completedAt = null) and idempotency are enforced by the service.
 * No CandidateStatus change, no StageEvent, no client-supplied state —
 * completion timestamps and the resume point are server decisions alone.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = onboardingCompleteSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't complete your onboarding. Check the confirmation and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOnboarding(normalizeReferenceNumber(reference), parsed.data);
  });
}
