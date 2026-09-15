import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { getStaffMe } from "@/server/services/staff-portal";

/**
 * GET /api/staff/me — the authenticated Staff member's identity (brief §18).
 *
 * Identity is derived EXCLUSIVELY from the session cookie
 * (Session → StaffAccount → Staff → Candidate). The endpoint accepts NO
 * user-controlled identifier — no ?staffId=FF-STF-NNNN, no reference, no
 * appointment reference — so Staff A can never resolve Staff B (brief §19).
 */
export async function GET() {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    return getStaffMe(session);
  });
}
