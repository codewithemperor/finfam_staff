import { db } from "@/lib/db";
import { adminRequestCodeSchema } from "@/lib/validation/admin";

/**
 * Admin Account bootstrap (Stage 11, approved brief §37; hardened in the
 * production-readiness remediation §22) — provisions a FinFam AdminAccount
 * for the /admin console. There is deliberately NO public registration
 * route, no invite flow and no password (§38): admin provisioning is
 * controlled operationally through this script.
 *
 * Behavior:
 *   - Unknown email        → creates ONE ACTIVE AdminAccount.
 *   - Existing ACTIVE      → idempotent no-op (reports the account).
 *   - Existing SUSPENDED   → REFUSES. The script NEVER reactivates a
 *                            suspended admin account — that would be an
 *                            unaudited privileged status change bypassing
 *                            future admin-account audit/recovery policy
 *                            (approved brief §37/§39). Recovery is an
 *                            explicit break-glass operational question.
 *   - --dry-run            → reports what would happen, writes nothing.
 *   - --yes                → REQUIRED outside development (NODE_ENV !==
 *                            "development"): an explicit acknowledgement
 *                            that the operator intends to provision on a
 *                            non-dev environment. (§22 confirmation
 *                            safeguard — dev stays friction-free for the
 *                            automated suite.)
 *
 * Email validation/normalization REUSES the Admin auth schema
 * (adminRequestCodeSchema — trim + length + format), so the CLI can never
 * provision an address the console would reject (remediation §22).
 *
 * The script NEVER touches Staff, Candidate, Appointment, DailyReport,
 * Training or any recruitment/recruitment-adjacent row — its only write
 * path is adminAccount.create (and the idempotent read before it).
 *
 * Audit note (remediation §23): bootstrap runs OUTSIDE any authenticated
 * Admin session, and the AdminAuditEvent model has no honest way to
 * represent a system/CLI actor (actorId is a required AdminAccount FK).
 * Provisioning via this script is therefore documented in the OPERATIONS
 * RUNBOOK (who ran it, when, for which email) rather than fabricated as an
 * audit row. A future ADMIN_CREATED audit design may revisit this.
 *
 * Usage:
 *   bun run bootstrap:admin -- <email> [--dry-run] [--yes]
 *   bash scripts/bootstrap-admin.sh <email> [--dry-run] [--yes]
 *
 * The new admin signs in at /admin/login with email OTP exactly like the
 * Staff Portal (no password exists anywhere in FinFam).
 */

function isDevelopment(): boolean {
  const env = process.env.NODE_ENV;
  // "test" counts as development: the automated suite drives this script as
  // a real subprocess (brief §55) and must not need a --yes flag.
  return env === "development" || env === "test" || !env;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const yes = process.argv.includes("--yes");
  const rawEmail = process.argv
    .slice(2)
    .filter((a) => a !== "--dry-run" && a !== "--yes")[0];

  if (!rawEmail) {
    console.error(
      "Usage: bun run bootstrap:admin -- <email> [--dry-run] [--yes]",
    );
    process.exit(1);
  }

  // Same validation + normalization as the Admin console's own auth
  // (remediation §22): zod trims and validates; the service convention
  // lowercases before any lookup or write.
  const parsed = adminRequestCodeSchema.shape.email.safeParse(rawEmail);
  if (!parsed.success) {
    console.error(
      `Bootstrap: "${rawEmail}" is not a valid administrator email address.`,
    );
    process.exit(1);
  }
  const email = parsed.data.toLowerCase();

  if (!isDevelopment() && !yes && !dryRun) {
    console.error(
      "Bootstrap: REFUSED — this does not look like a development environment\n" +
        `(NODE_ENV=${process.env.NODE_ENV || "unset"}). Provisioning an admin account is a\n` +
        "privileged operational action: re-run with --yes after confirming the\n" +
        "target environment, or use --dry-run to inspect first.\n" +
        "(The --yes safeguard is remediation §22; development is unaffected.)",
    );
    process.exit(1);
  }

  const existing = await db.adminAccount.findUnique({
    where: { email },
    select: { id: true, email: true, status: true, createdAt: true },
  });

  if (existing) {
    if (existing.status === "SUSPENDED") {
      console.error(
        `Bootstrap: REFUSED — an admin account for ${email} already exists and is SUSPENDED.\n` +
          `This script never reactivates suspended admin accounts (approved brief §37).\n` +
          `Admin account recovery requires an explicit future break-glass policy; ` +
          `handle it as a documented operational decision, not a script side effect.`,
      );
      process.exit(1);
    }
    console.log(
      `Bootstrap: admin account already exists and is ACTIVE — nothing to do.\n` +
        `  id: ${existing.id}\n  email: ${existing.email}\n  created: ${existing.createdAt.toISOString()}`,
    );
    return;
  }

  if (dryRun) {
    console.log(
      `Dry run: would create ONE ACTIVE AdminAccount for ${email}. Nothing was written.`,
    );
    return;
  }

  const created = await db.adminAccount.create({
    data: { email },
    select: { id: true, email: true, status: true, createdAt: true },
  });

  console.log(
    `Bootstrap: created ACTIVE AdminAccount.\n` +
      `  id: ${created.id}\n  email: ${created.email}\n  created: ${created.createdAt.toISOString()}\n` +
      `Sign in at /admin/login with email OTP (STAFF/ADMIN dev echo and Mailjet config apply).\n` +
      `NOTE: record this provisioning action (who/when/email) in the operations log —\n` +
      `CLI bootstrap runs outside an Admin session and is NOT written to the audit log\n` +
      `(remediation §23: no fabricated system actor).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Bootstrap failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
