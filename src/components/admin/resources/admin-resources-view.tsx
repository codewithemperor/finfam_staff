"use client";

import { useState, useRef } from "react";
import {
  Download,
  Eye,
  FileIcon,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  X,
  ExternalLink,
} from "lucide-react";
import { Button, Alert, Chip, Modal } from "@heroui/react";

import { STAFF_RESOURCES_CATEGORIES } from "@/config/staff-resources";

export interface ResourceItem {
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

interface AdminResourcesViewProps {
  initialResources: ResourceItem[];
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

export function AdminResourcesView({ initialResources }: AdminResourcesViewProps) {
  const [resources, setResources] = useState<ResourceItem[]>(initialResources);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<ResourceItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(STAFF_RESOURCES_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "danger", message: "File exceeds the 5MB maximum limit." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "resource");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "File upload failed.");
      }

      setUploadedFile({
        url: json.data.url,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err) {
      setFeedback({
        type: "danger",
        message: err instanceof Error ? err.message : "Failed to upload file.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveResource() {
    const resolvedCategory = category === "OTHER" ? customCategory.trim() : category;
    if (!title.trim() || !resolvedCategory || !uploadedFile) {
      setFeedback({ type: "danger", message: "Please fill in all required fields and upload a file." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: resolvedCategory,
          description: description.trim() || null,
          fileUrl: uploadedFile.url,
          fileName: uploadedFile.fileName,
          fileType: uploadedFile.fileType,
          fileSize: uploadedFile.fileSize,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to create resource.");
      }

      setResources((prev) => [json.data.resource, ...prev]);
      setFeedback({ type: "success", message: "Resource published successfully!" });
      resetForm();
      setIsUploadOpen(false);
    } catch (err) {
      setFeedback({
        type: "danger",
        message: err instanceof Error ? err.message : "Failed to save resource.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteResource(id: string) {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    setIsDeleting(id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/resources?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to delete resource.");
      }

      setResources((prev) => prev.filter((r) => r.id !== id));
      setFeedback({ type: "success", message: "Resource deleted successfully." });
    } catch (err) {
      setFeedback({
        type: "danger",
        message: err instanceof Error ? err.message : "Failed to delete resource.",
      });
    } finally {
      setIsDeleting(null);
    }
  }

  function resetForm() {
    setTitle("");
    setCategory(STAFF_RESOURCES_CATEGORIES[0]);
    setCustomCategory("");
    setDescription("");
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filteredResources = resources.filter((r) => {
    const matchesCategory = selectedCategory === "ALL" || r.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const allCategories = Array.from(
    new Set([...STAFF_RESOURCES_CATEGORIES, ...resources.map((r) => r.category)]),
  );

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <Alert status={feedback.type}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{feedback.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Staff Resource Library
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload marketing materials, training guides, and documents accessible to staff.
          </p>
        </div>
        <Button
          variant="primary"
          onPress={() => {
            resetForm();
            setIsUploadOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-4" />
          Upload Resource
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors ${
              selectedCategory === "ALL"
                ? "bg-primary border-primary text-primary-foreground shadow-xs"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            All ({resources.length})
          </button>
          {allCategories.map((cat) => {
            const count = resources.filter((r) => r.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary border-primary text-primary-foreground shadow-xs"
                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>
      </div>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <UploadCloud className="size-10 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No resources found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery
              ? "No items match your search."
              : "Upload your first marketing or training resource for staff."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onPress={() => setIsUploadOpen(true)}
          >
            Upload Now
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((res) => {
            const isImage =
              res.fileType.startsWith("image/") ||
              /\.(jpe?g|png|webp)($|\?)/i.test(res.fileUrl);
            const isPdf =
              res.fileType.includes("pdf") || /\.pdf($|\?)/i.test(res.fileUrl);

            return (
              <div
                key={res.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200">
                        {getFileIcon(res.fileType, res.fileName)}
                      </div>
                      <div className="min-w-0">
                        <Chip size="sm" variant="soft" color="accent">
                          {res.category}
                        </Chip>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete resource"
                      disabled={isDeleting === res.id}
                      onClick={() => handleDeleteResource(res.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    >
                      {isDeleting === res.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-base font-bold text-foreground">
                    {res.title}
                  </h3>

                  {res.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {res.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate max-w-[150px] font-mono text-[11px]">
                      {res.fileName}
                    </span>
                    <span>•</span>
                    <span>{formatBytes(res.fileSize)}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-divider pt-3">
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
      )}

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog aria-label="Upload Staff Resource">
              <Modal.Header>
                <Modal.Heading slot="title" className="text-lg font-bold text-foreground">
                  Upload Staff Resource
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    Resource Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FinFam Marketing Pitch & Product Deck"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    Category Section <span className="text-danger">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {STAFF_RESOURCES_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="OTHER">Other / Custom Section</option>
                  </select>
                </div>

                {category === "OTHER" && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground">
                      Custom Category Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter custom category name"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Briefly explain what this resource is and how staff should use it..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </div>

                {/* File Upload Box */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">
                    Upload File <span className="text-danger">*</span>
                  </label>

                  {uploadedFile ? (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(uploadedFile.fileType, uploadedFile.fileName)}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {uploadedFile.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(uploadedFile.fileSize)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="rounded p-1 text-danger hover:bg-danger/10"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-zinc-50"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                      />
                      {isUploading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="size-8 animate-spin text-primary" />
                          <p className="mt-2 text-sm font-medium text-foreground">
                            Uploading and processing file...
                          </p>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="size-8 text-muted-foreground" />
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            Click to select or drag and drop file here
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPEG, PNG, PDF, Word (.doc, .docx) — Max 5MB
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" size="sm" onPress={() => setIsUploadOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={
                    !title.trim() ||
                    !uploadedFile ||
                    (category === "OTHER" && !customCategory.trim()) ||
                    isSaving
                  }
                  onPress={handleSaveResource}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Publishing...
                    </span>
                  ) : (
                    "Publish Resource"
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Preview Modal */}
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
