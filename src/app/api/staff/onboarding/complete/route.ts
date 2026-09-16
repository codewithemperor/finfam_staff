import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { onboardingCompleteSchema } from "@/lib/validation/onboarding";
import { requireStaffSession } from "@/lib/auth/session";
import { completeOnboardingForStaff } from "@/server/services/onboarding";

/**
 * POST /api/staff/onboarding/complete — the explicit end of the onboarding
 * and resumption experience, through the authenticated door (Stage 7).
 *
 * Requires the literal acknowledgement and the current content version
 * (server-validated); records the final step and the exactly-once
 * completedAt latch in the SAME transaction; no CandidateStatus change, no
 * StageEvent. Same core and same ONE StaffOnboarding state as the legacy
 * reference route.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const body = await readJsonBody(request);
    const parsed = onboardingCompleteSchema.safeParse(body);

    if (!parsed.success) {
      throw validationError(
        "Please confirm the onboarding acknowledgement before completing.",
        getFieldErrors(parsed.error),
      );
    }

    return completeOnboardingForStaff(session.staff.rowId, parsed.data);
  });
}
