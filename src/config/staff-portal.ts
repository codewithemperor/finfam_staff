/**
 * Staff Portal constants (Stage 7, CLIENT-SAFE).
 *
 * Small by design: the portal shows only real functionality (brief §20/§23).
 * No metrics, no fake modules — Reporting/Earnings/Members/Performance/
 * Analytics destinations are deliberately absent until those modules exist.
 */

/** The operational-role identity shown beside the appointment designation. */
export const STAFF_PORTAL_OPERATIONAL_ROLE = "FinFam Growth Ambassador";

/** Portal navigation — real destinations only (brief §21). */
export const STAFF_PORTAL_NAV = [
  { href: "/staff", label: "Home" },
  { href: "/staff/appointment", label: "My Appointment" },
  { href: "/staff/onboarding", label: "Onboarding" },
  { href: "/staff/resources", label: "Resources" },
  { href: "/staff/profile", label: "Profile" },
] as const;

/**
 * The five resource categories from the approved Section 7 material (§32).
 * No resource assets exist yet: the portal LIST ONLY, with honest copy —
 * never fabricated downloads.
 */
export const STAFF_RESOURCE_CATEGORIES = [
  "FinFam Staff Communication Group",
  "Marketing Resources",
  "Customer Education Materials",
  "Approved Marketing Guidelines",
  "Reporting Instructions",
] as const;

/** Honest availability copy while no real assets exist (§32/§42). */
export const STAFF_RESOURCES_PENDING_NOTICE =
  "These resources will be made available through your approved Staff communication/onboarding channel.";
