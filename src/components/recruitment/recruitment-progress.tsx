import { Check, Lock } from "lucide-react";

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
  /**
   * Optional explicit per-stage states (e.g. from getStageStates(status))
   * for statuses where the mapped stage is already completed. When omitted,
   * states are derived from currentStage by position, as before.
   */
  states?: Partial<Record<string, StageState>>;
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
  locked: {
    circle: "border-border bg-surface text-muted-foreground",
    label: "text-muted-foreground",
  },
};

const stateReaderText: Record<StageState, string> = {
  completed: "Completed",
  current: "Current stage",
  upcoming: "Upcoming",
  locked: "Locked — complete the current stage first",
};

/**
 * Vertical recruitment journey stepper.
 *
 * Clearly communicates completed / current / upcoming (and, on the unified
 * journey, locked) stages without visual noise. Rendered as an ordered list
 * so screen readers read the journey in order; the current stage is marked
 * with aria-current="step".
 *
 * This is a PROGRESS INDICATOR, not navigation: stages are never rendered
 * as links, so candidates cannot jump backward into completed stages or
 * forward into locked ones.
 */
export function RecruitmentProgress({
  currentStage,
  stages = RECRUITMENT_STAGES,
  showDescriptions = true,
  states,
  className,
}: RecruitmentProgressProps) {
  const currentIndex = currentStage
    ? stages.findIndex((stage) => stage.id === currentStage)
    : -1;

  return (
    <ol className={cn("m-0 flex list-none flex-col p-0", className)}>
      {stages.map((stage, index) => {
        const derivedState: StageState =
          currentStage === null
            ? "upcoming"
            : index < currentIndex
              ? "completed"
              : index === currentIndex
                ? "current"
                : "upcoming";
        const state: StageState = states?.[stage.id] ?? derivedState;
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
              {state === "completed" ? (
                <Check className="size-4" />
              ) : state === "locked" ? (
                <Lock className="size-3.5" />
              ) : (
                index + 1
              )}
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
