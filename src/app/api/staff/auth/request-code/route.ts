import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { requestCodeSchema } from "@/lib/validation/staff-auth";
import {
  NEUTRAL_REQUEST_MESSAGE,
  requestLoginCode,
} from "@/server/services/staff-auth";

/**
 * POST /api/staff/auth/request-code — Stage 7 email-OTP step 1.
 *
 * Anti-enumeration (brief §8): unknown email, non-Staff email and suspended
 * accounts all receive the SAME neutral success response and create NO
 * rows. Cooldown/rate-limit breaches answer 429 with neutral wording.
 *
 * DEVELOPMENT/TEST ONLY (STAFF_AUTH_DEV_CODE_ECHO=true): the response may
 * include `devCode`. Production MUST run with the flag false — documented
 * prominently in .env.example and README.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const body = await readJsonBody(request);
    const parsed = requestCodeSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Enter your registered email address.",
        getFieldErrors(parsed.error),
      );
    }

    const result = await requestLoginCode(parsed.data.email);
    return {
      message: NEUTRAL_REQUEST_MESSAGE,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  });
}
