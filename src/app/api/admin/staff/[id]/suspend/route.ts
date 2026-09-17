import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { assertSameOrigin } from "@/lib/admin/request-origin";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminSuspendSchema } from "@/lib/validation/admin";
import { suspendStaffAccount } from "@/server/services/admin-account-actions";

/**
 * POST /api/admin/staff/[id]/suspend — privileged StaffAccount access
 * transition (Stage 11, brief §27/§28).
 *
 * Guards, in order:
 *   1. `requireAdminSession()` — authentication is independently required
 *      (§61): no valid admin session → 401 before anything else runs.
 *   2. `assertSameOrigin()` — same-origin verification, fail closed (§40).
 *   3. Zod body — a trimmed 1–500 character plain-text reason is REQUIRED
 *      (§27); no invented reason categories exist.
 *
 * The transition itself is one atomic transaction (status flip + revocation
 * of every live Staff session + audit event) and is idempotent: suspending
 * an already-suspended account is a safe no-op returning the current state
 * with `transitioned: false` and NO second audit event (§32/§33). The
 * actor comes from the session only (§36).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireAdminSession();
    assertSameOrigin(request);

    const { id } = await context.params;

    const body = await readJsonBody(request);
    const parsed = adminSuspendSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "A suspension reason is required.",
        getFieldErrors(parsed.error),
      );
    }

    const result = await suspendStaffAccount({
      actorId: session.account.id,
      staffRowId: id,
      reason: parsed.data.reason,
    });

    return {
      accountStatus: result.accountStatus,
      transitioned: result.transitioned,
    };
  });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}
