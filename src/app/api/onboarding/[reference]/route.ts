import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getOnboardingView } from "@/server/services/onboarding";

/**
 * GET /api/onboarding/[reference] — the Staff Onboarding stage view: staff
 * identity context, onboarding state, completed steps, resume point and the
 * step content (with its version). Reading is the stage's entry action for
 * eligible staff: the first open lazily creates the one StaffOnboarding
 * record (startedAt + pinned version + resume step, idempotent, race-safe,
 * server-side) — viewing never completes a step and never completes
 * onboarding. Candidates not at APPROVED_STAFF get an honest eligible:false
 * view; unknown references get the same neutral 404 as every other lookup.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  return handleApiRequest(async () => {
    const { reference } = await context.params;
    return getOnboardingView(normalizeReferenceNumber(reference));
  });
}
