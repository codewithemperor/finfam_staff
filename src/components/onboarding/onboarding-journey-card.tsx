import { format } from "date-fns";

import { ButtonLink } from "@/components/ui/button-link";
import type { JourneyOnboardingSummary } from "@/types/recruitment";

/**
 * The "Staff Onboarding" section on the unified journey — a SEPARATE
 * staff-side process beneath the completed recruitment block, never a
 * seventh recruitment stage.
 *
 * The CTA belongs to this card alone: `deriveNextAction` stays null for
 * APPROVED_STAFF, so the recruitment frame keeps its "recruitment is
 * complete" semantics while onboarding carries its own honest action.
 *
 * - NOT_STARTED: "Start Onboarding"
 * - IN_PROGRESS: "In progress — X of 7 steps reviewed" + "Continue Onboarding"
 * - COMPLETED:   "Completed" + date + the terminal line. No CTA, no next
 *   stage, no fake Staff Portal link.
 */
export function OnboardingJourneyCard({
  reference,
  onboarding,
}: {
  reference: string;
  onboarding: JourneyOnboardingSummary;
}) {
  const isCompleted = onboarding.state === "COMPLETED";

  const statusLine =
    onboarding.state === "COMPLETED"
      ? "Completed"
      : onboarding.state === "IN_PROGRESS"
        ? "In progress"
        : "Not started";

  const progressLine =
    onboarding.state === "COMPLETED"
      ? `Completed ${format(new Date(onboarding.completedAt ?? ""), "d MMMM yyyy")}`
      : onboarding.state === "IN_PROGRESS"
        ? `${onboarding.completedSteps} of ${onboarding.totalSteps} steps reviewed`
        : "Complete your onboarding to review your communication, staff resources, reporting expectations and first-work instructions.";

  return (
    <section
      aria-labelledby="staff-onboarding-heading"
      className="mt-8 max-w-xl rounded-lg border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="staff-onboarding-heading"
          className="text-base font-bold tracking-tight text-foreground"
        >
          Staff Onboarding
        </h2>
        <p
          className={`text-sm font-semibold ${
            isCompleted ? "text-primary" : "text-foreground"
          }`}
        >
          {statusLine}
        </p>
      </div>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {progressLine}
      </p>

      {isCompleted ? (
        <p className="mt-4 text-sm font-semibold text-foreground">
          You are ready to begin your FinFam assignment.
        </p>
      ) : (
        <div className="mt-5">
          <ButtonLink href={`/onboarding/${reference}`}>
            {onboarding.state === "IN_PROGRESS"
              ? "Continue Onboarding"
              : "Start Onboarding"}
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
