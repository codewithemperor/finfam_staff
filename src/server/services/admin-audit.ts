import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ADMIN_AUDIT_PAGE_SIZE } from "@/config/admin";

/**
 * Append-only admin audit log (Stage 11, approved brief §34/§35).
 *
 * Every privileged management write records WHO (actor AdminAccount —
 * always resolved from the AdminSession, never accepted from the client),
 * WHAT (action + target type/id), WHEN (createdAt, set by the database)
 * and WHY (reason / conservative metadata).
 *
 * There is deliberately NO update path, NO delete path, NO clear-history
 * action and NO retention job in this stage — the log is read-only after
 * creation and retained indefinitely (retention is an open business/legal
 * question, docs/CONTENT-QUESTIONS.md). Metadata is conservative approved
 * fields only (staffId, previousStatus, newStatus) — never a dump of whole
 * Staff/Candidate records or PII (brief §34).
 */

export const ADMIN_AUDIT_TARGET_TYPE_STAFF_ACCOUNT = "STAFF_ACCOUNT";

/** Conservative structured context stored alongside an audit event. */
export interface AdminAuditMetadata {
  staffId?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface RecordAdminAuditEventInput {
  actorId: string;
  action: "STAFF_SUSPENDED" | "STAFF_REACTIVATED";
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: AdminAuditMetadata;
}

/**
 * Append one audit event inside the caller's transaction, so the audit
 * row commits atomically WITH the state change it describes (brief §28 —
 * a hard atomicity requirement). The action value comes from the
 * intent-specific service, never from the client.
 */
export async function recordAdminAuditEvent(
  tx: Prisma.TransactionClient,
  input: RecordAdminAuditEventInput,
): Promise<void> {
  await tx.adminAuditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
    },
  });
}

/** Defensive reader for the conservative metadata shape. */
function toAuditMetadata(raw: unknown): AdminAuditMetadata | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const pickString = (key: string): string | undefined => {
    const field = value[key];
    return typeof field === "string" && field.length > 0 ? field : undefined;
  };
  const metadata: AdminAuditMetadata = {};
  const staffId = pickString("staffId");
  const previousStatus = pickString("previousStatus");
  const newStatus = pickString("newStatus");
  if (staffId) metadata.staffId = staffId;
  if (previousStatus) metadata.previousStatus = previousStatus;
  if (newStatus) metadata.newStatus = newStatus;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export interface AdminAuditEventView {
  id: string;
  action: "STAFF_SUSPENDED" | "STAFF_REACTIVATED";
  /** The acting administrator's email (never their session or any secret). */
  actorEmail: string;
  targetType: string;
  targetId: string;
  /** Human-readable Staff ID resolved conservatively from metadata. */
  staffId: string | null;
  reason: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: Date;
}

export interface AdminAuditListResult {
  events: AdminAuditEventView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Newest-first, paginated read of the audit log. Read-only: this service
 * exposes exactly one write (recordAdminAuditEvent, transaction-scoped)
 * and one read — no edit/delete/clear paths exist anywhere.
 */
export async function listAdminAuditEvents(query: {
  page?: number;
}): Promise<AdminAuditListResult> {
  const page = query.page ?? 1;

  const where: Prisma.AdminAuditEventWhereInput = {};

  const [total, rows] = await Promise.all([
    db.adminAuditEvent.count({ where }),
    db.adminAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_AUDIT_PAGE_SIZE,
      take: ADMIN_AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize: ADMIN_AUDIT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_AUDIT_PAGE_SIZE)),
    events: rows.map((row) => {
      const metadata = toAuditMetadata(row.metadata);
      return {
        id: row.id,
        action: row.action,
        actorEmail: row.actor.email,
        targetType: row.targetType,
        targetId: row.targetId,
        staffId: metadata?.staffId ?? null,
        reason: row.reason,
        previousStatus: metadata?.previousStatus ?? null,
        newStatus: metadata?.newStatus ?? null,
        createdAt: row.createdAt,
      };
    }),
  };
}
