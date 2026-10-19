import { NextRequest } from "next/server";

import { handleApiRequest } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/session";
import { listStaffResources } from "@/server/services/staff-resources";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireStaffSession();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const resources = await listStaffResources(category);
    return { resources };
  });
}
