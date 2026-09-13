import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { orientationCompleteSchema } from "@/lib/validation/orientation";
import { normalizeReferenceNumber } from "@/lib/reference";
import { completeOrientation } from "@/server/services/orientation";

/**
 * POST /api/orientation/[reference]/complete — explicitly complete the
 * orientation after every section has been read. Requires the integrity
 * acknowledgement; the server decides whether the candidate may complete.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    const body = await readJsonBody(request);
    const parsed = orientationCompleteSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Please confirm the declaration to complete your orientation.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOrientation(
      normalizeReferenceNumber(reference),
      parsed.data,
    );
  });
}
