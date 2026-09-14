import type { Metadata } from "next";
import { format } from "date-fns";

import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { ButtonLink } from "@/components/ui/button-link";
import { CANDIDATE_STATUS_DETAILS } from "@/config/recruitment";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getRecruitmentJourney } from "@/server/services/journey";

export const metadata: Metadata = {
  title: "Your application",
  description:
    "Your FinFam recruitment journey: where your application stands and what to do next.",
};

/**
 * The unified recruitment journey — the ONE screen a candidate returns to.
 *
 * Entered via "Continue Application" (or straight after applying), it
 * answers in order: whose application this is, where it currently stands,
 * the ONE next action, which stages are completed, and which are locked.
 *
 * Everything on this page is decided by the server from persisted state —
 * the candidate never chooses their stage. Completed stages are records,
 * not re-enterable workflows, and future stages render as locked.
 */
export default async function ApplicationJourneyPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let journey;
  try {
    journey = await getRecruitmentJourney(normalizeReferenceNumber(reference));
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return (
        <PageShell size="narrow">
          <JourneyNotFoundPanel message={error.message} />
        </PageShell>
      );
    }
    throw error;
  }

  const statusDefinition = CANDIDATE_STATUS_DETAILS[journey.status];
  const currentStageLabel = journey.currentStage
    ? (journey.stages.find((stage) => stage.id === journey.currentStage)?.label ??
      journey.currentStage)
    : null;
  const stageStates = Object.fromEntries(
    journey.stages.map((stage) => [stage.id, stage.state]),
  );
  const firstName = journey.fullName.trim().split(/\s+/)[0];

  return (
    <PageShell size="wide">
      {/* Who this application belongs to */}
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Here is where your {journey.roleTitle} application stands. Keep your
          reference number safe — you&apos;ll use it every time you return.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Application reference{" "}
          <span className="font-mono font-semibold tracking-widest text-foreground">
            {journey.referenceNumber}
          </span>{" "}
          · applied {format(new Date(journey.submittedAt), "d MMMM yyyy")}
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        {/* ----------------------------------------------------------- */}
        {/* Current stage: one stage, one obvious next action            */}
        {/* ----------------------------------------------------------- */}
        <section aria-labelledby="current-stage" className="order-1 min-w-0">
          <h2
            id="current-stage"
            className="text-sm text-muted-foreground"
          >
            Your application is currently at
          </h2>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {currentStageLabel ?? "Complete"}
          </p>

          <div className="mt-5 max-w-xl rounded-lg border border-border bg-surface p-5 sm:p-6">
            {journey.nextAction ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Your next step
                </p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {statusDefinition.nextStep}
                </p>
                {journey.currentStageDetail && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    So far: {journey.currentStageDetail}.
                  </p>
                )}
                <div className="mt-5">
                  <ButtonLink href={journey.nextAction.href}>
                    {journey.nextAction.label}
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  What happens next
                </p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {journey.upcomingNote ?? statusDefinition.nextStep}
                </p>
              </>
            )}
          </div>

          {/* The submitted assessment stays available as a record — but the
              stage itself is closed; no re-entry, no restart. */}
          {journey.assessmentResult && (
            <div className="mt-6 flex max-w-xl flex-wrap items-center justify-between gap-4 border-t border-divider pt-5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Assessment result
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {journey.assessmentResult.passed ? "Passed" : "Not passed"} —{" "}
                  {journey.assessmentResult.marksAwarded} of{" "}
                  {journey.assessmentResult.totalMarks} marks
                </p>
              </div>
              <ButtonLink
                href={`/assessment/${journey.referenceNumber}`}
                variant="outline"
                size="sm"
              >
                View result
              </ButtonLink>
            </div>
          )}
        </section>

        {/* ----------------------------------------------------------- */}
        {/* Journey progress — informational, never navigation           */}
        {/* ----------------------------------------------------------- */}
        <aside
          aria-label="Your recruitment journey"
          className="order-2 self-start md:sticky md:top-8"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Your journey
          </h2>
          <RecruitmentProgress
            currentStage={journey.currentStage}
            states={stageStates}
            showDescriptions={false}
            className="mt-4"
          />
        </aside>
      </div>

      {/* Updates — append-only StageEvent history */}
      {journey.events.length > 0 && (
        <section aria-label="Updates" className="mt-12 max-w-2xl">
          <h2 className="text-base font-semibold text-foreground">Updates</h2>
          <ul className="mt-1 list-none p-0">
            {journey.events.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-4 border-b border-divider py-3 last:border-b-0 last:pb-0"
              >
                <span className="text-sm text-foreground">
                  {event.description ?? event.type}
                </span>
                <time
                  dateTime={event.occurredAt}
                  className="shrink-0 text-sm text-muted-foreground"
                >
                  {format(new Date(event.occurredAt), "d MMM yyyy, HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
