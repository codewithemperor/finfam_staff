import type { NextRequest } from "next/server";

import { handleApiRequest, readJsonBody } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { assertSameOrigin } from "@/lib/admin/request-origin";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminReactivateSchema } from "@/lib/validation/admin";
import { reactivateStaffAccount } from "@/server/services/admin-account-actions";

/**
 * POST /api/admin/staff/[id]/reactivate — privileged StaffAccount access
 * transition (Stage 11, brief §31/§32).
 *
 * Guards mirror the suspend endpoint: admin session first (independently
 * required, §61), then same-origin verification (fail closed, §40), then
 * Zod (the note is optional, trimmed, ≤ 500 chars).
 *
 * Reactivation changes ONLY StaffAccount.status SUSPENDED → ACTIVE inside
 * one transaction with the audit event. It never recreates Staff, never
 * issues a new Staff ID, never resets onboarding/training, never modifies
 * reports and never resurrects old sessions. Duplicate reactivation on an
 * ACTIVE account is a safe no-op (`transitioned: false`) with no second
 * audit event (§32/§33). The actor comes from the session only (§36).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return handleApiRequest(async () => {
    const session = await requireAdminSession();
    assertSameOrigin(request);

    const { id } = await context.params;

    const body = await readJsonBody(request);
    const parsed = adminReactivateSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "The reactivation note is not valid.",
        getFieldErrors(parsed.error),
      );
    }

    const result = await reactivateStaffAccount({
      actorId: session.account.id,
      staffRowId: id,
      note: parsed.data.note,
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
