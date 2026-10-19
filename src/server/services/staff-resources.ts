import "server-only";

import { db } from "@/lib/db";
import { deleteUploadedFile } from "@/lib/cloudinary";

export interface CreateStaffResourceInput {
  title: string;
  category: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
}

export async function listStaffResources(category?: string) {
  return db.staffResource.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function createStaffResource(input: CreateStaffResourceInput) {
  return db.staffResource.create({
    data: {
      title: input.title.trim(),
      category: input.category.trim(),
      description: input.description?.trim() || null,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize ?? null,
    },
  });
}

export async function deleteStaffResource(id: string) {
  const existing = await db.staffResource.findUnique({
    where: { id },
  });

  if (!existing) return null;

  try {
    await deleteUploadedFile(existing.fileUrl);
  } catch (err) {
    console.error("[staff-resources] Failed to delete file:", err);
  }

  return db.staffResource.delete({
    where: { id },
  });
}
