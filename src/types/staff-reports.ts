/**
 * Daily Reporting view types (Stage 8) — the shapes the reports service
 * returns to pages and route handlers. Dates are ISO strings; the
 * Africa/Lagos labelling happens in the UI layer (src/lib/dates/lagos.ts).
 */

/** The nine approved daily metrics, keyed by their stable config names. */
export type DailyReportMetrics = {
  [name: string]: number;
};

export type DailyReportStatusId = "DRAFT" | "SUBMITTED";

/** One full report — editor hydration and read-only detail. */
export interface DailyReportView {
  id: string;
  /** "YYYY-MM-DD" Africa/Lagos calendar date the work occurred. */
  reportDate: string;
  status: DailyReportStatusId;
  /** Report-schema version pinned at creation (e.g. "1.0"). */
  version: string;
  metrics: DailyReportMetrics;
  activitySummary: string | null;
  /** Server finalisation instant; null while DRAFT. */
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** History-list row (§36) — headline facts only, no full metric dump. */
export interface DailyReportSummaryView {
  id: string;
  reportDate: string;
  status: DailyReportStatusId;
  submittedAt: string | null;
  establishedMembersCreated: number;
  individualsContacted: number;
  newRegistrations: number;
}

/** Today's reporting state for the portal home card (§35). */
export interface DailyReportTodayState {
  /** "YYYY-MM-DD" Africa/Lagos today. */
  date: string;
  state: "NOT_STARTED" | "DRAFT" | "SUBMITTED";
  reportId: string | null;
  submittedAt: string | null;
}

/** Result of POST /api/staff/reports — create-or-get (§15). */
export interface CreateOrGetReportResult {
  report: DailyReportView;
  /** True when THIS call created the row (false = it already existed). */
  created: boolean;
}

/** Result of POST /api/staff/reports/[id]/submit (§21). */
export interface SubmitReportResult {
  report: DailyReportView;
  /**
   * True when the report was ALREADY submitted (idempotent repeat or a
   * losing concurrent call). The winner returns false.
   */
  alreadySubmitted: boolean;
}
