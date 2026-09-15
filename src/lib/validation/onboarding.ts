import { z } from "zod";

import { ONBOARDING_META } from "@/config/onboarding";

/**
 * Shared onboarding validation.
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. Business rules (eligibility, step existence, sequential
 * order, all-steps completion, idempotency) live in the onboarding service;
 * the literal acknowledgement here guarantees the final action was
 * explicitly confirmed, and the version check guarantees the staff member
 * responded to the onboarding version they actually saw, never a stale one.
 *
 * There is deliberately no state, completedAt, currentStepId or staffId
 * field: all of those are decided by the server alone.
 */

/** Body of POST /api/onboarding/[reference]/steps. */
export const onboardingStepSchema = z.object({
  stepId: z
    .string({ message: "Missing onboarding step." })
    .trim()
    .min(1, "Missing onboarding step."),
});

export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;

/** Body of POST /api/onboarding/[reference]/complete. */
export const onboardingCompleteSchema = z.object({
  acknowledgement: z
    .boolean()
    .refine(
      (value) => value === true,
      "Please confirm the onboarding acknowledgement before completing.",
    ),
  version: z
    .string()
    .trim()
    .min(1, "Missing onboarding version.")
    .refine(
      (value) => value === ONBOARDING_META.version,
      "The onboarding step has been updated since you opened it. Refresh the page and try again.",
    ),
});

export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
