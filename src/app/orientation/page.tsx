import type { Metadata } from "next";

import { OrientationEntryForm } from "@/components/orientation/orientation-entry-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Staff orientation workshop",
  description:
    "Open your FinFam Staff Orientation Workshop with your application reference number.",
};

/**
 * Orientation entry. Candidates identify themselves with the application
 * reference number they received when they applied — the same lookup key
 * used on the status page. No passwords, no extra accounts.
 */
export default function OrientationEntryPage() {
  return (
    <PageShell size="narrow">
      <PageHeader
        title="Staff Orientation Workshop"
        description="Learn how FinFam works, what your role involves, and the professional standards expected from every team member. Enter the reference number you received when you applied to begin."
      />

      <div className="mt-8">
        <OrientationEntryForm />
      </div>

      <p className="mt-8 max-w-xl text-sm leading-6 text-muted-foreground">
        The workshop is a sequence of short sections. Your progress is saved
        as you go, so you can leave at any point and continue where you
        stopped.
      </p>
    </PageShell>
  );
}
