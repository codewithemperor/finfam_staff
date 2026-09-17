import "server-only";

import { db } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import {
  ADMIN_AUDIT_TARGET_TYPE_STAFF_ACCOUNT,
  recordAdminAuditEvent,
} from "@/server/services/admin-audit";

/**
 * Privileged StaffAccount access transitions (Stage 11, approved brief
 * §27–§33). The ONLY management writes in this stage.
 *
 * - Intent-specific by design: suspension and reactivation are separate
 *   functions behind separate POST endpoints. There is deliberately NO
 *   generic status PATCH — the browser never sends a status value (§42/§45).
 * - Actor identity comes from the resolved AdminSession (§36) — never from
 *   the client.
 * - Atomicity (§28 — hard requirement): ONE transaction contains the
 *   conditional StaffAccount transition, the revocation of every live
 *   StaffSession for that account, and the append-only audit event.
 * - Idempotency (§33): the transition is a conditional updateMany guarded
 *   on the expected source status, so repeated/double-click/concurrent
 *   requests cannot duplicate transitions or audit events. Harmless no-ops
 *   return the current state and write NOTHING to the audit log (§32).
 * - Scope guard (§29): suspension touches ONLY the StaffAccount status,
 *   the account's live sessions and the audit log. It never modifies the
 *   Staff row, Staff ID, Appointment, Onboarding, Training, DailyReports,
 *   Candidate or StageEvents. Suspension is access disabled, not a record
 *   deleted.
 */

export interface StaffAccessActionResult {
  /** True when THIS call performed the real state transition. */
  transitioned: boolean;
  /** The account status after the call. */
  accountStatus: "ACTIVE" | "SUSPENDED";
}

/**
 * Suspend one ACTIVE Staff account.
 *
 * Transaction contents (§28):
 *   1. conditional ACTIVE → SUSPENDED StaffAccount transition
 *   2. revoke every non-revoked StaffSession for that account
 *   3. append the STAFF_SUSPENDED audit event
 *
 * Global Staff access is already denied whenever StaffAccount is not
 * ACTIVE (every auth path re-checks status); the explicit session
 * revocation adds durable cutoff semantics (§28/§29).
 */
export async function suspendStaffAccount(input: {
  actorId: string;
  staffRowId: string;
  reason: string;
}): Promise<StaffAccessActionResult> {
  const staff = await db.staff.findUnique({
    where: { id: input.staffRowId },
    select: {
      staffId: true,
      account: { select: { id: true, status: true } },
    },
  });

  if (!staff || !staff.account) {
    throw notFoundError("Staff record not found.");
  }

  const account = staff.account;
  const now = new Date();

  const transitioned = await db.$transaction(async (tx) => {
    // (1) Conditional transition — the idempotency latch. count === 0
    // means the account is not ACTIVE (already suspended, or flipped by a
    // concurrent request): a no-op with no audit event (§33).
    const updated = await tx.staffAccount.updateMany({
      where: { id: account.id, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    if (updated.count !== 1) return false;

    // (2) Durable cutoff — revoke every live session of this account.
    await tx.staffSession.updateMany({
      where: { accountId: account.id, revokedAt: null },
      data: { revokedAt: now },
    });

    // (3) Append-only audit — actor/action/target/reason/metadata.
    await recordAdminAuditEvent(tx, {
      actorId: input.actorId,
      action: "STAFF_SUSPENDED",
      targetType: ADMIN_AUDIT_TARGET_TYPE_STAFF_ACCOUNT,
      targetId: account.id,
      reason: input.reason,
      metadata: {
        staffId: staff.staffId,
        previousStatus: "ACTIVE",
        newStatus: "SUSPENDED",
      },
    });

    return true;
  });

  return {
    transitioned,
    accountStatus: transitioned ? "SUSPENDED" : account.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
  };
}

/**
 * Reactivate one SUSPENDED Staff account. Changes ONLY
 * StaffAccount.status SUSPENDED → ACTIVE (§31): it never recreates Staff,
 * never issues a new Staff ID, never re-runs activation, never resets
 * onboarding/training, never modifies reports and never resurrects old
 * sessions — the Staff member signs in normally afterwards and receives a
 * NEW Staff session. Exactly one STAFF_REACTIVATED audit event is written
 * per real transition; duplicate reactivation on an ACTIVE account is a
 * safe no-op with no audit event (§32).
 */
export async function reactivateStaffAccount(input: {
  actorId: string;
  staffRowId: string;
  note?: string;
}): Promise<StaffAccessActionResult> {
  const staff = await db.staff.findUnique({
    where: { id: input.staffRowId },
    select: {
      staffId: true,
      account: { select: { id: true, status: true } },
    },
  });

  if (!staff || !staff.account) {
    throw notFoundError("Staff record not found.");
  }

  const account = staff.account;
  const now = new Date();

  const transitioned = await db.$transaction(async (tx) => {
    const updated = await tx.staffAccount.updateMany({
      where: { id: account.id, status: "SUSPENDED" },
      data: { status: "ACTIVE" },
    });
    if (updated.count !== 1) return false;

    await recordAdminAuditEvent(tx, {
      actorId: input.actorId,
      action: "STAFF_REACTIVATED",
      targetType: ADMIN_AUDIT_TARGET_TYPE_STAFF_ACCOUNT,
      targetId: account.id,
      reason: input.note ?? null,
      metadata: {
        staffId: staff.staffId,
        previousStatus: "SUSPENDED",
        newStatus: "ACTIVE",
      },
    });

    return true;
  });

  return {
    transitioned,
    accountStatus: transitioned ? "ACTIVE" : account.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
  };
}
