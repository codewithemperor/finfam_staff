import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { Alert } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";
import { LessonCompleteAction } from "@/components/training/lesson-complete-action";
import {
  TRAINING_LESSON_STATE_LABELS,
  TRAINING_REQUIRED_LABEL,
} from "@/config/training";
import { getStaffSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getTrainingCourseDetail } from "@/server/services/staff-training";
import type { TrainingBlock } from "@/types/staff-training";

export const metadata: Metadata = {
  title: "Staff Training course — FinFam Staff Portal",
  robots: { index: false },
};

/**
 * /staff/training/[courseId] — the course/lesson reader (Stage 9, brief
 * §31/§39–§42). Opening the course lazily create-or-gets the enrollment
 * (the one approved GET side effect, brief §34); everything else on this
 * page is a read.
 *
 * The DISPLAYED lesson is always server-derived (brief §25/§26): the
 * current lesson by default, any completed lesson via ?lesson=<id> for
 * review (zero writes), and NEVER locked content — a locked or unknown
 * ?lesson= falls back to the open lesson with an honest notice.
 *
 * Layout: mobile single column (header → compact progress → lesson →
 * action → lesson list); md+ adds the functional progress rail on the
 * right (brief §41). Completed lessons stay readable; the course stays
 * open after completion (brief §30).
 */

function TrainingBlocks({ blocks }: { blocks: TrainingBlock[] }) {
  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={index}
                className="mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.text}
              </p>
            );
          case "heading":
            return (
              <h3
                key={index}
                className="mt-8 max-w-[68ch] text-base font-bold tracking-tight text-foreground first:mt-0"
              >
                {block.text}
              </h3>
            );
          case "list":
            return (
              <ul
                key={index}
                className="mt-4 max-w-[68ch] list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "facts":
            return (
              <dl
                key={index}
                className="mt-4 max-w-[68ch] rounded-lg border border-border bg-surface p-5 first:mt-0"
              >
                {block.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 first:pt-0 last:pb-0"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          case "alert":
            return (
              <Alert
                key={index}
                status={block.tone}
                className="mt-4 max-w-[68ch] first:mt-0"
              >
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{block.title}</Alert.Title>
                  <Alert.Description>{block.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export default async function StaffTrainingCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  const { courseId } = await params;
  const { lesson: requestedLessonId } = await searchParams;

  let detail;
  try {
    detail = await getTrainingCourseDetail(
      session,
      courseId,
      requestedLessonId,
    );
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "FORBIDDEN") redirect("/staff/onboarding");
      if (error.code === "NOT_FOUND") notFound();
    }
    throw error;
  }

  const courseHref = `/staff/training/${detail.courseId}`;
  const lessonIndex = detail.lessons.findIndex(
    (state) => state.lessonId === detail.lesson.lessonId,
  );
  const isReviewingCompleted =
    detail.lesson.state === "COMPLETED" && !detail.lesson.canComplete;

  return (
    <>
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Staff Training
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {detail.title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted-foreground">
          {detail.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {detail.required && (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
              {TRAINING_REQUIRED_LABEL}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Version {detail.version}
          </span>
          <p className="text-sm font-semibold text-foreground">
            <span className="tabular-nums">{detail.completedLessons}</span> of{" "}
            <span className="tabular-nums">{detail.totalLessons}</span> lessons
            completed
            <span className="sr-only">
              {" "}
              — course{" "}
              {detail.state === "COMPLETED"
                ? `completed${detail.completedAt ? ` on ${format(new Date(detail.completedAt), "d MMMM yyyy")}` : ""}`
                : detail.state === "IN_PROGRESS"
                  ? "in progress"
                  : "not started"}
              .
            </span>
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {detail.nonBlockingNotice}
        </p>
        {detail.state === "COMPLETED" && (
          <p className="mt-2 text-sm font-semibold text-foreground">
            Course completed
            {detail.completedAt
              ? ` on ${format(new Date(detail.completedAt), "d MMMM yyyy")}`
              : ""}
            . Every lesson remains available for review.
            <span className="sr-only"> — training completed.</span>
          </p>
        )}
      </div>

      {detail.lockedNotice && (
        <p
          role="status"
          className="mt-6 max-w-2xl rounded-lg border border-border bg-surface px-5 py-4 text-sm text-foreground"
        >
          {detail.lockedNotice}
        </p>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        {/* Lesson content (mobile: first; md+: left column) */}
        <section aria-label="Lesson content" className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Lesson{" "}
            <span className="tabular-nums">{lessonIndex + 1}</span> of{" "}
            <span className="tabular-nums">{detail.totalLessons}</span>
            {isReviewingCompleted && " · Reviewed — read only"}
          </p>
          <h2
            id="training-lesson-heading"
            tabIndex={-1}
            className="mt-1 scroll-mt-20 text-xl font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {detail.lesson.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            <span className="sr-only">Lesson status: </span>
            {TRAINING_LESSON_STATE_LABELS[detail.lesson.state]}
          </p>

          <div className="mt-6">
            <TrainingBlocks blocks={detail.lesson.blocks} />
          </div>

          {detail.lesson.relatedLinks.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3 border-t border-divider pt-6">
              {detail.lesson.relatedLinks.map((link) => (
                <ButtonLink
                  key={link.href}
                  href={link.href}
                  variant="outline"
                  size="sm"
                >
                  {link.label}
                </ButtonLink>
              ))}
            </div>
          )}

          {detail.lesson.canComplete ? (
            <LessonCompleteAction
              courseId={detail.courseId}
              lessonId={detail.lesson.lessonId}
              isFinalLesson={detail.lesson.isFinalLesson}
            />
          ) : detail.state === "COMPLETED" ? (
            <div className="mt-8 border-t border-divider pt-6">
              <p className="text-sm text-muted-foreground">
                You have completed this course — all lessons remain open for
                review. No action is needed.
              </p>
              <div className="mt-4">
                <ButtonLink href="/staff/training" variant="outline" size="sm">
                  Back to Training
                </ButtonLink>
              </div>
            </div>
          ) : isReviewingCompleted ? (
            <div className="mt-8 border-t border-divider pt-6">
              <ButtonLink href={courseHref} variant="outline">
                Return to your current lesson
              </ButtonLink>
            </div>
          ) : null}
        </section>

        {/* Progress rail (mobile: below; md+: right column, functional) */}
        <aside
          aria-label="Course progress"
          className="md:sticky md:top-8 md:self-start"
        >
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Course progress
            </h2>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {detail.completedLessons} of {detail.totalLessons} lessons
              completed
            </p>

            <ol className="mt-4 space-y-1">
              {detail.lessons.map((state, index) => {
                const isCurrent = state.state === "CURRENT";
                const isOpen = state.state !== "LOCKED";
                const href = `${courseHref}?lesson=${state.lessonId}`;
                return (
                  <li
                    key={state.lessonId}
                    aria-current={isCurrent ? "step" : undefined}
                    className={
                      isCurrent ? "rounded-md bg-surface px-3 py-2" : "px-3 py-2"
                    }
                  >
                    {isOpen ? (
                      <Link
                        href={href}
                        className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span
                            className={`text-sm font-semibold ${isCurrent ? "text-foreground" : "text-muted-foreground group-hover:text-foreground group-focus-visible:text-foreground"}`}
                          >
                            <span className="tabular-nums">{index + 1}.</span>{" "}
                            {state.title}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {TRAINING_LESSON_STATE_LABELS[state.state]}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <span className="block">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-muted-foreground">
                            <span className="tabular-nums">{index + 1}.</span>{" "}
                            {state.title}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {TRAINING_LESSON_STATE_LABELS[state.state]}
                          </span>
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 border-t border-divider pt-5">
              <ButtonLink href="/staff/training" variant="ghost" size="sm">
                Back to Training
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
