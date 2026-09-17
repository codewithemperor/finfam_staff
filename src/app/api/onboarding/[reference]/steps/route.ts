import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { getFieldErrors } from "@/lib/validation/application";
import { onboardingStepSchema } from "@/lib/validation/onboarding";
import { normalizeReferenceNumber } from "@/lib/reference";
import { completeOnboardingStep } from "@/server/services/onboarding";

/**
 * POST /api/onboarding/[reference]/steps — mark one onboarding step as
 * reviewed ("I have reviewed this onboarding section"). The body carries
 * only the stable step id; sequential order, step existence, exactly-once
 * persistence (unique-constraint backstop), the resume-point update and
 * idempotency are all enforced by the service. The current step, completion
 * timestamps and state are NEVER accepted from the browser.
 *
 * Rate limited (production-readiness remediation §14/§16): this is one of
 * the two unauthenticated WRITE paths (the documented "reference door",
 * kept because the ONBOARDING_STARTED email links here — a live business
 * workflow; retirement is an open business decision, see
 * docs/CONTENT-QUESTIONS.md). The onboarding-reference bucket damps
 * scripted probing of that door while leaving real journeys untouched.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    await enforcePublicRateLimit(request, "onboarding-reference");

    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = onboardingStepSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't save your onboarding progress. Check the step and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOnboardingStep(normalizeReferenceNumber(reference), parsed.data);
  });
}
