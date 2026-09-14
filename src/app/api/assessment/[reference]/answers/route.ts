import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { assessmentAnswerSchema } from "@/lib/validation/assessment";
import { normalizeReferenceNumber } from "@/lib/reference";
import { saveAssessmentAnswer } from "@/server/services/assessment";

/**
 * POST /api/assessment/[reference]/answers — autosave one answer on the
 * active attempt. Idempotent per question; membership in the attempt's
 * persisted question set and the active-attempt rule are enforced by the
 * service.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = assessmentAnswerSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't save that answer. Please try again.",
        getFieldErrors(parsed.error),
      );
    }

    return saveAssessmentAnswer(
      normalizeReferenceNumber(reference),
      parsed.data,
    );
  });
}
