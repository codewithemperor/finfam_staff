import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/auth/hash";
import { AppError, validationError } from "@/lib/errors";
import {
  dispatchNotification,
  enqueueOneShotNotification,
} from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import type { StaffLoginCodePayload } from "@/server/notifications/notification-types";

/**
 * Staff Portal authentication (Stage 7): Email OTP + DB-backed sessions.
 *
 * Approved MVP policy (brief §6/§59 — every value documented, none secret):
 *
 * - Code: 6 digits, cryptographically secure randomness (crypto.randomInt).
 * - Storage: ONLY the sha256 hash at rest. The plaintext exists in memory
 *   between creation and the single dispatch, and is never logged.
 * - Expiry: 10 minutes. Single-use: one verification transaction wins a
 *   conditional `consumedAt = null` latch — a reused or concurrently
 *   verified code creates exactly one session (the loser fails).
 * - Attempts: max 5 failed verifications per code (atomic increment).
 * - Replacement: only the LATEST code of an account is ever verifiable —
 *   a fresh request supersedes older ones.
 * - Resend cooldown: 60s between codes per account (HTTP 429).
 * - Request rate limit: max 5 codes / rolling 15 minutes per account (429).
 * - Unknown or inactive email requests return a field-level validation error
 *   and create NO rows. Verification failures remain generic.
 * - Suspension (§17): a SUSPENDED account cannot receive usable codes,
 *   cannot verify, and its sessions do not resolve.
 * - One-shot delivery (§10): the OTP email is attempted exactly once from
 *   memory; a failed send is terminal for that code (request a new one).
 *   No plaintext is ever persisted to support a retry.
 * - Recovery (§16): OTP resend IS the recovery mechanism for this stage.
 */

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_WINDOW_MAX = 5;

/** MVP default 7 days; configurable via STAFF_SESSION_TTL_DAYS (brief §13). */
function sessionTtlMs(): number {
  const raw = Number.parseInt(process.env.STAFF_SESSION_TTL_DAYS ?? "", 10);
  const days = Number.isFinite(raw) && raw > 0 ? raw : 7;
  return days * 24 * 60 * 60 * 1000;
}

export const NEUTRAL_REQUEST_MESSAGE =
  "If the email belongs to an active FinFam Staff account, a login code has been sent. The code expires in 10 minutes.";

const UNKNOWN_STAFF_EMAIL_MESSAGE =
  "No active FinFam Staff account was found for this email address.";

const INVALID_CODE_MESSAGE =
  "That code is not valid or has expired. Request a new code and try again.";

const RATE_LIMITED_MESSAGE =
  "Too many login code requests. Please wait a few minutes before requesting another code.";

const COOLDOWN_MESSAGE =
  "A login code was sent recently. Please wait a minute before requesting another one.";

/* -------------------------------------------------------------------------
 * Account resolution — the single authority for "does this email belong to
 * an ACTIVE Staff Portal account". Never leaks existence to the client.
 * ---------------------------------------------------------------------- */

interface ResolvedStaffAccount {
  accountId: string;
  status: "ACTIVE" | "SUSPENDED";
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  referenceNumber: string;
  staffRowId: string;
  staffId: string;
}

async function resolveAccountByEmail(
  rawEmail: string,
): Promise<ResolvedStaffAccount | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;

  const candidate = await db.candidate.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      referenceNumber: true,
      staff: {
        select: {
          id: true,
          staffId: true,
          account: { select: { id: true, status: true } },
        },
      },
    },
  });

  const staff = candidate?.staff;
  if (!candidate || !staff || !staff.account) return null;

  return {
    accountId: staff.account.id,
    status: staff.account.status,
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    candidateEmail: candidate.email,
    referenceNumber: candidate.referenceNumber,
    staffRowId: staff.id,
    staffId: staff.staffId,
  };
}

/* -------------------------------------------------------------------------
 * Request a login code
 * ---------------------------------------------------------------------- */

export interface RequestLoginCodeResult {
  /** Returned only after an active Staff account has been resolved. */
  sent: true;
  /**
   * DEVELOPMENT/TEST ONLY (STAFF_AUTH_DEV_CODE_ECHO=true): the plaintext
   * code echoed so sandbox flows can complete without a real inbox.
   * Production MUST run with the flag false — then this is undefined and
   * the code exists only inside the email pipeline.
   */
  devCode?: string;
}

export async function requestLoginCode(
  rawEmail: string,
): Promise<RequestLoginCodeResult> {
  const account = await resolveAccountByEmail(rawEmail);

  // Unknown and suspended emails cannot receive a code and create no rows.
  if (!account || account.status !== "ACTIVE") {
    throw validationError(UNKNOWN_STAFF_EMAIL_MESSAGE, {
      email: UNKNOWN_STAFF_EMAIL_MESSAGE,
    });
  }

  const now = Date.now();

  // Resend cooldown: the latest code must be older than 60s (§6).
  const latest = await db.staffLoginCode.findFirst({
    where: { accountId: account.accountId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && now - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError("RATE_LIMITED", COOLDOWN_MESSAGE, { status: 429 });
  }

  // Request rate limit: max 5 codes in the rolling 15-minute window (§6).
  const windowStart = new Date(now - REQUEST_WINDOW_MS);
  const recentCount = await db.staffLoginCode.count({
    where: {
      accountId: account.accountId,
      createdAt: { gte: windowStart },
    },
  });
  if (recentCount >= REQUEST_WINDOW_MAX) {
    throw new AppError("RATE_LIMITED", RATE_LIMITED_MESSAGE, { status: 429 });
  }

  // Generate + persist (hashed) + queue the one-shot email intent in ONE
  // transaction, then dispatch once after the commit (§10).
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(
    CODE_LENGTH,
    "0",
  );
  const expiresAt = new Date(now + CODE_TTL_MS);

  const { row, enqueued } = await db.$transaction(async (tx) => {
    const created = await tx.staffLoginCode.create({
      data: {
        accountId: account.accountId,
        codeHash: sha256Hex(code),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    const payload: StaffLoginCodePayload = {
      candidateId: account.candidateId,
      candidateName: account.candidateName,
      recipientEmail: account.candidateEmail,
      referenceNumber: account.referenceNumber,
      staffId: account.staffId,
      loginCode: code,
      expiresAt: created.expiresAt.toISOString(),
    };

    const queued = await enqueueOneShotNotification(tx, {
      type: "STAFF_LOGIN_CODE",
      dedupeKey: buildDedupeKey("STAFF_LOGIN_CODE", created.id),
      candidateId: account.candidateId,
      recipientEmail: account.candidateEmail,
      payload,
    });

    return { row: created, enqueued: queued };
  });

  // Exactly one delivery attempt from memory (§10). If the process dies
  // before this line, the row stays queued but can never be rendered — the
  // user simply requests a fresh code. The code is NOT logged.
  if (enqueued.deliveryId) {
    dispatchNotification(enqueued.deliveryId, enqueued.payload);
  }

  const devCode =
    process.env.STAFF_AUTH_DEV_CODE_ECHO === "true" ? code : undefined;

  return { sent: true, ...(devCode ? { devCode } : {}) };
}

/* -------------------------------------------------------------------------
 * Verify a code → create a session
 * ---------------------------------------------------------------------- */

export interface VerifiedLogin {
  /** Opaque session token for the cookie — the DB stores only its hash. */
  token: string;
  expiresAt: Date;
}

export async function verifyLoginCode(
  rawEmail: string,
  rawCode: string,
): Promise<VerifiedLogin> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const account = await resolveAccountByEmail(rawEmail);

  // Unknown / non-Staff / suspended: the SAME invalid-code response as a
  // wrong code — no existence signal (§8/§17).
  if (!account || account.status !== "ACTIVE") {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const latest = await db.staffLoginCode.findFirst({
    where: { accountId: account.accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, expiresAt: true, attemptCount: true },
  });

  // No code at all — the same invalid response (never "you have no code").
  if (!latest) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const now = new Date();

  // Attempt budget (§6): a dead code refuses everything, atomically.
  if (latest.attemptCount >= MAX_ATTEMPTS_PER_CODE) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const matches = sha256Hex(code) === latest.codeHash;

  if (!matches) {
    // Atomic increment so parallel wrong attempts cannot exceed the budget.
    await db.staffLoginCode.updateMany({
      where: { id: latest.id, attemptCount: { lt: MAX_ATTEMPTS_PER_CODE } },
      data: { attemptCount: { increment: 1 } },
    });
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  if (latest.expiresAt.getTime() <= now.getTime()) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  // Consume + create the session + stamp lastLoginAt in ONE transaction.
  // The conditional latch makes the code single-use under concurrency
  // (§7): exactly one verification wins; losers get the invalid-code
  // response and never a second session.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + sessionTtlMs());

  const winner = await db.$transaction(async (tx) => {
    const consumed = await tx.staffLoginCode.updateMany({
      where: {
        id: latest.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: MAX_ATTEMPTS_PER_CODE },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;

    await tx.staffSession.create({
      data: {
        accountId: account.accountId,
        tokenHash: sha256Hex(token),
        expiresAt,
      },
    });

    await tx.staffAccount.update({
      where: { id: account.accountId },
      data: { lastLoginAt: now },
    });

    return true;
  });

  if (!winner) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  return { token, expiresAt };
}

/* -------------------------------------------------------------------------
 * Sessions
 * ---------------------------------------------------------------------- */

/** The identity chain the whole Staff Portal is built on (brief §18). */
export interface StaffSessionContext {
  session: { id: string; expiresAt: Date };
  account: { id: string; status: "ACTIVE" | "SUSPENDED" };
  staff: {
    rowId: string;
    staffId: string;
    roleTitle: string;
    appointmentReference: string;
    activatedAt: Date;
  };
  candidate: {
    id: string;
    referenceNumber: string;
    fullName: string;
    email: string;
  };
}

/**
 * Resolve a session token to its identity chain. Returns null when the
 * token is unknown, the session expired or was revoked, or the account is
 * no longer ACTIVE (§17 — suspension kills access immediately). The token
 * argument is the raw cookie value; only its hash is ever queried.
 */
export async function resolveStaffSession(
  token: string,
): Promise<StaffSessionContext | null> {
  if (!token) return null;

  const row = await db.staffSession.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      account: {
        select: {
          id: true,
          status: true,
          staff: {
            select: {
              id: true,
              staffId: true,
              roleTitle: true,
              appointmentReference: true,
              activatedAt: true,
              candidate: {
                select: {
                  id: true,
                  referenceNumber: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.account.status !== "ACTIVE") return null;

  return {
    session: { id: row.id, expiresAt: row.expiresAt },
    account: { id: row.account.id, status: row.account.status },
    staff: {
      rowId: row.account.staff.id,
      staffId: row.account.staff.staffId,
      roleTitle: row.account.staff.roleTitle,
      appointmentReference: row.account.staff.appointmentReference,
      activatedAt: row.account.staff.activatedAt,
    },
    candidate: {
      id: row.account.staff.candidate.id,
      referenceNumber: row.account.staff.candidate.referenceNumber,
      fullName: row.account.staff.candidate.fullName,
      email: row.account.staff.candidate.email,
    },
  };
}

/** Revoke one session by token (logout, brief §15). Idempotent. */
export async function revokeStaffSession(token: string): Promise<void> {
  await db.staffSession.updateMany({
    where: { tokenHash: sha256Hex(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
