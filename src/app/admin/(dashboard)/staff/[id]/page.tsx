import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { Chip } from "@heroui/react";

import { AccountAccessActions } from "@/components/admin/account-access-actions";
import { getTrainingCourse } from "@/config/training";
import { getAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/errors";
import {
  formatLagosDateCompact,
  formatLagosDateTimeLabel,
  lagosDateISOFromUtcMidnight,
} from "@/lib/dates/lagos";
import { getStaffAdminDetail } from "@/server/services/admin-directory";

export const metadata: Metadata = {
  title: "Staff record · FinFam Admin",
  robots: { index: false },
};

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/**
 * /admin/staff/[id] — read-only Staff record (Stage 11, brief §21). The
 * id is the opaque internal Staff row id; unknown ids answer the standard
 * 404 (existence is never disclosed — the valid Admin session is what
 * grants visibility, never the URL). Sections are read-only: there is NO
 * profile editing anywhere in the console. The single privileged write is
 * the account access action below.
 */
export default async function AdminStaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    // The layout already guards this — defensive double-check (Next 16
    // serves layout redirects as HTTP-200 shells while pages render).
    redirect("/admin/login");
  }

  const { id } = await params;

  let detail;
  try {
    detail = await getStaffAdminDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const { identity, appointment, onboarding, training, recentReports, account } =
    detail;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/staff"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Staff
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {identity.fullName}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="font-mono text-sm font-semibold tracking-wider text-foreground">
          {identity.staffId}
        </span>
        {account.status === "ACTIVE" ? (
          <Chip color="success" variant="soft" size="sm">
            Active
            <span className="sr-only">Status: active.</span>
          </Chip>
        ) : (
          <Chip color="danger" variant="soft" size="sm">
            Suspended
            <span className="sr-only">Status: suspended.</span>
          </Chip>
        )}
      </p>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Read-only record. Nothing on this page can be edited in the console.
      </p>

      {/* Identity */}
      <section
        aria-labelledby="staff-identity"
        className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2
          id="staff-identity"
          className="text-sm font-semibold text-foreground"
        >
          Identity
        </h2>
        <dl className="mt-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <dt className="text-sm text-muted-foreground">Staff ID</dt>
            <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
              {identity.staffId}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">Full name</dt>
            <dd className="text-right text-sm font-semibold text-foreground">
              {identity.fullName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">Email address</dt>
            <dd className="text-right text-sm font-semibold text-foreground">
              {identity.email}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">Designation</dt>
            <dd className="text-right text-sm font-semibold text-foreground">
              {identity.designation}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">Operational role</dt>
            <dd className="text-right text-sm font-semibold text-foreground">
              {identity.operationalRole}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="text-sm text-muted-foreground">Activated</dt>
            <dd className="text-sm font-semibold text-foreground">
              {format(new Date(identity.activatedAt), "d MMMM yyyy")}
            </dd>
          </div>
        </dl>
      </section>

      {/* Appointment */}
      <section
        aria-labelledby="staff-appointment"
        className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2
          id="staff-appointment"
          className="text-sm font-semibold text-foreground"
        >
          Appointment
        </h2>
        <dl className="mt-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <dt className="text-sm text-muted-foreground">Reference</dt>
            <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
              {appointment.reference}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">Version</dt>
            <dd className="text-sm font-semibold text-foreground">
              {appointment.version}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="text-sm text-muted-foreground">Issued</dt>
            <dd className="text-sm font-semibold text-foreground">
              {appointment.issuedAt
                ? format(new Date(appointment.issuedAt), "d MMMM yyyy")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Onboarding */}
      <section
        aria-labelledby="staff-onboarding"
        className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2
          id="staff-onboarding"
          className="text-sm font-semibold text-foreground"
        >
          Onboarding
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          State: {STATE_LABELS[onboarding.state]}
          <span className="sr-only">
            {" "}
            Status: {onboarding.state.toLowerCase().replace("_", " ")}.
          </span>
        </p>
        <dl className="mt-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <dt className="text-sm text-muted-foreground">Started</dt>
            <dd className="text-sm font-semibold text-foreground">
              {onboarding.startedAt
                ? format(new Date(onboarding.startedAt), "d MMMM yyyy")
                : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="text-sm text-muted-foreground">Completed</dt>
            <dd className="text-sm font-semibold text-foreground">
              {onboarding.completedAt
                ? format(new Date(onboarding.completedAt), "d MMMM yyyy")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Training */}
      <section
        aria-labelledby="staff-training"
        className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2
          id="staff-training"
          className="text-sm font-semibold text-foreground"
        >
          Training
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Overall state: {STATE_LABELS[training.state]}
          <span className="sr-only">
            {" "}
            Status: {training.state.toLowerCase().replace("_", " ")}.
          </span>
        </p>

        {training.courses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No training enrollments yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {training.courses.map((course) => {
              const courseTitle =
                getTrainingCourse(course.courseId)?.title ?? course.courseId;
              return (
                <li key={`${course.courseId}-${course.courseVersion}`} className="p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {courseTitle}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Version{" "}
                      <span className="font-mono">{course.courseVersion}</span>
                    </span>
                    <span>
                      {STATE_LABELS[course.state]}
                      <span className="sr-only">
                        {" "}
                        Status: {course.state.toLowerCase().replace("_", " ")}.
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {course.completedLessons} of {course.totalLessons}{" "}
                      lessons
                    </span>
                    <span>
                      {course.completedAt && course.state === "COMPLETED"
                        ? `Completed ${format(new Date(course.completedAt), "d MMMM yyyy")}`
                        : "Not completed yet"}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Daily reporting — recent submitted reports only. */}
      <section
        aria-labelledby="staff-reports"
        className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="staff-reports"
            className="text-sm font-semibold text-foreground"
          >
            Daily reporting
          </h2>
          <Link
            href={`/admin/reports?staff=${encodeURIComponent(identity.staffId)}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            View full report history →
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No submitted daily reports yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {recentReports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="flex flex-col gap-1 p-4 transition-colors hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {formatLagosDateCompact(
                      lagosDateISOFromUtcMidnight(report.reportDate),
                    )}
                    <span className="sr-only"> — submitted report</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.submittedAt
                      ? `Submitted ${formatLagosDateTimeLabel(new Date(report.submittedAt))} (Africa/Lagos)`
                      : "Submitted"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account access — the single privileged write. */}
      <section
        aria-labelledby="staff-account"
        className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2
          id="staff-account"
          className="text-sm font-semibold text-foreground"
        >
          Account access
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Current status:{" "}
          <span className="font-semibold text-foreground">
            {account.status === "ACTIVE" ? "Active" : "Suspended"}
          </span>
          <span className="sr-only">
            {" "}
            Status: {account.status === "ACTIVE" ? "active." : "suspended."}
          </span>
        </p>
        <div className="mt-4">
          <AccountAccessActions
            staffRowId={identity.id}
            staffId={identity.staffId}
            fullName={identity.fullName}
            currentStatus={account.status}
          />
        </div>
      </section>
    </div>
  );
}
