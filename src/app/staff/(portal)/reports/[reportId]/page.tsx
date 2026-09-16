import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import { DailyReportForm } from "@/components/reports/daily-report-form";
import { DAILY_REPORT_CATEGORIES, DAILY_REPORT_SELF_REPORTED_NOTICE } from "@/config/daily-report";
import { getStaffSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  formatLagosDateLabel,
  formatLagosDateTimeLabel,
} from "@/lib/dates/lagos";
import { getDailyReportDetail } from "@/server/services/daily-reports";

export const metadata: Metadata = {
  title: "Daily report — FinFam Staff Portal",
  robots: { index: false },
};

/**
 * /staff/reports/[reportId] — one owned daily report (Stage 8).
 *
 * DRAFT renders the editable form; SUBMITTED renders the permanently
 * read-only detail. The id comes from the URL, ownership from the
 * session: a foreign or unknown id is a plain 404 (existence never
 * disclosed). An authenticated staff member with incomplete onboarding is
 * redirected to the onboarding flow (the service's 403 → /staff/onboarding).
 */
export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  const { reportId } = await params;

  let report;
  try {
    report = await getDailyReportDetail(session, reportId);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "FORBIDDEN") redirect("/staff/onboarding");
      if (error.code === "NOT_FOUND") notFound();
    }
    throw error;
  }

  const reportDateLabel = formatLagosDateLabel(report.reportDate);

  if (report.status === "DRAFT") {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/staff/reports"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Daily Reports
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Daily report — {reportDateLabel}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Enter what you did on this date. You can save a draft and come
          back — submitting is final.
        </p>

        <div className="mt-8">
          <DailyReportForm report={report} reportDateLabel={reportDateLabel} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/staff/reports"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Daily Reports
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Daily report — {reportDateLabel}
        </h1>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Submitted
        </span>
      </div>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Submitted
        {report.submittedAt
          ? ` on ${formatLagosDateTimeLabel(new Date(report.submittedAt))} (Africa/Lagos)`
          : ""}
        . This report is final and can no longer be changed.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6">
        {DAILY_REPORT_CATEGORIES.map((category) => (
          <section
            key={category.id}
            aria-label={category.legend}
            className="[&:not(:first-child)]:mt-6"
          >
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {category.legend}
            </h2>
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
          </section>
        ))}

        <section aria-label="Activity summary" className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Activity summary
          </h2>
          {report.activitySummary ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
              {report.activitySummary}
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground">
              No summary was provided for this report.
            </p>
          )}
        </section>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {DAILY_REPORT_SELF_REPORTED_NOTICE}
      </p>

      <div className="mt-8">
        <ButtonLink href="/staff/reports" variant="outline" size="sm">
          Back to all reports
        </ButtonLink>
      </div>
    </div>
  );
}
