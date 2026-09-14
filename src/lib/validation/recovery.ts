import { z } from "zod";

import { EMAIL_PATTERN, NAME_PATTERN, PHONE_PATTERN } from "@/lib/validation/application";

/**
 * Shared reference-recovery validation.
 *
 * Recovery deliberately asks for the three details the candidate supplied
 * when they applied (full name, email, phone). ALL of them must match a
 * single application before the reference is revealed — see
 * docs/CONTENT-QUESTIONS.md §11 for the (unresolved) verification policy.
 * The same schema is re-run on the server; failures never reveal whether a
 * particular application exists.
 */

export const referenceRecoverySchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the full name you applied with")
    .max(80, "Full name must be 80 characters or fewer")
    .regex(NAME_PATTERN, "Enter a valid full name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Email address must be 120 characters or fewer")
    .regex(EMAIL_PATTERN, "Enter the email address you applied with"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number must be 20 digits or fewer")
    .regex(PHONE_PATTERN, "Enter a valid phone number, e.g. 0803 000 0000"),
});

export type ReferenceRecoveryInput = z.infer<typeof referenceRecoverySchema>;
