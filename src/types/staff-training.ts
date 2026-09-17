/**
 * Staff Training types (Stage 9, CLIENT-SAFE) — the shapes shared between
 * the source-controlled course content (src/config/training/), the training
 * service (src/server/services/staff-training.ts) and the portal pages.
 *
 * Content shapes (TrainingCourseContent / TrainingLessonContent) describe
 * the course itself — authored ONLY from approved FinFam material, kept in
 * src/config/training/. Progress shapes describe the Staff member's
 * persisted state (StaffTrainingEnrollment / StaffTrainingLessonProgress
 * rows) as the service returns it. Dates are ISO strings.
 *
 * Deliberately NO quiz/assessment, score, pass-mark, certificate, badge or
 * video types exist — Stage 9 ships read-and-complete only (brief §14).
 */

/* -------------------------------------------------------------------------
 * Course content shapes (source-controlled config)
 * ---------------------------------------------------------------------- */

/**
 * One content block of a training lesson — the same plain-document
 * philosophy as onboarding: readable typography, not cards or LMS chrome.
 */
export type TrainingBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "facts"; items: { label: string; value: string }[] }
  | { type: "alert"; tone: "accent" | "warning"; title: string; text: string };

/** One lesson of a course, in course order (order = the array position). */
export interface TrainingLessonContent {
  /** Stable lesson id — persisted in staff_training_lesson_progress. */
  id: string;
  title: string;
  /** One-line summary shown in the course progress rail. */
  summary: string;
  blocks: TrainingBlock[];
  /**
   * Optional approved in-portal destinations related to this lesson
   * (e.g. Daily Reports for the reporting lesson, Resources for the
   * approved-materials lesson). Training links — it never embeds or
   * duplicates another module.
   */
  relatedLinks?: { href: string; label: string }[];
}

/**
 * The full content of ONE course version. `version` is pinned onto the
 * StaffTrainingEnrollment row at first open, so a completed course version
 * always remains reviewable as it was written.
 */
export interface TrainingCourseContent {
  /** Stable course id (e.g. "staff-foundations") — URL path segment. */
  id: string;
  /** Course content version (e.g. "1.0") — pinned on enrollment. */
  version: string;
  title: string;
  description: string;
  /**
   * True → the UI shows the "Required Training" label. Required-ness is an
   * ORGANISATIONAL label only: it never technically blocks any other
   * portal tool (brief §16 — see TRAINING_NON_BLOCKING_NOTICE).
   */
  required: boolean;
  lessons: TrainingLessonContent[];
}

/* -------------------------------------------------------------------------
 * Progress / view shapes (persisted state as the service returns it)
 * ---------------------------------------------------------------------- */

/** Derived course state — completion derives from completedAt, no enum. */
export type TrainingCourseStateId = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

/** Derived per-lesson state — sequential completion is server-enforced. */
export type TrainingLessonStateId = "LOCKED" | "CURRENT" | "COMPLETED";

/** One course row of the Training overview (GET /api/staff/training). */
export interface TrainingOverviewCourseView {
  courseId: string;
  title: string;
  description: string;
  /** The Staff member's pinned version when enrolled, else the current one. */
  version: string;
  required: boolean;
  state: TrainingCourseStateId;
  completedLessons: number;
  totalLessons: number;
  startedAt: string | null;
  completedAt: string | null;
}

/** Overview payload — read-only; it NEVER creates enrollments (brief §24). */
export interface TrainingOverviewView {
  courses: TrainingOverviewCourseView[];
  /** Explanatory wording shown wherever "Required Training" appears. */
  nonBlockingNotice: string;
}

/** Per-lesson state within a course detail view. */
export interface TrainingLessonStateView {
  lessonId: string;
  title: string;
  summary: string;
  state: TrainingLessonStateId;
  completedAt: string | null;
}

/** The displayed lesson — content is only ever served for an open lesson. */
export interface TrainingDisplayedLessonView {
  lessonId: string;
  title: string;
  state: TrainingLessonStateId;
  blocks: TrainingBlock[];
  relatedLinks: { href: string; label: string }[];
  /** True only for the CURRENT lesson (the completion action). */
  canComplete: boolean;
  /** True when this is the course's final lesson. */
  isFinalLesson: boolean;
}

/**
 * Course detail payload (GET /api/staff/training/[courseId]). Opening the
 * course lazily creates the enrollment — the ONE approved write side
 * effect of a GET in Stage 9 (brief §34). Locked lesson content is NEVER
 * included: an out-of-range ?lesson= falls back to the open lesson with
 * `lockedNotice` set (brief §26).
 */
export interface TrainingCourseDetailView {
  courseId: string;
  /** The version PINNED on this Staff member's enrollment (not the config's). */
  version: string;
  title: string;
  description: string;
  required: boolean;
  nonBlockingNotice: string;
  state: TrainingCourseStateId;
  startedAt: string;
  completedAt: string | null;
  /** The next lesson to complete; null once the course is completed. */
  currentLessonId: string | null;
  completedLessons: number;
  totalLessons: number;
  lessons: TrainingLessonStateView[];
  lesson: TrainingDisplayedLessonView;
  /** Honest notice when a requested locked/unknown lesson fell back. */
  lockedNotice: string | null;
}

/** Result of POST /api/staff/training/[courseId]/lessons (brief §35). */
export interface CompleteLessonResult {
  courseId: string;
  lesson: {
    lessonId: string;
    state: "COMPLETED";
    completedAt: string;
  };
  /**
   * True when the lesson was ALREADY completed (idempotent repeat or a
   * losing concurrent call). The winning call returns false.
   */
  alreadyCompleted: boolean;
  /** True when THIS call completed the final lesson and latched completedAt. */
  courseJustCompleted: boolean;
  courseState: TrainingCourseStateId;
  courseCompletedAt: string | null;
  /** Next current lesson after this completion; null once completed. */
  currentLessonId: string | null;
  completedLessons: number;
  totalLessons: number;
}

/** Training facts for the Staff Portal home card (read-only, brief §38). */
export interface TrainingHomeState {
  courseId: string;
  title: string;
  required: boolean;
  state: TrainingCourseStateId;
  completedLessons: number;
  totalLessons: number;
  completedAt: string | null;
}
