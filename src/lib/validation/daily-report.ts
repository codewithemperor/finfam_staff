import { z } from "zod";

import {
  DAILY_REPORT_CATEGORIES,
  DAILY_REPORT_MAX_COUNT,
  DAILY_REPORT_MIN_COUNT,
  DAILY_REPORT_METRIC_NAMES,
  DAILY_REPORT_SUMMARY_MAX_LENGTH,
} from "@/config/daily-report";

/**
 * Daily Reporting validation (Stage 8).
 *
 * The schema is re-run on the server for every request — the server never
 * trusts the client. NO identity field exists anywhere (no staffId, no
 * reference, no email): ownership is resolved from the authenticated
 * session only (Stage 8 brief §32).
 *
 * Count rules (brief §12): integers, 0..999 inclusive, NEVER silently
 * clamped — invalid values are rejected with per-field errors. The
 * activitySummary is optional, trimmed, plain text, ≤ 1000 chars.
 */

const COUNT_MESSAGE = "Enter a whole number between 0 and 999.";

function countField(label: string) {
  return z
    .number({
      message: `${label} must be a number.`,
    })
    .int(`${label} must be a whole number.`)
    .min(DAILY_REPORT_MIN_COUNT, `${label} cannot be negative.`)
    .max(DAILY_REPORT_MAX_COUNT, `${label} cannot be more than 999.`);
}

/**
 * The nine daily metrics, built from the config category table so the
 * validated fields and the rendered form can never drift apart.
 * (Object.fromEntries widens the keys, so the shape is cast to the exact
 * metric shape below — and the test suite asserts
 * schema keys === DAILY_REPORT_METRIC_NAMES === DailyReportDraftInput.)
 */
type MetricShape = {
  [K in Exclude<keyof DailyReportDraftInput, "activitySummary">]: z.ZodNumber;
};

const metricShape = Object.fromEntries(
  DAILY_REPORT_CATEGORIES.flatMap((category) =>
    category.fields.map((field) => [
      field.name,
      countField(field.label),
    ]),
  ),
) as MetricShape;

/** Body of PATCH /api/staff/reports/[id] — a full draft save. */
export const dailyReportDraftSchema = z.object({
  ...metricShape,
  activitySummary: z
    .string({
      message: "The activity summary must be plain text.",
    })
    .max(
      DAILY_REPORT_SUMMARY_MAX_LENGTH,
      `The activity summary must be ${DAILY_REPORT_SUMMARY_MAX_LENGTH} characters or fewer.`,
    )
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : null;
    }),
});

/** The exact approved metric names — pinned explicitly (see note above). */
export type DailyReportDraftInput = {
  individualsContacted: number;
  groupsApproached: number;
  followUpActivities: number;
  newRegistrations: number;
  establishedMembersCreated: number;
  firstDepositsAchieved: number;
  savingsGoalsActivated: number;
  memberEngagement: number;
  connectionsBuilt: number;
  activitySummary: string | null;
};

/** Body of POST /api/staff/reports — create-or-get, optional date. */
export const createReportSchema = z.object({
  reportDate: z
    .string({ message: "The reporting date is not valid." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "The reporting date is not valid.")
    .optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Query of GET /api/staff/reports — month + page (§30/§36). */
export const reportListQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "The month filter is not valid.")
    .optional(),
  page: z.coerce
    .number()
    .int()
    .min(1, "Page must be 1 or greater.")
    .max(10_000)
    .optional(),
});

export type ReportListQueryInput = z.infer<typeof reportListQuerySchema>;
