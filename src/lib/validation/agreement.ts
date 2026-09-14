import { z } from "zod";

import { AGREEMENT_META } from "@/config/agreement";

/**
 * Shared agreement validation.
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. Business rules (eligibility, stage, idempotency) live
 * in the agreement service; the version check here guarantees the candidate
 * responded to the agreement version they actually saw, never a stale one.
 */
export const agreementAcceptSchema = z.object({
  acknowledgement: z
    .boolean()
    .refine(
      (value) => value === true,
      "Please confirm you have read and understood the agreement before accepting.",
    ),
  version: z
    .string()
    .trim()
    .min(1, "Missing agreement version.")
    .refine(
      (value) => value === AGREEMENT_META.version,
      "The agreement has been updated since you opened it. Refresh the page, review the latest version, and try again.",
    ),
});

export type AgreementAcceptInput = z.infer<typeof agreementAcceptSchema>;
