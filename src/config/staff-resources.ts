/**
 * Staff Resources registry (Stage 10, CLIENT-SAFE).
 *
 * The single source of truth for what the Staff Portal's /staff/resources
 * page and home card show. Every entry is APPROVED MATERIAL ONLY — entries
 * are never invented to fill a category, and nothing is listed as
 * downloadable unless the real file actually exists and has been supplied
 * by the business.
 *
 * AVAILABILITY MODEL (approved brief §4):
 *  - "available"  A real file exists and may be opened/downloaded.
 *                 There are currently ZERO entries in this state, so the
 *                 UI can never render a fabricated or disabled download
 *                 button (brief §5 — hard requirement).
 *  - "in_portal"  The resource exists as a real Staff Portal destination.
 *  - "channel"    The material/access is provided through the approved
 *                 Staff communication channel (informational row only).
 *  - "pending"    FinFam has not yet supplied it (honest text only).
 *
 * ─── FUTURE SECURE-FILE CONTRACT (brief §8 — documented, NOT built) ─────
 * When the FIRST real downloadable Staff resource is introduced later:
 *   1. classify it Staff-only vs public;
 *   2. keep Staff-only files OUTSIDE /public (never guessable URLs);
 *   3. serve them through an authenticated route:
 *        authenticated Staff session → registry lookup by resource id
 *        → server-side protected file → streamed response
 *      (GET /api/staff/resources/[resourceId]/file, session-derived
 *      identity, no user-controlled path segments);
 *   4. add the registry entry with availability "available";
 *   5. update the Onboarding resources step IF its "not downloadable
 *      from this portal" statement becomes false, bumping the onboarding
 *      content version when meaning changes;
 *   6. only then may a download action render — until that moment the
 *      secure file route itself must NOT exist (no dead routes).
 * ────────────────────────────────────────────────────────────────────────
 */

/** Approved resource categories, in approved display order (brief §7). */
export const STAFF_RESOURCES_CATEGORIES = [
  "Marketing Resources",
  "Customer Education Materials",
  "Approved Marketing Guidelines",
  "Reporting Instructions",
  "Training Resources",
] as const;

export type StaffResourceCategory = (typeof STAFF_RESOURCES_CATEGORIES)[number];

export const STAFF_RESOURCE_AVAILABILITY_STATES = [
  "available",
  "in_portal",
  "channel",
  "pending",
] as const;

export type StaffResourceAvailability =
  (typeof STAFF_RESOURCE_AVAILABILITY_STATES)[number];

export interface StaffResourceEntry {
  /** Stable registry id — never user-facing identity. */
  id: string;
  title: string;
  category: StaffResourceCategory;
  availability: StaffResourceAvailability;
  /** Honest description. Never promises a file that does not exist. */
  description: string;
  /** Real in-portal destination — set ONLY for availability "in_portal". */
  href?: string;
  /** Action label for the in-portal link (brief §6 exact CTAs). */
  actionLabel?: string;
  /** Resource content version — displayed where relevant (brief §7). */
  version?: string;
  /** ISO date (YYYY-MM-DD) of the last approved content change. */
  updatedAt?: string;
}

/**
 * The approved registry, in approved category order (brief §6/§7).
 * Zero file-backed entries exist today, so zero download actions render —
 * pinned by tests (tests/staff-resources.test.ts).
 */
export const STAFF_RESOURCES: readonly StaffResourceEntry[] = [
  {
    id: "marketing-resources",
    title: "Marketing Resources",
    category: "Marketing Resources",
    availability: "pending",
    description:
      "FinFam has not yet supplied marketing resources for portal distribution. When approved marketing materials are provided, they will be listed here.",
  },
  {
    id: "customer-education-materials",
    title: "Customer Education Materials",
    category: "Customer Education Materials",
    availability: "pending",
    description:
      "FinFam has not yet supplied customer education materials for portal distribution. When approved materials are provided, they will be listed here.",
  },
  {
    id: "approved-marketing-guidelines",
    title: "Approved Marketing Guidelines",
    category: "Approved Marketing Guidelines",
    availability: "pending",
    description:
      "FinFam has not yet supplied the approved marketing guidelines for portal distribution. When the guidelines are provided, they will be listed here.",
  },
  {
    id: "reporting-instructions",
    title: "Reporting Instructions",
    category: "Reporting Instructions",
    availability: "in_portal",
    href: "/staff/reports",
    actionLabel: "Open Daily Reports",
    description:
      "Your reporting instructions are incorporated into the Daily Reporting workflow itself — every field on the report form shows its approved meaning, and your onboarding accountability briefing explains how daily reporting works.",
  },
  {
    id: "training-resources",
    title: "Training Resources",
    category: "Training Resources",
    availability: "in_portal",
    href: "/staff/training",
    actionLabel: "Open Staff Training",
    description:
      "FinFam Staff Foundations — the required staff training course — is available in your portal, together with your training overview and progress.",
  },
] as const;

/**
 * The FinFam Staff Communication Group is a COMMUNICATION REFERENCE, not a
 * downloadable resource (brief §6): it appears as channel context and never
 * renders a link, because no official communication link has been supplied.
 */
export const STAFF_COMMUNICATION_REFERENCE = {
  title: "FinFam Staff Communication Group",
  copy: "Access to the FinFam Staff Communication Group is provided through your approved staff communication/onboarding channel. It is a communication reference, not a downloadable file — the onboarding team guides you on receiving and using it. When the official FinFam contact is configured, it appears on your portal Home.",
} as const;

/** Honest, text-based availability labels (never colour alone). */
export const STAFF_RESOURCE_AVAILABILITY_LABELS: Record<
  StaffResourceAvailability,
  string
> = {
  available: "Available",
  in_portal: "Available in your portal",
  channel: "Provided through your approved staff communication channel",
  pending: "Not yet supplied",
} as const;

export interface StaffResourcesHomeSummary {
  /** Real in-portal resources (title + destination), registry order. */
  inPortal: readonly { title: string; href: string }[];
  /** Honest note covering the channel/pending categories. */
  remainingNote: string;
}

/**
 * Derives the portal-home Resources card content from registry truth —
 * no hard-coded availability, no fake counts (brief §10).
 */
export function getStaffResourcesHomeSummary(): StaffResourcesHomeSummary {
  const inPortal = STAFF_RESOURCES.flatMap((entry) =>
    entry.availability === "in_portal" && entry.href
      ? [{ title: entry.title, href: entry.href }]
      : [],
  );
  return {
    inPortal,
    remainingNote:
      "Other resource categories are not yet available in the portal — FinFam provides them through your approved staff communication/onboarding channel.",
  };
}
