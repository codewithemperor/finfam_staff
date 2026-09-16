import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { lessonCompletionSchema } from "@/lib/validation/staff-training";
import { completeTrainingLesson } from "@/server/services/staff-training";

/**
 * Staff Training lesson completion API (Stage 9, brief §35).
 *
 * The body is EXACTLY one field — { lessonId } (strict schema): no
 * staffId, no enrollmentId, no completedAt, no courseVersion, no progress
 * percentage is ever accepted. The server derives all other state from
 * the session chain and the pinned course content.
 *
 * Rules: unknown course → 404; unknown lesson → 422; future/locked lesson
 * → 422; duplicate completion → idempotent success (same final state, no
 * second row); valid next lesson → persisted once; final lesson → course
 * completedAt latched exactly once.
 */

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** POST /api/staff/training/[courseId]/lessons — body { lessonId }. */
export async function POST(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const { courseId } = await context.params;

    const body = await readJsonBody(request);
    const parsed = lessonCompletionSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "We couldn't record that lesson. Check the request and try again.",
        getFieldErrors(parsed.error),
      );
    }

    return completeTrainingLesson(session, courseId, parsed.data.lessonId);
  });
}
