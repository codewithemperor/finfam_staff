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
import type { AdminLoginCodePayload } from "@/server/notifications/notification-types";

/**
 * FinFam Admin console authentication (Stage 11): Email OTP + DB-backed
 * sessions. Mirrors the PROVEN Staff authentication security properties
 * (approved brief §6/§7) against the structurally separate AdminAccount /
 * AdminLoginCode / AdminSession tables:
 *
 * - Code: 6 digits, cryptographically secure randomness (crypto.randomInt).
 * - Storage: ONLY the sha256 hash at rest. The plaintext exists in memory
 *   between creation and the single dispatch, and is never logged.
 * - Expiry: 10 minutes. Single-use: one verification transaction wins a
 *   conditional `consumedAt = null` latch — a reused or concurrently
 *   verified code creates exactly one session (the loser fails).
 * - Attempts: max 5 failed verifications per code (atomic increment).
 * - Replacement: only the LATEST code of an account is ever verifiable.
 * - Resend cooldown: 60s between codes per account (HTTP 429).
 * - Request rate limit: max 5 codes / rolling 15 minutes per account (429).
 * - Unknown or inactive email requests return a field-level validation error
 *   and create NO rows. Verification failures remain generic.
 * - Suspension: a SUSPENDED AdminAccount cannot receive usable codes,
 *   cannot verify, and its sessions do not resolve.
 * - One-shot delivery (§9): ADMIN_LOGIN_CODE is attempted exactly once from
 *   memory via the existing outbox — with NO Candidate row and NO fabricated
 *   candidateId (NotificationDelivery.candidateId stays null; the
 *   recipient is the real AdminAccount email). A failed send is terminal
 *   for that code; there is no retry that could re-send a dead code.
 * - Sessions: opaque 32-byte base64url cookie token, only its sha256 hash
 *   stored (unique), absolute TTL of 12h by default (ADMIN_SESSION_TTL_HOURS),
 *   no sliding renewal; logout revokes the row.
 *
 * Duplication policy (approved brief §7): this file deliberately mirrors
 * staff-auth.ts rather than refactoring Staff auth — no Staff OTP/session
 * behavior, TTL, cookie or copy was changed. Shared primitives are limited
 * to genuinely low-level helpers (sha256Hex, buildDedupeKey,
 * enqueueOneShotNotification).
 */

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_WINDOW_MAX = 5;

/** Absolute admin session TTL — 12h default via ADMIN_SESSION_TTL_HOURS. */
function adminSessionTtlMs(): number {
  const raw = Number.parseInt(process.env.ADMIN_SESSION_TTL_HOURS ?? "", 10);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 12;
  return hours * 60 * 60 * 1000;
}

export const NEUTRAL_ADMIN_REQUEST_MESSAGE =
  "If this email belongs to an authorized FinFam administrator account, a sign-in code has been sent. The code expires in 10 minutes.";

const UNKNOWN_ADMIN_EMAIL_MESSAGE =
  "No active FinFam administrator account was found for this email address.";

const INVALID_CODE_MESSAGE =
  "That code is not valid or has expired. Request a new code and try again.";

const RATE_LIMITED_MESSAGE =
  "Too many sign-in code requests. Please wait a few minutes before requesting another code.";

const COOLDOWN_MESSAGE =
  "A sign-in code was sent recently. Please wait a minute before requesting another one.";

/* -------------------------------------------------------------------------
 * Account resolution — the single authority for "does this email belong to
 * an ACTIVE Admin console account". Never leaks existence to the client.
 * ---------------------------------------------------------------------- */

interface ResolvedAdminAccount {
  accountId: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
}

async function resolveAdminAccountByEmail(
  rawEmail: string,
): Promise<ResolvedAdminAccount | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;

  const account = await db.adminAccount.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  return account
    ? { accountId: account.id, email: account.email, status: account.status }
    : null;
}

/* -------------------------------------------------------------------------
 * Request a sign-in code
 * ---------------------------------------------------------------------- */

export interface RequestAdminLoginCodeResult {
  /** Returned only after an active admin account has been resolved. */
  sent: true;
  /**
   * DEVELOPMENT/TEST ONLY (ADMIN_AUTH_DEV_CODE_ECHO=true): the plaintext
   * code echoed so sandbox flows can complete without a real inbox.
   * Production MUST run with the flag false — then this is undefined and
   * the code exists only inside the email pipeline. This switch is
   * deliberately separate from STAFF_AUTH_DEV_CODE_ECHO (brief §10).
   */
  devCode?: string;
}

export async function requestAdminLoginCode(
  rawEmail: string,
): Promise<RequestAdminLoginCodeResult> {
  const account = await resolveAdminAccountByEmail(rawEmail);

  // Unknown and suspended emails cannot receive a code and create no rows.
  if (!account || account.status !== "ACTIVE") {
    throw validationError(UNKNOWN_ADMIN_EMAIL_MESSAGE, {
      email: UNKNOWN_ADMIN_EMAIL_MESSAGE,
    });
  }

  const now = Date.now();

  // Resend cooldown: the latest code must be older than 60s.
  const latest = await db.adminLoginCode.findFirst({
    where: { accountId: account.accountId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && now - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError("RATE_LIMITED", COOLDOWN_MESSAGE, { status: 429 });
  }

  // Request rate limit: max 5 codes in the rolling 15-minute window.
  const windowStart = new Date(now - REQUEST_WINDOW_MS);
  const recentCount = await db.adminLoginCode.count({
    where: {
      accountId: account.accountId,
      createdAt: { gte: windowStart },
    },
  });
  if (recentCount >= REQUEST_WINDOW_MAX) {
    throw new AppError("RATE_LIMITED", RATE_LIMITED_MESSAGE, { status: 429 });
  }

  // Generate + persist (hashed) + queue the one-shot email intent in ONE
  // transaction, then dispatch once after the commit. The recipient is the
  // AdminAccount email itself — no Candidate row is created or borrowed.
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(
    CODE_LENGTH,
    "0",
  );
  const expiresAt = new Date(now + CODE_TTL_MS);

  const { row, enqueued } = await db.$transaction(async (tx) => {
    const created = await tx.adminLoginCode.create({
      data: {
        accountId: account.accountId,
        codeHash: sha256Hex(code),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    const payload: AdminLoginCodePayload = {
      loginCode: code,
      expiresAt: created.expiresAt.toISOString(),
    };

    const queued = await enqueueOneShotNotification(tx, {
      type: "ADMIN_LOGIN_CODE",
      dedupeKey: buildDedupeKey("ADMIN_LOGIN_CODE", created.id),
      recipientEmail: account.email,
      payload,
    });

    return { row: created, enqueued: queued };
  });

  // Exactly one delivery attempt from memory. If the process dies before
  // this line, the row stays queued but can never be rendered — the admin
  // simply requests a fresh code. The code is NOT logged.
  if (enqueued.deliveryId) {
    dispatchNotification(enqueued.deliveryId, enqueued.payload);
  }

  const devCode =
    process.env.ADMIN_AUTH_DEV_CODE_ECHO === "true" ? code : undefined;

  return { sent: true, ...(devCode ? { devCode } : {}) };
}

/* -------------------------------------------------------------------------
 * Verify a code → create an admin session
 * ---------------------------------------------------------------------- */

export interface VerifiedAdminLogin {
  /** Opaque session token for the cookie — the DB stores only its hash. */
  token: string;
  expiresAt: Date;
}

export async function verifyAdminLoginCode(
  rawEmail: string,
  rawCode: string,
): Promise<VerifiedAdminLogin> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const account = await resolveAdminAccountByEmail(rawEmail);

  // Unknown / non-admin / suspended: the SAME invalid-code response as a
  // wrong code — no existence signal (§9).
  if (!account || account.status !== "ACTIVE") {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const latest = await db.adminLoginCode.findFirst({
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

  // Attempt budget: a dead code refuses everything, atomically.
  if (latest.attemptCount >= MAX_ATTEMPTS_PER_CODE) {
    throw validationError(INVALID_CODE_MESSAGE, {
      code: INVALID_CODE_MESSAGE,
    });
  }

  const matches = sha256Hex(code) === latest.codeHash;

  if (!matches) {
    // Atomic increment so parallel wrong attempts cannot exceed the budget.
    await db.adminLoginCode.updateMany({
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
  // The conditional latch makes the code single-use under concurrency:
  // exactly one verification wins; losers get the invalid-code response
  // and never a second session.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + adminSessionTtlMs());

  const winner = await db.$transaction(async (tx) => {
    const consumed = await tx.adminLoginCode.updateMany({
      where: {
        id: latest.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: MAX_ATTEMPTS_PER_CODE },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;

    await tx.adminSession.create({
      data: {
        accountId: account.accountId,
        tokenHash: sha256Hex(token),
        expiresAt,
      },
    });

    await tx.adminAccount.update({
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

/** The identity chain the whole Admin console is built on (brief §12). */
export interface AdminSessionContext {
  session: { id: string; expiresAt: Date };
  account: { id: string; email: string; status: "ACTIVE" | "SUSPENDED" };
}

/**
 * Resolve a session token to its identity chain. Returns null when the
 * token is unknown, the session expired or was revoked, or the account is
 * no longer ACTIVE (suspension kills admin access immediately). The token
 * argument is the raw cookie value; only its hash is ever queried.
 */
export async function resolveAdminSession(
  token: string,
): Promise<AdminSessionContext | null> {
  if (!token) return null;

  const row = await db.adminSession.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      account: { select: { id: true, email: true, status: true } },
    },
  });

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.account.status !== "ACTIVE") return null;

  return {
    session: { id: row.id, expiresAt: row.expiresAt },
    account: {
      id: row.account.id,
      email: row.account.email,
      status: row.account.status,
    },
  };
}

/** Revoke one admin session by token (logout). Idempotent. */
export async function revokeAdminSession(token: string): Promise<void> {
  await db.adminSession.updateMany({
    where: { tokenHash: sha256Hex(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
