import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ReferenceRecoveryForm } from "@/components/recruitment/reference-recovery-form";

export const metadata: Metadata = {
  title: "Retrieve your application reference",
  description:
    "Find your FinFam application reference using the details you supplied when you applied.",
};

/**
 * Reference recovery — the focused flow behind "Forgot your application
 * reference?". Verification requirements are an open business question
 * (docs/CONTENT-QUESTIONS.md §11); the interim flow reveals only the
 * reference and is enumeration-safe.
 */
export default function RecoverReferencePage() {
  return (
    <PageShell size="narrow">
      <PageHeader
        title="Retrieve your application reference"
        description="Confirm the details you supplied when you applied and we'll show you your application reference."
      />

      <div className="mt-8">
        <ReferenceRecoveryForm />
      </div>

      <p className="mt-10 max-w-xl border-t border-divider pt-6 text-sm leading-6 text-muted-foreground">
        Remembered your reference after all?{" "}
        <Link
          href="/continue"
          className="rounded-md font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Continue your application
        </Link>
      </p>
    </PageShell>
  );
}
