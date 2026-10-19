import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiRequest } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { validationError } from "@/lib/errors";
import {
  createStaffResource,
  deleteStaffResource,
  listStaffResources,
} from "@/server/services/staff-resources";

const CreateResourceSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  category: z.string().min(1, "Category is required").max(80),
  description: z.string().max(1000).optional().nullable(),
  fileUrl: z.string().url("Valid file URL is required"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileSize: z.number().int().positive().optional().nullable(),
});

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const resources = await listStaffResources(category);
    return { resources };
  });
}

export async function POST(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireAdminSession();
    const raw = await request.json().catch(() => null);
    const parsed = CreateResourceSchema.safeParse(raw);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v?.[0]) fields[k] = v[0];
      }
      throw validationError("Invalid resource payload.", fields);
    }

    const resource = await createStaffResource(parsed.data);
    return { resource };
  });
}

export async function DELETE(request: NextRequest) {
  return handleApiRequest(async () => {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      throw validationError("Resource ID is required.", {
        id: "Missing resource id parameter",
      });
    }

    const deleted = await deleteStaffResource(id);
    return { success: true, deleted: !!deleted };
  });
}
