import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgreementDecision } from "@/components/agreement/agreement-decision";
import { AgreementDocument } from "@/components/agreement/agreement-document";
import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CANDIDATE_STATUS_DETAILS, getStageStates } from "@/config/recruitment";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAgreementView } from "@/server/services/agreement";

export const metadata: Metadata = {
  title: "Responsibility & Reward Agreement",
  description:
    "The formal review of your FinFam role, responsibilities, support package and reward structure before your provisional appointment.",
};

/**
 * The Responsibility & Reward Agreement — the home of stage 3, the last
 * stage before appointment. One server-rendered document: the agreement
 * contents, a context rail (version, contents, journey), and ONE explicit
 * acceptance action at the end of the reading flow.
 *
 * Stage access is decided by the server: the document only renders while
 * the agreement is the candidate's undecided stage. Any other state —
 * earlier stages, already accepted — is pointed at the unified journey,
 * which shows the authoritative state. Opening the page records the stage
 * entry (idempotently, server-side); it never implies acceptance, and a
 * direct URL after acceptance can never re-open the workflow.
 */
export default async function AgreementPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let view;
  try {
    view = await getAgreementView(normalizeReferenceNumber(reference));
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
  // direct visit from any earlier stage — or after acceptance — never
  // renders the workflow. Stale links are pointed at the candidate's real
  // current stage.
  if (!view.eligible) {
    redirect(`/application/${view.referenceNumber}`);
  }

  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];

  return (
    <PageShell size="default">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            SECTION 5: FINFAM RESPONSIBILITY &amp; REWARD POLICY ACCEPTANCE
          </p>
          <StatusBadge status={view.status} />
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Marketing &amp; Customer Care Executive Offer Review
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prepared for <span className="font-semibold text-foreground">{view.fullName}</span> ·{" "}
          <span className="font-mono tracking-widest">{view.referenceNumber}</span>
        </p>

        {/* Congratulations Banner */}
        <div className="mt-6 rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-foreground sm:text-lg">
            Congratulations on Reaching This Stage
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You have successfully completed the FinFam Staff Assessment (Interview Stage). Your performance demonstrates that you have gained an understanding of:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>FinFam&apos;s vision and mission</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>Our products and services</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>Your role as a Marketing &amp; Customer Care Executive</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>Our reward structure</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>Our professional standards and expectations</span>
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground border-t border-border pt-3">
            Before your appointment can be finalized, please carefully review and accept the FinFam Responsibility &amp; Reward Policy. This document defines your responsibilities, performance expectations, earning structure, and professional obligations as a FinFam representative.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        {/* ------------------------------------------------------- */}
        {/* The document, then the one explicit decision              */}
        {/* ------------------------------------------------------- */}
        <section aria-label="Agreement document" className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Agreement version {view.agreement.version}
          </p>

          {view.agreement.sections.map((section, index) => (
            <section
              key={section.id}
              aria-labelledby={`agreement-${section.id}`}
              className="mt-10 border-t border-divider pt-8 first:mt-6 first:border-t-0 first:pt-0"
            >
              <h2
                id={`agreement-${section.id}`}
                className="scroll-mt-20 text-xl font-bold tracking-tight text-foreground"
              >
                <span className="mr-2 text-muted-foreground">
                  {index + 1}.
                </span>
                {section.title}
              </h2>
              <AgreementDocument blocks={section.blocks} />
            </section>
          ))}

          <AgreementDecision
            reference={view.referenceNumber}
            version={view.agreement.version}
          />
        </section>

        {/* ------------------------------------------------------- */}
        {/* Context rail: version, contents, journey                  */}
        {/* ------------------------------------------------------- */}
        <aside
          aria-label="About this agreement"
          className="self-start md:sticky md:top-8"
        >
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              About this agreement
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Reference</dt>
                <dd className="text-sm font-mono font-semibold tracking-wider text-foreground">
                  {view.referenceNumber}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Version</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {view.agreement.version}
                </dd>
              </div>
            </dl>

            <nav
              aria-label="On this page"
              className="mt-6 border-t border-divider pt-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                On this page
              </h3>
              <ol className="mt-3 list-none space-y-2 p-0">
                {view.agreement.sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#agreement-${section.id}`}
                      className="text-sm leading-6 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

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
