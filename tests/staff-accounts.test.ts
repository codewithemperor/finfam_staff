/**
 * Stage 7 — Staff Account provisioning tests (brief §51).
 *
 * Drives REAL candidates through the REAL APIs and inspects the database:
 * the Staff row and the StaffAccount row must be atomic (one transaction),
 * concurrent activations must produce exactly one account and one
 * STAFF_ACCOUNT_CREATED email, and the backfill script must be idempotent
 * and mutate nothing it should not.
 *
 * Requires the dev server (`bun run dev`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { ACTIVATION_META } from "@/config/activation";
import { OPEN_POSITION } from "@/config/content";
import type { ActivationView } from "@/types/recruitment";

import {
  apiRequest,
  assertServerUp,
  expectFail,
  expectOk,
} from "./helpers/api";
import { cleanupTestCandidates, db, uniqueEmail } from "./helpers/db";
import { driveToActivation, STAFF_TEST_PROFILE } from "./helpers/journey";

const emails: string[] = [];
const fixtureCandidateIds: string[] = [];

beforeAll(async () => {
  await assertServerUp();
});

afterAll(async () => {
  const removed = await cleanupTestCandidates(emails);
  if (fixtureCandidateIds.length > 0) {
    // Fixture rows created directly for the self-heal/backfill tests.
    await db.candidate.deleteMany({
      where: { id: { in: fixtureCandidateIds } },
    });
  }
  console.log(
    `[staff-accounts] cleanup: ${removed} journey candidate(s) + ${fixtureCandidateIds.length} fixture candidate(s) removed (sequences stay advanced — documented behaviour)`,
  );
});

async function staffRowByEmail(email: string) {
  const candidate = await db.candidate.findUnique({
    where: { email },
    select: {
      id: true,
      staff: {
        select: {
          id: true,
          staffId: true,
          account: { select: { id: true, status: true, lastLoginAt: true } },
        },
      },
    },
  });
  if (!candidate?.staff) throw new Error(`fixture missing for ${email}`);
  return { candidateId: candidate.id, staff: candidate.staff };
}

describe("Stage 7 — Staff Account provisioning", () => {
  it("activation creates the StaffAccount atomically and queues the account email exactly once", async () => {
    const staff = await driveToActivation("acct-happy");
    emails.push(staff.email);

    const { staff: row } = await staffRowByEmail(staff.email);
    expect(row.account).not.toBeNull();
    expect(row.account?.status).toBe("ACTIVE");
    expect(row.account?.lastLoginAt).toBeNull();

    const notifications = await db.notificationDelivery.findMany({
      where: { candidateId: (await staffRowByEmail(staff.email)).candidateId },
      select: { type: true, dedupeKey: true },
    });
    const accountEmails = notifications.filter(
      (n) => n.type === "STAFF_ACCOUNT_CREATED",
    );
    expect(accountEmails).toHaveLength(1);
    expect(accountEmails[0]?.dedupeKey).toBe(
      `STAFF_ACCOUNT_CREATED:${row.account?.id}`,
    );
    expect(
      notifications.filter((n) => n.type === "STAFF_ACTIVATED"),
    ).toHaveLength(1);
  });

  it("concurrent activation produces ONE Staff row, ONE account, ONE account email", async () => {
    // Drive all the way to APPOINTMENT_ISSUED, then race the SAME explicit
    // activation action from four parallel requests.
    const staff = await driveToActivation("acct-race", { activate: false });
    emails.push(staff.email);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiRequest<ActivationView>(
          "POST",
          `/api/activation/${staff.referenceNumber}/activate`,
          { acknowledgement: true, version: ACTIVATION_META.version },
        ),
      ),
    );
    for (const result of results) {
      expectOk(result, 200, "concurrent activation");
    }

    const staffRows = await db.staff.findMany({
      where: { candidate: { email: staff.email } },
      select: { id: true, account: { select: { id: true } } },
    });
    expect(staffRows).toHaveLength(1);
    expect(staffRows[0]?.account?.id).toBeTruthy();

    const accountEmails = await db.notificationDelivery.findMany({
      where: {
        candidate: { email: staff.email },
        type: "STAFF_ACCOUNT_CREATED",
      },
      select: { dedupeKey: true },
    });
    expect(accountEmails).toHaveLength(1);
  });

  it("repeat activation after provisioning is a full no-op (idempotent core)", async () => {
    const staff = await driveToActivation("acct-idem");
    emails.push(staff.email);

    const before = await staffRowByEmail(staff.email);
    const beforeNotifications = await db.notificationDelivery.count({
      where: { candidateId: before.candidateId },
    });

    // The same core the activation and backfill use, exercised in-process
    // against an already-provisioned Staff row — pure no-op.
    const { provisionStaffAccount } =
      await import("@/server/services/staff-accounts");
    const provisioned = await provisionStaffAccount(db, {
      staffId: before.staff.id,
      candidateId: before.candidateId,
      recipientEmail: staff.email,
    });
    expect(provisioned.accountCreated).toBe(false);
    expect(before.staff.account).not.toBeNull();
    expect(provisioned.accountId).toBe(before.staff.account!.id);
    expect(provisioned.deliveryId).toBeNull();

    expect(
      await db.notificationDelivery.count({
        where: { candidateId: before.candidateId },
      }),
    ).toBe(beforeNotifications);
  });

  it("self-heals a pre-Stage-7 Staff row through the idempotent activation path", async () => {
    // Fixture: a candidate + Staff row WITHOUT an account, as if activated
    // before Stage 7 shipped (created directly — this is exactly the state
    // the backfill targets).
    const orphan = await createOrphanStaff("acct-selfheal");
    fixtureCandidateIds.push(orphan.candidateId);

    const view = expectOk<ActivationView>(
      await apiRequest(
        "POST",
        `/api/activation/${orphan.referenceNumber}/activate`,
        { acknowledgement: true, version: ACTIVATION_META.version },
      ),
      200,
      "self-heal activation",
    );
    expect(view.staff?.staffId).toBe(orphan.staffId);

    const account = await db.staffAccount.findUnique({
      where: { staffId: orphan.staffRowId },
      select: { id: true, status: true },
    });
    expect(account?.status).toBe("ACTIVE");

    expect(
      await db.notificationDelivery.count({
        where: {
          candidateId: orphan.candidateId,
          type: "STAFF_ACCOUNT_CREATED",
        },
      }),
    ).toBe(1);
  });

  it("backfill creates missing accounts + exactly one email each; rerun and dry-run change nothing", async () => {
    const orphan = await createOrphanStaff("acct-backfill");
    fixtureCandidateIds.push(orphan.candidateId);

    const runScript = async (args: string[]) => {
      const proc = Bun.spawn(
        [
          "bun",
          "--conditions",
          "react-server",
          "scripts/backfill-staff-accounts.ts",
          ...args,
        ],
        { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
      );
      const output = await new Response(proc.stdout).text();
      const exit = await proc.exited;
      return { exit, output };
    };

    const countAccount = () =>
      db.staffAccount.findUnique({
        where: { staffId: orphan.staffRowId },
        select: { id: true },
      });
    const countEmail = () =>
      db.notificationDelivery.count({
        where: {
          candidateId: orphan.candidateId,
          type: "STAFF_ACCOUNT_CREATED",
        },
      });

    // Dry run: reports the orphan, writes NOTHING.
    const dry = await runScript(["--dry-run"]);
    expect(dry.exit).toBe(0);
    expect(dry.output).toContain(orphan.staffId);
    expect(dry.output).toContain("dry run");
    expect(await countAccount()).toBeNull();
    expect(await countEmail()).toBe(0);

    // Real run: creates the account + queues the email exactly once.
    const first = await runScript([]);
    expect(first.exit).toBe(0);
    expect(first.output).toContain(orphan.staffId);
    const account = await countAccount();
    expect(account).not.toBeNull();
    expect(await countEmail()).toBe(1);

    // Rerun: nothing to do — no duplicates, no extra emails.
    const second = await runScript([]);
    expect(second.exit).toBe(0);
    expect(second.output).toContain("Nothing to do");
    expect(await countEmail()).toBe(1);

    // The backfill never mutated the Staff identity.
    const staffAfter = await db.staff.findUnique({
      where: { id: orphan.staffRowId },
      select: {
        staffId: true,
        activatedAt: true,
        version: true,
        roleTitle: true,
      },
    });
    expect(staffAfter?.staffId).toBe(orphan.staffId);
    expect(staffAfter?.activatedAt.getTime()).toBe(
      orphan.activatedAt.getTime(),
    );
    expect(staffAfter?.roleTitle).toBe("Marketing & Customer Care Executive");
  });

  it("suspended accounts cannot receive login codes (status respected at request time)", async () => {
    const staff = await driveToActivation("acct-suspend");
    emails.push(staff.email);
    const { staff: row } = await staffRowByEmail(staff.email);

    await db.staffAccount.update({
      where: { id: row.account!.id },
      data: { status: "SUSPENDED" },
    });

    const error = expectFail(
      await apiRequest("POST", "/api/staff/auth/request-code", {
        email: staff.email,
      }),
      422,
      "VALIDATION_ERROR",
      "suspended request-code",
    );
    // Field error, no code row created.
    expect(error.error.fields?.email).toMatch(
      /No active FinFam Staff account/i,
    );
    expect(
      await db.staffLoginCode.count({ where: { accountId: row.account!.id } }),
    ).toBe(0);

    await db.staffAccount.update({
      where: { id: row.account!.id },
      data: { status: "ACTIVE" },
    });
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Creates a pre-Stage-7 style orphan: candidate + Staff row, NO account. */
async function createOrphanStaff(label: string) {
  const email = uniqueEmail(label);
  const referenceNumber = `FF-${Array.from(
    { length: 6 },
    () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)],
  ).join("")}`;

  const candidate = await db.candidate.create({
    data: {
      referenceNumber,
      fullName: STAFF_TEST_PROFILE.fullName,
      email,
      phone: STAFF_TEST_PROFILE.phone,
      city: STAFF_TEST_PROFILE.city,
      status: "APPROVED_STAFF",
      applications: {
        create: { roleTitle: OPEN_POSITION.title, status: "SUBMITTED" },
      },
    },
    select: { id: true, referenceNumber: true },
  });

  const staffRow = await db.staff.create({
    data: {
      candidateId: candidate.id,
      staffId: `FF-STF-9${Math.floor(100 + Math.random() * 900)}`,
      version: "1.0",
      roleTitle: "Marketing & Customer Care Executive",
      appointmentReference: "FFL/HR/PLA/901",
      activatedAt: new Date(),
    },
    select: { id: true, staffId: true, activatedAt: true },
  });

  return {
    candidateId: candidate.id,
    referenceNumber: candidate.referenceNumber,
    staffRowId: staffRow.id,
    staffId: staffRow.staffId,
    activatedAt: staffRow.activatedAt,
    email,
  };
}
