/**
 * Daily Reporting & Accountability constants (Stage 8, CLIENT-SAFE).
 *
 * The reporting categories and field labels are the EXACT four categories
 * the approved Section 7 onboarding content (src/config/onboarding.ts,
 * "accountability" step) teaches — nothing invented, nothing dropped.
 * The helper copy makes each metric's approved MVP meaning visible to the
 * staff member in the UI (Stage 8 brief §11) — not only in comments.
 *
 * `version` is pinned onto every DailyReport row at CREATION so later
 * field evolution can never silently re-mean historical reports (§13).
 */

export const DAILY_REPORT_META = {
  version: "1.0",
} as const;

/** Integer-metric bounds (§12): inclusive; nothing is silently clamped. */
export const DAILY_REPORT_MIN_COUNT = 0;
export const DAILY_REPORT_MAX_COUNT = 999;

/** activitySummary limit (§12) — trimmed, plain text. */
export const DAILY_REPORT_SUMMARY_MAX_LENGTH = 1000;

/** One metric field as rendered by the form and validated by the schema. */
export interface DailyReportMetricField {
  /** Stable key — the DailyReport column AND the zod field name. */
  name: string;
  label: string;
  /** The approved MVP meaning, shown under the field in the UI (§11). */
  helper: string;
}

export interface DailyReportCategory {
  /** Stable id used as the fieldset/legend anchor. */
  id: string;
  legend: string;
  fields: DailyReportMetricField[];
}

/**
 * The four approved reporting categories in the official order (§10).
 */
export const DAILY_REPORT_CATEGORIES: readonly DailyReportCategory[] = [
  {
    id: "prospects",
    legend: "Prospects",
    fields: [
      {
        name: "individualsContacted",
        label: "Individuals contacted",
        helper: "How many people you contacted or introduced FinFam to today.",
      },
      {
        name: "groupsApproached",
        label: "Groups approached",
        helper: "How many groups you approached with FinFam information today.",
      },
      {
        name: "followUpActivities",
        label: "Follow-up activities",
        helper:
          "Count of follow-up actions you performed today — calls, messages, visits, reminders.",
      },
    ],
  },
  {
    id: "member-growth",
    legend: "Member Growth",
    fields: [
      {
        name: "newRegistrations",
        label: "New registrations",
        helper: "New member registrations you supported today.",
      },
      {
        name: "establishedMembersCreated",
        label: "Established Members created",
        helper:
          "Reported members who reached Established status through your support today.",
      },
    ],
  },
  {
    id: "savings-activities",
    legend: "Savings Activities",
    fields: [
      {
        name: "firstDepositsAchieved",
        label: "First deposits achieved",
        helper:
          "Members who made their first deposit with your support today.",
      },
      {
        name: "savingsGoalsActivated",
        label: "Savings goals activated",
        helper: "Member savings goals started or activated today.",
      },
    ],
  },
  {
    id: "community-activities",
    legend: "Community Activities",
    fields: [
      {
        name: "memberEngagement",
        label: "Member engagement",
        helper:
          "Count of member-support / engagement touchpoints you had today.",
      },
      {
        name: "connectionsBuilt",
        label: "Connections built",
        helper:
          "Count of new useful relationships or connections you built today.",
      },
    ],
  },
] as const;

/** Every metric name, in form order — the single source for loops. */
export const DAILY_REPORT_METRIC_NAMES = DAILY_REPORT_CATEGORIES.flatMap(
  (category) => category.fields.map((field) => field.name),
) as readonly string[];

/** Self-reported-data notice (§22) — shown wherever report values appear. */
export const DAILY_REPORT_SELF_REPORTED_NOTICE =
  "These figures are your own reported activity. They are not independently verified by FinFam systems.";

/** History list page size (§36). */
export const DAILY_REPORT_PAGE_SIZE = 20;
