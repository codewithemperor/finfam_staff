import { z } from "zod";

import { OPEN_POSITION } from "@/config/content";

/**
 * Shared application validation.
 *
 * This schema is the AUTHORITATIVE validation and is re-run on the server
 * for every submission. The client reuses it for immediate feedback
 * (see README → Conventions → Forms & validation).
 *
 * Deliberately permissive-but-clean regexes are used instead of library
 * format validators so the same rules apply on both sides without version
 * quirks.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;
// Letters (any language), spaces, apostrophes, hyphens and periods.
const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;

export const applicationFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(80, "Full name must be 80 characters or fewer")
    .regex(NAME_PATTERN, "Enter a valid full name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Email address must be 120 characters or fewer")
    .regex(EMAIL_PATTERN, "Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number must be 20 digits or fewer")
    .regex(PHONE_PATTERN, "Enter a valid phone number, e.g. 0803 000 0000"),
  city: z
    .string()
    .trim()
    .max(60, "City must be 60 characters or fewer")
    .optional()
    .transform((value) => (value ? value : undefined)),
  roleTitle: z
    .string()
    .trim()
    .refine(
      (value) => value === OPEN_POSITION.title,
      "This role is not currently open for applications",
    ),
  consent: z
    .boolean()
    .refine((value) => value === true, "Please confirm before submitting"),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;

/** Flatten a ZodError into { field: firstMessage } for form display. */
export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}
