import "server-only";

import { cookies } from "next/headers";

import { AppError } from "@/lib/errors";
import { resolveAdminSession } from "@/server/services/admin-auth";
import type { AdminSessionContext } from "@/server/services/admin-auth";

/**
 * Admin console session cookie + identity resolution (Stage 11).
 *
 * Structurally SEPARATE from the Staff Portal domain (approved brief §3):
 * the browser holds ONLY an opaque random token in the HttpOnly cookie
 * `ff_admin_session`; the server stores only its sha256 hash
 * (admin-auth.ts). Identity ALWAYS resolves cookie → token hash →
 * AdminSession → AdminAccount — never from a URL parameter or request body.
 *
 * A Staff session cookie can never satisfy this guard (different cookie
 * name AND a different session table), and an Admin cookie can never
 * satisfy the Staff guard. The token never touches localStorage; `Secure`
 * is enabled in production. Cookie WRITES are done on the route handler's
 * NextResponse, so the cookie always matches the response that created it.
 *
 * Default absolute TTL is 12 hours (ADMIN_SESSION_TTL_HOURS) — shorter
 * than the Staff Portal's 7 days because this surface carries privileged
 * writes. There is no sliding renewal.
 */

export const ADMIN_SESSION_COOKIE = "ff_admin_session";

export type { AdminSessionContext };

/** Read the authenticated Admin identity chain, or null. */
export async function getAdminSession(): Promise<AdminSessionContext | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveAdminSession(token);
}

/**
 * Session-or-throw variant for admin route handlers. Pages use
 * `getAdminSession` + `redirect` instead (they need a navigation, not an
 * error envelope).
 */
export async function requireAdminSession(): Promise<AdminSessionContext> {
  const session = await getAdminSession();
  if (!session) {
    throw new AppError(
      "UNAUTHORIZED",
      "Please sign in to the FinFam Admin console to continue.",
      { status: 401 },
    );
  }
  return session;
}

/**
 * Cookie attributes shared by the admin login (set) and logout (clear)
 * routes. HttpOnly + SameSite=Lax + Path=/ always; Secure in production
 * (brief §11). Mirrors the Staff cookie posture — never weaker.
 */
export function adminSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  } as const;
}

/** Cookie attributes that clear the admin session cookie immediately. */
export function adminSessionClearOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  } as const;
}
