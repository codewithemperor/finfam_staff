import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { OrientationContent } from "@/components/orientation/orientation-content";
import { OrientationNotFoundPanel } from "@/components/orientation/orientation-not-found";
import { SectionReadFooter } from "@/components/orientation/section-read-footer";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { getOrientationSection } from "@/config/orientation";
import { AppError } from "@/lib/errors";
import {
  getOrientationProgress,
  getOrientationSectionViews,
} from "@/lib/orientation";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getOrientationView } from "@/server/services/orientation";

interface SectionPageProps {
  params: Promise<{ reference: string; section: string }>;
}

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const sectionDefinition = getOrientationSection(section);
  return {
    title: sectionDefinition
      ? `Orientation — ${sectionDefinition.title}`
      : "Orientation section",
  };
}

/**
 * One section of the workshop. Desktop recomposes the page into content
 * (left) and context — key points plus saved progress (right); mobile keeps
 * the reading experience single-column. Sections the candidate has not
 * reached yet are gated server-side: the URL never exposes unread content.
 * Failed-assessment candidates may reread completed orientation sections in
 * review mode without reopening or mutating orientation progress.
 */
export default async function OrientationSectionPage({
  params,
}: SectionPageProps) {
  const { reference, section: sectionId } = await params;

  const sectionDefinition = getOrientationSection(sectionId);

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

  const overviewHref = `/orientation/${view.referenceNumber}`;

  if (!sectionDefinition) {
    return (
      <PageShell size="narrow">
        <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
          <h1 className="text-base font-semibold text-foreground">
            That section doesn&apos;t exist
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            The workshop sections live at their own addresses. Open your
            orientation overview to continue where you stopped.
          </p>
          <div className="mt-5">
            <ButtonLink href={overviewHref}>Back to the overview</ButtonLink>
          </div>
        </div>
      </PageShell>
    );
  }

  const sections = getOrientationSectionViews(view);
  const progress = getOrientationProgress(view);
  const thisSection = sections.find((s) => s.id === sectionDefinition.id);
  if (!thisSection) return null; // config and helper are always in sync

  const position = thisSection.index - 1;
  const prev =
    position > 0
      ? { href: sections[position - 1].href, title: sections[position - 1].title }
      : null;
  const next =
    position < sections.length - 1
      ? { href: sections[position + 1].href, title: sections[position + 1].title }
      : null;

  if (thisSection.state === "locked") {
    const resume = sections.find((s) => s.state === "current");
    return (
      <PageShell size="narrow">
        <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <Lock aria-hidden className="size-5 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">
              This section isn&apos;t open yet
            </h1>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sections open in order, so each one builds on the last. Finish
            the earlier sections first
            {resume ? (
              <>
                {" "}
                — your current section is{" "}
                <span className="font-semibold text-foreground">
                  {resume.title}
                </span>
              </>
            ) : null}
            .
          </p>
          <div className="mt-5">
            <ButtonLink href={resume?.href ?? overviewHref}>
              Go to your current section
            </ButtonLink>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell size="default">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={overviewHref}
          className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          ← Orientation overview
        </Link>
        <span className="text-sm text-muted-foreground">
          Section {thisSection.index} of {progress.total}
        </span>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12 xl:gap-14">
        <article className="order-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {sectionDefinition.title}
          </h1>
          <div className="mt-6">
            <OrientationContent blocks={sectionDefinition.blocks} />
          </div>

          <SectionReadFooter
            reference={view.referenceNumber}
            sectionId={sectionDefinition.id}
            isCompleted={thisSection.state === "completed"}
            isLast={thisSection.index === progress.total}
            prev={prev}
            next={next}
            overviewHref={overviewHref}
            isReview={isReview}
          />
        </article>

        <aside
          aria-label="About this section"
          className="order-2 self-start lg:sticky lg:top-8"
        >
          <h2 className="text-sm font-semibold text-foreground">
            In this section
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-4">
            {sectionDefinition.keyPoints.map((point) => (
              <li key={point} className="text-sm leading-6 text-muted-foreground">
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-divider pt-5">
            <p className="text-sm font-semibold text-foreground">
              Orientation progress
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {progress.completed} of {progress.total} sections read
            </p>
            <div
              role="progressbar"
              aria-label="Orientation sections read"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.completed}
              aria-valuetext={`${progress.completed} of ${progress.total} sections`}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-divider"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
          {isReview && (
            <div className="mt-6 border-t border-divider pt-5">
              <p className="text-sm font-semibold text-foreground">
                Review mode
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This review does not reset orientation or change your failed
                assessment status.
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
