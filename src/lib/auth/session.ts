import "server-only";

import { cookies } from "next/headers";

import { AppError } from "@/lib/errors";
import { resolveStaffSession } from "@/server/services/staff-auth";
import type { StaffSessionContext } from "@/server/services/staff-auth";

/**
 * Staff Portal session cookie + identity resolution (Stage 7).
 *
 * The browser holds ONLY an opaque random token in an HttpOnly cookie;
 * the server stores only its sha256 hash (staff-auth.ts). Identity ALWAYS
 * resolves Session → StaffAccount → Staff → Candidate — never from a URL
 * parameter, request body or sequential Staff ID (brief §18/§19).
 *
 * The token never touches localStorage; `Secure` is enabled in production.
 * Cookie WRITES are done on the route handler's NextResponse (response
 * cookies), so the cookie always matches the response that created it.
 */

export const STAFF_SESSION_COOKIE = "ff_staff_session";

export type { StaffSessionContext };

/** Read the authenticated Staff identity chain, or null. */
export async function getStaffSession(): Promise<StaffSessionContext | null> {
  const store = await cookies();
  const token = store.get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveStaffSession(token);
}

/**
 * Session-or-throw variant for route handlers. Pages use `getStaffSession`
 * + `redirect` instead (they need a navigation, not an error envelope).
 */
export async function requireStaffSession(): Promise<StaffSessionContext> {
  const session = await getStaffSession();
  if (!session) {
    throw new AppError(
      "UNAUTHORIZED",
      "Please sign in to the Staff Portal to continue.",
      { status: 401 },
    );
  }
  return session;
}

/**
 * Cookie attributes shared by the login (set) and logout (clear) routes.
 * HttpOnly + SameSite=Lax + Path=/ always; Secure in production (brief §12).
 */
export function staffSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  } as const;
}

/** Cookie attributes that clear the session cookie immediately. */
export function staffSessionClearOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  } as const;
}
