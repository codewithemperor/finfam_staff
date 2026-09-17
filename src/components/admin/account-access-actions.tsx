"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Spinner, toast } from "@heroui/react";

import { ADMIN_SUSPENSION_CONSEQUENCE } from "@/config/admin";
import { ApiClientError, apiFetch } from "@/lib/api/client";

/**
 * Account access actions (Stage 11, brief §27–§33): the ONE privileged
 * write in the console — suspend or reactivate a Staff account — exposed
 * as two intent-specific focused dialogs.
 *
 * Suspend requires a reason (1–500 characters, trimmed); Reactivation
 * takes an optional note. Both POST to the matching intent-specific API
 * (`/api/admin/staff/{rowId}/suspend|reactivate`), show API errors inside
 * the dialog (role="alert"), toast on success and router.refresh() so the
 * server-rendered page re-reads the new state. The consequence copy is
 * rendered VERBATIM from config (single source of truth).
 *
 * Focus trapping is handled by the HeroUI Modal. No other mutation exists:
 * this component never edits profiles, reports or anything else.
 */
export function AccountAccessActions({
  staffRowId,
  staffId,
  fullName,
  currentStatus,
}: {
  staffRowId: string;
  staffId: string;
  fullName: string;
  currentStatus: "ACTIVE" | "SUSPENDED";
}) {
  const router = useRouter();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  async function handleSuspend() {
    if (suspending) return;
    setSuspendError(null);
    setSuspending(true);

    try {
      await apiFetch<{ accountStatus: string; transitioned: boolean }>(
        `/api/admin/staff/${staffRowId}/suspend`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      setSuspendOpen(false);
      setReason("");
      toast("Staff access suspended.", {
        description: `${fullName}'s Staff Portal access has been removed.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSuspendError(error.fields?.reason ?? error.message);
      } else {
        setSuspendError(
          "We couldn't complete this action right now. Please try again.",
        );
      }
    } finally {
      setSuspending(false);
    }
  }

  async function handleReactivate() {
    if (reactivating) return;
    setReactivateError(null);
    setReactivating(true);

    try {
      await apiFetch<{ accountStatus: string; transitioned: boolean }>(
        `/api/admin/staff/${staffRowId}/reactivate`,
        {
          method: "POST",
          body: JSON.stringify(note.trim() ? { note } : {}),
        },
      );
      setReactivateOpen(false);
      setNote("");
      toast("Staff Portal access restored.", {
        description: `${fullName} can sign in to the Staff Portal again.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setReactivateError(error.fields?.note ?? error.message);
      } else {
        setReactivateError(
          "We couldn't complete this action right now. Please try again.",
        );
      }
    } finally {
      setReactivating(false);
    }
  }

  if (currentStatus === "ACTIVE") {
    return (
      <>
        <Button variant="danger" onPress={() => setSuspendOpen(true)}>
          Suspend Staff
        </Button>

        <Modal isOpen={suspendOpen} onOpenChange={setSuspendOpen}>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="md">
              <Modal.Dialog aria-label="Suspend Staff Portal access">
                <Modal.Header>
                  <Modal.Heading
                    slot="title"
                    className="text-lg font-bold text-foreground"
                  >
                    Suspend Staff
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p className="text-sm leading-6 text-muted-foreground">
                    You are suspending{" "}
                    <span className="font-semibold text-foreground">
                      {fullName}
                    </span>{" "}
                    <span className="font-mono tracking-wider text-foreground">
                      ({staffId})
                    </span>
                    . Current status:{" "}
                    <span className="font-semibold text-foreground">
                      Active
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                    {ADMIN_SUSPENSION_CONSEQUENCE}
                  </p>

                  <div className="mt-4">
                    <label
                      htmlFor="suspend-reason"
                      className="block text-sm font-medium text-foreground"
                    >
                      Reason (required)
                    </label>
                    <textarea
                      id="suspend-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      maxLength={500}
                      aria-describedby="suspend-reason-help"
                      className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      placeholder="Why is this Staff member's access being removed?"
                    />
                    <p
                      id="suspend-reason-help"
                      className="mt-1.5 text-xs text-muted-foreground"
                    >
                      1–500 characters
                    </p>
                  </div>

                  {suspendError && (
                    <p
                      role="alert"
                      className="mt-2 text-sm font-medium text-danger"
                    >
                      {suspendError}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="outline"
                    onPress={() => setSuspendOpen(false)}
                    isDisabled={suspending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onPress={handleSuspend}
                    isDisabled={reason.trim().length < 1}
                    isPending={suspending}
                  >
                    {({ isPending }) => (
                      <>
                        {isPending && <Spinner color="current" size="sm" />}
                        {isPending ? "Suspending…" : "Suspend Staff"}
                      </>
                    )}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Button onPress={() => setReactivateOpen(true)}>
        Reactivate Staff
      </Button>

      <Modal isOpen={reactivateOpen} onOpenChange={setReactivateOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog aria-label="Restore Staff Portal access">
              <Modal.Header>
                <Modal.Heading
                  slot="title"
                  className="text-lg font-bold text-foreground"
                >
                  Reactivate Staff
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  You are reactivating{" "}
                  <span className="font-semibold text-foreground">
                    {fullName}
                  </span>{" "}
                  <span className="font-mono tracking-wider text-foreground">
                    ({staffId})
                  </span>
                  . Current status:{" "}
                  <span className="font-semibold text-foreground">
                    Suspended
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Reactivating restores this Staff member&apos;s ability to
                  sign in to the Staff Portal. Nothing else is changed — no
                  new Staff ID, no onboarding or training reset, and old
                  sessions are not restored.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="reactivate-note"
                    className="block text-sm font-medium text-foreground"
                  >
                    Note (optional)
                  </label>
                  <textarea
                    id="reactivate-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    maxLength={500}
                    aria-describedby="reactivate-note-help"
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    placeholder="Optional context for the audit record."
                  />
                  <p
                    id="reactivate-note-help"
                    className="mt-1.5 text-xs text-muted-foreground"
                  >
                    0–500 characters
                  </p>
                </div>

                {reactivateError && (
                  <p
                    role="alert"
                    className="mt-2 text-sm font-medium text-danger"
                  >
                    {reactivateError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline"
                  onPress={() => setReactivateOpen(false)}
                  isDisabled={reactivating}
                >
                  Cancel
                </Button>
                <Button onPress={handleReactivate} isPending={reactivating}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending
                        ? "Restoring…"
                        : "Restore Staff Portal Access"}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
