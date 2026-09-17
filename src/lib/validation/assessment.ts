import { z } from "zod";

/**
 * Shared assessment validation.
 *
 * Schemas are re-run on the server for every request — the server never
 * trusts client state. Business rules (eligibility, active attempt, question
 * membership, scoring) live in the assessment service; the answer key never
 * reaches this layer.
 */

export const assessmentStartSchema = z.object({}).strict();

export const assessmentAnswerSchema = z.object({
  questionId: z
    .string()
    .trim()
    .min(1, "Missing question."),
  /** 0-based index of the chosen option. */
  selectedOption: z
    .number()
    .int()
    .min(0, "Select one of the four options.")
    .max(3, "Select one of the four options."),
});

export const assessmentSubmitSchema = z.object({}).strict();

export type AssessmentAnswerInput = z.infer<typeof assessmentAnswerSchema>;
