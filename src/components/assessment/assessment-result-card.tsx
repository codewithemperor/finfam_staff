import { format } from "date-fns";

import { cn } from "@/lib/utils";
import type { AssessmentResultState } from "@/types/recruitment";

/**
 * The persisted result of a submitted attempt, rendered plainly: outcome,
 * score out of total marks, percentage, and when it was recorded. No score
 * circles, no celebration graphics — the numbers and the words carry it.
 */
export function AssessmentResultCard({
  result,
  className,
}: {
  result: AssessmentResultState;
  className?: string;
}) {
  return (
    <section
      aria-label="Assessment result"
      className={cn("rounded-lg border border-border p-5 sm:p-6", className)}
    >
      <p className="text-sm text-muted-foreground">Assessment result</p>

      <p
        className={cn(
          "mt-2 text-xl font-bold tracking-tight",
          result.passed ? "text-primary" : "text-foreground",
        )}
      >
        {result.passed ? "Passed" : "Not passed"}
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {result.marksAwarded}
            <span className="text-lg font-semibold text-muted-foreground">
              {" "}
              / {result.totalMarks}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.correctCount} of 30 questions correct
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Percentage</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {Math.round(result.percentage)}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pass mark: 70%
          </p>
        </div>
      </div>

      <p className="mt-6 border-t border-divider pt-4 text-sm text-muted-foreground">
        Recorded on {format(new Date(result.submittedAt), "d MMMM yyyy")} ·
        Attempt {result.attemptNumber}
      </p>
    </section>
  );
}
