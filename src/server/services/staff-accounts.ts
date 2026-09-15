import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";

/**
 * Staff Account provisioning (Stage 7) — ONE core, TWO callers.
 *
 * The approved architecture (brief §2/§4): a StaffAccount is provisioned
 * DURING Staff Activation — inside the winning activation transaction — so
 * the Staff Portal exists before portal onboarding can begin. Staff records
 * that predate Stage 7 receive their account through the idempotent backfill
 * script, which calls THE SAME core (brief §4: no separate provisioning
 * logic).
 *
 * Guarantees:
 * - Exactly one account per Staff row (unique FK + P2002-safe create-or-get).
 * - Exactly one STAFF_ACCOUNT_CREATED email intent per account (unique
 *   dedupeKey "STAFF_ACCOUNT_CREATED:<accountId>"), queued only by the call
 *   that actually CREATED the account — reruns and races never re-queue.
 * - No data duplication: the account row carries status and login
 *   bookkeeping only; identity is reached through Staff → Candidate.
 * - Mailjet is never touched here — the caller dispatches after commit, so
 *   an email outage can never roll back an activation or a backfill.
 */

export interface ProvisionStaffAccountContext {
  /** The Staff ROW id (staff.id) — the account's 1:1 anchor. */
  staffId: string;
  /** Owning candidate (notification row ownership + cascade delete). */
  candidateId: string;
  /** The Staff member's registered email — the login email (snapshot). */
  recipientEmail: string;
}

export interface ProvisionedStaffAccount {
  accountId: string;
  /** True when THIS call created the account (false = it already existed). */
  accountCreated: boolean;
  /**
   * Delivery row id when this call queued the STAFF_ACCOUNT_CREATED intent
   * (callers dispatch AFTER commit). Null when the account already existed
   * or the intent was already queued.
   */
  deliveryId: string | null;
}

/**
 * Create-or-get the StaffAccount for a Staff row and, when this call
 * created it, queue the single STAFF_ACCOUNT_CREATED notification intent.
 *
 * Accepts either the plain `db` client or a transaction client:
 * - Activation passes its `tx` so Staff row + account + notification intent
 *   commit atomically (brief §2 — the winner path only; a losing concurrent
 *   activation never provisions).
 * - The backfill passes `db` (autocommit per statement is fine there; the
 *   dedupeKey keeps the email exactly-once across reruns).
 */
export async function provisionStaffAccount(
  client: Prisma.TransactionClient,
  context: ProvisionStaffAccountContext,
): Promise<ProvisionedStaffAccount> {
  let accountCreated = false;

  const account = await client.staffAccount
    .create({
      data: { staffId: context.staffId },
      select: { id: true },
    })
    .catch((error) => {
      // A concurrent provisioner (activation race, backfill rerun) already
      // created the account — not an error; use the winner's row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    });

  let accountId: string;
  if (account) {
    accountId = account.id;
    accountCreated = true;
  } else {
    const existing = await client.staffAccount.findUnique({
      where: { staffId: context.staffId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error(
        "Staff account provisioning failed: the account row could not be created or read.",
      );
    }
    accountId = existing.id;
  }

  let deliveryId: string | null = null;
  if (accountCreated) {
    // Exactly-once by dedupeKey — a concurrent provisioner of the SAME new
    // account (the only race that reaches here) still queues one intent.
    const enqueued = await enqueueNotification(client, {
      type: "STAFF_ACCOUNT_CREATED",
      dedupeKey: buildDedupeKey("STAFF_ACCOUNT_CREATED", accountId),
      candidateId: context.candidateId,
      recipientEmail: context.recipientEmail,
    });
    deliveryId = enqueued.alreadyQueued ? null : enqueued.deliveryId;
  }

  return { accountId, accountCreated, deliveryId };
}

/**
 * Backfill driver (scripts/backfill-staff-accounts.ts): every Staff record
 * without an account gets one. Idempotent across reruns by construction —
 * the query only sees un-provisioned Staff, and the dedupeKey makes the
 * account-created email impossible to duplicate even under a concurrent
 * double-run.
 */
export async function listStaffWithoutAccount(): Promise<
  { id: string; staffId: string; candidateId: string; email: string; fullName: string }[]
> {
  const rows = await db.staff.findMany({
    where: { account: null },
    select: {
      id: true,
      staffId: true,
      candidate: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    staffId: row.staffId,
    candidateId: row.candidate.id,
    email: row.candidate.email,
    fullName: row.candidate.fullName,
  }));
}
