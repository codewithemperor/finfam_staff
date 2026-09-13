import { z } from "zod";

import { ORIENTATION_SECTION_IDS } from "@/config/orientation";

/**
 * Shared orientation validation.
 *
 * The schemas are re-run on the server for every request — the server never
 * trusts client-side progress. Business rules (sequential section order,
 * "all sections read before completion") live in the orientation service.
 */

export const orientationSectionCompleteSchema = z.object({
  sectionId: z
    .string()
    .trim()
    .min(1, "Missing section.")
    .refine(
      (value) => (ORIENTATION_SECTION_IDS as string[]).includes(value),
      "That section does not exist.",
    ),
});

export const orientationCompleteSchema = z.object({
  acknowledgement: z
    .boolean()
    .refine(
      (value) => value === true,
      "Please confirm the declaration to complete your orientation.",
    ),
});

export type OrientationSectionCompleteInput = z.infer<
  typeof orientationSectionCompleteSchema
>;
export type OrientationCompleteInput = z.infer<
  typeof orientationCompleteSchema
>;
