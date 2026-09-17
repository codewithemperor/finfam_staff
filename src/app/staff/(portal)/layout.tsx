import { redirect } from "next/navigation";

import { StaffShell } from "@/components/staff/staff-shell";
import { getStaffSession } from "@/lib/auth/session";

/**
 * Guarded Staff Portal layout (Stage 7, brief §16/§22): every /staff page
 * below this layout requires a valid Staff Portal session. Identity comes
 * ONLY from the cookie chain Session → StaffAccount → Staff → Candidate —
 * never from a URL parameter. Unauthenticated visitors are redirected to
 * the login screen; suspended accounts do not resolve and are sent there
 * too (brief §17).
 *
 * /staff/login lives OUTSIDE this route group, so the guard never loops.
 */
export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  return (
    <StaffShell
      staffId={session.staff.staffId}
      fullName={session.candidate.fullName}
    >
      {children}
    </StaffShell>
  );
}
