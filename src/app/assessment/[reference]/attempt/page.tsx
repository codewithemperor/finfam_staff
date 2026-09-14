import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssessmentNotFoundPanel } from "@/components/assessment/assessment-not-found";
import { AssessmentRunner } from "@/components/assessment/assessment-runner";
import { PageShell } from "@/components/layout/page-shell";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAssessmentView } from "@/server/services/assessment";

export const metadata: Metadata = {
  title: "Your assessment",
  description: "Answer the FinFam assessment questions and submit.",
};

/**
 * The assessment attempt: one question at a time with server autosave.
 * The server decides whether an active attempt exists — any other phase
 * redirects to the hub, so this URL is never a side door into a closed
 * or not-yet-started assessment.
 */
export default async function AssessmentAttemptPage({
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

  if (view.phase !== "IN_PROGRESS" || !view.attempt) {
    redirect(`/assessment/${view.referenceNumber}`);
  }

  return (
    <PageShell size="default">
      <AssessmentRunner
        reference={view.referenceNumber}
        attempt={view.attempt}
      />
    </PageShell>
  );
}
