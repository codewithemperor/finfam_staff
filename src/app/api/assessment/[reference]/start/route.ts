import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { assessmentStartSchema } from "@/lib/validation/assessment";
import { normalizeReferenceNumber } from "@/lib/reference";
import { startAssessment } from "@/server/services/assessment";

/**
 * POST /api/assessment/[reference]/start — begin (or resume) the
 * assessment. Eligibility, retake policy and status transitions are
 * enforced by the service.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = assessmentStartSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't start your assessment. Please try again.",
        getFieldErrors(parsed.error),
      );
    }

    return startAssessment(normalizeReferenceNumber(reference));
  });
}
