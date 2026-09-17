import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import { Chip } from "@heroui/react";

import { ADMIN_AUDIT_ACTION_LABELS } from "@/config/admin";
import { getAdminSession } from "@/lib/auth/admin-session";
import { formatLagosDateTimeLabel } from "@/lib/dates/lagos";
import { getAdminOverview } from "@/server/services/admin-directory";

export const metadata: Metadata = {
  title: "Overview · FinFam Admin",
  description:
    "Operationally simple overview of FinFam Staff account states and recent privileged actions.",
};

/**
 * /admin — Overview (Stage 11, brief §17): operationally simple, real
 * data only. Two persisted Staff account counts, quick links into the
 * directory and Daily Reports, and the five most recent audit events.
 * No analytics, no conversion dashboards, no KPIs — nothing that the
 * database does not actually store.
 */
export default async function AdminOverviewPage() {
  const session = await getAdminSession();
  if (!session) {
    // The layout already guards this — defensive double-check (Next 16
    // serves layout redirects as HTTP-200 shells while pages render).
    redirect("/admin/login");
  }

  const overview = await getAdminOverview();

  return (
    <div className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        FinFam Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Overview
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Current Staff account states and the most recent privileged actions
        taken in this console.
      </p>

      {/* Account counts — real persisted numbers only. */}
      <section aria-labelledby="overview-counts" className="mt-8">
        <h2 id="overview-counts" className="sr-only">
          Staff account counts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total active Staff
              </p>
              <Chip color="success" variant="soft" size="sm">
                Active
                <span className="sr-only">Status: active.</span>
              </Chip>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
              {overview.totalActiveStaff}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total suspended Staff
              </p>
              <Chip color="danger" variant="soft" size="sm">
                Suspended
                <span className="sr-only">Status: suspended.</span>
              </Chip>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
              {overview.totalSuspendedStaff}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {overview.totalStaff} Staff record
          {overview.totalStaff === 1 ? "" : "s"} in total.
        </p>
      </section>

      {/* Quick links */}
      <section aria-labelledby="overview-links" className="mt-8">
        <h2
          id="overview-links"
          className="text-sm font-semibold text-foreground"
        >
          Go to
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <ButtonLink href="/admin/staff" size="sm">
            Open Staff directory
          </ButtonLink>
          <ButtonLink href="/admin/applicants" variant="outline" size="sm">
            View Applicants
          </ButtonLink>
          <ButtonLink href="/admin/reports" variant="outline" size="sm">
            Open Daily Reports
          </ButtonLink>
        </div>
      </section>

      {/* Recent admin actions */}
      <section aria-labelledby="overview-recent-actions" className="mt-10">
        <h2
          id="overview-recent-actions"
          className="text-sm font-semibold text-foreground"
        >
          Recent admin actions
        </h2>

        {overview.recentAuditEvents.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No privileged actions recorded yet.
            </p>
            <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
              Suspensions and reactivations performed in this console will
              appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
            {overview.recentAuditEvents.map((event) => (
              <li key={event.id} className="p-4 sm:p-5">
                <p className="text-sm font-semibold text-foreground">
                  {ADMIN_AUDIT_ACTION_LABELS[event.action] ?? event.action}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatLagosDateTimeLabel(new Date(event.createdAt))}</span>
                  <span>
                    by <span className="font-medium text-foreground">{event.actorEmail}</span>
                  </span>
                  {event.staffId && (
                    <span className="font-mono tracking-wider">{event.staffId}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
