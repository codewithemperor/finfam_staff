import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { normalizeReferenceNumber, REFERENCE_NUMBER_PATTERN } from "@/lib/reference";

export const metadata: Metadata = {
  title: "Your application",
};

/**
 * Legacy status lookup — now a thin bridge onto the unified journey.
 *
 * A well-formed ?ref= goes straight to the candidate's application journey
 * (the server decides the current stage there); anything else goes to the
 * single "Continue Application" entry point. No duplicate lookup forms.
 */
export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const normalized = ref ? normalizeReferenceNumber(ref) : "";

  redirect(
    REFERENCE_NUMBER_PATTERN.test(normalized)
      ? `/application/${normalized}`
      : "/continue",
  );
}
