import { z } from "zod";

import { ACTIVATION_META } from "@/config/activation";

/**
 * Shared activation validation.
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. Business rules (eligibility, stage, idempotency, Staff
 * ID allocation) live in the activation service; the literal acknowledgement
 * here guarantees the action was explicitly confirmed, and the version check
 * guarantees the candidate responded to the activation version they actually
 * saw, never a stale one. There is deliberately no Staff ID or status field:
 * both are decided by the server alone.
 */
export const activationSchema = z.object({
  acknowledgement: z
    .boolean()
    .refine(
      (value) => value === true,
      "Please confirm you are ready to activate your staff profile before continuing.",
    ),
  version: z
    .string()
    .trim()
    .min(1, "Missing activation version.")
    .refine(
      (value) => value === ACTIVATION_META.version,
      "The activation step has been updated since you opened it. Refresh the page and try again.",
    ),
});

export type ActivationInput = z.infer<typeof activationSchema>;
