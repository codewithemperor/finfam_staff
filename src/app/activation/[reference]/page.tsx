import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { ActivationDecision } from "@/components/activation/activation-decision";
import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Alert } from "@heroui/react";
import { CANDIDATE_STATUS_DETAILS, getStageStates } from "@/config/recruitment";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getActivationView } from "@/server/services/activation";
import type { ActivationBlock } from "@/types/recruitment";

export const metadata: Metadata = {
  title: "Staff Activation",
  description:
    "Activate your FinFam staff profile, receive your Staff ID, and complete your recruitment journey.",
};

/**
 * Renders activation content blocks as plain, readable typography — the
 * same document philosophy as the agreement: whitespace, not nested cards.
 */
function ActivationSectionBlocks({ blocks }: { blocks: ActivationBlock[] }) {
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
                className="mt-6 max-w-[68ch] first:mt-0"
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
 * Staff Activation — the home of stage 5 and the final recruitment step:
 * the formal transition from candidate to staff. One explicit action, and
 * everything else is decided by the server from persisted state.
 *
 * - Unknown reference → the established neutral not-found panel.
 * - Not eligible (earlier stage, declined agreement, or already activated)
 *   → redirected to the unified journey, which is the authoritative view.
 *   After activation the stage is closed (one-way progression); the staff
 *   record lives on the journey, and a direct URL can never re-open the
 *   workflow.
 * - Eligible (APPOINTMENT_ISSUED → lazily entered as ACTIVATION_PENDING on
 *   this open, or ACTIVATION_PENDING re-entry) → the review screen with ONE
 *   explicit action: Activate Staff Profile. Opening NEVER activates —
 *   only the explicit, server-validated action does.
 *
 * Layout: mobile is a single-column flow (title → appointment summary →
 * what activation means → confirmation → action); tablet/desktop
 * recomposes into the activation content plus a useful secondary rail
 * (status, appointment facts, future Staff ID note, journey, back).
 */
export default async function ActivationPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let view;
  try {
    view = await getActivationView(normalizeReferenceNumber(reference));
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

  // Server-enforced one-way stage lock (mirrors the service rule): a
  // direct visit from any earlier stage — or after activation — never
  // renders the workflow. Stale links are pointed at the candidate's real
  // current stage, where the staff record is shown read-only.
  if (!view.eligible || !view.appointment) {
    redirect(`/application/${view.referenceNumber}`);
  }

  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];

  return (
    <PageShell size="default">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff Activation
          </h1>
          <StatusBadge status={view.status} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {view.content.intro}
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
        {/* Appointment summary, the review, then the one action      */}
        {/* ------------------------------------------------------- */}
        <section aria-label="Staff activation" className="min-w-0">
          <section
            aria-labelledby="activation-appointment-summary"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h2
              id="activation-appointment-summary"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Your appointment
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Candidate
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {view.fullName}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.appointment.appointmentReference}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Appointment date
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {format(new Date(view.appointment.issuedAt), "d MMMM yyyy")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Designation
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {view.appointment.roleTitle}
                </dd>
              </div>
            </dl>
          </section>

          {view.content.sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`activation-${section.id}`}
              className="mt-10 border-t border-divider pt-8 first:mt-10"
            >
              <h2
                id={`activation-${section.id}`}
                className="scroll-mt-20 text-xl font-bold tracking-tight text-foreground"
              >
                {section.title}
              </h2>
              <ActivationSectionBlocks blocks={section.blocks} />
            </section>
          ))}

          <ActivationDecision
            reference={view.referenceNumber}
            version={view.content.version}
            acknowledgementLabel={view.content.acknowledgementLabel}
          />
        </section>

        {/* ------------------------------------------------------- */}
        {/* Secondary rail: useful information only                   */}
        {/* ------------------------------------------------------- */}
        <aside
          aria-label="About this step"
          className="self-start md:sticky md:top-8"
        >
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              About this step
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={view.status} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="text-sm font-mono font-semibold tracking-wider text-foreground">
                  {view.appointment.appointmentReference}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Designation</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {view.appointment.roleTitle}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Staff ID</dt>
                <dd className="text-right text-sm font-semibold text-foreground">
                  Assigned when
                  <br aria-hidden />
                  you activate
                </dd>
              </div>
            </dl>

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
