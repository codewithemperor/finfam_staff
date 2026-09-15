import Link from "next/link";

import type { OnboardingCompletedStep } from "@/types/recruitment";

/**
 * Restrained onboarding progress — an ordered step list plus the compact
 * "Step X of 7" counter. States are communicated by text (never colour
 * alone) and the current step carries aria-current="step".
 *
 * Completed steps may be RE-READ read-only via ?step=<id> links; the
 * current step is plain text; future steps are rendered as muted text and
 * are never links — the rail is not unrestricted stage navigation, and
 * navigation never changes persisted completion state.
 */
export function OnboardingProgress({
  steps,
  completedSteps,
  currentStepId,
  reference,
}: {
  /** Config step summaries in order (id + title only are needed here). */
  steps: { id: string; title: string }[];
  completedSteps: OnboardingCompletedStep[];
  currentStepId: string | null;
  reference: string;
}) {
  const completedIds = new Set(completedSteps.map((step) => step.id));
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  const reviewedCount = completedIds.size;

  return (
    <nav aria-label="Onboarding progress">
      <p className="text-sm font-semibold text-foreground">
        Step{" "}
        <span className="tabular-nums">
          {currentIndex + 1 > 0 ? currentIndex + 1 : reviewedCount || 1}
        </span>{" "}
        of{" "}
        <span className="tabular-nums">{steps.length}</span>
        <span className="sr-only">
          {" "}
          — {reviewedCount} of {steps.length} steps reviewed
        </span>
      </p>

      <ol className="mt-3 list-none space-y-1 p-0">
        {steps.map((step, index) => {
          const isCompleted = completedIds.has(step.id);
          const isCurrent = step.id === currentStepId;
          const isFuture = !isCompleted && !isCurrent;

          const stateText = isCompleted
            ? "Completed"
            : isCurrent
              ? "Current step"
              : "Not yet started";

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-baseline gap-2.5 text-sm"
            >
              <span
                aria-hidden
                className={`w-5 shrink-0 text-right font-mono text-xs tabular-nums ${
                  isFuture ? "text-muted-foreground/60" : "text-muted-foreground"
                }`}
              >
                {isCompleted ? "✓" : index + 1}
              </span>
              {isCompleted ? (
                <Link
                  href={`/onboarding/${reference}?step=${step.id}`}
                  className="rounded font-normal text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="sr-only">{stateText}: </span>
                  {step.title}
                </Link>
              ) : (
                <span
                  className={
                    isFuture
                      ? "text-muted-foreground"
                      : "font-semibold text-foreground"
                  }
                >
                  <span className="sr-only">{stateText}: </span>
                  {step.title}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
