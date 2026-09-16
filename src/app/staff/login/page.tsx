import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { StaffLoginForm } from "@/components/staff/staff-login-form";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Portal Sign In",
  description:
    "Sign in to the FinFam Staff Portal with a secure login code sent to your registered email address.",
};

/**
 * /staff/login — Staff Portal entry (Stage 7, brief §14). Step 1 of the
 * email-OTP flow lives in the client form; this server page only decides
 * whether the screen is needed at all: an already-authenticated Staff
 * member goes straight to the portal.
 */
export default async function StaffLoginPage() {
  const session = await getStaffSession();
  if (session) {
    redirect("/staff");
  }

  return (
    <PageShell size="narrow">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          FinFam Staff Portal
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sign in to the Staff Portal
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Your Staff Portal is where you complete onboarding and access your
          FinFam staff tools.
        </p>

        <div className="mt-8">
          <StaffLoginForm />
        </div>
      </div>
    </PageShell>
  );
}
