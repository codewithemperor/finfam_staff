import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Chip, Table } from "@heroui/react";

import { ADMIN_REPORTS_SELF_REPORTED_NOTICE } from "@/config/admin";
import { getAdminSession } from "@/lib/auth/admin-session";
import {
  formatLagosDateCompact,
  formatLagosDateTimeLabel,
  lagosDateISOFromUtcMidnight,
} from "@/lib/dates/lagos";
import { listAdminSubmittedReports } from "@/server/services/admin-reports";

export const metadata: Metadata = {
  title: "Daily Reports · FinFam Admin",
  description:
    "Submitted daily reports across all Staff members — self-reported activity, read-only.",
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function monthLabel(monthISO: string): string {
  const year = monthISO.slice(0, 4);
  const month = Number(monthISO.slice(5, 7));
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/**
 * /admin/reports — submitted Daily Reports across all Staff (Stage 11,
 * brief §23–§25). SUBMITTED reports ONLY (drafts are hidden server-side);
 * strictly read-only. The self-reported notice is shown prominently: these
 * figures are the Staff member's OWN reported activity — never "verified
 * performance", confirmed member growth or payroll data.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    // The layout already guards this — defensive double-check (Next 16
    // serves layout redirects as HTTP-200 shells while pages render).
    redirect("/admin/login");
  }

  const params = await searchParams;
  const rawMonth = typeof params.month === "string" ? params.month : "";
  const staff = typeof params.staff === "string" ? params.staff.trim() : "";
  const rawPage =
    typeof params.page === "string"
      ? Number.parseInt(params.page, 10)
      : undefined;
  const page =
    typeof rawPage === "number" && Number.isFinite(rawPage) && rawPage > 0
      ? rawPage
      : 1;

  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : undefined;

  const reports = await listAdminSubmittedReports({
    month,
    staff: staff || undefined,
    page,
  });

  /** Build a pagination href that preserves the current filters. */
  function pageHref(nextPage: number): string {
    const search = new URLSearchParams();
    if (reports.month) search.set("month", reports.month);
    if (staff) search.set("staff", staff);
    search.set("page", String(nextPage));
    return `/admin/reports?${search.toString()}`;
  }

  return (
    <div className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        FinFam Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Daily Reports
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Submitted daily reports across all Staff members. Read-only — reports
        are final once submitted and cannot be edited, annotated or approved
        here.
      </p>

      {/* Self-reported framing — shown prominently, verbatim. */}
      <Alert status="warning" className="mt-6">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Self-reported activity</Alert.Title>
          <Alert.Description>
            {ADMIN_REPORTS_SELF_REPORTED_NOTICE}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* Server-rendered filters — works without JavaScript. */}
      <form
        method="get"
        action="/admin/reports"
        role="search"
        aria-label="Filter submitted reports"
        className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label
              htmlFor="reports-filter-month"
              className="block text-sm font-medium text-foreground"
            >
              Report month
            </label>
            <input
              id="reports-filter-month"
              name="month"
              type="month"
              defaultValue={reports.month ?? ""}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="reports-filter-staff"
              className="block text-sm font-medium text-foreground"
            >
              Staff ID or name
            </label>
            <input
              id="reports-filter-staff"
              name="staff"
              type="text"
              defaultValue={staff}
              autoComplete="off"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="e.g. FF-STF-0142"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Apply
          </button>
        </div>
      </form>

      {reports.reports.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No submitted reports match the current filters.
          </p>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
            {reports.month
              ? `Nothing was submitted for ${monthLabel(reports.month)} with these filters — adjust the month or the Staff search above.`
              : "Adjust the Staff search above, or check back after Staff members submit their reports."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden md:block">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Submitted Daily Reports" className="min-w-[760px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Report date</Table.Column>
                    <Table.Column>Staff</Table.Column>
                    <Table.Column>Submitted</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Action</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {reports.reports.map((report) => (
                      <Table.Row key={report.id}>
                        <Table.Cell><Link href={`/admin/reports/${report.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{formatLagosDateCompact(lagosDateISOFromUtcMidnight(report.reportDate))}</Link></Table.Cell>
                        <Table.Cell><Link href={`/admin/staff/${report.staffRowId}`} className="font-mono text-sm font-semibold text-foreground hover:text-primary hover:underline">{report.staffId}</Link><p className="text-xs text-muted-foreground">{report.staffName}</p></Table.Cell>
                        <Table.Cell>{formatLagosDateTimeLabel(new Date(report.submittedAt))}</Table.Cell>
                        <Table.Cell><Chip color="success" variant="soft" size="sm">Submitted<span className="sr-only">Status: submitted.</span></Chip></Table.Cell>
                        <Table.Cell><Link href={`/admin/reports/${report.id}`} className="text-sm font-semibold text-primary hover:underline">View report</Link></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {reports.reports.map((report) => (
              <li key={report.id} className="p-5">
                <div className="flex items-start justify-between gap-3"><div><Link href={`/admin/reports/${report.id}`} className="font-semibold text-foreground">{formatLagosDateCompact(lagosDateISOFromUtcMidnight(report.reportDate))}</Link><p className="mt-1 text-sm text-muted-foreground">{report.staffName} · <span className="font-mono">{report.staffId}</span></p></div><Chip color="success" variant="soft" size="sm">Submitted</Chip></div>
                <p className="mt-4 text-xs text-muted-foreground">Submitted {formatLagosDateTimeLabel(new Date(report.submittedAt))} (Africa/Lagos)</p>
                <div className="mt-4"><Link href={`/admin/reports/${report.id}`} className="flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">View report</Link></div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Page {reports.page} of {reports.totalPages} · {reports.total}{" "}
        submitted report{reports.total === 1 ? "" : "s"}
      </p>

      {reports.totalPages > 1 && (
        <nav
          aria-label="Report pages"
          className="mt-2 flex items-center justify-between text-sm"
        >
          {reports.page > 1 ? (
            <Link
              href={pageHref(reports.page - 1)}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              ← Previous
            </Link>
          ) : (
            <span className="px-2 py-1 text-muted-foreground/50">← Previous</span>
          )}
          {reports.page < reports.totalPages ? (
            <Link
              href={pageHref(reports.page + 1)}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Next →
            </Link>
          ) : (
            <span className="px-2 py-1 text-muted-foreground/50">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}
