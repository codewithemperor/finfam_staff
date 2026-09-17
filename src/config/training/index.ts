import type { TrainingCourseContent } from "@/types/staff-training";

import {
  STAFF_FOUNDATIONS_CURRENT_VERSION,
  STAFF_FOUNDATIONS_VERSIONS,
} from "./staff-foundations";

/**
 * Staff Training course registry (Stage 9, CLIENT-SAFE).
 *
 * One course ships in Stage 9 — "FinFam Staff Foundations" — but the
 * registry is structurally capable of holding more courses later (brief
 * §48): pages, service and APIs all loop over this list, so a future
 * course is a config addition, not a rebuild.
 *
 * Content is SOURCE-CONTROLLED (brief §2/§3): course identity, lessons,
 * titles and content blocks live in src/config/training/; the database
 * stores only Staff progress. There is no course CMS and no
 * database-authored content.
 *
 * Versioning (brief §23/§50): an enrollment pins courseVersion at first
 * open. A future 2.0 must be ADDED to the version map — never silently
 * replacing 1.0 — so a 1.0 completion stays reviewable exactly as it was
 * written. Whether future versions require retraining is an open business
 * policy (docs/CONTENT-QUESTIONS.md); this MVP builds NO automatic
 * retraining.
 */

export {
  STAFF_FOUNDATIONS_CURRENT_VERSION,
  STAFF_FOUNDATIONS_VERSIONS,
};

/** Registry of every published course (order = overview display order). */
export const TRAINING_COURSES: readonly TrainingCourseContent[] = [
  STAFF_FOUNDATIONS_VERSIONS[STAFF_FOUNDATIONS_CURRENT_VERSION],
];

/** Look up a course by its stable id (URL path segment). */
export function getTrainingCourse(
  courseId: string,
): TrainingCourseContent | undefined {
  return TRAINING_COURSES.find((course) => course.id === courseId);
}

/**
 * Resolve the content of ONE pinned version. A missing pinned version
 * fails loudly in the service (defensive INTERNAL — same philosophy as
 * the appointment content registry); it is never silently substituted,
 * because completed history must stay reviewable as written.
 */
export function getTrainingCourseContent(
  courseId: string,
  version: string,
): TrainingCourseContent | undefined {
  if (courseId === "staff-foundations") {
    return STAFF_FOUNDATIONS_VERSIONS[version];
  }
  return undefined;
}

/** The "Required Training" organisational label (brief §16). */
export const TRAINING_REQUIRED_LABEL = "Required Training";

/**
 * The non-blocking explanation shown wherever "Required Training" appears
 * (brief §16 — exact approved meaning): an incomplete course never
 * technically blocks Daily Reporting, Appointment, Resources, Profile or
 * the Staff Portal home. Only Training itself requires completed
 * onboarding.
 */
export const TRAINING_NON_BLOCKING_NOTICE =
  "Training does not block your other Staff Portal tools in this release.";

/** Honest notice when a locked lesson is requested (brief §26). */
export const TRAINING_LOCKED_LESSON_NOTICE =
  "That lesson is not open yet. Lessons open in order — complete your current lesson to continue.";

/** Lesson-state labels — states are always visible as text, not colour. */
export const TRAINING_LESSON_STATE_LABELS: Record<
  "LOCKED" | "CURRENT" | "COMPLETED",
  string
> = {
  LOCKED: "Locked",
  CURRENT: "Current lesson",
  COMPLETED: "Completed",
} as const;
