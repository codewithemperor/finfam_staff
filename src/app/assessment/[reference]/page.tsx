import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssessmentNotFoundPanel } from "@/components/assessment/assessment-not-found";
import { AssessmentResultCard } from "@/components/assessment/assessment-result-card";
import { StartAssessmentButton } from "@/components/assessment/start-assessment-button";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CANDIDATE_STATUS_DETAILS, getStageStates } from "@/config/recruitment";
import { AppError } from "@/lib/errors";
import { assessmentFacts } from "@/lib/assessment";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAssessmentView } from "@/server/services/assessment";

export const metadata: Metadata = {
  title: "Assessment overview",
  description:
    "Your FinFam Automated Interview Assessment: introduction, progress and result.",
};

/**
 * Assessment hub — the home of stage 2. One server-rendered page covering
 * every phase: the introduction, resuming an active attempt, and the
 * recorded result. Desktop recomposes into content plus a context rail; on
 * mobile the primary content and its action come first.
 *
 * Stage access is decided by the server: candidates whose orientation is
 * not complete are redirected to their current stage (the unified journey)
 * — a direct URL never renders the assessment. A submitted result stays
 * available here as a read-only record; the stage itself is closed.
 */
export default async function AssessmentHubPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let view;
  try {
    view = await getAssessmentView(normalizeReferenceNumber(reference));
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return (
        <PageShell size="narrow">
          <AssessmentNotFoundPanel message={error.message} />
        </PageShell>
      );
    }
    throw error;
  }

  // Server-enforced eligibility (mirrors the service rule): the assessment
  // opens only after orientation is completed. Direct visits and stale
  // links are pointed at the candidate's real current stage.
  if (!view.orientationCompleted) {
    redirect(`/application/${view.referenceNumber}`);
  }

  const answeredCount = view.attempt?.answers.length ?? 0;
  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];

  return (
    <PageShell size="wide">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Automated Interview Assessment
          </h1>
          <StatusBadge status={view.status} />
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          A short assessment on FinFam, the role you are applying for, and the
          professional standards expected from every FinFam team member.
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
          {/* Primary content by phase */}
          {/* ------------------------------------------------------- */}
          <section aria-label="Assessment" className="min-w-0">
            {view.phase === "NOT_STARTED" && (
              <>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Before you begin
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                  The assessment has {assessmentFacts.questions} multiple-choice
                  questions worth {assessmentFacts.marks} marks in total. For
                  each question, choose the best answer. The pass mark is{" "}
                  {assessmentFacts.passMark}%.
                </p>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                  Your answers are saved automatically as you go, so you can
                  leave the assessment and return to it. Once you submit, your
                  result is calculated immediately and cannot be changed.
                </p>
                <div className="mt-8">
                  <StartAssessmentButton reference={view.referenceNumber} />
                </div>
              </>
            )}

            {view.phase === "IN_PROGRESS" && (
              <>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Your assessment is in progress
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                  You have answered {answeredCount} of{" "}
                  {view.attempt?.questions.length} questions
                  {answeredCount > 0
                    ? " — everything you selected has been saved."
                    : "."}{" "}
                  Continue where you stopped, review your answers, and submit
                  when you are ready.
                </p>
                <div className="mt-8">
                  <ButtonLink
                    href={`/assessment/${view.referenceNumber}/attempt`}
                  >
                    Continue assessment
                  </ButtonLink>
                </div>
              </>
            )}

            {view.phase === "SUBMITTED" && view.result && (
              <>
                <AssessmentResultCard result={view.result} />

                <div className="mt-6 max-w-xl rounded-lg bg-surface p-5">
                  <p className="text-sm font-semibold text-foreground">
                    What happens next
                  </p>
                  {view.result.passed ? (
                    <>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {statusDefinition.nextStep}
                      </p>
                      <div className="mt-4">
                        <ButtonLink href={`/agreement/${view.referenceNumber}`}>
                          Review Agreement
                        </ButtonLink>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        You can retake the assessment from this page. How
                        retakes are handled in the long term is still being
                        finalised — if the policy changes, it will be
                        communicated to you directly before it affects you.
                      </p>
                      <div className="mt-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <ButtonLink
                            href={`/orientation/${view.referenceNumber}`}
                            variant="outline"
                          >
                            Review Orientation
                          </ButtonLink>
                          <StartAssessmentButton
                            reference={view.referenceNumber}
                            label="Retake assessment"
                            pendingLabel="Preparing…"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ------------------------------------------------------- */}
          {/* Context rail: facts + recruitment journey */}
          {/* ------------------------------------------------------- */}
          <aside
            aria-label="About this assessment"
            className="self-start md:sticky md:top-8"
          >
            <div className="rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground">
                About this assessment
              </h2>
              <dl className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Questions</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {assessmentFacts.questions}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Total marks</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {assessmentFacts.marks}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Pass mark</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {assessmentFacts.passMark}%
                  </dd>
                </div>
                {view.phase === "SUBMITTED" && view.result && (
                  <div className="flex items-baseline justify-between gap-4 border-t border-divider pt-3">
                    <dt className="text-sm text-muted-foreground">Your score</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {view.result.marksAwarded} / {view.result.totalMarks}
                    </dd>
                  </div>
                )}
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
            </div>
          </aside>
      </div>
    </PageShell>
  );
}
