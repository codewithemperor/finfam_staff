import type { Metadata } from "next";

import { AssessmentEntryForm } from "@/components/assessment/assessment-entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Automated interview assessment",
  description:
    "Open your FinFam Automated Interview Assessment with your application reference number.",
};

/**
 * Assessment entry. Same identification model as the orientation and the
 * status page: the application reference number the candidate already
 * holds. Eligibility (orientation completed) is decided by the server.
 */
export default function AssessmentEntryPage() {
  return (
    <PageShell size="narrow">
      <PageHeader
        title="Automated Interview Assessment"
        description="A short assessment on FinFam, your role, and the professional standards expected from every team member. Enter the reference number you received when you applied to continue."
      />

      <div className="mt-8">
        <AssessmentEntryForm />
      </div>

      <p className="mt-8 max-w-xl text-sm leading-6 text-muted-foreground">
        The assessment is available after you complete your orientation. Your
        answers are saved as you go, so you can leave and return without
        losing progress.
      </p>
    </PageShell>
  );
}
