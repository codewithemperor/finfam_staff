"use client";

import { useState } from "react";
import { Alert, Button, Input, Label, Spinner, TextField, toast } from "@heroui/react";
import { ExternalLink, MessageCircle, Save } from "lucide-react";

export function AdminSettingsForm({
  initialWhatsappGroupLink,
}: {
  initialWhatsappGroupLink: string;
}) {
  const [whatsappLink, setWhatsappLink] = useState(initialWhatsappGroupLink);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappGroupLink: whatsappLink.trim() }),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to save settings");
      }

      toast("Settings updated successfully", {
        description: "Official Staff WhatsApp Group link has been updated.",
        variant: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Unable to save settings</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <span className="grid size-10 place-items-center rounded-lg bg-success/10 text-success">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Official Staff WhatsApp Group
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct group link displayed prominently on all staff member dashboards.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <TextField name="whatsappLink">
            <Label>Official WhatsApp Group Invite Link</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="url"
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="flex-1"
              />
              {whatsappLink.trim() && (
                <a
                  href={whatsappLink.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-zinc-100"
                >
                  <ExternalLink className="size-4" />
                  Test link
                </a>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Paste the full invite link (e.g.{" "}
              <code className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-800">
                https://chat.whatsapp.com/ABC123xyz...
              </code>
              ). When this link is updated or reset by WhatsApp, change it here to immediately update all staff dashboards.
            </p>
          </TextField>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <Button
            type="submit"
            isPending={saving}
            className="gap-2"
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <Save className="size-4" />
                )}
                {isPending ? "Saving changes…" : "Save changes"}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
