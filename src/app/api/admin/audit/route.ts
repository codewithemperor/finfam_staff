import type { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { validationError } from "@/lib/errors";
import { getFieldErrors } from "@/lib/validation/application";
import { adminAuditQuerySchema } from "@/lib/validation/admin";
import { listAdminAuditEvents } from "@/server/services/admin-audit";

/**
 * GET /api/admin/audit — paginated, read-only view of the append-only
 * privileged-action audit log (Stage 11, brief §46).
 *
 * Requires an Admin session. There is deliberately NO write method on this
 * route and no edit/delete/clear path exists anywhere in the codebase —
 * the log is immutable after creation and retained indefinitely (§35/§47;
 * formal retention is an open business/legal question).
 */
export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const parsed = adminAuditQuerySchema.safeParse({
      ...(searchParams.get("page")
        ? { page: searchParams.get("page") ?? undefined }
        : {}),
    });
    if (!parsed.success) {
      throw validationError(
        "The audit log filters are not valid.",
        getFieldErrors(parsed.error),
      );
    }

    return listAdminAuditEvents({ page: parsed.data.page });
  });
}
