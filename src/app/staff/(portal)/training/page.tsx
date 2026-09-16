import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { ButtonLink } from "@/components/ui/button-link";
import {
  TRAINING_NON_BLOCKING_NOTICE,
  TRAINING_REQUIRED_LABEL,
} from "@/config/training";
import { getStaffSession } from "@/lib/auth/session";
import { getTrainingOverview } from "@/server/services/staff-training";

export const metadata: Metadata = {
  title: "Staff Training — FinFam Staff Portal",
  description:
    "FinFam Staff Training — learn how to perform your role correctly, professionally, consistently and safely.",
};

/**
 * /staff/training — the Training overview (Stage 9, brief §37).
 *
 * Shows ONLY real course data from the source-controlled registry and the
 * Staff member's persisted progress. This page is strictly READ-ONLY
 * (brief §24): it never creates an enrollment — "Not started" comes from
 * the absence of progress, and the course itself is where enrollment
 * happens (lazily, race-safe, once).
 *
 * Three honest states per course — no fake catalog, no scores, no badges:
 * - Not started  → "Start Training"
 * - In progress  → "N of M lessons completed" → "Continue Training"
 * - Completed    → "Completed <date>" → "Review Training"
 *
 * "Required Training" is an organisational label (brief §16): the
 * non-blocking notice makes clear that incomplete training never blocks
 * any other Staff Portal tool in this release.
 */
export default async function StaffTrainingPage() {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  const overview = await getTrainingOverview(session);

  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Staff Training
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Staff Training
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Ongoing training to help you perform your FinFam role correctly,
        professionally, consistently and safely.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {TRAINING_NON_BLOCKING_NOTICE}
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {overview.courses.map((course) => (
          <section
            key={course.courseId}
            aria-labelledby={`training-course-${course.courseId}`}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2
                id={`training-course-${course.courseId}`}
                className="text-lg font-bold tracking-tight text-foreground"
              >
                {course.title}
              </h2>
              {course.required && (
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                  {TRAINING_REQUIRED_LABEL}
                  <span className="sr-only">
                    {" "}
                    — required training does not block other portal tools
                  </span>
                </span>
              )}
            </div>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">
              {course.description}
            </p>

            {/* State — always visible as text, never colour-only. */}
            <p className="mt-4 text-sm font-semibold text-foreground">
              {course.state === "NOT_STARTED" && (
                <>
                  Not started
                  <span className="sr-only"> — course not started.</span>
                </>
              )}
              {course.state === "IN_PROGRESS" && (
                <>
                  <span className="tabular-nums">
                    {course.completedLessons} of {course.totalLessons}
                  </span>{" "}
                  lessons completed
                  <span className="sr-only">
                    {" "}
                    — course in progress: {course.completedLessons} of{" "}
                    {course.totalLessons} lessons completed.
                  </span>
                </>
              )}
              {course.state === "COMPLETED" && (
                <>
                  Completed
                  {course.completedAt
                    ? ` ${format(new Date(course.completedAt), "d MMMM yyyy")}`
                    : ""}
                  <span className="sr-only">
                    {" "}
                    — course completed
                    {course.completedAt ? ` on ${course.completedAt}` : ""}.
                  </span>
                </>
              )}
            </p>

            <div className="mt-5">
              <ButtonLink
                href={`/staff/training/${course.courseId}`}
                size="sm"
              >
                {course.state === "NOT_STARTED" && "Start Training"}
                {course.state === "IN_PROGRESS" && "Continue Training"}
                {course.state === "COMPLETED" && "Review Training"}
              </ButtonLink>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
