import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrientationNotFoundPanel } from "@/components/orientation/orientation-not-found";
import { OrientationProgressCard } from "@/components/orientation/orientation-progress-card";
import { OrientationSectionList } from "@/components/orientation/orientation-section-list";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { AppError } from "@/lib/errors";
import {
  getOrientationProgress,
  getOrientationSectionViews,
} from "@/lib/orientation";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getOrientationView } from "@/server/services/orientation";

export const metadata: Metadata = {
  title: "Orientation overview",
  description:
    "Your FinFam Staff Orientation Workshop: what you will learn and where you stopped.",
};

/**
 * Orientation overview — the home of stage 1 after the application.
 *
 * Recomposed responsively: on desktop the section list and the progress
 * rail sit side by side (content + context); on mobile the rail — current
 * stage, saved progress and the one next action — comes first.
 *
 * Stage access is decided by the server. Once orientation is completed the
 * workflow is closed, but failed-assessment candidates may return here for
 * read-only review. Review never resets progress or reopens the stage.
 */
export default async function OrientationOverviewPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let view;
  try {
    view = await getOrientationView(normalizeReferenceNumber(reference));
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return (
        <PageShell size="narrow">
          <OrientationNotFoundPanel message={error.message} />
        </PageShell>
      );
    }
    throw error;
  }

  const isReview = view.status === "ASSESSMENT_FAILED";

  // One-way progression: past orientation, only failed-assessment review may
  // render here. Every other later status resumes from the journey page.
  if (
    view.status !== "APPLICANT" &&
    view.status !== "ORIENTATION_PENDING" &&
    !isReview
  ) {
    redirect(`/application/${view.referenceNumber}`);
  }

  const sections = getOrientationSectionViews(view);
  const progress = getOrientationProgress(view);

  return (
    <PageShell size="wide">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff Orientation Workshop
          </h1>
          <StatusBadge status={view.status} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {isReview
            ? "Review the orientation material before retaking your assessment. Your orientation remains complete; this page is read-only."
            : "Learn how FinFam works, what your role involves, and the professional standards expected from every team member."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          For {view.fullName} ·{" "}
          <span className="font-mono tracking-widest">
            {view.referenceNumber}
          </span>
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        <section
          aria-labelledby="orientation-sections"
          className="order-2 md:order-1"
        >
          <h2
            id="orientation-sections"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            What you&apos;ll learn
          </h2>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
            {isReview
              ? "Open any completed section to reread it. Reviewing does not change your recruitment status or orientation progress."
              : "Work through the sections in order. Each one ends with a short confirmation that saves your progress, so you can leave at any time and continue where you stopped."}
          </p>
          <OrientationSectionList sections={sections} className="mt-6" />
        </section>

        <aside
          aria-label="Your orientation progress"
          className="order-1 self-start md:order-2 lg:sticky lg:top-8"
        >
          <OrientationProgressCard
            view={view}
            sections={sections}
            completedCount={progress.completed}
            totalCount={progress.total}
            allSectionsRead={progress.allSectionsRead}
            isComplete={progress.isComplete}
          />
          {isReview && (
            <div className="mt-4 rounded-lg border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">
                Review mode
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Return to the assessment page when you are ready to retake.
              </p>
              <ButtonLink
                href={`/assessment/${view.referenceNumber}`}
                className="mt-4"
                size="sm"
              >
                Back to assessment
              </ButtonLink>
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
