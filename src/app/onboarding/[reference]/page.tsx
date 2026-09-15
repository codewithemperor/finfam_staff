import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { OnboardingContinue } from "@/components/onboarding/onboarding-continue";
import { OnboardingDecision } from "@/components/onboarding/onboarding-decision";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Alert } from "@heroui/react";
import { CANDIDATE_STATUS_DETAILS, getStageStates } from "@/config/recruitment";
import { ONBOARDING_STEPS } from "@/config/onboarding";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getOnboardingView } from "@/server/services/onboarding";
import type { OnboardingBlock } from "@/types/recruitment";

export const metadata: Metadata = {
  title: "Staff Onboarding",
  description:
    "Complete your FinFam staff onboarding: communication instructions, staff resources, reporting expectations and first-work guidance.",
};

/**
 * Renders onboarding content blocks as plain, readable typography — the
 * same document philosophy as the activation screen: whitespace, not
 * nested cards.
 */
function OnboardingStepBlocks({ blocks }: { blocks: OnboardingBlock[] }) {
  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={index}
                className="mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul
                key={index}
                className="mt-4 max-w-[68ch] list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "alert":
            return (
              <Alert
                key={index}
                status={block.tone}
                className="mt-4 max-w-[68ch] first:mt-0"
              >
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{block.title}</Alert.Title>
                  <Alert.Description>{block.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/**
 * Staff Onboarding — the home of stage 6, the FINAL stage of the FinFam
 * recruitment/onboarding MVP: the staff-side operational briefing that
 * turns Approved Staff into operationally onboarded staff. Everything is
 * decided by the server from persisted state.
 *
 * - Unknown reference → the established neutral not-found panel.
 * - Not eligible (any pre-APPROVED_STAFF stage, or no Staff record) →
 *   redirected to the unified journey, the authoritative view.
 * - Completed onboarding → redirected to the unified journey too: the
 *   workflow is closed (one-way), and the journey shows the terminal
 *   staff state. No read-only archive page exists in this MVP.
 * - Eligible → the current step (the server-derived resume point) with ONE
 *   action: "Continue" (steps 1–6) or the final acknowledgement + "Complete
 *   Onboarding" (step 7). Already-completed steps may be RE-READ read-only
 *   via ?step=<id>; future steps are never rendered. Opening the page
 *   records the lazy onboarding entry — it never completes anything.
 *
 * Layout: mobile is a single-column flow (heading → Step X of 7 → staff
 * identity → current content → action → back); tablet/desktop recomposes
 * into the current step plus a useful secondary rail (staff identity,
 * onboarding step list with states, six-stage recruitment progress, back).
 */
export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { reference } = await params;
  const { step: requestedStepId } = await searchParams;

  let view;
  try {
    view = await getOnboardingView(normalizeReferenceNumber(reference));
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

  // Server-enforced stage lock (mirrors the service rule): a direct visit
  // from any earlier stage — or after completion — never renders the
  // workflow. Stale links are pointed at the authoritative journey.
  if (!view.eligible || !view.staff || !view.onboarding) {
    redirect(`/application/${view.referenceNumber}`);
  }

  if (view.onboarding.state === "COMPLETED") {
    redirect(`/application/${view.referenceNumber}`);
  }

  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];
  const completedIds = new Set(
    view.onboarding.steps.map((step) => step.id),
  );

  // Which step renders? The resume point by default; a ?step=<id> may
  // re-open an already-completed step READ-ONLY (navigation never changes
  // persisted state). Future or unknown steps are ignored — the resume
  // point renders instead; locked content is never exposed.
  const currentStep =
    ONBOARDING_STEPS.find((step) => step.id === view.onboarding!.currentStepId) ??
    ONBOARDING_STEPS[0];
  const requestedStep = requestedStepId
    ? ONBOARDING_STEPS.find((step) => step.id === requestedStepId)
    : undefined;
  const reviewingCompletedStep =
    requestedStep &&
    requestedStep.id !== currentStep.id &&
    completedIds.has(requestedStep.id)
      ? requestedStep
      : null;
  const step = reviewingCompletedStep ?? currentStep;
  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step.id);
  const isFinalStep = !reviewingCompletedStep && step.id === "ready";

  return (
    <PageShell size="default">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff Onboarding
          </h1>
          <StatusBadge status={view.status} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Complete your onboarding to review your communication instructions,
          staff resources, reporting expectations and first-work guidance.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          For {view.fullName} ·{" "}
          <span className="font-mono tracking-widest">
            {view.referenceNumber}
          </span>
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        {/* ------------------------------------------------------- */}
        {/* Mobile progress + identity, the step, then the one action */}
        {/* ------------------------------------------------------- */}
        <section aria-label="Staff onboarding" className="min-w-0">
          {/* Mobile: compact progress counter (§33 position 2). The full
              step list lives in the desktop rail. */}
          <p className="text-sm font-semibold text-foreground md:hidden">
            Step{" "}
            <span className="tabular-nums">{stepIndex + 1}</span> of{" "}
            <span className="tabular-nums">{ONBOARDING_STEPS.length}</span>
            <span className="sr-only">
              {" "}
              — {view.onboarding.steps.length} of {ONBOARDING_STEPS.length}{" "}
              steps reviewed
            </span>
          </p>

          {/* Mobile: staff identity summary (§33 position 3). The desktop
              identity facts live in the rail. */}
          <section
            aria-labelledby="onboarding-identity-mobile"
            className="mt-4 rounded-lg border border-border bg-surface p-5 md:hidden"
          >
            <h2
              id="onboarding-identity-mobile"
              className="text-sm font-semibold text-foreground"
            >
              Your staff identity
            </h2>
            <dl className="mt-3 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Staff name</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {view.fullName}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Staff ID</dt>
                <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.staff.staffId}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Designation</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {view.staff.roleTitle}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="text-right font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.staff.appointmentReference}
                </dd>
              </div>
            </dl>
          </section>

          <div className="mt-8 md:mt-10">
            {reviewingCompletedStep && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Reviewed — read only
              </p>
            )}
            {!reviewingCompletedStep && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
              </p>
            )}
            <h2
              id={`onboarding-step-${step.id}`}
              className="scroll-mt-20 mt-1 text-xl font-bold tracking-tight text-foreground"
            >
              {step.title}
            </h2>
            <OnboardingStepBlocks blocks={step.blocks} />
          </div>

          {reviewingCompletedStep ? (
            <div className="mt-8 border-t border-divider pt-6">
              <ButtonLink
                href={`/onboarding/${view.referenceNumber}`}
                variant="outline"
              >
                Return to your current step
              </ButtonLink>
            </div>
          ) : isFinalStep ? (
            <OnboardingDecision
              reference={view.referenceNumber}
              version={view.content.version}
              acknowledgementLabel={view.content.acknowledgementLabel}
            />
          ) : (
            <OnboardingContinue
              reference={view.referenceNumber}
              stepId={step.id}
              stepTitle={step.title}
            />
          )}

          {/* Mobile: back link (§33 position 6). Desktop keeps it in the
              rail. */}
          <div className="mt-10 md:hidden">
            <ButtonLink
              href={`/application/${view.referenceNumber}`}
              variant="ghost"
              size="sm"
            >
              Back to your application
            </ButtonLink>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* Secondary rail: useful information only (desktop)         */}
        {/* ------------------------------------------------------- */}
        <aside
          aria-label="About this step"
          className="hidden self-start md:sticky md:top-8 md:block"
        >
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Your staff identity
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Staff ID</dt>
                <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.staff.staffId}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Designation</dt>
                <dd className="text-right text-sm font-semibold text-foreground">
                  {view.staff.roleTitle}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Activated</dt>
                <dd className="text-right text-sm font-semibold text-foreground">
                  {format(new Date(view.staff.activatedAt), "d MMMM yyyy")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="text-right font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.staff.appointmentReference}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-divider pt-5">
              <h2 className="text-sm font-semibold text-foreground">
                Onboarding progress
              </h2>
              <div className="mt-4">
                <OnboardingProgress
                  steps={ONBOARDING_STEPS}
                  completedSteps={view.onboarding.steps}
                  currentStepId={view.onboarding.currentStepId}
                  reference={view.referenceNumber}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <h2 className="text-sm font-semibold text-foreground">
                Recruitment journey
              </h2>
              <RecruitmentProgress
                currentStage={statusDefinition.stage}
                states={getStageStates(view.status)}
                showDescriptions={false}
                className="mt-4"
              />
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <ButtonLink
                href={`/application/${view.referenceNumber}`}
                variant="ghost"
                size="sm"
              >
                Back to your application
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
