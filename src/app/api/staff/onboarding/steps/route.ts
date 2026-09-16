import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { onboardingStepSchema } from "@/lib/validation/onboarding";
import { requireStaffSession } from "@/lib/auth/session";
import { completeOnboardingStepForStaff } from "@/server/services/onboarding";

/**
 * POST /api/staff/onboarding/steps — mark one onboarding step as reviewed,
 * through the authenticated Staff Portal door (Stage 7).
 *
 * The body carries only the stable step id; the session supplies the Staff
 * row (never a reference or Staff ID). Sequential order, step existence,
 * exactly-once persistence, the resume-point update and idempotency are all
 * enforced by the SAME service core the legacy reference route uses.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const body = await readJsonBody(request);
    const parsed = onboardingStepSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "We couldn't save your onboarding progress. Check the step and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOnboardingStepForStaff(session.staff.rowId, parsed.data);
  });
}
