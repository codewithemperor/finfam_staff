import "server-only";

import { Prisma } from "@prisma/client";

import {
  DAILY_REPORT_META,
  DAILY_REPORT_METRIC_NAMES,
  DAILY_REPORT_PAGE_SIZE,
} from "@/config/daily-report";
import { AppError, conflictError, notFoundError, validationError } from "@/lib/errors";
import {
  lagosCurrentMonthISO,
  lagosDateISOFromUtcMidnight,
  lagosDateISOToUtcMidnight,
  lagosDaysBetween,
  lagosMonthToUtcMidnight,
  lagosNow,
  lagosTodayISO,
  nextLagosMonth,
  parseLagosDateISO,
} from "@/lib/dates/lagos";
import { db } from "@/lib/db";
import {
  dailyReportDraftSchema,
} from "@/lib/validation/daily-report";
import type { DailyReportDraftInput } from "@/lib/validation/daily-report";
import type { StaffSessionContext } from "@/server/services/staff-auth";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import type {
  CreateOrGetReportResult,
  DailyReportSummaryView,
  DailyReportTodayState,
  DailyReportView,
  SubmitReportResult,
} from "@/types/staff-reports";

/**
 * Daily Reporting & Accountability (Stage 8) — an ongoing STAFF PLATFORM
 * module. Every rule lives here; pages and route handlers never touch
 * Prisma and never decide eligibility.
 *
 * Identity & ownership (brief §31/§32): the Staff row comes ONLY from the
 * authenticated session chain (Session → StaffAccount → Staff). Every
 * query is scoped by `id + staffId` (or `staffId` alone for lists), so a
 * foreign report id behaves exactly like a missing one (404 — existence
 * is never disclosed). No staffId / reference / appointment reference /
 * email / accountId is ever accepted from the browser.
 *
 * Eligibility (brief §2): ACTIVE account (implied — suspended sessions
 * never resolve) + a Staff row + APPROVED_STAFF + COMPLETED onboarding.
 * Incomplete onboarding → 403 FORBIDDEN (never 401, so the UI never
 * misroutes an onboarding gate to the login screen).
 *
 * Dates (brief §3–§5): reportDate is the Africa/Lagos calendar date the
 * work occurred, stored as that DATE (UTC midnight — src/lib/dates/
 * lagos.ts); submittedAt is the server instant of finalisation. Future
 * dates are rejected; backdating is bounded by
 * DAILY_REPORT_BACKDATE_LIMIT_DAYS (default 7). No clock deadline exists
 * and none is invented.
 *
 * Lifecycle (brief §14–§21): DRAFT → SUBMITTED, one way. Creation is a
 * race-safe create-or-get (@@unique([staffId, reportDate]); the P2002
 * loser re-reads the winner). Drafts are full-replace saves. Submission
 * is a conditional updateMany latch — exactly one winner, one
 * submittedAt; repeats/concurrent calls return the SAME submitted state.
 * Submitted reports are permanently read-only; drafts are never deleted.
 *
 * Notifications (brief §25/§27): the DAILY_REPORT_SUBMITTED receipt is
 * queued INSIDE the winning submission transaction (dedupeKey
 * "DAILY_REPORT_SUBMITTED:<reportId>" — exactly once) and dispatched only
 * AFTER the commit; a Mailjet failure can never roll back a submission.
 * There is deliberately NO reminder notification (no confirmed deadline).
 *
 * Boundary (brief §22–§24): the data is STAFF SELF-REPORTED activity —
 * never verified, never compensated (no ₦650 path exists), and never a
 * person-level member/prospect record.
 */

/* -------------------------------------------------------------------------
 * Eligibility (brief §2)
 * ---------------------------------------------------------------------- */

const ONBOARDING_REQUIRED_MESSAGE =
  "Complete your onboarding to begin daily reporting.";

/**
 * The shared operational gate for every Daily Reporting read and write.
 * Throws 403 FORBIDDEN when the authenticated Staff member has not
 * completed onboarding (or, defensively, is not APPROVED_STAFF).
 */
async function ensureReportingEligibility(
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
 * Date rules (brief §3–§5)
 * ---------------------------------------------------------------------- */

/**
 * Approved MVP backdating window in Africa/Lagos calendar days
 * (DAILY_REPORT_BACKDATE_LIMIT_DAYS, default 7). Read at call time so
 * deployments can tune it without a code change. 0 = today only.
 */
function backdateLimitDays(): number {
  const raw = Number.parseInt(
    process.env.DAILY_REPORT_BACKDATE_LIMIT_DAYS ?? "",
    10,
  );
  return Number.isFinite(raw) && raw >= 0 ? raw : 7;
}

/**
 * Resolve the requested reporting date or throw a field-level validation
 * error. Absent → Africa/Lagos today; future dates and dates older than
 * the configured window are rejected (§5).
 */
function resolveRequestedReportDate(raw: string | undefined): string {
  if (raw === undefined) return lagosTodayISO();

  const dateISO = parseLagosDateISO(raw);
  if (!dateISO) {
    throw validationError("The reporting date is not valid.", {
      reportDate: "Enter a valid date in YYYY-MM-DD format.",
    });
  }

  const today = lagosTodayISO();
  const diffDays = lagosDaysBetween(today, dateISO);

  if (diffDays > 0) {
    throw validationError("You cannot report for a future date.", {
      reportDate: "Reports can only cover today or earlier dates.",
    });
  }

  const limit = backdateLimitDays();
  if (-diffDays > limit) {
    throw validationError(
      `Reports can only cover the last ${limit} day${limit === 1 ? "" : "s"}.`,
      {
        reportDate: `Reports can only cover today and the previous ${limit} day${limit === 1 ? "" : "s"}.`,
      },
    );
  }

  return dateISO;
}

/* -------------------------------------------------------------------------
 * Row → view
 * ---------------------------------------------------------------------- */

type DailyReportRow = Prisma.DailyReportGetPayload<object>;

function toReportView(row: DailyReportRow): DailyReportView {
  const metrics: DailyReportView["metrics"] = {};
  for (const name of DAILY_REPORT_METRIC_NAMES) {
    metrics[name] = row[name as keyof DailyReportRow] as number;
  }
  return {
    id: row.id,
    reportDate: lagosDateISOFromUtcMidnight(row.reportDate),
    status: row.status,
    version: row.version,
    metrics,
    activitySummary: row.activitySummary,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummaryView(row: DailyReportRow): DailyReportSummaryView {
  return {
    id: row.id,
    reportDate: lagosDateISOFromUtcMidnight(row.reportDate),
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    establishedMembersCreated: row.establishedMembersCreated,
    individualsContacted: row.individualsContacted,
    newRegistrations: row.newRegistrations,
  };
}

/* -------------------------------------------------------------------------
 * Create-or-get (brief §15)
 * ---------------------------------------------------------------------- */

/**
 * Create-or-get the report for the requested date. Two tabs (or two
 * racing requests) can never create two rows: the unique
 * [staffId, reportDate] constraint decides the winner and the loser
 * re-reads it. If the date already holds a SUBMITTED report it is
 * returned unchanged — callers route on `report.status`.
 */
export async function createOrGetDailyReport(
  session: StaffSessionContext,
  rawReportDate?: string,
): Promise<CreateOrGetReportResult> {
  await ensureReportingEligibility(session);

  const dateISO = resolveRequestedReportDate(rawReportDate);
  const reportDate = lagosDateISOToUtcMidnight(dateISO);

  const created = await db.dailyReport
    .create({
      data: {
        staffId: session.staff.rowId,
        reportDate,
        version: DAILY_REPORT_META.version,
      },
    })
    .catch((error) => {
      // A concurrent create-or-get for the same date won — use its row.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    });

  if (created) {
    return { report: toReportView(created), created: true };
  }

  const existing = await db.dailyReport.findUnique({
    where: {
      staffId_reportDate: { staffId: session.staff.rowId, reportDate },
    },
  });
  if (!existing) {
    throw new AppError(
      "INTERNAL",
      "Your daily report could not be opened. Please try again.",
      { status: 500 },
    );
  }
  return { report: toReportView(existing), created: false };
}

/* -------------------------------------------------------------------------
 * Draft save (brief §16/§19/§20)
 * ---------------------------------------------------------------------- */

/**
 * Full-replace save of a DRAFT. Foreign ids are 404; submitted reports
 * are 409 (read-only permanently — no edit, no reopen). Drafts are never
 * deleted; values may simply be revised (zeros included).
 *
 * Concurrency (production-readiness remediation §8): the save is a SINGLE
 * conditional write — `status: "DRAFT"` is part of the WHERE clause, so a
 * report submitted between a caller's read and its write can never be
 * modified. The old check-then-update pattern could lose that race and
 * mutate metrics of an already-SUBMITTED report; `updateMany` makes the
 * submitted-immutability rule atomic with the write itself. count === 0
 * re-reads the owned row and answers 404 (not owned) or 409 (submitted).
 */
export async function saveDailyReportDraft(
  session: StaffSessionContext,
  reportId: string,
  input: DailyReportDraftInput,
): Promise<DailyReportView> {
  await ensureReportingEligibility(session);

  const latched = await db.dailyReport.updateMany({
    where: {
      id: reportId,
      staffId: session.staff.rowId,
      status: "DRAFT",
    },
    data: {
      individualsContacted: input.individualsContacted,
      groupsApproached: input.groupsApproached,
      followUpActivities: input.followUpActivities,
      newRegistrations: input.newRegistrations,
      establishedMembersCreated: input.establishedMembersCreated,
      firstDepositsAchieved: input.firstDepositsAchieved,
      savingsGoalsActivated: input.savingsGoalsActivated,
      memberEngagement: input.memberEngagement,
      connectionsBuilt: input.connectionsBuilt,
      activitySummary: input.activitySummary,
    },
  });

  if (latched.count === 1) {
    const saved = await db.dailyReport.findUniqueOrThrow({
      where: { id: reportId },
    });
    return toReportView(saved);
  }

  // count === 0: either the report is not owned by this session (404 —
  // existence is never disclosed) or it is no longer a DRAFT. Re-read the
  // owned row to distinguish; a SUBMITTED report is NEVER reopened or
  // mutated by this path.
  const existing = await db.dailyReport.findFirst({
    where: { id: reportId, staffId: session.staff.rowId },
  });
  if (!existing) {
    throw notFoundError("We couldn't find that report.");
  }
  throw conflictError("Submitted reports can no longer be changed.");
}

/* -------------------------------------------------------------------------
 * Submission (brief §18/§21/§27)
 * ---------------------------------------------------------------------- */

/**
 * Finalise a DRAFT with the one-way conditional latch. Exactly ONE call
 * wins and stamps submittedAt; every other caller — repeated clicks,
 * concurrent tabs, retries — re-reads and returns the SAME submitted
 * report (`alreadySubmitted: true`). The receipt notification intent is
 * queued in the SAME transaction (exactly once by dedupeKey) and
 * dispatched only after the commit.
 */
export async function submitDailyReport(
  session: StaffSessionContext,
  reportId: string,
): Promise<SubmitReportResult> {
  await ensureReportingEligibility(session);

  const existing = await db.dailyReport.findFirst({
    where: { id: reportId, staffId: session.staff.rowId },
  });
  if (!existing) {
    throw notFoundError("We couldn't find that report.");
  }
  if (existing.status === "SUBMITTED") {
    // Idempotent repeat — the same final state, never a second timestamp.
    return { report: toReportView(existing), alreadySubmitted: true };
  }

  // Defensive: the persisted draft must satisfy the same schema the save
  // API enforced (all-zero drafts are valid by design).
  const persisted = dailyReportDraftSchema.safeParse({
    individualsContacted: existing.individualsContacted,
    groupsApproached: existing.groupsApproached,
    followUpActivities: existing.followUpActivities,
    newRegistrations: existing.newRegistrations,
    establishedMembersCreated: existing.establishedMembersCreated,
    firstDepositsAchieved: existing.firstDepositsAchieved,
    savingsGoalsActivated: existing.savingsGoalsActivated,
    memberEngagement: existing.memberEngagement,
    connectionsBuilt: existing.connectionsBuilt,
    activitySummary: existing.activitySummary ?? undefined,
  });
  if (!persisted.success) {
    throw validationError(
      "This draft has invalid values that must be corrected before it can be submitted.",
    );
  }

  const submittedAt = lagosNow();

  const outcome = await db.$transaction(async (tx) => {
    // The one-way latch: exactly one caller flips DRAFT → SUBMITTED.
    const latched = await tx.dailyReport.updateMany({
      where: {
        id: existing.id,
        staffId: session.staff.rowId,
        status: "DRAFT",
      },
      data: { status: "SUBMITTED", submittedAt },
    });
    if (latched.count !== 1) return null;

    const enqueued = await enqueueNotification(tx, {
      type: "DAILY_REPORT_SUBMITTED",
      dedupeKey: buildDedupeKey("DAILY_REPORT_SUBMITTED", existing.id),
      candidateId: session.candidate.id,
      recipientEmail: session.candidate.email,
    });

    return { enqueued };
  });

  if (!outcome) {
    // A concurrent submit won the latch between our read and write —
    // re-read and return the winner's state (idempotent for the caller).
    const winner = await db.dailyReport.findUnique({
      where: { id: existing.id },
    });
    if (!winner || winner.status !== "SUBMITTED") {
      throw new AppError(
        "INTERNAL",
        "Your daily report could not be submitted. Please try again.",
        { status: 500 },
      );
    }
    return { report: toReportView(winner), alreadySubmitted: true };
  }

  // Post-commit dispatch — a Mailjet failure can never disturb the
  // submission (§27). Suppressed entirely while notifications are disabled.
  if (outcome.enqueued.deliveryId) {
    dispatchNotification(outcome.enqueued.deliveryId);
  }

  const final = await db.dailyReport.findUniqueOrThrow({
    where: { id: existing.id },
  });
  return { report: toReportView(final), alreadySubmitted: false };
}

/* -------------------------------------------------------------------------
 * Reads — detail, history, today (brief §33/§35/§36)
 * ---------------------------------------------------------------------- */

/**
 * One owned report (draft editor hydration and submitted detail). The
 * query is id + session Staff row: a foreign id is a plain 404.
 */
export async function getDailyReportDetail(
  session: StaffSessionContext,
  reportId: string,
): Promise<DailyReportView> {
  await ensureReportingEligibility(session);

  const row = await db.dailyReport.findFirst({
    where: { id: reportId, staffId: session.staff.rowId },
  });
  if (!row) {
    throw notFoundError("We couldn't find that report.");
  }
  return toReportView(row);
}

export interface DailyReportListResult {
  month: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  reports: DailyReportSummaryView[];
  today: DailyReportTodayState;
}

/**
 * Month-bounded, newest-first, paginated history for the authenticated
 * Staff member only (§36) + today's state for the page header (§33).
 */
export async function listDailyReports(
  session: StaffSessionContext,
  query: { month?: string; page?: number },
): Promise<DailyReportListResult> {
  await ensureReportingEligibility(session);

  const month = query.month ?? lagosCurrentMonthISO();
  const page = query.page ?? 1;
  const start = lagosMonthToUtcMidnight(month);
  const endExclusive = lagosMonthToUtcMidnight(nextLagosMonth(month));

  const where = {
    staffId: session.staff.rowId,
    reportDate: { gte: start, lt: endExclusive },
  };

  const [total, rows] = await Promise.all([
    db.dailyReport.count({ where }),
    db.dailyReport.findMany({
      where,
      orderBy: { reportDate: "desc" },
      skip: (page - 1) * DAILY_REPORT_PAGE_SIZE,
      take: DAILY_REPORT_PAGE_SIZE,
    }),
  ]);

  return {
    month,
    page,
    pageSize: DAILY_REPORT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / DAILY_REPORT_PAGE_SIZE)),
    reports: rows.map(toSummaryView),
    today: await getDailyReportTodayState(session.staff.rowId),
  };
}

/**
 * Today's reporting state (Africa/Lagos) for the portal home card (§35)
 * and the history header. A plain read — the home page already gates on
 * onboarding before it renders this.
 */
export async function getDailyReportTodayState(
  staffRowId: string,
): Promise<DailyReportTodayState> {
  const date = lagosTodayISO();
  const row = await db.dailyReport.findUnique({
    where: {
      staffId_reportDate: {
        staffId: staffRowId,
        reportDate: lagosDateISOToUtcMidnight(date),
      },
    },
    select: { id: true, status: true, submittedAt: true },
  });

  if (!row) {
    return { date, state: "NOT_STARTED", reportId: null, submittedAt: null };
  }
  return {
    date,
    state: row.status,
    reportId: row.id,
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}
