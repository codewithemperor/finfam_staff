import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { getTrainingCourseDetail } from "@/server/services/staff-training";

/**
 * One Staff Training course API (Stage 9).
 *
 * The courseId comes from the URL path and must exist in the
 * source-controlled course registry — an unknown id is a plain 404. The
 * optional `?lesson=<lessonId>` query selects the displayed lesson; a
 * locked or unknown lesson NEVER exposes its content — the server falls
 * back to the open lesson with an honest notice (brief §26), so query
 * manipulation cannot unlock future lessons.
 *
 * GET side effect (explicitly approved, brief §34): opening the course
 * lazily create-or-gets the Staff member's enrollment, race-safe and
 * exactly once. The version is pinned at first open.
 */

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** GET /api/staff/training/[courseId]?lesson=<lessonId> — course/lesson reader. */
export async function GET(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const { courseId } = await context.params;
    const lesson = request.nextUrl.searchParams.get("lesson") ?? undefined;
    return getTrainingCourseDetail(session, courseId, lesson);
  });
}
