import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/lib/auth/admin-session";

export const metadata: Metadata = {
  title: "Administrator Sign In",
  description:
    "Sign in to the FinFam Admin console with a secure sign-in code sent to your administrator email address.",
};

/**
 * /admin/login — Admin console entry (Stage 11). Step 1 of the email-OTP
 * flow lives in the client form; this server page only decides whether the
 * screen is needed at all: an already-authenticated administrator goes
 * straight to the console. /admin/login lives OUTSIDE the guarded
 * (dashboard) route group, so the guard never loops.
 */
export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <PageShell size="narrow">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          FinFam Admin
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Administrator sign-in
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          This is the FinFam management console for authorised
          administrators. Sign in with the email address registered to your
          administrator account.
        </p>

        <div className="mt-8">
          <AdminLoginForm />
        </div>
      </div>
    </PageShell>
  );
}
