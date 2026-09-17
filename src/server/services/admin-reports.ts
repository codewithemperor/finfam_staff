import "server-only";

import { db } from "@/lib/db";
import { ADMIN_REPORTS_PAGE_SIZE } from "@/config/admin";
import { notFoundError } from "@/lib/errors";
import {
  lagosMonthToUtcMidnight,
  nextLagosMonth,
} from "@/lib/dates/lagos";

/**
 * Admin Daily Reports reads (Stage 11, approved brief §23–§26).
 *
 * MVP policy: SUBMITTED reports ONLY — drafts are hidden (they are
 * incomplete staff work; there is deliberately no config flag, a hard
 * submitted-only policy). These views are strictly READ-ONLY: no PATCH,
 * no DELETE, no approve/reject/review/correct path exists anywhere, and
 * submitted reports remain immutable exactly as the Staff service
 * guarantees (§26).
 *
 * Framing (§25): every view carries the established self-reported notice.
 * Management sees staff SELF-REPORTED ACTIVITY — never "verified
 * performance", "confirmed member growth" or payroll data.
 */

export interface AdminReportListRow {
  id: string;
  reportDate: Date;
  status: "SUBMITTED";
  submittedAt: Date;
  staffRowId: string;
  staffId: string;
  staffName: string;
}

export interface AdminReportListResult {
  reports: AdminReportListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  month: string | null;
}

/**
 * Newest-first, paginated list of SUBMITTED reports across all staff with
 * a month filter (Africa/Lagos calendar semantics — the same conversion
 * helpers the Staff history uses) and a whitelisted staff search
 * (Staff ID or staff name; Prisma parameterised queries only).
 */
export async function listAdminSubmittedReports(query: {
  month?: string;
  staff?: string;
  page?: number;
}): Promise<AdminReportListResult> {
  const page = query.page ?? 1;

  const reportDate = query.month
    ? {
        gte: lagosMonthToUtcMidnight(query.month),
        lt: lagosMonthToUtcMidnight(nextLagosMonth(query.month)),
      }
    : undefined;

  const where = {
    status: "SUBMITTED" as const,
    ...(reportDate ? { reportDate } : {}),
    ...(query.staff
      ? {
          staff: {
            OR: [
              { staffId: { contains: query.staff, mode: "insensitive" as const } },
              {
                candidate: {
                  fullName: { contains: query.staff, mode: "insensitive" as const },
                },
              },
            ],
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.dailyReport.count({ where }),
    db.dailyReport.findMany({
      where,
      orderBy: [{ reportDate: "desc" }, { submittedAt: "desc" }],
      skip: (page - 1) * ADMIN_REPORTS_PAGE_SIZE,
      take: ADMIN_REPORTS_PAGE_SIZE,
      select: {
        id: true,
        reportDate: true,
        status: true,
        submittedAt: true,
        staff: {
          select: {
            id: true,
            staffId: true,
            candidate: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  return {
    page,
    pageSize: ADMIN_REPORTS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_REPORTS_PAGE_SIZE)),
    month: query.month ?? null,
    reports: rows.map((row) => ({
      id: row.id,
      reportDate: row.reportDate,
      status: "SUBMITTED" as const,
      submittedAt: row.submittedAt as Date,
      staffRowId: row.staff.id,
      staffId: row.staff.staffId,
      staffName: row.staff.candidate.fullName,
    })),
  };
}

export interface AdminReportDetailView {
  id: string;
  reportDate: Date;
  submittedAt: Date;
  metrics: {
    individualsContacted: number;
    groupsApproached: number;
    followUpActivities: number;
    newRegistrations: number;
    establishedMembersCreated: number;
    firstDepositsAchieved: number;
    savingsGoalsActivated: number;
    memberEngagement: number;
    connectionsBuilt: number;
  };
  activitySummary: string | null;
  staff: {
    rowId: string;
    staffId: string;
    fullName: string;
  };
}

/**
 * Read-only detail for ONE SUBMITTED report (brief §25). The id is the
 * opaque DailyReport row id (brief §45); unknown ids AND drafts answer the
 * same plain 404 — drafts are hidden, not acknowledged.
 */
export async function getAdminReportDetail(
  reportId: string,
): Promise<AdminReportDetailView> {
  const report = await db.dailyReport.findFirst({
    where: { id: reportId, status: "SUBMITTED" },
    select: {
      id: true,
      reportDate: true,
      submittedAt: true,
      individualsContacted: true,
      groupsApproached: true,
      followUpActivities: true,
      newRegistrations: true,
      establishedMembersCreated: true,
      firstDepositsAchieved: true,
      savingsGoalsActivated: true,
      memberEngagement: true,
      connectionsBuilt: true,
      activitySummary: true,
      staff: {
        select: {
          id: true,
          staffId: true,
          candidate: { select: { fullName: true } },
        },
      },
    },
  });

  if (!report || !report.submittedAt) {
    throw notFoundError("Daily report not found.");
  }

  return {
    id: report.id,
    reportDate: report.reportDate,
    submittedAt: report.submittedAt,
    metrics: {
      individualsContacted: report.individualsContacted,
      groupsApproached: report.groupsApproached,
      followUpActivities: report.followUpActivities,
      newRegistrations: report.newRegistrations,
      establishedMembersCreated: report.establishedMembersCreated,
      firstDepositsAchieved: report.firstDepositsAchieved,
      savingsGoalsActivated: report.savingsGoalsActivated,
      memberEngagement: report.memberEngagement,
      connectionsBuilt: report.connectionsBuilt,
    },
    activitySummary: report.activitySummary,
    staff: {
      rowId: report.staff.id,
      staffId: report.staff.staffId,
      fullName: report.staff.candidate.fullName,
    },
  };
}
