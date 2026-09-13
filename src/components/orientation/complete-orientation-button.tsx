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

import { ORIENTATION_ACKNOWLEDGEMENT_LABEL } from "@/config/orientation";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { OrientationView } from "@/types/recruitment";

/**
 * "Complete orientation" — the explicit final action of the workshop.
 * Opens a focused confirmation (Modal) where the candidate must confirm the
 * integrity declaration; the server re-validates every rule before the
 * stage is actually completed. Used on the overview and on the final
 * section page — the only place this action exists.
 */
export function CompleteOrientationButton({
  reference,
  size = "md",
}: {
  reference: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const modal = useOverlayState();
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<
    string | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    if (submitting) return;

    if (!acknowledged) {
      setAcknowledgementError(
        "Please confirm the declaration to complete your orientation.",
      );
      return;
    }
    setAcknowledgementError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<OrientationView>(
        `/api/orientation/${reference}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ acknowledgement: acknowledged }),
        },
      );
      modal.close();
      toast("Orientation completed", {
        description: "Your progress through the recruitment journey has been updated.",
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.fields?.acknowledgement) {
        setAcknowledgementError(error.fields.acknowledgement);
      } else {
        setSubmitError(
          error instanceof ApiClientError
            ? error.message
            : "We couldn't complete your orientation. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // Reset the focused decision when the modal is dismissed.
      setAcknowledgementError(null);
      setSubmitError(null);
    }
    modal.setOpen(isOpen);
  }

  return (
    <>
      <Button onPress={() => handleOpenChange(true)} size={size}>
        Complete orientation
      </Button>

      <Modal isOpen={modal.isOpen} onOpenChange={handleOpenChange}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Complete orientation">
              <Modal.Header>
                <Modal.Heading slot="title" className="text-lg font-bold text-foreground">
                  Complete orientation?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  This confirms that you have read the whole workshop. Make
                  sure you are happy with every section — the orientation can
                  only be completed once.
                </p>

                <Checkbox
                  className="mt-2"
                  isSelected={acknowledged}
                  onChange={setAcknowledged}
                  isInvalid={Boolean(acknowledgementError)}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-sm leading-6 text-foreground">
                      {ORIENTATION_ACKNOWLEDGEMENT_LABEL}
                    </span>
                  </Checkbox.Content>
                  <FieldError>{acknowledgementError}</FieldError>
                </Checkbox>

                {submitError && (
                  <p role="alert" className="mt-1 text-sm text-danger">
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
                <Button onPress={handleComplete} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Completing…" : "Complete orientation"}
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
