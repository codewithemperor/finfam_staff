import { z } from "zod";

/**
 * Staff Training validation (Stage 9).
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. NO identity field exists anywhere (no staffId, no
 * enrollmentId, no courseVersion, no reference, no email, no completedAt):
 * ownership and every other state are derived from the authenticated
 * session and the source-controlled course config (brief §27/§18).
 */

/**
 * Body of POST /api/staff/training/[courseId]/lessons — exactly ONE field:
 * the stable lesson id from the course config. Anything else the client
 * sends is ignored/rejected by the strict object below.
 */
export const lessonCompletionSchema = z
  .object({
    lessonId: z
      .string({
        message: "The lesson id must be text.",
      })
      .min(1, "Enter the lesson to complete.")
      .max(100, "The lesson id is not valid."),
  })
  .strict();

export type LessonCompletionInput = z.infer<typeof lessonCompletionSchema>;
