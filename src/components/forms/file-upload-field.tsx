"use client";

import { useState, useRef } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@heroui/react";

interface FileUploadFieldProps {
  label: string;
  description: string;
  accept: string;
  documentType: "cv" | "passport" | "id_card";
  value?: string;
  onChange: (url: string) => void;
  error?: string;
  required?: boolean;
}

export function FileUploadField({
  label,
  description,
  accept,
  documentType,
  value,
  onChange,
  error,
  required = true,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds the 5MB maximum allowed size.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setUploadError(null);
    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to upload file");
      }

      const previousUrl = value;
      onChange(json.data.url);

      if (previousUrl && previousUrl !== json.data.url) {
        fetch(`/api/upload?url=${encodeURIComponent(previousUrl)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    const previousUrl = value;
    onChange("");
    setFileName(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (previousUrl) {
      fetch(`/api/upload?url=${encodeURIComponent(previousUrl)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }

  const isImage = documentType === "passport" || (value && /\.(jpe?g|png|webp)($|\?)/i.test(value));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">
          {label} {required && <span aria-hidden className="text-danger">*</span>}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id={`upload-${documentType}`}
      />

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {isImage ? (
              <img
                src={value}
                alt="Uploaded preview"
                className="size-12 shrink-0 rounded-md border border-border object-cover"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <FileText className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="truncate">{fileName || "Document uploaded successfully"}</span>
              </p>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
              >
                View uploaded document
              </a>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onPress={handleClear}
            className="text-muted-foreground hover:text-danger"
          >
            <X className="size-4" />
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`upload-${documentType}`}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
            uploadError || error
              ? "border-danger/60 bg-danger/5"
              : "border-border bg-surface hover:border-primary/50 hover:bg-surface/80"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Uploading to Cloudinary…</p>
              <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                {documentType === "passport" ? (
                  <ImageIcon className="size-5" />
                ) : (
                  <UploadCloud className="size-5" />
                )}
              </span>
              <p className="text-sm font-medium text-foreground">
                Click to browse and upload
              </p>
              <p className="text-xs text-muted-foreground">
                {documentType === "passport"
                  ? "JPG, PNG or WEBP (Max 5MB)"
                  : "PDF, DOC, DOCX, or clear image (Max 5MB)"}
              </p>
            </div>
          )}
        </label>
      )}

      {(uploadError || error) && (
        <p className="text-xs font-medium text-danger">{uploadError || error}</p>
      )}
    </div>
  );
}
