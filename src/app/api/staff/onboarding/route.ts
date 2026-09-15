import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { getOnboardingViewForStaff } from "@/server/services/onboarding";

/**
 * GET /api/staff/onboarding — the authenticated onboarding view (Stage 7).
 *
 * The session supplies the Staff row; no reference or Staff ID is accepted.
 * Same core, same rules and the SAME StaffOnboarding state as the legacy
 * reference route (brief §23/§24). First open lazily creates the record and
 * queues the single ONBOARDING_STARTED email — exactly once.
 */
export async function GET() {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    return getOnboardingViewForStaff(session.staff.rowId);
  });
}
