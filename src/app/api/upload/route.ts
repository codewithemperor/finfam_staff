import { NextRequest, NextResponse } from "next/server";
import { uploadFileBuffer, deleteUploadedFile } from "@/lib/cloudinary";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "No file was uploaded." } },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "File exceeds the 5MB maximum allowed size.",
          },
        },
        { status: 400 },
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Unsupported file type. Please upload a PDF, DOC, DOCX, or Image (JPEG/PNG/WEBP).",
          },
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = "name" in file && typeof file.name === "string" ? file.name : "upload.bin";
    const documentType = String(formData.get("documentType") ?? "credential");

    const result = await uploadFileBuffer(buffer, {
      folder: `finfam/credentials/${documentType}`,
      filename: fileName,
      resourceType: file.type.startsWith("image/") ? "image" : "auto",
    });

    return NextResponse.json({
      ok: true,
      data: {
        url: result.url,
        bytes: result.bytes,
        format: result.format,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File upload failed";
    return NextResponse.json(
      { ok: false, error: { code: "UPLOAD_FAILED", message } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "File URL is required." } },
        { status: 400 },
      );
    }

    await deleteUploadedFile(fileUrl);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "DELETE_FAILED", message: "Failed to delete file." } },
      { status: 500 },
    );
  }
}

