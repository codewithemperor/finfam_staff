import { db } from "@/lib/db";
import {
  listStaffWithoutAccount,
  provisionStaffAccount,
} from "@/server/services/staff-accounts";
import { dispatchNotification } from "@/server/notifications/notification-service";

/**
 * Staff Account backfill (Stage 7, brief §4) — gives every Staff record
 * that predates Staff Account provisioning its StaffAccount + the single
 * STAFF_ACCOUNT_CREATED email intent, through the SAME provisionStaffAccount
 * core the live activation path uses.
 *
 * Idempotent by construction: the query only sees un-provisioned Staff, the
 * unique FK backstops concurrent runs, and the dedupeKey makes duplicate
 * account-created emails impossible. Staff IDs, Staff rows and every other
 * record are NEVER mutated.
 *
 * Usage:
 *   bash scripts/backfill-staff-accounts.sh [--dry-run]
 *
 * Production execution is a DEPLOYMENT STEP (docs/CONTENT-QUESTIONS.md):
 * run it once after deploy with NOTIFICATIONS_ENABLED configured, so the
 * account-created emails actually send.
 */

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const pending = await listStaffWithoutAccount();

  if (pending.length === 0) {
    console.log("Backfill: every Staff record already has a StaffAccount. Nothing to do.");
    return;
  }

  console.log(
    `Backfill: found ${pending.length} Staff record(s) without a StaffAccount${dryRun ? " (dry run — nothing will be written)" : ""}:`,
  );

  let created = 0;
  let emailed = 0;

  for (const staff of pending) {
    console.log(
      `  - ${staff.fullName} (${staff.staffId}) <${staff.email}>`,
    );
    if (dryRun) continue;

    const provisioned = await provisionStaffAccount(db, {
      staffId: staff.id,
      candidateId: staff.candidateId,
      recipientEmail: staff.email,
    });

    if (provisioned.accountCreated) created += 1;
    if (provisioned.deliveryId) {
      emailed += 1;
      // Post-commit (autocommit) dispatch — fire-and-forget, never blocking.
      dispatchNotification(provisioned.deliveryId);
    }
  }

  if (!dryRun) {
    console.log(
      `Backfill complete: ${created} account(s) created, ${emailed} STAFF_ACCOUNT_CREATED email intent(s) queued.`,
    );
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error("Backfill failed:", error instanceof Error ? error.message : error);
    await db.$disconnect().catch(() => undefined);
    process.exit(1);
  });
