"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Checkbox,
  FieldError,
  Modal,
  Spinner,
  toast,
  useOverlayState,
} from "@heroui/react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { ActivationView } from "@/types/recruitment";

/**
 * "Confirmation" — the ONE explicit action of Staff Activation.
 *
 * The acknowledgement checkbox sits at the end of the reading flow; the
 * primary action stays disabled until the candidate has confirmed it. A
 * focused Modal then confirms the action, and the SERVER re-validates
 * everything (acknowledgement, version, eligibility) before activating.
 * Opening this page or ticking the box alone never activates anything.
 *
 * On success the candidate is returned to the unified journey, which shows
 * the read-only staff record and the honest next step — the activation
 * stage itself is closed (one-way progression; no second activation view).
 */
export function ActivationDecision({
  reference,
  version,
  acknowledgementLabel,
}: {
  reference: string;
  version: string;
  acknowledgementLabel: string;
}) {
  const router = useRouter();
  const modal = useOverlayState();
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<
    string | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleActivate() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<ActivationView>(
        `/api/activation/${reference}/activate`,
        {
          method: "POST",
          body: JSON.stringify({ acknowledgement: acknowledged, version }),
        },
      );
      modal.close();
      toast("Staff profile activated.", {
        description:
          "Your Staff ID has been assigned and is shown on your application page.",
        variant: "success",
      });
      // The activation stage is closed — the unified journey (where the
      // server decides the state) is the authoritative next view.
      router.push(`/application/${reference}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields?.acknowledgement) {
        setAcknowledgementError(error.fields.acknowledgement);
      } else if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "We couldn't activate your staff profile. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSubmitError(null);
    }
    modal.setOpen(isOpen);
  }

  return (
    <>
      <div
        id="activation-confirmation"
        className="mt-10 scroll-mt-20 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Confirmation
        </h2>

        <Checkbox
          className="mt-4"
          isSelected={acknowledged}
          onChange={(checked) => {
            setAcknowledged(checked);
            if (checked) setAcknowledgementError(null);
          }}
          isInvalid={Boolean(acknowledgementError)}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-sm leading-6 text-foreground">
              {acknowledgementLabel}
            </span>
          </Checkbox.Content>
          <FieldError>{acknowledgementError}</FieldError>
        </Checkbox>

        {submitError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {submitError}
          </p>
        )}

        <div className="mt-5">
          <Button
            onPress={() => handleOpenChange(true)}
            isDisabled={!acknowledged}
            size="lg"
          >
            Activate Staff Profile
          </Button>
        </div>

        <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          After you activate, this step is recorded as complete and your staff
          record appears on your application page. Activation is permanent —
          your Staff ID does not change.
        </p>
      </div>

      <Modal isOpen={modal.isOpen} onOpenChange={handleOpenChange}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Activate staff profile">
              <Modal.Header>
                <Modal.Heading
                  slot="title"
                  className="text-lg font-bold text-foreground"
                >
                  Activate staff profile?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  Activating your profile will complete your recruitment
                  process and assign your permanent FinFam Staff ID.
                </p>
                {submitError && (
                  <p role="alert" className="text-sm text-danger">
                    {submitError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline"
                  onPress={() => handleOpenChange(false)}
                  isDisabled={submitting}
                >
                  Cancel
                </Button>
                <Button onPress={handleActivate} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Activating…" : "Activate Staff Profile"}
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
