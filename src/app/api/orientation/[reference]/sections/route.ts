import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import {
  orientationSectionCompleteSchema,
} from "@/lib/validation/orientation";
import { normalizeReferenceNumber } from "@/lib/reference";
import { completeOrientationSection } from "@/server/services/orientation";

/**
 * POST /api/orientation/[reference]/sections — mark one orientation section
 * as read. The body is validated with the shared schema; sequential order
 * and stage rules are enforced by the service.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = orientationSectionCompleteSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't save that section. Please try again.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOrientationSection(
      normalizeReferenceNumber(reference),
      parsed.data,
    );
  });
}
