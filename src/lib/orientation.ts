import { ORIENTATION_SECTIONS } from "@/config/orientation";
import type { OrientationView } from "@/types/recruitment";

/**
 * Pure helpers that combine static section content (config) with the
 * candidate's persisted orientation state into everything the UI renders.
 * Used by both server components and client components — no Prisma, no
 * server-only imports.
 */

export type OrientationSectionState = "completed" | "current" | "locked";

export interface OrientationSectionView {
  id: string;
  /** 1-based position in the workshop. */
  index: number;
  title: string;
  summary: string;
  state: OrientationSectionState;
  href: string;
}

/**
 * Per-section view states:
 * - completed → section has been marked as read
 * - current   → the first unread section (the resume point)
 * - locked    → unread section that comes after the current one
 *
 * Once orientation is completed, every previously read section stays
 * "completed"; there is no current section anymore.
 */
export function getOrientationSectionViews(
  view: OrientationView,
): OrientationSectionView[] {
  const completedIds = new Set(
    view.orientation?.sections.map((section) => section.id) ?? [],
  );
  const firstIncomplete = ORIENTATION_SECTIONS.find(
    (section) => !completedIds.has(section.id),
  );

  return ORIENTATION_SECTIONS.map((section, index) => {
    const state: OrientationSectionState = completedIds.has(section.id)
      ? "completed"
      : section.id === firstIncomplete?.id
        ? "current"
        : "locked";

    return {
      id: section.id,
      index: index + 1,
      title: section.title,
      summary: section.summary,
      state,
      href: `/orientation/${view.referenceNumber}/${section.id}`,
    };
  });
}

export function getOrientationProgress(view: OrientationView): {
  completed: number;
  total: number;
  /** True when every section is read (even before explicit completion). */
  allSectionsRead: boolean;
  /** True once the candidate explicitly completed the workshop. */
  isComplete: boolean;
} {
  const completed = view.orientation?.sections.length ?? 0;
  return {
    completed,
    total: ORIENTATION_SECTIONS.length,
    allSectionsRead: completed === ORIENTATION_SECTIONS.length,
    isComplete: Boolean(view.orientation?.completedAt),
  };
}

/** The section the candidate should open next, or null when done. */
export function getResumeSection(
  view: OrientationView,
): OrientationSectionView | null {
  if (view.orientation?.completedAt) return null;
  return (
    getOrientationSectionViews(view).find(
      (section) => section.state === "current",
    ) ?? null
  );
}
