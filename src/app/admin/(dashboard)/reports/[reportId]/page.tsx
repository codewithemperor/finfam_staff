import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Chip } from "@heroui/react";

import { ADMIN_REPORTS_SELF_REPORTED_NOTICE } from "@/config/admin";
import { DAILY_REPORT_CATEGORIES } from "@/config/daily-report";
import { getAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/errors";
import {
  formatLagosDateLabel,
  formatLagosDateTimeLabel,
  lagosDateISOFromUtcMidnight,
} from "@/lib/dates/lagos";
import { getAdminReportDetail } from "@/server/services/admin-reports";

export const metadata: Metadata = {
  title: "Submitted report · FinFam Admin",
  robots: { index: false },
};

/**
 * /admin/reports/[reportId] — read-only detail of ONE submitted report
 * (Stage 11, brief §25). Unknown ids AND drafts answer the same plain 404
 * (drafts are hidden, not acknowledged). Strictly read-only: NO edit,
 * annotate or approve control exists on this page or anywhere in the
 * console. The self-reported notice is shown again here, verbatim.
 */
export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    // The layout already guards this — defensive double-check (Next 16
    // serves layout redirects as HTTP-200 shells while pages render).
    redirect("/admin/login");
  }

  const { reportId } = await params;

  let report;
  try {
    report = await getAdminReportDetail(reportId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const reportDateLabel = formatLagosDateLabel(
    lagosDateISOFromUtcMidnight(report.reportDate),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/reports"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Daily Reports
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Daily report — {reportDateLabel}
        </h1>
        <Chip color="success" variant="soft" size="sm" className="shrink-0">
          Submitted
          <span className="sr-only">Status: submitted.</span>
        </Chip>
      </div>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Submitted on {formatLagosDateTimeLabel(new Date(report.submittedAt))}{" "}
        (Africa/Lagos). This report is final and is read-only in the console.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-start">
        <div className="space-y-6">
          {/* The nine metrics — exact submitted values, official grouping. */}
          <section
            aria-labelledby="report-metrics"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h2
              id="report-metrics"
              className="text-sm font-semibold text-foreground"
            >
              Reported activity
            </h2>
            {DAILY_REPORT_CATEGORIES.map((category) => (
              <div key={category.id} className="[&:not(:first-child)]:mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {category.legend}
                </h3>
                <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {category.fields.map((field) => (
                    <div
                      key={field.name}
                      className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
                    >
                      <dt className="text-sm text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-base font-semibold tabular-nums text-foreground">
                        {report.metrics[field.name] ?? 0}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>

          {/* Activity summary */}
          <section
            aria-labelledby="report-summary"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h2
              id="report-summary"
              className="text-sm font-semibold text-foreground"
            >
              Activity summary
            </h2>
            {report.activitySummary ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                {report.activitySummary}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">
                No activity summary provided.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Staff identity — links to the read-only Staff record. */}
          <section
            aria-labelledby="report-staff"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h2
              id="report-staff"
              className="text-sm font-semibold text-foreground"
            >
              Reported by
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {report.staff.fullName}
              </span>
              <Link
                href={`/admin/staff/${report.staff.rowId}`}
                className="rounded-md font-mono font-semibold tracking-wider text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                {report.staff.staffId}
              </Link>
            </p>
          </section>

          {/* Self-reported framing — verbatim, again. */}
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Self-reported activity</Alert.Title>
              <Alert.Description>
                {ADMIN_REPORTS_SELF_REPORTED_NOTICE}
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <Link
            href={`/admin/reports?staff=${encodeURIComponent(report.staff.staffId)}`}
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            View all submitted reports by {report.staff.staffId} →
          </Link>
        </aside>
      </div>
    </div>
  );
}
