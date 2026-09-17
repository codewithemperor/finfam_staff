import "server-only";

import { Prisma } from "@prisma/client";

import {
  getTrainingCourse,
  getTrainingCourseContent,
  TRAINING_COURSES,
  TRAINING_LOCKED_LESSON_NOTICE,
  TRAINING_NON_BLOCKING_NOTICE,
} from "@/config/training";
import { AppError, notFoundError, validationError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { StaffSessionContext } from "@/server/services/staff-auth";
import type {
  CompleteLessonResult,
  TrainingCourseDetailView,
  TrainingCourseStateId,
  TrainingHomeState,
  TrainingLessonStateId,
  TrainingLessonStateView,
  TrainingOverviewView,
} from "@/types/staff-training";

/**
 * Staff Training (Stage 9) — an ongoing STAFF PLATFORM module. Every rule
 * lives here; pages and route handlers never touch Prisma and never decide
 * eligibility.
 *
 * Identity & ownership (brief §18): the Staff row comes ONLY from the
 * authenticated session chain (Session → StaffAccount → Staff). No staffId,
 * email, recruitment/appointment reference, accountId or enrollmentId is
 * ever accepted from the browser. Training is SESSION-ONLY — there is no
 * /training/[reference] route and none may be built.
 *
 * Eligibility (brief §17): ACTIVE account (implied — suspended sessions
 * never resolve) + a Staff row + APPROVED_STAFF + COMPLETED onboarding.
 * Incomplete onboarding → 403 FORBIDDEN (the existing code — never a new
 * error type). Daily Report submission history is deliberately NOT an
 * eligibility requirement: Training and reporting are fully decoupled
 * (brief §8).
 *
 * Non-blocking (brief §8/§16): "Required Training" is an organisational
 * label only. Nothing here blocks Daily Reporting, Appointment, Resources,
 * Profile or the portal home, and completion changes NO employment state
 * (brief §29).
 *
 * Enrollment (brief §20/§24): LAZY. The overview and home card are
 * read-only; opening /staff/training/[courseId] create-or-gets the
 * enrollment (the one approved GET side effect) with the race-safe
 * P2002 → re-read-winner pattern, so concurrent first opens produce
 * exactly ONE row. `courseVersion` is pinned at first open and a completed
 * course stays reviewable as-written — a future version can only coexist
 * as a separate enrollment; no automatic retraining exists (brief §23/§50).
 *
 * Progression (brief §25–§28): sequential first completion, enforced
 * server-side against the PINNED content — the browser never decides which
 * lesson is current. Progress rows are append-only (no uncomplete).
 * Completion of the final lesson latches `completedAt` exactly once via a
 * conditional updateMany inside the same transaction. Review performs zero
 * writes (brief §30).
 *
 * Content firewall (brief §12): this module never teaches any
 * report-count→earnings path; there are no payroll/commission/bonus figures
 * anywhere. No notifications are queued (brief §45), no certificates exist
 * (§46), no video (§47).
 */

/* -------------------------------------------------------------------------
 * Eligibility (brief §17)
 * ---------------------------------------------------------------------- */

const ONBOARDING_REQUIRED_MESSAGE =
  "Complete your onboarding to begin Staff Training.";

/**
 * The shared operational gate for every Training read and write. Throws
 * 403 FORBIDDEN when the authenticated Staff member has not completed
 * onboarding (or, defensively, is not APPROVED_STAFF).
 */
async function ensureTrainingEligibility(
  session: StaffSessionContext,
): Promise<void> {
  const candidate = await db.candidate.findUnique({
    where: { id: session.candidate.id },
    select: {
      status: true,
      staff: { select: { onboarding: { select: { completedAt: true } } } },
    },
  });

  if (!candidate || candidate.status !== "APPROVED_STAFF" || !candidate.staff) {
    // Impossible via the session chain — refuse loudly rather than guess.
    throw new AppError(
      "INTERNAL",
      "Your Staff Portal session could not be resolved. Please sign in again.",
      { status: 500 },
    );
  }

  if (!candidate.staff.onboarding?.completedAt) {
    throw new AppError("FORBIDDEN", ONBOARDING_REQUIRED_MESSAGE, {
      status: 403,
    });
  }
}

/* -------------------------------------------------------------------------
 * Enrollment core (brief §20/§23/§24)
 * ---------------------------------------------------------------------- */

/**
 * Create-or-get the Staff member's enrollment for ONE course. The Staff
 * member's LATEST enrollment wins (any pinned version) — a completed
 * course stays reviewable without creating surprise re-enrollments; a
 * future version policy can only ever add a separate enrollment through
 * an explicit future flow (brief §50). The unique
 * [staffId, courseId, courseVersion] constraint is the concurrency
 * backstop: the P2002 loser re-reads the winner.
 */
async function getOrCreateEnrollment(
  staffRowId: string,
  courseId: string,
  currentVersion: string,
) {
  const existing = await db.staffTrainingEnrollment.findFirst({
    where: { staffId: staffRowId, courseId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const created = await db.staffTrainingEnrollment
    .create({
      data: {
        staffId: staffRowId,
        courseId,
        courseVersion: currentVersion,
        startedAt: new Date(),
      },
    })
    .catch((error) => {
      // A concurrent create-or-get won — re-read its row below.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    });

  if (created) return created;

  const winner = await db.staffTrainingEnrollment.findFirst({
    where: { staffId: staffRowId, courseId },
    orderBy: { createdAt: "desc" },
  });
  if (!winner) {
    throw new AppError(
      "INTERNAL",
      "Your training enrollment could not be opened. Please try again.",
      { status: 500 },
    );
  }
  return winner;
}

/** Resolve the PINNED content for an enrollment, failing loudly if the
 * registry version has disappeared (same philosophy as the appointment
 * content registry — historical integrity over silent substitution). */
function resolvePinnedContent(
  courseId: string,
  courseVersion: string,
): NonNullable<ReturnType<typeof getTrainingCourseContent>> {
  const content = getTrainingCourseContent(courseId, courseVersion);
  if (!content) {
    throw new AppError(
      "INTERNAL",
      "This training course could not be opened. Please contact support.",
      { status: 500 },
    );
  }
  return content;
}

/* -------------------------------------------------------------------------
 * State derivation (brief §25/§33)
 * ---------------------------------------------------------------------- */

function deriveCourseState(
  completedAt: Date | null,
  completedLessons: number,
): TrainingCourseStateId {
  if (completedAt) return "COMPLETED";
  if (completedLessons > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function deriveLessonStates(
  lessons: readonly { id: string; title: string; summary: string }[],
  completedMap: Map<string, Date>,
  courseCompleted: boolean,
): TrainingLessonStateView[] {
  let currentAssigned = false;
  return lessons.map((lesson) => {
    const completedAt = completedMap.get(lesson.id) ?? null;
    if (completedAt) {
      return {
        lessonId: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        state: "COMPLETED" as TrainingLessonStateId,
        completedAt: completedAt.toISOString(),
      };
    }
    if (courseCompleted) {
      // Defensive: a completed course should have every lesson row. A
      // missing row is still never completable again — render honestly.
      return {
        lessonId: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        state: "COMPLETED" as TrainingLessonStateId,
        completedAt: null,
      };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return {
        lessonId: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        state: "CURRENT" as TrainingLessonStateId,
        completedAt: null,
      };
    }
    return {
      lessonId: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      state: "LOCKED" as TrainingLessonStateId,
      completedAt: null,
    };
  });
}

/* -------------------------------------------------------------------------
 * Overview (brief §33) — READ-ONLY, never enrolls
 * ---------------------------------------------------------------------- */

export async function getTrainingOverview(
  session: StaffSessionContext,
): Promise<TrainingOverviewView> {
  await ensureTrainingEligibility(session);

  const enrollments = await db.staffTrainingEnrollment.findMany({
    where: { staffId: session.staff.rowId },
    include: { _count: { select: { lessons: true } } },
    orderBy: { createdAt: "desc" },
  });

  const courses = TRAINING_COURSES.map((course) => {
    const enrollment = enrollments.find((row) => row.courseId === course.id);
    const completedLessons = enrollment?._count.lessons ?? 0;
    return {
      courseId: course.id,
      title: course.title,
      description: course.description,
      // The Staff member's pinned version when enrolled; the registry's
      // current version while not started.
      version: enrollment?.courseVersion ?? course.version,
      required: course.required,
      state: deriveCourseState(
        enrollment?.completedAt ?? null,
        completedLessons,
      ),
      completedLessons,
      totalLessons: course.lessons.length,
      startedAt: enrollment?.startedAt.toISOString() ?? null,
      completedAt: enrollment?.completedAt?.toISOString() ?? null,
    };
  });

  return { courses, nonBlockingNotice: TRAINING_NON_BLOCKING_NOTICE };
}

/**
 * Read-only facts for the Staff Portal home card (brief §38). Mirrors
 * getDailyReportTodayState: the home page already gates on onboarding,
 * and this function NEVER creates an enrollment.
 */
export async function getStaffTrainingHomeState(
  staffRowId: string,
): Promise<TrainingHomeState> {
  const course = TRAINING_COURSES[0];
  if (!course) {
    // No courses published — the home card is not rendered for a null
    // course, so this shape can only be reached in a misconfigured deploy.
    throw new AppError(
      "INTERNAL",
      "Staff Training is not configured. Please contact support.",
      { status: 500 },
    );
  }

  const enrollment = await db.staffTrainingEnrollment.findFirst({
    where: { staffId: staffRowId, courseId: course.id },
    include: { _count: { select: { lessons: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    courseId: course.id,
    title: course.title,
    required: course.required,
    state: deriveCourseState(
      enrollment?.completedAt ?? null,
      enrollment?._count.lessons ?? 0,
    ),
    completedLessons: enrollment?._count.lessons ?? 0,
    totalLessons: course.lessons.length,
    completedAt: enrollment?.completedAt?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------
 * Course detail (brief §26/§34) — the ONE approved lazy-enrollment read
 * ---------------------------------------------------------------------- */

export async function getTrainingCourseDetail(
  session: StaffSessionContext,
  rawCourseId: string,
  requestedLessonId?: string,
): Promise<TrainingCourseDetailView> {
  await ensureTrainingEligibility(session);

  const courseConfig = getTrainingCourse(rawCourseId);
  if (!courseConfig) {
    throw notFoundError("We couldn't find that training course.");
  }

  // The lazy enrollment side effect (approved, brief §34): opening the
  // course create-or-gets the Staff member's row — exactly once.
  const enrollment = await getOrCreateEnrollment(
    session.staff.rowId,
    courseConfig.id,
    courseConfig.version,
  );
  const content = resolvePinnedContent(
    enrollment.courseId,
    enrollment.courseVersion,
  );

  const progressRows = await db.staffTrainingLessonProgress.findMany({
    where: { enrollmentId: enrollment.id },
    select: { lessonId: true, completedAt: true },
  });
  const completedMap = new Map(
    progressRows.map((row) => [row.lessonId, row.completedAt]),
  );
  const courseCompleted = enrollment.completedAt !== null;

  const lessonStates = deriveLessonStates(
    content.lessons,
    completedMap,
    courseCompleted,
  );
  const currentLessonId = courseCompleted
    ? null
    : (lessonStates.find((state) => state.state === "CURRENT")?.lessonId ??
      null);

  // Resolve the DISPLAYED lesson (brief §26): a requested locked or
  // unknown lesson never exposes content — the open lesson is shown with
  // an honest notice instead. With no ?lesson=, the current lesson is
  // shown; a completed course opens on Lesson 1 for review (zero writes).
  let lockedNotice: string | null = null;
  let displayedLessonId: string | null = null;

  if (requestedLessonId) {
    const requested = lessonStates.find(
      (state) => state.lessonId === requestedLessonId,
    );
    if (requested && requested.state !== "LOCKED") {
      displayedLessonId = requested.lessonId;
    } else {
      lockedNotice = TRAINING_LOCKED_LESSON_NOTICE;
    }
  }
  if (!displayedLessonId) {
    displayedLessonId = currentLessonId ?? content.lessons[0].id;
  }

  const displayedState = lessonStates.find(
    (state) => state.lessonId === displayedLessonId,
  );
  const displayedContent = content.lessons.find(
    (lesson) => lesson.id === displayedLessonId,
  );
  if (!displayedState || !displayedContent) {
    throw new AppError(
      "INTERNAL",
      "This lesson could not be opened. Please try again.",
      { status: 500 },
    );
  }

  return {
    courseId: enrollment.courseId,
    version: enrollment.courseVersion,
    title: content.title,
    description: content.description,
    required: content.required,
    nonBlockingNotice: TRAINING_NON_BLOCKING_NOTICE,
    state: deriveCourseState(
      enrollment.completedAt,
      progressRows.length,
    ),
    startedAt: enrollment.startedAt.toISOString(),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    currentLessonId,
    completedLessons: progressRows.length,
    totalLessons: content.lessons.length,
    lessons: lessonStates,
    lesson: {
      lessonId: displayedContent.id,
      title: displayedContent.title,
      state: displayedState.state,
      blocks: displayedContent.blocks,
      relatedLinks: displayedContent.relatedLinks ?? [],
      canComplete: displayedState.state === "CURRENT",
      isFinalLesson:
        displayedContent.id === content.lessons[content.lessons.length - 1].id,
    },
    lockedNotice,
  };
}

/* -------------------------------------------------------------------------
 * Lesson completion (brief §27/§28/§35) — POST only, one field
 * ---------------------------------------------------------------------- */

export async function completeTrainingLesson(
  session: StaffSessionContext,
  rawCourseId: string,
  lessonId: string,
): Promise<CompleteLessonResult> {
  await ensureTrainingEligibility(session);

  const courseConfig = getTrainingCourse(rawCourseId);
  if (!courseConfig) {
    throw notFoundError("We couldn't find that training course.");
  }

  // The enrollment is create-or-got here too: completing a lesson implies
  // the course is open, and the same race-safe pattern guarantees exactly
  // one row even if a first-open POST races a first-open GET.
  const enrollment = await getOrCreateEnrollment(
    session.staff.rowId,
    courseConfig.id,
    courseConfig.version,
  );
  const content = resolvePinnedContent(
    enrollment.courseId,
    enrollment.courseVersion,
  );

  const lesson = content.lessons.find((entry) => entry.id === lessonId);
  if (!lesson) {
    // Unknown lesson — a field-level 422, never a crash (brief §35).
    throw validationError("That lesson is not part of this course.", {
      lessonId: "We couldn't find that lesson in this course.",
    });
  }

  const completedRows = await db.staffTrainingLessonProgress.findMany({
    where: { enrollmentId: enrollment.id },
    select: { lessonId: true, completedAt: true },
  });
  const completedMap = new Map(
    completedRows.map((row) => [row.lessonId, row.completedAt]),
  );

  // Idempotent duplicate (brief §35): already-completed lessons — and any
  // lesson of a completed course — return the SAME final state with no
  // second row and no second timestamp.
  const existingRow = completedMap.get(lessonId);
  if (existingRow) {
    return buildCompletionResult({
      enrollmentId: enrollment.id,
      lessonOrder: content.lessons.map((entry) => entry.id),
      lessonId,
      lessonCompletedAt: existingRow,
      alreadyCompleted: true,
      courseJustCompleted: false,
    });
  }

  // Sequential enforcement (brief §25/§35): the ONLY completable lesson is
  // the first not-yet-completed one in the pinned course order. A skip
  // ahead is a field-level 422 — the browser never sets the sequence.
  const nextLesson = content.lessons.find(
    (entry) => !completedMap.has(entry.id),
  );
  if (!nextLesson || nextLesson.id !== lessonId) {
    throw validationError(
      "Lessons open in order. Complete your current lesson first.",
      { lessonId: "This lesson is still locked." },
    );
  }

  const now = new Date();

  // One append-only completion fact; a concurrent duplicate loses P2002
  // and simply continues — the row exists either way. This deliberately
  // happens OUTSIDE an interactive transaction: Postgres aborts a
  // transaction after any failed statement (25P02), so a caught-P2002
  // inside $transaction would poison the following latch queries.
  await db.staffTrainingLessonProgress
    .create({
      data: {
        enrollmentId: enrollment.id,
        lessonId,
        completedAt: now,
      },
    })
    .catch((error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    });

  // Final-lesson completion latch (brief §28): once every lesson has a
  // row, stamp completedAt exactly once via the conditional
  // `completedAt = null` → set UPDATE. The invariants hold without a
  // wrapping transaction because progress rows are append-only (once all
  // lessons are present they stay present) and the conditional UPDATE is
  // atomic — exactly one racing final call wins; every other caller
  // re-reads and returns the same final state below.
  const rowsCount = await db.staffTrainingLessonProgress.count({
    where: { enrollmentId: enrollment.id },
  });
  let courseJustCompleted = false;
  if (rowsCount >= content.lessons.length && !enrollment.completedAt) {
    const latched = await db.staffTrainingEnrollment.updateMany({
      where: { id: enrollment.id, completedAt: null },
      data: { completedAt: now },
    });
    courseJustCompleted = latched.count === 1;
  }

  return buildCompletionResult({
    enrollmentId: enrollment.id,
    lessonOrder: content.lessons.map((entry) => entry.id),
    lessonId,
    lessonCompletedAt: now,
    alreadyCompleted: false,
    courseJustCompleted,
  });
}

/* -------------------------------------------------------------------------
 * Shared result assembly
 * ---------------------------------------------------------------------- */

/**
 * Assemble the completion result from FRESH persisted state: re-reads the
 * enrollment and its progress rows so every caller — winner, idempotent
 * repeat or a losing concurrent call — returns the SAME final state, with
 * the winner's persisted timestamps (brief §28/§35).
 *
 * Self-healing latch: a caller can observe "all lesson rows present" in
 * the narrow window AFTER another caller's final-lesson row committed but
 * BEFORE its completedAt latch committed. Whenever this read sees every
 * lesson present with completedAt still null, it runs the same
 * conditional `completedAt = null` → set UPDATE — so every legitimate
 * concurrent/retry call converges on the SAME completed final state
 * (exactly one row, exactly one timestamp, one logical winner).
 */
async function buildCompletionResult(input: {
  enrollmentId: string;
  /** Lesson ids in the pinned course order. */
  lessonOrder: string[];
  lessonId: string;
  /** Fallback instant (this call's clock) when no row exists yet. */
  lessonCompletedAt: Date;
  alreadyCompleted: boolean;
  courseJustCompleted: boolean;
}): Promise<CompleteLessonResult> {
  let enrollment = await db.staffTrainingEnrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
  });
  let rows = await db.staffTrainingLessonProgress.findMany({
    where: { enrollmentId: input.enrollmentId },
    select: { lessonId: true, completedAt: true },
  });

  let courseJustCompleted = input.courseJustCompleted;
  if (rows.length >= input.lessonOrder.length && !enrollment.completedAt) {
    const latched = await db.staffTrainingEnrollment.updateMany({
      where: { id: input.enrollmentId, completedAt: null },
      data: { completedAt: new Date() },
    });
    courseJustCompleted = courseJustCompleted || latched.count === 1;
    enrollment = await db.staffTrainingEnrollment.findUniqueOrThrow({
      where: { id: input.enrollmentId },
    });
    rows = await db.staffTrainingLessonProgress.findMany({
      where: { enrollmentId: input.enrollmentId },
      select: { lessonId: true, completedAt: true },
    });
  }

  const completedIds = new Set(rows.map((row) => row.lessonId));
  const lessonRow = rows.find((row) => row.lessonId === input.lessonId);

  // The next current lesson: the first lesson (pinned order) without a
  // completion row — null once the course is completed.
  const currentLessonId = enrollment.completedAt
    ? null
    : (input.lessonOrder.find((id) => !completedIds.has(id)) ?? null);

  return {
    courseId: enrollment.courseId,
    lesson: {
      lessonId: input.lessonId,
      state: "COMPLETED",
      completedAt: (lessonRow?.completedAt ?? input.lessonCompletedAt).toISOString(),
    },
    alreadyCompleted: input.alreadyCompleted,
    courseJustCompleted,
    courseState: deriveCourseState(enrollment.completedAt, rows.length),
    courseCompletedAt: enrollment.completedAt?.toISOString() ?? null,
    currentLessonId,
    completedLessons: rows.length,
    totalLessons: input.lessonOrder.length,
  };
}
