import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { assessmentSubmitSchema } from "@/lib/validation/assessment";
import { normalizeReferenceNumber } from "@/lib/reference";
import { submitAssessment } from "@/server/services/assessment";

/**
 * POST /api/assessment/[reference]/submit — submit the active attempt for
 * server-side scoring. Idempotent: duplicate submissions return the
 * persisted result without creating a new one.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = assessmentSubmitSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't submit your assessment. Please try again.",
        getFieldErrors(parsed.error),
      );
    }

    return submitAssessment(normalizeReferenceNumber(reference));
  });
}
