import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import {
  DAILY_REPORT_PAGE_SIZE,
  DAILY_REPORT_SELF_REPORTED_NOTICE,
} from "@/config/daily-report";
import { getStaffSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  formatLagosDateCompact,
  formatLagosDateLabel,
  formatLagosTimeLabel,
  lagosCurrentMonthISO,
  nextLagosMonth,
  previousLagosMonth,
} from "@/lib/dates/lagos";
import { listDailyReports } from "@/server/services/daily-reports";

export const metadata: Metadata = {
  title: "Daily Reports — FinFam Staff Portal",
  description:
    "Your self-reported daily activity — one report per working day.",
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
 * /staff/reports — Daily Reports history (Stage 8).
 *
 * The page header always shows today's Africa/Lagos reporting state with
 * the ONE correct next action (start / continue / view today's report).
 * Below it, the month-bounded history lists the staff member's OWN reports
 * (newest first, 20 per page) with honest empty states. Everything is
 * self-reported data — never presented as verified (see the notice).
 *
 * Eligibility lives in the reports service: an authenticated staff member
 * whose onboarding is not complete lands here and is redirected to the
 * onboarding flow (403 FORBIDDEN → /staff/onboarding).
 */
export default async function StaffReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  const params = await searchParams;
  const rawMonth = typeof params.month === "string" ? params.month : "";
  const rawPage =
    typeof params.page === "string"
      ? Number.parseInt(params.page, 10)
      : undefined;

  let history;
  try {
    history = await listDailyReports(session, {
      // The page validates the month shape itself (the zod schema guards
      // the API route; a malformed ?month= just falls back to this month).
      month: /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : undefined,
      page: Number.isFinite(rawPage) ? rawPage : undefined,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      redirect("/staff/onboarding");
    }
    throw error;
  }

  const currentMonth = lagosCurrentMonthISO();
  const hasPrevMonth = history.month > "0000-01"; // always true in practice
  const hasNextMonth = history.month < currentMonth;

  const prevMonthHref = `/staff/reports?month=${previousLagosMonth(history.month)}&page=1`;
  const nextMonthHref = `/staff/reports?month=${nextLagosMonth(history.month)}&page=1`;

  const todayState = history.today;
  const todayHref =
    todayState.state === "NOT_STARTED"
      ? "/staff/reports/new"
      : `/staff/reports/${todayState.reportId}`;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        FinFam Staff Portal
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Daily Reports
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Record what you did each day — the four reporting categories from
        your onboarding, one report per day.
      </p>

      {/* Today's state — the one ongoing operational action. */}
      <section
        aria-labelledby="reports-today"
        className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="reports-today"
              className="text-sm font-semibold text-foreground"
            >
              Today — {formatLagosDateLabel(todayState.date)}
            </h2>
            {todayState.state === "NOT_STARTED" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                You haven&apos;t started today&apos;s report yet.
              </p>
            )}
            {todayState.state === "DRAFT" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your report for today is a draft — finish and submit it when
                you are ready.
                <span className="sr-only"> Status: draft.</span>
              </p>
            )}
            {todayState.state === "SUBMITTED" && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Today&apos;s report was submitted
                {todayState.submittedAt
                  ? ` at ${formatLagosTimeLabel(new Date(todayState.submittedAt))} (Africa/Lagos)`
                  : ""}
                . Thank you.
                <span className="sr-only"> Status: submitted.</span>
              </p>
            )}
          </div>
          <div className="shrink-0">
            <ButtonLink href={todayHref} size="sm">
              {todayState.state === "NOT_STARTED"
                ? "Start today's report"
                : todayState.state === "DRAFT"
                  ? "Continue today's report"
                  : "View today's report"}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* History */}
      <section aria-labelledby="reports-history" className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="reports-history"
            className="text-sm font-semibold text-foreground"
          >
            Your reports
          </h2>
          <nav aria-label="Month" className="flex items-center gap-1 text-sm">
            {hasPrevMonth ? (
              <Link
                href={prevMonthHref}
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <span aria-hidden="true">←</span>{" "}
                <span className="sr-only">Previous month</span>
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/50">
                <span aria-hidden="true">←</span>
              </span>
            )}
            <span
              className="px-2 font-semibold text-foreground"
              aria-current="true"
            >
              {monthLabel(history.month)}
            </span>
            {hasNextMonth ? (
              <Link
                href={nextMonthHref}
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <span aria-hidden="true">→</span>{" "}
                <span className="sr-only">Next month</span>
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/50" aria-hidden="true">
                →
              </span>
            )}
          </nav>
        </div>

        {history.reports.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No reports for {monthLabel(history.month)} yet.
            </p>
            <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
              {history.month === currentMonth
                ? "Start today's report above, or come back at the end of your working day."
                : "Reports appear in the month they were for — switch months with the arrows above."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
            {history.reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/staff/reports/${report.id}`}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-background sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatLagosDateCompact(report.reportDate)}
                      <span className="sr-only">
                        {report.status === "DRAFT"
                          ? " — draft report"
                          : " — submitted report"}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={
                            report.status === "DRAFT"
                              ? "inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                              : "inline-block h-1.5 w-1.5 rounded-full bg-emerald-600"
                          }
                        />
                        {report.status === "DRAFT" ? "Draft" : "Submitted"}
                      </span>
                      <span>
                        Individuals contacted{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {report.individualsContacted}
                        </span>
                      </span>
                      <span>
                        New registrations{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {report.newRegistrations}
                        </span>
                      </span>
                      <span>
                        Established Members{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {report.establishedMembersCreated}
                        </span>
                      </span>
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-sm font-medium text-primary"
                    aria-hidden="true"
                  >
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {history.totalPages > 1 && (
          <nav
            aria-label="History pages"
            className="mt-4 flex items-center justify-between text-sm"
          >
            {history.page > 1 ? (
              <Link
                href={`/staff/reports?month=${history.month}&page=${history.page - 1}`}
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                ← Previous
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/50">← Previous</span>
            )}
            <span className="text-muted-foreground">
              Page {history.page} of {history.totalPages}
            </span>
            {history.page < history.totalPages ? (
              <Link
                href={`/staff/reports?month=${history.month}&page=${history.page + 1}`}
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                Next →
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/50">Next →</span>
            )}
          </nav>
        )}

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {DAILY_REPORT_SELF_REPORTED_NOTICE} Showing up to{" "}
          {DAILY_REPORT_PAGE_SIZE} reports per page.
        </p>
      </section>
    </div>
  );
}
