import "server-only";

import { db } from "@/lib/db";
import { ADMIN_DIRECTORY_PAGE_SIZE } from "@/config/admin";
import { notFoundError } from "@/lib/errors";

/**
 * Admin Staff directory + detail reads (Stage 11, approved brief §18–§22).
 *
 * READ-ONLY by design: this service exposes directory/detail views only.
 * It never mutates Staff, Candidate, Appointment, Onboarding, Training or
 * DailyReport rows, and never selects secrets — no OTP hashes, session
 * tokens, or sensitive identifiers ever leave the database through here
 * (brief §18: no NIN/BVN/bank details/OTP data/hashes).
 *
 * Query quality (brief §20): the directory resolves one page with a single
 * findMany whose nested selects join account/candidate/onboarding/
 * enrollments — no per-staff follow-up queries, no N+1. Training state is
 * derived from the page's own rows; histories are never fully loaded.
 */

/* ── Directory ── */

export type StaffDirectoryStatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

export type StaffOnboardingStateId = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type StaffTrainingStateId = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface StaffDirectoryRow {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  designation: string;
  operationalRole: string;
  activatedAt: Date;
  accountStatus: "ACTIVE" | "SUSPENDED";
  onboardingState: StaffOnboardingStateId;
  trainingState: StaffTrainingStateId;
}

export interface StaffDirectoryResult {
  staff: StaffDirectoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function deriveOnboardingState(onboarding: {
  startedAt: Date | null;
  completedAt: Date | null;
} | null): StaffOnboardingStateId {
  if (!onboarding) return "NOT_STARTED";
  if (onboarding.completedAt) return "COMPLETED";
  if (onboarding.startedAt) return "IN_PROGRESS";
  return "NOT_STARTED";
}

/**
 * Training aggregate for ONE staff member from that member's enrollments
 * (already loaded for the page): COMPLETED when every enrollment's course
 * completion latch has fired, IN_PROGRESS when any progress exists,
 * NOT_STARTED when there are no enrollments at all.
 */
function deriveTrainingState(
  enrollments: { completedAt: Date | null; completedLessons: number }[],
): StaffTrainingStateId {
  if (enrollments.length === 0) return "NOT_STARTED";
  if (enrollments.every((enrollment) => enrollment.completedAt !== null)) {
    return "COMPLETED";
  }
  if (enrollments.some((e) => e.completedAt !== null || e.completedLessons > 0)) {
    return "IN_PROGRESS";
  }
  return "NOT_STARTED";
}

/**
 * Newest-activated-first, server-paginated Staff directory with a
 * whitelisted search: `q` matches Staff ID, full name or email
 * (case-insensitive `contains` — Prisma parameterised queries only, no
 * raw SQL, no client-supplied field names, no sort expressions, brief
 * §19). Status filter is a closed enum.
 */
export async function listStaffDirectory(query: {
  q?: string;
  status: StaffDirectoryStatusFilter;
  page?: number;
}): Promise<StaffDirectoryResult> {
  const page = query.page ?? 1;

  const where = {
    account: {
      ...(query.status === "ALL" ? {} : { status: query.status }),
    },
    ...(query.q
      ? {
          OR: [
            { staffId: { contains: query.q, mode: "insensitive" as const } },
            {
              candidate: {
                fullName: { contains: query.q, mode: "insensitive" as const },
              },
            },
            {
              candidate: {
                email: { contains: query.q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.staff.count({ where }),
    db.staff.findMany({
      where,
      orderBy: { activatedAt: "desc" },
      skip: (page - 1) * ADMIN_DIRECTORY_PAGE_SIZE,
      take: ADMIN_DIRECTORY_PAGE_SIZE,
      select: {
        id: true,
        staffId: true,
        roleTitle: true,
        activatedAt: true,
        account: { select: { status: true } },
        candidate: { select: { fullName: true, email: true } },
        onboarding: { select: { startedAt: true, completedAt: true } },
        trainingEnrollments: {
          select: {
            completedAt: true,
            _count: { select: { lessons: true } },
          },
        },
      },
    }),
  ]);

  return {
    page,
    pageSize: ADMIN_DIRECTORY_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_DIRECTORY_PAGE_SIZE)),
    staff: rows.map((row) => ({
      id: row.id,
      staffId: row.staffId,
      fullName: row.candidate.fullName,
      email: row.candidate.email,
      designation: row.roleTitle,
      operationalRole: "FinFam Growth Ambassador",
      activatedAt: row.activatedAt,
      accountStatus: row.account?.status ?? "ACTIVE",
      onboardingState: deriveOnboardingState(row.onboarding),
      trainingState: deriveTrainingState(
        row.trainingEnrollments.map((enrollment) => ({
          completedAt: enrollment.completedAt,
          completedLessons: enrollment._count.lessons,
        })),
      ),
    })),
  };
}

/* ── Detail ── */

export interface StaffAdminDetailView {
  identity: {
    id: string;
    staffId: string;
    fullName: string;
    email: string;
    designation: string;
    operationalRole: string;
    activatedAt: Date;
  };
  appointment: {
    reference: string;
    version: string;
    issuedAt: Date | null;
  };
  onboarding: {
    state: StaffOnboardingStateId;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  training: {
    state: StaffTrainingStateId;
    courses: {
      courseId: string;
      courseVersion: string;
      state: StaffTrainingStateId;
      completedAt: Date | null;
      completedLessons: number;
      totalLessons: number;
    }[];
  };
  recentReports: {
    id: string;
    reportDate: Date;
    status: "DRAFT" | "SUBMITTED";
    submittedAt: Date | null;
  }[];
  account: {
    status: "ACTIVE" | "SUSPENDED";
  };
}

/**
 * Full read-only detail for ONE staff member (approved brief §21). The id
 * is the opaque internal Staff row id used in admin URLs (brief §44);
 * unknown ids answer a plain 404 — admin visibility is granted by the
 * valid Admin session, never by the URL.
 */
export async function getStaffAdminDetail(
  staffRowId: string,
): Promise<StaffAdminDetailView> {
  const staff = await db.staff.findUnique({
    where: { id: staffRowId },
    select: {
      id: true,
      staffId: true,
      roleTitle: true,
      activatedAt: true,
      appointmentReference: true,
      account: { select: { status: true } },
      candidate: {
        select: {
          fullName: true,
          email: true,
          appointment: {
            select: {
              appointmentReference: true,
              version: true,
              issuedAt: true,
            },
          },
        },
      },
      onboarding: { select: { startedAt: true, completedAt: true } },
      trainingEnrollments: {
        orderBy: { createdAt: "asc" },
        select: {
          courseId: true,
          courseVersion: true,
          completedAt: true,
          _count: { select: { lessons: true } },
        },
      },
    },
  });

  if (!staff) {
    throw notFoundError("Staff record not found.");
  }

  const recentReports = await db.dailyReport.findMany({
    where: { staffId: staff.id, status: "SUBMITTED" },
    orderBy: { reportDate: "desc" },
    take: 10,
    select: { id: true, reportDate: true, status: true, submittedAt: true },
  });

  // Total lesson counts come from the pinned source-controlled course
  // registry (Stage 9) — never guessed from the database.
  const { getTrainingCourseContent } = await import("@/config/training");

  const courses = staff.trainingEnrollments.map((enrollment) => {
    const content = getTrainingCourseContent(
      enrollment.courseId,
      enrollment.courseVersion,
    );
    const totalLessons = content?.lessons.length ?? 0;
    const completedLessons = enrollment._count.lessons;
    const state: StaffTrainingStateId = enrollment.completedAt
      ? "COMPLETED"
      : completedLessons > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";
    return {
      courseId: enrollment.courseId,
      courseVersion: enrollment.courseVersion,
      state,
      completedAt: enrollment.completedAt,
      completedLessons,
      totalLessons,
    };
  });

  return {
    identity: {
      id: staff.id,
      staffId: staff.staffId,
      fullName: staff.candidate.fullName,
      email: staff.candidate.email,
      designation: staff.roleTitle,
      operationalRole: "FinFam Growth Ambassador",
      activatedAt: staff.activatedAt,
    },
    appointment: {
      reference:
        staff.candidate.appointment?.appointmentReference ??
        staff.appointmentReference,
      version: staff.candidate.appointment?.version ?? "—",
      issuedAt: staff.candidate.appointment?.issuedAt ?? null,
    },
    onboarding: {
      state: deriveOnboardingState(staff.onboarding),
      startedAt: staff.onboarding?.startedAt ?? null,
      completedAt: staff.onboarding?.completedAt ?? null,
    },
    training: {
      state: deriveTrainingState(courses),
      courses,
    },
    recentReports: recentReports.map((report) => ({
      id: report.id,
      reportDate: report.reportDate,
      status: report.status,
      submittedAt: report.submittedAt,
    })),
    account: {
      status: staff.account?.status ?? "ACTIVE",
    },
  };
}

/* ── Overview (approved brief §17) ── */

export interface AdminOverviewView {
  totalActiveStaff: number;
  totalSuspendedStaff: number;
  totalStaff: number;
  recentAuditEvents: {
    id: string;
    action: "STAFF_SUSPENDED" | "STAFF_REACTIVATED";
    actorEmail: string;
    staffId: string | null;
    createdAt: Date;
  }[];
}

/**
 * Operationally simple overview: real persisted counts and the most recent
 * audit events only. No analytics, no conversion dashboards, no KPIs
 * (approved brief §17).
 */
export async function getAdminOverview(): Promise<AdminOverviewView> {
  const [activeCount, suspendedCount, recentEvents] = await Promise.all([
    db.staffAccount.count({ where: { status: "ACTIVE" } }),
    db.staffAccount.count({ where: { status: "SUSPENDED" } }),
    db.adminAuditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    }),
  ]);

  return {
    totalActiveStaff: activeCount,
    totalSuspendedStaff: suspendedCount,
    totalStaff: activeCount + suspendedCount,
    recentAuditEvents: recentEvents.map((event) => {
      const metadata =
        typeof event.metadata === "object" && event.metadata !== null
          ? (event.metadata as { staffId?: unknown })
          : null;
      return {
        id: event.id,
        action: event.action,
        actorEmail: event.actor.email,
        staffId:
          typeof metadata?.staffId === "string" ? metadata.staffId : null,
        createdAt: event.createdAt,
      };
    }),
  };
}
