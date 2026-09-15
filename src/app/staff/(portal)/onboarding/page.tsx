import type { Metadata } from "next";
import { format } from "date-fns";

import { OnboardingContinue } from "@/components/onboarding/onboarding-continue";
import { OnboardingDecision } from "@/components/onboarding/onboarding-decision";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { OnboardingStepContent } from "@/components/onboarding/onboarding-step-content";
import { ButtonLink } from "@/components/ui/button-link";
import { ONBOARDING_STEPS } from "@/config/onboarding";
import { getStaffSession } from "@/lib/auth/session";
import { getOnboardingViewForStaff } from "@/server/services/onboarding";

export const metadata: Metadata = {
  title: "Staff Onboarding — FinFam Staff Portal",
  description:
    "Complete your FinFam onboarding and resumption instructions: communication channel, staff verification, resources, operational orientation, assignment and daily accountability.",
};

/**
 * /staff/onboarding — the AUTHENTICATED onboarding & resumption door
 * (Stage 7, brief §18/§22/§28). This is the onboarding-first experience a
 * newly activated Staff member lands in; it renders the SAME Section 7
 * v2.0 content through the SAME service core as the legacy reference door
 * and operates on the SAME StaffOnboarding rows — two doors, one state.
 *
 * - Completed onboarding → a compact READ-ONLY summary (what was completed,
 *   when, which version): the workflow is closed (one-way), the destination
 *   stays honest in the nav.
 * - In progress → the current step (server-derived resume point) with ONE
 *   action: "Continue" or the final acknowledgement + "Complete Onboarding".
 *   Completed steps are re-readable read-only via ?step=<id>.
 * - Opening the page records the lazy onboarding entry — never a step.
 *
 * Layout: mobile single column (heading → Step X of 8 → identity → content
 * → action); tablet/desktop adds the useful rail (identity, progress,
 * portal home link).
 */
export default async function StaffOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step: requestedStepId } = await searchParams;
  const session = await getStaffSession();
  // The layout guarantees a session; defensive fallback keeps TS honest.
  const staffRowId = session?.staff.rowId ?? "";
  const staffId = session?.staff.staffId ?? "";

  const view = await getOnboardingViewForStaff(staffRowId);

  if (view.onboarding?.state === "COMPLETED") {
    const completedAt = view.onboarding.completedAt
      ? format(new Date(view.onboarding.completedAt), "d MMMM yyyy")
      : null;
    return (
              <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Onboarding completed
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            You completed your FinFam onboarding and resumption instructions
            {completedAt ? ` on ${completedAt}` : ""}. You are ready to begin
            your FinFam assignment.
          </p>
          <dl className="mt-8 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Staff ID</dt>
              <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
                {staffId}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">
                Instructions version
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                {view.onboarding.version}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="text-sm font-semibold text-foreground">
                Completed
                <span className="sr-only"> — onboarding closed</span>
              </dd>
            </div>
          </dl>
          <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted-foreground">
            Your acknowledged instructions:{" "}
            <span className="text-foreground">
              {view.content.acknowledgementLabel}
            </span>
          </p>
          <div className="mt-8 border-t border-divider pt-6">
            <ButtonLink href="/staff" variant="outline">
              Go to the Staff Portal home
            </ButtonLink>
          </div>
        </div>
    );
  }

  if (!view.onboarding) {
    // Impossible for a session-resolved Staff row — the core lazily creates
    // the record. Kept for TypeScript honesty.
    return null;
  }

  const completedIds = new Set(view.onboarding.steps.map((step) => step.id));

  const currentStep =
    ONBOARDING_STEPS.find((step) => step.id === view.onboarding?.currentStepId) ??
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
    <>
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Complete Your Staff Onboarding
          </h1>
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Welcome to the FinFam Team. Work through your onboarding and
          resumption instructions — your progress is saved as you go.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          For {view.fullName} ·{" "}
          <span className="font-mono tracking-widest">{staffId}</span>
        </p>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        <section aria-label="Staff onboarding" className="min-w-0">
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

          <section
            aria-labelledby="staff-onboarding-identity-mobile"
            className="mt-4 rounded-lg border border-border bg-surface p-5 md:hidden"
          >
            <h2
              id="staff-onboarding-identity-mobile"
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
                  {staffId}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Designation</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {view.staff?.roleTitle}
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
              id={`staff-onboarding-step-${step.id}`}
              className="scroll-mt-20 mt-1 text-xl font-bold tracking-tight text-foreground"
            >
              {step.title}
            </h2>
            <OnboardingStepContent step={step} view={view} />
          </div>

          {reviewingCompletedStep ? (
            <div className="mt-8 border-t border-divider pt-6">
              <ButtonLink href="/staff/onboarding" variant="outline">
                Return to your current step
              </ButtonLink>
            </div>
          ) : isFinalStep ? (
            <OnboardingDecision
              reference={view.referenceNumber}
              version={view.content.version}
              acknowledgementLabel={view.content.acknowledgementLabel}
              endpoint="/api/staff/onboarding/complete"
              completedHref="/staff"
            />
          ) : (
            <OnboardingContinue
              reference={view.referenceNumber}
              stepId={step.id}
              stepTitle={step.title}
              endpoint="/api/staff/onboarding/steps"
            />
          )}

          <div className="mt-10 md:hidden">
            <ButtonLink href="/staff" variant="ghost" size="sm">
              Back to the Staff Portal home
            </ButtonLink>
          </div>
        </section>

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
                  {staffId}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Designation</dt>
                <dd className="text-right text-sm font-semibold text-foreground">
                  {view.staff?.roleTitle}
                </dd>
              </div>
              {view.staff?.activatedAt && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Activated</dt>
                  <dd className="text-right text-sm font-semibold text-foreground">
                    {format(new Date(view.staff.activatedAt), "d MMMM yyyy")}
                  </dd>
                </div>
              )}
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
                  reviewHrefBase="/staff/onboarding"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <ButtonLink href="/staff" variant="ghost" size="sm">
                Back to the Staff Portal home
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
