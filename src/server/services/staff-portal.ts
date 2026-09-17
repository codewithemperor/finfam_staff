import "server-only";

import { STAFF_PORTAL_OPERATIONAL_ROLE } from "@/config/staff-portal";
import { getAppointmentContent } from "@/config/appointment";
import { ONBOARDING_WHATSAPP } from "@/config/onboarding";
import {
  getStaffResourcesHomeSummary,
  type StaffResourcesHomeSummary,
} from "@/config/staff-resources";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getDailyReportTodayState,
} from "@/server/services/daily-reports";
import { getStaffTrainingHomeState } from "@/server/services/staff-training";
import {
  lagosCurrentMonthISO,
  lagosDateISOFromUtcMidnight,
  lagosMonthToUtcMidnight,
  nextLagosMonth,
} from "@/lib/dates/lagos";
import type { StaffSessionContext } from "@/server/services/staff-auth";
import type { IssuedAppointmentView } from "@/types/recruitment";
import type { DailyReportTodayState } from "@/types/staff-reports";
import type { TrainingHomeState } from "@/types/staff-training";

/**
 * Staff Portal view services (Stage 7) — read models for the authenticated
 * home, profile and appointment pages. Identity is ALWAYS the session chain
 * (Session → StaffAccount → Staff → Candidate); these functions accept a
 * Staff ROW id resolved from the session and never any client-supplied
 * identifier (brief §18/§19).
 *
 * The home view contains only real, persisted facts. The dashboard summary
 * below is intentionally limited to submitted self-reported Daily Reports;
 * there are no earnings, member, commission or target models in this stage.
 */

export interface StaffPortalHomeView {
  fullName: string;
  staffId: string;
  /** Official appointment designation (snapshot: "Remote Staff"). */
  designation: string;
  /** Operational role presented beside the designation (brief §27). */
  operationalRole: string;
  activatedAt: string;
  appointment: {
    appointmentReference: string;
    issuedAt: string;
    /** Path of the authenticated portal letter view. */
    viewPath: string;
  } | null;
  onboarding: {
    state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    completedAt: string | null;
  };
  /** Official WhatsApp contact when configured; null keeps honest pending copy. */
  whatsappNumber: string | null;
  /** Today's Daily Report state for the home card (Stage 8, brief §35). */
  dailyReporting: DailyReportTodayState;
  dashboard: StaffPortalDashboardView;
  /** Staff Training facts for the home card (Stage 9, brief §38) — a
   * READ-ONLY lookup that never creates an enrollment. */
  training: TrainingHomeState;
  /** Staff Resources facts for the home card (Stage 10) — derived from
   * the source-controlled registry (src/config/staff-resources.ts),
   * never a hard-coded availability flag. */
  resources: StaffResourcesHomeSummary;
  accountStatus: "ACTIVE" | "SUSPENDED";
}

export interface StaffPortalDashboardView {
  submittedReportsThisMonth: number;
  newRegistrationsThisMonth: number;
  establishedMembersThisMonth: number;
  recentReports: Array<{
    id: string;
    reportDate: string;
    newRegistrations: number;
    establishedMembersCreated: number;
  }>;
}

export async function getStaffPortalDashboard(
  staffRowId: string,
): Promise<StaffPortalDashboardView> {
  const month = lagosCurrentMonthISO();
  const [start, endExclusive] = [
    lagosMonthToUtcMidnight(month),
    lagosMonthToUtcMidnight(nextLagosMonth(month)),
  ];

  const [monthRows, recentRows] = await Promise.all([
    db.dailyReport.findMany({
      where: {
        staffId: staffRowId,
        status: "SUBMITTED",
        reportDate: { gte: start, lt: endExclusive },
      },
      select: {
        newRegistrations: true,
        establishedMembersCreated: true,
      },
    }),
    db.dailyReport.findMany({
      where: { staffId: staffRowId, status: "SUBMITTED" },
      orderBy: { reportDate: "desc" },
      take: 5,
      select: {
        id: true,
        reportDate: true,
        newRegistrations: true,
        establishedMembersCreated: true,
      },
    }),
  ]);

  return {
    submittedReportsThisMonth: monthRows.length,
    newRegistrationsThisMonth: monthRows.reduce(
      (total, row) => total + row.newRegistrations,
      0,
    ),
    establishedMembersThisMonth: monthRows.reduce(
      (total, row) => total + row.establishedMembersCreated,
      0,
    ),
    recentReports: recentRows.map((row) => ({
      id: row.id,
      reportDate: lagosDateISOFromUtcMidnight(row.reportDate),
      newRegistrations: row.newRegistrations,
      establishedMembersCreated: row.establishedMembersCreated,
    })),
  };
}

export async function getStaffPortalHome(
  staffRowId: string,
): Promise<StaffPortalHomeView> {
  const staff = await db.staff.findUnique({
    where: { id: staffRowId },
    select: {
      staffId: true,
      roleTitle: true,
      activatedAt: true,
      appointmentReference: true,
      account: { select: { status: true } },
      candidate: {
        select: {
          fullName: true,
          appointment: {
            select: { appointmentReference: true, issuedAt: true },
          },
        },
      },
    },
  });

  if (!staff) {
    // Impossible via the session chain — refuse loudly rather than guess.
    throw new AppError(
      "INTERNAL",
      "Your Staff Portal session could not be resolved. Please sign in again.",
      { status: 500 },
    );
  }

  // Onboarding is read directly by the Staff row (the one state, both
  // doors write it) — never created here.
  const onboardingRow = await db.staffOnboarding.findUnique({
    where: { staffId: staffRowId },
    select: { completedAt: true },
  });

  const completedAt = onboardingRow?.completedAt ?? null;
  const dashboard = await getStaffPortalDashboard(staffRowId);

  return {
    fullName: staff.candidate.fullName,
    staffId: staff.staffId,
    designation: staff.roleTitle,
    operationalRole: STAFF_PORTAL_OPERATIONAL_ROLE,
    activatedAt: staff.activatedAt.toISOString(),
    appointment: staff.candidate.appointment
      ? {
          appointmentReference: staff.candidate.appointment.appointmentReference,
          issuedAt: staff.candidate.appointment.issuedAt.toISOString(),
          viewPath: "/staff/appointment",
        }
      : null,
    onboarding: {
      state: completedAt
        ? "COMPLETED"
        : onboardingRow
          ? "IN_PROGRESS"
          : "NOT_STARTED",
      completedAt: completedAt?.toISOString() ?? null,
    },
    whatsappNumber: ONBOARDING_WHATSAPP.number,
    dailyReporting: await getDailyReportTodayState(staffRowId),
    dashboard,
    training: await getStaffTrainingHomeState(staffRowId),
    resources: getStaffResourcesHomeSummary(),
    accountStatus: staff.account?.status ?? "ACTIVE",
  };
}

export interface StaffMeView {
  staffId: string;
  fullName: string;
  /** The login email — the candidate's registered email (brief §5). */
  email: string;
  designation: string;
  operationalRole: string;
  appointmentReference: string;
  activatedAt: string;
  accountStatus: "ACTIVE" | "SUSPENDED";
  onboarding: {
    state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    completedAt: string | null;
  };
  session: { expiresAt: string };
}

/** GET /api/staff/me — identity derived from the session, nothing else. */
export async function getStaffMe(
  session: StaffSessionContext,
): Promise<StaffMeView> {
  // Opportunistic lastSeenAt refresh (never blocks the response).
  void db.staffSession
    .update({
      where: { id: session.session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);

  const onboardingRow = await db.staffOnboarding.findUnique({
    where: { staffId: session.staff.rowId },
    select: { completedAt: true },
  });

  return {
    staffId: session.staff.staffId,
    fullName: session.candidate.fullName,
    email: session.candidate.email,
    designation: session.staff.roleTitle,
    operationalRole: STAFF_PORTAL_OPERATIONAL_ROLE,
    appointmentReference: session.staff.appointmentReference,
    activatedAt: session.staff.activatedAt.toISOString(),
    accountStatus: session.account.status,
    onboarding: {
      state: onboardingRow?.completedAt
        ? "COMPLETED"
        : onboardingRow
          ? "IN_PROGRESS"
          : "NOT_STARTED",
      completedAt: onboardingRow?.completedAt?.toISOString() ?? null,
    },
    session: { expiresAt: session.session.expiresAt.toISOString() },
  };
}

/**
 * The authenticated Staff member's provisional appointment (brief §41):
 * loads the existing Appointment row through the session-owned Staff →
 * Candidate relation, reuses the SAME immutable snapshot + content registry
 * as the recruitment appointment stage, and never requires a recruitment
 * reference in the URL.
 */
export async function getStaffAppointmentView(
  staffRowId: string,
): Promise<IssuedAppointmentView> {
  const staff = await db.staff.findUnique({
    where: { id: staffRowId },
    select: {
      candidate: {
        select: {
          appointment: {
            select: {
              appointmentReference: true,
              version: true,
              printedName: true,
              roleTitle: true,
              issuedAt: true,
            },
          },
        },
      },
    },
  });

  const appointment = staff?.candidate.appointment;
  if (!staff || !appointment) {
    throw new AppError(
      "NOT_FOUND",
      "Your provisional appointment letter could not be found. Please contact support.",
      { status: 404 },
    );
  }

  const content = getAppointmentContent(appointment.version);
  if (!content) {
    // Historical integrity: a missing registry version fails loudly.
    throw new AppError(
      "INTERNAL",
      "Your provisional appointment letter could not be opened. Please contact support.",
      { status: 500 },
    );
  }

  return {
    appointmentReference: appointment.appointmentReference,
    version: appointment.version,
    printedName: appointment.printedName,
    roleTitle: appointment.roleTitle,
    issuedAt: appointment.issuedAt.toISOString(),
    content,
  };
}
