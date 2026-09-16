import { z } from "zod";

/**
 * Shared Staff Portal authentication validation (Stage 7).
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. Deliberately NO staffId / reference / appointment
 * field exists anywhere: portal identity is resolved from the session
 * (StaffAccount → Staff → Candidate), never from user input (brief §18).
 */

/** Body of POST /api/staff/auth/request-code. */
export const requestCodeSchema = z.object({
  email: z
    .string({ message: "Enter your registered email address." })
    .trim()
    .min(3, "Enter your registered email address.")
    .max(254, "Enter your registered email address.")
    .email("Enter a valid email address."),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

/** Body of POST /api/staff/auth/verify. */
export const verifyCodeSchema = z.object({
  email: z
    .string({ message: "Enter your registered email address." })
    .trim()
    .min(3, "Enter your registered email address.")
    .max(254, "Enter your registered email address.")
    .email("Enter a valid email address."),
  code: z
    .string({ message: "Enter the 6-digit login code." })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit login code from your email."),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
