/**
 * FinFam Admin console constants (Stage 11, CLIENT-SAFE).
 *
 * Small by design — the console shows only real operational functionality
 * (approved brief §16/§17). No Earnings/Performance/Members/Analytics
 * destinations exist or get links; there is deliberately no Resources
 * entry (§49: no admin resource CMS in this stage).
 */

/** Visibly distinct console identity — never mistaken for the Staff Portal. */
export const ADMIN_CONSOLE_LABEL = "FinFam Admin";

/** Admin navigation — real destinations only (approved brief §16). */
export const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/reports", label: "Daily Reports" },
  { href: "/admin/audit", label: "Audit Log" },
] as const;

/** Directory rows per page — server-paginated from day one (brief §18). */
export const ADMIN_DIRECTORY_PAGE_SIZE = 20;

/** Admin Daily Reports rows per page (brief §24). */
export const ADMIN_REPORTS_PAGE_SIZE = 20;

/** Audit log rows per page (brief §46). */
export const ADMIN_AUDIT_PAGE_SIZE = 20;

/** Human labels for audit actions — never colour-only (brief §46/§63). */
export const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  STAFF_SUSPENDED: "Staff suspended",
  STAFF_REACTIVATED: "Staff reactivated",
};

/**
 * Suspension consequence copy, shown verbatim in the confirmation dialog
 * (approved brief §30).
 */
export const ADMIN_SUSPENSION_CONSEQUENCE =
  "This immediately removes Staff Portal access.";

/** Neutral directory empty state. */
export const ADMIN_DIRECTORY_EMPTY_MESSAGE =
  "No Staff records match the current search.";

/** Self-reported framing for the admin reports views (brief §25): the
 * word boundary is preserved even for management — these figures remain
 * the Staff member's own reported activity, never verified performance,
 * confirmed member growth, or payroll data. */
export const ADMIN_REPORTS_SELF_REPORTED_NOTICE =
  "These figures are the Staff member's own reported activity. They are not independently verified by FinFam systems.";
