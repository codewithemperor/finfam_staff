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
  // Current-stage label: for a status sitting INSIDE the activation stage
  // (ACTIVATION_PENDING) the journey says so explicitly; a finished journey
  // (currentStage null — only APPROVED_STAFF) shows the status label
  // ("Approved staff") instead of a generic "Complete".
  const currentStageLabel = journey.currentStage
    ? journey.status === "ACTIVATION_PENDING" &&
      journey.currentStage === "ACTIVATION"
      ? "Activation — In progress"
      : (journey.stages.find((stage) => stage.id === journey.currentStage)?.label ??
        journey.currentStage)
    : statusDefinition.label;
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

          {/* The accepted agreement is a record, not a re-enterable stage —
              shown read-only, no link, no way back in. */}
          {journey.agreementRecord && (
            <div className="mt-6 flex max-w-xl flex-wrap items-center justify-between gap-4 border-t border-divider pt-5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Responsibility &amp; Reward Agreement
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Accepted — version {journey.agreementRecord.version} ·{" "}
                  {format(new Date(journey.agreementRecord.acceptedAt), "d MMM yyyy")}
                </p>
              </div>
            </div>
          )}

          {/* The issued appointment is a record too — but an issued DOCUMENT
              stays reopenable read-only (the one-way-lock exception). Opening
              it again can never re-issue or change the letter. */}
          {journey.appointmentRecord && (
            <div className="mt-6 flex max-w-xl flex-wrap items-center justify-between gap-4 border-t border-divider pt-5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Provisional Appointment
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-mono tracking-wider">
                    {journey.appointmentRecord.appointmentReference}
                  </span>{" "}
                  · issued{" "}
                  {format(new Date(journey.appointmentRecord.issuedAt), "d MMMM yyyy")}
                </p>
              </div>
              <ButtonLink
                href={`/appointment/${journey.referenceNumber}`}
                variant="outline"
                size="sm"
              >
                View letter
              </ButtonLink>
            </div>
          )}

          {/* The staff record — read-only identity facts, no link back into
              the completed activation flow (one-way progression). */}
          {journey.staffRecord && (
            <div className="mt-6 max-w-xl border-t border-divider pt-5">
              <p className="text-sm font-semibold text-foreground">
                FinFam staff record
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Staff ID
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold tracking-wider text-foreground">
                    {journey.staffRecord.staffId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Activated
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">
                    {format(new Date(journey.staffRecord.activatedAt), "d MMMM yyyy")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Designation
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">
                    {journey.staffRecord.roleTitle}
                  </dd>
                </div>
              </dl>
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
