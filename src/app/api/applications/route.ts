import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import {
  applicationFormSchema,
  getFieldErrors,
} from "@/lib/validation/application";
import { submitApplication } from "@/server/services/applications";

/**
 * POST /api/applications — submit a recruitment application.
 * The server re-validates everything; client validation is a convenience,
 * never the security boundary.
 *
 * Rate limited (production-readiness remediation §14): this is a fully
 * unauthenticated mutation endpoint, so a conservative sliding-window
 * limiter (mirroring the OTP request-window pattern) damps bulk abuse
 * before the database is touched for a submission.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    await enforcePublicRateLimit(request, "applications");

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
