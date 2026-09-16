"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiClientError, apiFetch } from "@/lib/api/client";

/**
 * "Mark Lesson Complete & Continue" — the ONE training write action
 * (Stage 9, brief §27).
 *
 * POSTs EXACTLY one field ({ lessonId }) — no staffId, no enrollmentId,
 * no completedAt, no courseVersion, no progress percentage ever leaves
 * the browser; the server derives all other state from the session.
 *
 * On success the server component tree is refreshed (router.refresh) so
 * the next current lesson (or the completed state) is re-rendered from
 * real persisted data, and focus moves to the new lesson heading — a
 * sensible, announced landing point after completion (brief §42).
 *
 * A duplicate completion (idempotent success) is treated the same way:
 * refresh + focus, with an honest "already completed" note when the
 * server reports it.
 */
export function LessonCompleteAction({
  courseId,
  lessonId,
  isFinalLesson,
}: {
  courseId: string;
  lessonId: string;
  isFinalLesson: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyNote, setAlreadyNote] = useState(false);
  const completionRequested = useRef(false);

  const handleComplete = useCallback(async () => {
    if (pending || completionRequested.current) return;
    completionRequested.current = true;
    setPending(true);
    setError(null);

    try {
      const data = await apiFetch<{
        alreadyCompleted: boolean;
        courseJustCompleted: boolean;
      }>(`/api/staff/training/${courseId}/lessons`, {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });

      if (data.alreadyCompleted) {
        setAlreadyNote(true);
      }

      // Re-render from the server's persisted state, then move focus to
      // the freshly rendered lesson heading.
      router.refresh();
      requestAnimationFrame(() => {
        const heading = document.getElementById("training-lesson-heading");
        if (heading) {
          heading.focus({ preventScroll: false });
        }
      });
    } catch (error) {
      setError(
        error instanceof ApiClientError && error.message
          ? error.message
          : "We couldn't record that lesson. Please try again.",
      );
    } finally {
      completionRequested.current = false;
      setPending(false);
    }
  }, [courseId, lessonId, pending, router]);

  return (
    <div className="mt-8 border-t border-divider pt-6">
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {alreadyNote && !error && (
        <p className="mb-3 text-sm text-muted-foreground">
          This lesson was already completed — no change was made.
        </p>
      )}
      <button
        type="button"
        onClick={handleComplete}
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : isFinalLesson
            ? "Mark lesson complete & finish course"
            : "Mark lesson complete & continue"}
        <span className="sr-only">
          {isFinalLesson
            ? " — completes the final lesson and the course"
            : ` — completes ${lessonId} and opens the next lesson`}
        </span>
      </button>
      <p className="mt-2 text-sm text-muted-foreground">
        {isFinalLesson
          ? "Completing this final lesson completes the course."
          : "Lessons stay available to review after you complete them."}
      </p>
    </div>
  );
}
