import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/auth/admin-session";

/**
 * Guarded Admin console layout (Stage 11): every /admin page below this
 * layout requires a valid Admin session. Identity comes ONLY from the
 * cookie chain Session → AdminAccount — never from a URL parameter.
 * Unauthenticated visitors are redirected to the login screen.
 *
 * IMPORTANT (Next 16, pinned lesson from Stage 10/11 worklogs): the
 * layout redirect and the page render run in PARALLEL and redirects can
 * be served as HTTP-200 shells — so EVERY dashboard page below this
 * layout ALSO self-gates with `getAdminSession()` + redirect. This layout
 * guard is necessary but NOT sufficient on its own.
 *
 * /admin/login lives OUTSIDE this route group, so the guard never loops.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <AdminShell adminEmail={session.account.email}>{children}</AdminShell>;
}
