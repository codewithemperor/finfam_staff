import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
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
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
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
