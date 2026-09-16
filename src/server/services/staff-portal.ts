import "server-only";

import { STAFF_PORTAL_OPERATIONAL_ROLE, STAFF_RESOURCE_CATEGORIES } from "@/config/staff-portal";
import { getAppointmentContent } from "@/config/appointment";
import { ONBOARDING_WHATSAPP } from "@/config/onboarding";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getDailyReportTodayState } from "@/server/services/daily-reports";
import type { StaffSessionContext } from "@/server/services/staff-auth";
import type { IssuedAppointmentView } from "@/types/recruitment";
import type { DailyReportTodayState } from "@/types/staff-reports";

/**
 * Staff Portal view services (Stage 7) — read models for the authenticated
 * home, profile and appointment pages. Identity is ALWAYS the session chain
 * (Session → StaffAccount → Staff → Candidate); these functions accept a
 * Staff ROW id resolved from the session and never any client-supplied
 * identifier (brief §18/§19).
 *
 * Deliberately NO metrics, KPIs or activity data: the portal shows only
 * real, persisted facts (brief §40). Onboarding state is READ here — the
 * home page never lazily creates the onboarding record (that side effect
 * belongs to the onboarding door itself). Stage 8 adds exactly ONE
 * reporting fact to the home view: today's Daily Report state (NOT_STARTED
 * / DRAFT / SUBMITTED) so the home card can route to the right action —
 * no aggregates, no history, no metric values.
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
  resources: {
    /** Categories the business supplies; none exist yet (honest state). */
    categories: readonly string[];
    available: false;
  };
  accountStatus: "ACTIVE" | "SUSPENDED";
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
    resources: {
      categories: STAFF_RESOURCE_CATEGORIES,
      available: false,
    },
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
