import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminRequestCodeSchema } from "@/lib/validation/admin";
import {
  NEUTRAL_ADMIN_REQUEST_MESSAGE,
  requestAdminLoginCode,
} from "@/server/services/admin-auth";

/**
 * POST /api/admin/auth/request-code — Stage 11 admin email-OTP step 1.
 *
 * Anti-enumeration (approved brief §9): unknown email, non-admin email and
 * suspended admin accounts all receive the SAME neutral success response
 * and create NO rows. Cooldown/rate-limit breaches answer 429 with neutral
 * wording. Responses never reveal whether an address holds an AdminAccount.
 *
 * DEVELOPMENT/TEST ONLY (ADMIN_AUTH_DEV_CODE_ECHO=true): the response may
 * include `devCode`. Production MUST run with the flag false — documented
 * prominently in .env.example and README. This switch is separate from the
 * Staff dev echo (brief §10).
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const body = await readJsonBody(request);
    const parsed = adminRequestCodeSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Enter your administrator email address.",
        getFieldErrors(parsed.error),
      );
    }

    const result = await requestAdminLoginCode(parsed.data.email);
    return {
      message: NEUTRAL_ADMIN_REQUEST_MESSAGE,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  });
}
