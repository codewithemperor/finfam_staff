import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { ButtonLink } from "@/components/ui/button-link";
import { getStaffSession } from "@/lib/auth/session";
import { formatLagosTimeLabel } from "@/lib/dates/lagos";
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
      <div className="mt-0 max-w-3xl">
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

      {/* Daily Reporting — the one ongoing operational action (Stage 8).
          The card routes on TODAY'S Africa/Lagos state only; no metrics,
          no streaks, no reminders. */}
      <section
        aria-labelledby="portal-daily-reporting"
        className="mt-8 rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2
              id="portal-daily-reporting"
              className="text-sm font-semibold text-foreground"
            >
              Daily Reporting
            </h2>
            {home.dailyReporting.state === "NOT_STARTED" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {format(
                  new Date(`${home.dailyReporting.date}T12:00:00Z`),
                  "d MMMM yyyy",
                )}{" "}
                — you haven&apos;t started today&apos;s report yet.
                <span className="sr-only"> Status: not started.</span>
              </p>
            )}
            {home.dailyReporting.state === "DRAFT" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {format(
                  new Date(`${home.dailyReporting.date}T12:00:00Z`),
                  "d MMMM yyyy",
                )}{" "}
                — today&apos;s report is a draft, waiting to be submitted.
                <span className="sr-only"> Status: draft.</span>
              </p>
            )}
            {home.dailyReporting.state === "SUBMITTED" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {format(
                  new Date(`${home.dailyReporting.date}T12:00:00Z`),
                  "d MMMM yyyy",
                )}{" "}
                — today&apos;s report was submitted
                {home.dailyReporting.submittedAt
                  ? ` at ${formatLagosTimeLabel(new Date(home.dailyReporting.submittedAt))} (Africa/Lagos)`
                  : ""}
                . Thank you.
                <span className="sr-only"> Status: submitted.</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <ButtonLink
              href={
                home.dailyReporting.state === "NOT_STARTED"
                  ? "/staff/reports/new"
                  : `/staff/reports/${home.dailyReporting.reportId}`
              }
              size="sm"
            >
              {home.dailyReporting.state === "NOT_STARTED"
                ? "Start today's report"
                : home.dailyReporting.state === "DRAFT"
                  ? "Continue today's report"
                  : "View today's report"}
            </ButtonLink>
            <ButtonLink href="/staff/reports" variant="ghost" size="sm">
              All reports
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mt-8 ">
        <section aria-labelledby="portal-summary">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="portal-summary"
                className="text-lg font-semibold text-foreground"
              >
                This month
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submitted Daily Report activity. These figures are
                self-reported.
              </p>
            </div>
            <ButtonLink href="/staff/reports" variant="outline" size="sm">
              View report history
            </ButtonLink>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Reports submitted", home.dashboard.submittedReportsThisMonth],
              ["New registrations", home.dashboard.newRegistrationsThisMonth],
              [
                "Established members",
                home.dashboard.establishedMembersThisMonth,
              ],
              [
                "Training lessons",
                `${home.training.completedLessons} / ${home.training.totalLessons}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* <section aria-labelledby="portal-recent-reports" className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="portal-recent-reports" className="text-sm font-semibold text-foreground">
              Your reports
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your latest recorded activity, shown exactly as submitted.
            </p>
          </div>
          <ButtonLink href="/staff/reports" variant="ghost" size="sm">
            All reports
          </ButtonLink>
        </div>
        {home.dashboard.recentReports.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Recent submitted Daily Reports</caption>
              <thead className="border-b border-divider text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-3 font-semibold">Report date</th>
                  <th scope="col" className="pb-3 font-semibold">New registrations</th>
                  <th scope="col" className="pb-3 font-semibold">Established members</th>
                  <th scope="col" className="pb-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {home.dashboard.recentReports.map((report) => (
                  <tr key={report.id}>
                    <th scope="row" className="py-3 font-medium text-foreground">
                      {format(new Date(`${report.reportDate}T12:00:00Z`), "d MMMM yyyy")}
                    </th>
                    <td className="py-3 text-muted-foreground">{report.newRegistrations}</td>
                    <td className="py-3 text-muted-foreground">{report.establishedMembersCreated}</td>
                    <td className="py-3 text-right">
                      <ButtonLink href={`/staff/reports/${report.id}`} variant="ghost" size="sm">
                        View report
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 border-t border-divider pt-5 text-sm text-muted-foreground">
            No submitted activity reports yet. Your first submission will appear here.
          </p>
        )}
      </section> */}
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
              <dt className="text-sm text-muted-foreground">
                Operational role
              </dt>
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
          {/* Stage 10 (brief §31): the identity card entry point — uses the
              SAME Staff ID already shown here; no second identity summary. */}
          <div className="mt-5">
            <ButtonLink href="/staff/id-card" size="sm">
              View Staff ID Card
            </ButtonLink>
          </div>
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
                      {format(
                        new Date(home.appointment.issuedAt),
                        "d MMMM yyyy",
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <ButtonLink href="/staff/appointment" size="sm">
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
        {/* Staff Training — ongoing learning (Stage 9, brief §38). The card
            shows real persisted progress in the three approved states; no
            scores, no percentages beyond "N of M lessons completed". */}
        <section
          aria-labelledby="portal-training"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2
            id="portal-training"
            className="text-sm font-semibold text-foreground"
          >
            Staff Training
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {home.training.title}
            {home.training.required ? " — Required Training." : ""}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            {home.training.state === "NOT_STARTED" && (
              <>
                Not started
                <span className="sr-only"> — training not started.</span>
              </>
            )}
            {home.training.state === "IN_PROGRESS" && (
              <>
                <span className="tabular-nums">
                  {home.training.completedLessons} of{" "}
                  {home.training.totalLessons}
                </span>{" "}
                lessons completed
                <span className="sr-only">
                  {" "}
                  — training in progress: {
                    home.training.completedLessons
                  } of {home.training.totalLessons} lessons completed.
                </span>
              </>
            )}
            {home.training.state === "COMPLETED" && (
              <>
                Completed
                {home.training.completedAt
                  ? ` ${format(new Date(home.training.completedAt), "d MMMM yyyy")}`
                  : ""}
                <span className="sr-only"> — training completed.</span>
              </>
            )}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Training does not block your other Staff Portal tools in this
            release.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={`/staff/training/${home.training.courseId}`}
              size="sm"
            >
              {home.training.state === "NOT_STARTED" && "Start Training"}
              {home.training.state === "IN_PROGRESS" && "Continue Training"}
              {home.training.state === "COMPLETED" && "Review Training"}
            </ButtonLink>
            <ButtonLink href="/staff/training" variant="ghost" size="sm">
              Training overview
            </ButtonLink>
          </div>
        </section>

        {/* Staff Resources (Stage 10, brief §10) — derived from the
            registry, never a hard-coded availability flag; no fake count. */}
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
          {home.resources.inPortal.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {home.resources.inPortal.map((resource) => (
                <li
                  key={resource.href}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
                >
                  <span className="font-semibold text-foreground">
                    {resource.title}
                  </span>
                  <span className="text-muted-foreground">
                    Available in your portal
                    <span className="sr-only"> — {resource.title}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No resources are available in the portal yet.
            </p>
          )}
          <p className="mt-3 max-w-[52ch] text-sm leading-6 text-muted-foreground">
            {home.resources.remainingNote}
          </p>
          <div className="mt-4">
            <ButtonLink href="/staff/resources" variant="ghost" size="sm">
              View Staff Resources
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
              The official FinFam staff communication channel will be shown here
              once the onboarding team&apos;s contact is confirmed.
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
