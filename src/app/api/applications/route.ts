import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import {
  applicationFormSchema,
  getFieldErrors,
} from "@/lib/validation/application";
import { submitApplication } from "@/server/services/applications";

/**
 * POST /api/applications — submit a recruitment application.
 * The server re-validates everything; client validation is a convenience,
 * never the security boundary.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const body = await readJsonBody(request);
    const parsed = applicationFormSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Please correct the highlighted fields and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return submitApplication(parsed.data);
  });
}
