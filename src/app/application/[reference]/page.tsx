import type { Metadata } from "next";
import { format } from "date-fns";
import { Accordion } from "@heroui/react";
import { CheckCircle2, ChevronDown } from "lucide-react";

import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import { RecruitmentProgress } from "@/components/recruitment/recruitment-progress";
import { OnboardingJourneyCard } from "@/components/onboarding/onboarding-journey-card";
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
      : (journey.stages.find((stage) => stage.id === journey.currentStage)
          ?.label ?? journey.currentStage)
    : statusDefinition.label;
  const stageStates = Object.fromEntries(
    journey.stages.map((stage) => [stage.id, stage.state]),
  );
  const firstName = journey.fullName.trim().split(/\s+/)[0];
  const onboardingCompleted = journey.onboarding?.state === "COMPLETED";

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
          {onboardingCompleted ? (
            <div
              role="status"
              className="max-w-xl border border-primary/30 bg-primary/5 p-6 sm:p-7"
            >
              <div className="flex items-start gap-4">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-7 shrink-0 text-primary"
                />
                <div>
                  <h2
                    id="current-stage"
                    className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
                  >
                    You are now a FinFam staff member
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Your recruitment application is complete. Check your email
                    for the Staff Portal access message, then use your
                    registered email to request a secure login code.
                  </p>
                  <div className="mt-5">
                    <ButtonLink href="/staff/login">
                      Open Staff Portal
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 id="current-stage" className="text-sm text-muted-foreground">
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
            </>
          )}

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
                  {format(
                    new Date(journey.agreementRecord.acceptedAt),
                    "d MMM yyyy",
                  )}
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
                  {format(
                    new Date(journey.appointmentRecord.issuedAt),
                    "d MMMM yyyy",
                  )}
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

          {/* Updates are one expandable history section. Each event remains
              visible in the body without turning the individual logs into
              separate navigation controls. */}
          {journey.events.length > 0 && (
            <section
              aria-label="Updates"
              className="mt-6 max-w-xl border-t border-divider pt-1"
            >
              <Accordion className="w-full" hideSeparator>
                <Accordion.Item id="updates" className="shadow-none">
                  <Accordion.Heading>
                    <Accordion.Trigger className="bg-transparent px-0 py-4 text-left shadow-none hover:bg-transparent">
                      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                        Updates
                      </span>
                      <Accordion.Indicator>
                        <ChevronDown aria-hidden="true" className="size-4" />
                      </Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="px-0 pb-4 pt-0 text-sm text-muted-foreground">
                      <ul className="divide-y divide-divider">
                        {journey.events.map((event) => (
                          <li
                            key={event.id}
                            className="py-3 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <p className="text-sm text-foreground">
                                {event.description ?? event.type}
                              </p>
                              <time
                                dateTime={event.occurredAt}
                                className="shrink-0 text-sm text-muted-foreground"
                              >
                                {format(
                                  new Date(event.occurredAt),
                                  "d MMM yyyy, HH:mm",
                                )}
                              </time>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Stage: {event.stage}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </section>
          )}

          {/* The staff record — read-only identity facts, no link back into
              the completed activation flow (one-way progression). */}
          {journey.staffRecord && (
            <div className="mt-6 max-w-xl border-t border-divider pt-5 md:hidden">
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
                    {format(
                      new Date(journey.staffRecord.activatedAt),
                      "d MMMM yyyy",
                    )}
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

          {/* Staff Onboarding — a SEPARATE staff-side process beneath the
              completed recruitment, never a seventh recruitment stage. The
              CTA belongs to this card, not to the recruitment next-action
              frame (deriveNextAction stays null for APPROVED_STAFF). */}
          {journey.onboarding && (
            <div className="md:hidden">
              <OnboardingJourneyCard
                reference={journey.referenceNumber}
                onboarding={journey.onboarding}
                headingId="staff-onboarding-heading-mobile"
              />
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
          {journey.staffRecord && (
            <section className="border-b border-divider pb-6">
              <h2 className="text-sm font-semibold text-foreground">
                FinFam staff record
              </h2>
              <dl className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Staff ID</dt>
                  <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
                    {journey.staffRecord.staffId}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Activated</dt>
                  <dd className="text-right text-sm font-semibold text-foreground">
                    {format(
                      new Date(journey.staffRecord.activatedAt),
                      "d MMMM yyyy",
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Designation</dt>
                  <dd className="text-right text-sm font-semibold text-foreground">
                    {journey.staffRecord.roleTitle}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {journey.onboarding && (
            <OnboardingJourneyCard
              reference={journey.referenceNumber}
              onboarding={journey.onboarding}
              className="mt-6 max-w-none"
              headingId="staff-onboarding-heading-rail"
            />
          )}

          <section className="border-t border-divider pt-6">
            <h2 className="text-sm font-semibold text-foreground">
              Your journey
            </h2>
            <RecruitmentProgress
              currentStage={journey.currentStage}
              states={stageStates}
              showDescriptions={false}
              className="mt-4"
            />
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
