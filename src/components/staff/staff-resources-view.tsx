"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  FileIcon,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  ExternalLink,
} from "lucide-react";
import { Button, Chip, Modal } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";
import {
  STAFF_RESOURCES,
  STAFF_RESOURCES_CATEGORIES,
  STAFF_RESOURCE_AVAILABILITY_LABELS,
} from "@/config/staff-resources";

export interface StaffResourceItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string | Date;
}

interface StaffResourcesViewProps {
  uploadedResources: StaffResourceItem[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(fileType: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (fileType.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return <ImageIcon className="size-5 text-blue-600" />;
  }
  if (fileType.includes("pdf") || ext === "pdf") {
    return <FileText className="size-5 text-red-600" />;
  }
  if (fileType.includes("word") || ["doc", "docx"].includes(ext)) {
    return <FileText className="size-5 text-indigo-600" />;
  }
  if (fileType.includes("excel") || fileType.includes("sheet") || ["xls", "xlsx"].includes(ext)) {
    return <FileSpreadsheet className="size-5 text-emerald-600" />;
  }
  return <FileIcon className="size-5 text-muted-foreground" />;
}

export function StaffResourcesView({ uploadedResources }: StaffResourcesViewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<StaffResourceItem | null>(null);

  // Group uploaded resources by category
  const resourcesByCategory = new Map<string, StaffResourceItem[]>();
  for (const res of uploadedResources) {
    const list = resourcesByCategory.get(res.category) || [];
    list.push(res);
    resourcesByCategory.set(res.category, list);
  }

  // Combine standard registry categories with any additional uploaded categories
  const dynamicCategories = Array.from(resourcesByCategory.keys()).filter(
    (c) => !(STAFF_RESOURCES_CATEGORIES as readonly string[]).includes(c),
  );
  const allCategorySections = [...STAFF_RESOURCES_CATEGORIES, ...dynamicCategories];

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-divider">
        {allCategorySections.map((categoryName) => {
          const uploads = resourcesByCategory.get(categoryName) || [];
          const staticEntry = STAFF_RESOURCES.find((e) => e.category === categoryName);
          const hasUploads = uploads.length > 0;

          return (
            <li key={categoryName} className="py-6 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {categoryName}
                </h3>
                {hasUploads ? (
                  <Chip size="sm" color="success" variant="soft">
                    {uploads.length} {uploads.length === 1 ? "file available" : "files available"}
                  </Chip>
                ) : (
                  staticEntry && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {STAFF_RESOURCE_AVAILABILITY_LABELS[staticEntry.availability]}
                    </p>
                  )
                )}
              </div>

              {/* Uploaded materials list */}
              {hasUploads ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {uploads.map((res) => {
                    const isImage =
                      res.fileType.startsWith("image/") ||
                      /\.(jpe?g|png|webp)($|\?)/i.test(res.fileUrl);
                    const isPdf =
                      res.fileType.includes("pdf") || /\.pdf($|\?)/i.test(res.fileUrl);

                    return (
                      <div
                        key={res.id}
                        className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-xs transition-shadow hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200">
                              {getFileIcon(res.fileType, res.fileName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-bold text-foreground">
                                {res.title}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(res.fileSize)}
                              </p>
                            </div>
                          </div>

                          {res.description && (
                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {res.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex items-center gap-2 border-t border-divider pt-3">
                          {(isImage || isPdf) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onPress={() => {
                                setPreviewResource(res);
                                setIsPreviewOpen(true);
                              }}
                            >
                              <Eye className="mr-1.5 size-3.5" />
                              Preview
                            </Button>
                          )}
                          <a
                            href={res.fileUrl}
                            download={res.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                          >
                            <Download className="mr-1.5 size-3.5" />
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p className="mt-1.5 max-w-[64ch] text-sm leading-6 text-muted-foreground">
                    {staticEntry?.description ||
                      "Materials for this category will be made available here once approved by FinFam."}
                  </p>
                  {staticEntry?.availability === "in_portal" && staticEntry.href && (
                    <div className="mt-3">
                      <ButtonLink href={staticEntry.href} variant="outline" size="sm">
                        {staticEntry.actionLabel}
                      </ButtonLink>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* Preview Modal for Staff */}
      {previewResource && (
        <Modal isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="lg">
              <Modal.Dialog aria-label="Preview Resource">
                {(() => {
                  const isImage =
                    previewResource.fileType.startsWith("image/") ||
                    /\.(jpe?g|png|webp)($|\?)/i.test(previewResource.fileUrl);

                  return (
                    <>
                      <Modal.Header>
                        <div>
                          <Modal.Heading slot="title" className="text-base font-bold text-foreground">
                            {previewResource.title}
                          </Modal.Heading>
                          <p className="text-xs text-muted-foreground">
                            {previewResource.fileName} ({formatBytes(previewResource.fileSize)})
                          </p>
                        </div>
                      </Modal.Header>
                      <Modal.Body className="max-h-[70vh] overflow-y-auto p-4">
                        {isImage ? (
                          <div className="flex items-center justify-center bg-black/5 p-4 rounded-lg">
                            <img
                              src={previewResource.fileUrl}
                              alt={previewResource.title}
                              className="max-h-[60vh] max-w-full rounded object-contain shadow-sm"
                            />
                          </div>
                        ) : (
                          <div className="h-[60vh] w-full rounded-lg border border-border overflow-hidden bg-zinc-100">
                            <iframe
                              src={`${previewResource.fileUrl}#toolbar=0`}
                              title={previewResource.title}
                              className="h-full w-full"
                            />
                          </div>
                        )}
                      </Modal.Body>
                      <Modal.Footer className="flex items-center justify-between">
                        <a
                          href={previewResource.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                        >
                          Open in New Tab
                          <ExternalLink className="ml-1 size-3.5" />
                        </a>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => {
                              setIsPreviewOpen(false);
                              setPreviewResource(null);
                            }}
                          >
                            Close
                          </Button>
                          <a
                            href={previewResource.fileUrl}
                            download={previewResource.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                          >
                            <Download className="mr-1.5 size-3.5" />
                            Download File
                          </a>
                        </div>
                      </Modal.Footer>
                    </>
                  );
                })()}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}
