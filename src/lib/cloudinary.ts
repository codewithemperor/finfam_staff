import { v2 as cloudinary } from "cloudinary";
import { promises as fs } from "fs";
import path from "path";

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface UploadResult {
  url: string;
  publicId?: string;
  bytes: number;
  format?: string;
}

/**
 * Upload a file buffer to Cloudinary (or fallback to local /uploads/ if Cloudinary is not configured).
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  options: {
    folder?: string;
    filename?: string;
    resourceType?: "auto" | "image" | "raw";
  } = {},
): Promise<UploadResult> {
  const folder = options.folder ?? "finfam/credentials";
  const resourceType = options.resourceType ?? "auto";

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed without error"));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            bytes: result.bytes,
            format: result.format,
          });
        },
      );
      uploadStream.end(buffer);
    });
  }

  // Graceful local fallback when Cloudinary env keys are not yet configured
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = options.filename ? path.extname(options.filename) : ".bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);
  await fs.writeFile(filePath, buffer);

  return {
    url: `/uploads/${uniqueName}`,
    bytes: buffer.length,
    format: ext.replace(/^\./, ""),
  };
}

/**
 * Delete an uploaded file from Cloudinary (or local fallback disk) to clean up
 * replaced or cancelled uploads.
 */
export async function deleteUploadedFile(
  fileUrl: string,
  publicId?: string,
): Promise<boolean> {
  try {
    if (fileUrl.startsWith("/uploads/")) {
      const fileName = path.basename(fileUrl);
      const filePath = path.join(process.cwd(), "public", "uploads", fileName);
      await fs.unlink(filePath).catch(() => {});
      return true;
    }

    if (isCloudinaryConfigured) {
      let resolvedId = publicId;
      if (!resolvedId) {
        // Parse public_id from standard Cloudinary URL: .../upload/(v[0-9]+/)?(path/to/file)(.[a-z]+)?
        const match = fileUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
        if (match?.[1]) {
          resolvedId = match[1];
        }
      }

      if (resolvedId) {
        // Try destroying as image first, then raw if not found
        const res = await cloudinary.uploader.destroy(resolvedId, {
          resource_type: "image",
        });
        if (res.result !== "ok") {
          await cloudinary.uploader.destroy(resolvedId, {
            resource_type: "raw",
          });
        }
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("[cloudinary] file deletion error:", error);
    return false;
  }
}

