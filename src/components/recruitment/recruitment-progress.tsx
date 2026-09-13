import { Check } from "lucide-react";

import {
  RECRUITMENT_STAGES,
  type StageDefinition,
} from "@/config/recruitment";
import { cn } from "@/lib/utils";
import type { StageState } from "@/types/recruitment";

interface RecruitmentProgressProps {
  /**
   * The candidate's current stage, or null to show every stage as upcoming
   * (e.g. on the landing page where the journey has not started yet).
   */
  currentStage: string | null;
  /** Optional custom stage list (defaults to the full journey). */
  stages?: StageDefinition[];
  /** Show the one-line description under each stage label. */
  showDescriptions?: boolean;
  className?: string;
}

const stateStyles: Record<StageState, { circle: string; label: string }> = {
  completed: {
    circle: "border-primary bg-primary text-primary-foreground",
    label: "text-foreground",
  },
  current: {
    circle: "border-2 border-primary bg-accent/10 text-primary",
    label: "font-semibold text-foreground",
  },
  upcoming: {
    circle: "border-border bg-background text-muted-foreground",
    label: "text-muted-foreground",
  },
};

const stateReaderText: Record<StageState, string> = {
  completed: "Completed",
  current: "Current stage",
  upcoming: "Upcoming",
};

/**
 * Vertical recruitment journey stepper.
 *
 * Clearly communicates completed / current / upcoming stages without visual
 * noise. Rendered as an ordered list so screen readers read the journey in
 * order; the current stage is marked with aria-current="step".
 */
export function RecruitmentProgress({
  currentStage,
  stages = RECRUITMENT_STAGES,
  showDescriptions = true,
  className,
}: RecruitmentProgressProps) {
  const currentIndex = currentStage
    ? stages.findIndex((stage) => stage.id === currentStage)
    : -1;

  return (
    <ol className={cn("m-0 flex list-none flex-col p-0", className)}>
      {stages.map((stage, index) => {
        const state: StageState =
          currentStage === null
            ? "upcoming"
            : index < currentIndex
              ? "completed"
              : index === currentIndex
                ? "current"
                : "upcoming";
        const styles = stateStyles[state];
        const isLast = index === stages.length - 1;

        return (
          <li
            key={stage.id}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex gap-4 pb-7 last:pb-0"
          >
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-px",
                  state === "completed" ? "bg-primary" : "bg-divider",
                )}
              />
            )}

            <span
              aria-hidden
              className={cn(
                "z-10 grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                styles.circle,
              )}
            >
              {state === "completed" ? <Check className="size-4" /> : index + 1}
            </span>

            <div className="min-w-0 pt-1">
              <p className={cn("text-sm leading-6", styles.label)}>
                {stage.label}
                <span className="sr-only"> — {stateReaderText[state]}</span>
              </p>
              {showDescriptions && (
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {stage.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
