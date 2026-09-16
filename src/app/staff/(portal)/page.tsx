import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { ButtonLink } from "@/components/ui/button-link";
import { STAFF_RESOURCES_PENDING_NOTICE } from "@/config/staff-portal";
import { getStaffSession } from "@/lib/auth/session";
import { getStaffPortalHome } from "@/server/services/staff-portal";

export const metadata: Metadata = {
  title: "Staff Portal",
  description:
    "Your FinFam Staff Portal — identity, appointment, onboarding status, resources and official communication.",
};

/**
 * /staff — the Staff Portal home (Stage 7, brief §22/§39/§40).
 *
 * ONBOARDING-FIRST GATING is the core Stage 7 experience: a Staff member
 * whose onboarding is not complete NEVER lands on a generic dashboard —
 * they are redirected to /staff/onboarding until completion. Once
 * complete, this page is the intentionally small portal home: real,
 * persisted facts only — Staff Identity, Appointment, Onboarding status,
 * Staff Resources (honest availability), Communication. No metrics, no
 * fake KPIs, no invented next stages.
 */
export default async function StaffHomePage() {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  const home = await getStaffPortalHome(session.staff.rowId);

  if (home.onboarding.state !== "COMPLETED") {
    redirect("/staff/onboarding");
  }

  return (
    <>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          FinFam Staff Portal
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {home.fullName}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Your onboarding is complete. You are ready to begin your FinFam
          assignment.
        </p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
        {/* Staff Identity */}
        <section
          aria-labelledby="portal-identity"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2
            id="portal-identity"
            className="text-sm font-semibold text-foreground"
          >
            Staff Identity
          </h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Full name</dt>
              <dd className="text-sm font-semibold text-foreground">
                {home.fullName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Staff ID</dt>
              <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
                {home.staffId}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">
                Appointment designation
              </dt>
              <dd className="text-sm font-semibold text-foreground">
                {home.designation}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Operational role</dt>
              <dd className="text-sm font-semibold text-foreground">
                {home.operationalRole}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Activated</dt>
              <dd className="text-sm font-semibold text-foreground">
                {format(new Date(home.activatedAt), "d MMMM yyyy")}
              </dd>
            </div>
          </dl>
        </section>

        {/* Appointment + Onboarding */}
        <div className="grid content-start gap-8">
          <section
            aria-labelledby="portal-appointment"
            className="rounded-lg border border-border bg-surface p-6"
          >
            <h2
              id="portal-appointment"
              className="text-sm font-semibold text-foreground"
            >
              Appointment
            </h2>
            {home.appointment ? (
              <>
                <dl className="mt-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">
                      Appointment reference
                    </dt>
                    <dd className="text-right font-mono text-sm font-semibold tracking-wider text-foreground">
                      {home.appointment.appointmentReference}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">Issued</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {format(new Date(home.appointment.issuedAt), "d MMMM yyyy")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <ButtonLink href="/staff/appointment" variant="outline" size="sm">
                    View Provisional Appointment
                  </ButtonLink>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Your appointment record could not be shown. Please contact
                support.
              </p>
            )}
          </section>

          <section
            aria-labelledby="portal-onboarding"
            className="rounded-lg border border-border bg-surface p-6"
          >
            <h2
              id="portal-onboarding"
              className="text-sm font-semibold text-foreground"
            >
              Onboarding
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {home.onboarding.state === "COMPLETED"
                    ? "Completed"
                    : "In progress"}
                  <span className="sr-only"> — onboarding status</span>
                </dd>
              </div>
              {home.onboarding.completedAt && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">
                    Completed on
                  </dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {format(
                      new Date(home.onboarding.completedAt),
                      "d MMMM yyyy",
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-10">
        {/* Staff Resources */}
        <section
          aria-labelledby="portal-resources"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2
            id="portal-resources"
            className="text-sm font-semibold text-foreground"
          >
            Staff Resources
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {STAFF_RESOURCES_PENDING_NOTICE}
          </p>
          <div className="mt-4">
            <ButtonLink href="/staff/resources" variant="ghost" size="sm">
              See resource categories
            </ButtonLink>
          </div>
        </section>

        {/* Communication */}
        <section
          aria-labelledby="portal-communication"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2
            id="portal-communication"
            className="text-sm font-semibold text-foreground"
          >
            Communication
          </h2>
          {home.whatsappNumber ? (
            <p className="mt-4 text-sm leading-6 text-foreground">
              Official staff onboarding contact (WhatsApp):{" "}
              <span className="font-mono font-semibold">
                {home.whatsappNumber}
              </span>
            </p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              The official FinFam staff communication channel will be shown
              here once the onboarding team&apos;s contact is confirmed.
            </p>
          )}
          <div className="mt-4">
            <ButtonLink href="/staff/onboarding" variant="ghost" size="sm">
              Review onboarding instructions
            </ButtonLink>
          </div>
        </section>
      </div>
    
    </>
  );
}