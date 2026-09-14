import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ContinueApplicationForm } from "@/components/recruitment/continue-application-form";

export const metadata: Metadata = {
  title: "Continue your application",
  description:
    "Continue your FinFam application from your current recruitment stage using your application reference.",
};

/**
 * "Continue Application" — the single returning-candidate entry point.
 *
 * The candidate identifies their application with the one recruitment
 * reference; the system then determines the current stage and takes them
 * straight there. There is deliberately no stage picker and no per-stage
 * reference forms anywhere else in the product.
 */
export default function ContinueApplicationPage() {
  return (
    <PageShell size="narrow">
      <PageHeader
        title="Continue your application"
        description="Enter the reference number you received when you applied. We'll take you straight to your current stage — you don't need to remember where you stopped."
      />

      <div className="mt-8">
        <ContinueApplicationForm />
      </div>

      <p className="mt-8 text-sm">
        <Link
          href="/continue/recover"
          className="rounded-md font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Forgot your application reference?
        </Link>
      </p>

      <p className="mt-10 max-w-xl border-t border-divider pt-6 text-sm leading-6 text-muted-foreground">
        New to FinFam?{" "}
        <Link
          href="/apply"
          className="rounded-md font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Start a new application
        </Link>{" "}
        — it takes a few minutes.
      </p>
    </PageShell>
  );
}
