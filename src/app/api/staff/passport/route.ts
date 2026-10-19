import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validationError } from "@/lib/errors";

const PassportPayloadSchema = z.object({
  passportPhotoUrl: z.string().url("A valid passport photo URL is required."),
});

/**
 * POST /api/staff/passport — update the authenticated staff member's passport photo.
 */
export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = await requireStaffSession();
    const raw = await request.json().catch(() => null);
    const parsed = PassportPayloadSchema.safeParse(raw);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v?.[0]) fields[k] = v[0];
      }
      throw validationError("Invalid passport photo payload.", fields);
    }

    const updated = await db.candidate.update({
      where: { id: session.candidate.id },
      data: { passportPhotoUrl: parsed.data.passportPhotoUrl },
      select: { passportPhotoUrl: true },
    });

    return { passportPhotoUrl: updated.passportPhotoUrl };
  });
}
