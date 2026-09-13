import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { StatusLookup } from "@/components/recruitment/status-lookup";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";

export const metadata: Metadata = {
  title: "Check status",
  description:
    "Check where you are in the FinFam recruitment process with your reference number.",
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  // Only pass a well-formed reference through; anything else is treated as
  // a fresh lookup. No PII ever travels in the URL — a reference number is
  // a lookup key the candidate already holds.
  const initialReference =
    ref && REFERENCE_NUMBER_PATTERN.test(ref.trim().toUpperCase())
      ? ref.trim().toUpperCase()
      : undefined;

  return (
    <PageShell size="narrow">
      <StatusLookup initialReference={initialReference} />
    </PageShell>
  );
}
