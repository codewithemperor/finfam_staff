import { format } from "date-fns";

import { CompleteOrientationButton } from "@/components/orientation/complete-orientation-button";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { ButtonLink } from "@/components/ui/button-link";
import {
  CANDIDATE_STATUS_DETAILS,
  getStageStates,
} from "@/config/recruitment";
import type { OrientationSectionView } from "@/lib/orientation";
import { cn } from "@/lib/utils";
import type { OrientationView } from "@/types/recruitment";

interface OrientationProgressCardProps {
  view: OrientationView;
  /** Per-section views — used to name the resume section. */
  sections: OrientationSectionView[];
  completedCount: number;
  totalCount: number;
  allSectionsRead: boolean;
  isComplete: boolean;
  className?: string;
}

/**
 * The orientation rail: saved progress, the one obvious next action, and
 * the candidate's place in the overall recruitment journey
 * (RecruitmentProgress stays the single source of truth for the journey).
 */
export function OrientationProgressCard({
  view,
  sections,
  completedCount,
  totalCount,
  allSectionsRead,
  isComplete,
  className,
}: OrientationProgressCardProps) {
  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];
  const completedAt = view.orientation?.completedAt ?? null;
  const resume = sections.find((section) => section.state === "current");

  return (
    <div className={cn("rounded-lg border border-border p-5", className)}>
      <h2 className="text-sm font-semibold text-foreground">Your progress</h2>

      <p className="mt-2 text-lg font-bold text-foreground">
        {completedCount} of {totalCount} sections read
      </p>

      {/* Plain, accessible progress bar — the fraction is also written out
          above, so colour is never the only signal. */}
      <div
        role="progressbar"
        aria-label="Orientation sections read"
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-valuenow={completedCount}
        aria-valuetext={`${completedCount} of ${totalCount} sections`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-divider"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="mt-5">
        {isComplete ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
              </span>
              Orientation completed
            </p>
            {completedAt && (
              <p className="text-sm text-muted-foreground">
                Completed on {format(new Date(completedAt), "d MMMM yyyy")}
              </p>
            )}
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {statusDefinition.nextStep}
            </p>
          </div>
        ) : allSectionsRead ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Every section has been read. Confirm below to finish the
              workshop.
            </p>
            <CompleteOrientationButton reference={view.referenceNumber} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {resume
                ? `Next up: ${resume.title}`
                : "Continue where you stopped."}
            </p>
            <ButtonLink href={resume?.href ?? "#"} fullWidth>
              {completedCount === 0 ? "Start orientation" : "Continue orientation"}
            </ButtonLink>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-divider pt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Recruitment journey
        </h3>
        <RecruitmentProgress
          currentStage={statusDefinition.stage}
          states={getStageStates(view.status)}
          showDescriptions={false}
          className="mt-4"
        />
      </div>
    </div>
  );
}
