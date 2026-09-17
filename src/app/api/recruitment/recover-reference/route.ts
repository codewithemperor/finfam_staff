import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { getFieldErrors } from "@/lib/validation/application";
import { referenceRecoverySchema } from "@/lib/validation/recovery";
import { recoverApplicationReference } from "@/server/services/journey";

/**
 * POST /api/recruitment/recover-reference — locate an application from the
 * details supplied at application time (full name + email + phone) and
 * return its recruitment reference.
 *
 * Enumeration-safe by contract: every mismatch (unknown email, wrong name,
 * wrong phone) returns the SAME neutral 404. Only the reference is revealed
 * — never application details. The final verification policy is an open
 * business question (docs/CONTENT-QUESTIONS.md §11).
 *
 * Rate limited (production-readiness remediation §14/§15): recovery is an
 * unauthenticated exact-match oracle, so a conservative sliding-window
 * limiter (mirroring the OTP request-window pattern) makes brute forcing
 * the 3-field match infeasible while never blocking a genuine user who
 * corrects a typo. The response for a blocked request is the standard 429
 * RATE_LIMITED envelope — it reveals nothing about whether a match exists.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    await enforcePublicRateLimit(request, "recruitment-recovery");

    const body = await readJsonBody(request);
    const parsed = referenceRecoverySchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Check the details you entered and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return recoverApplicationReference(parsed.data);
  });
}
