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
import type { OnboardingView } from "@/types/recruitment";

/**
 * "Ready to begin" — the ONE confirmation of Staff Onboarding (final step).
 *
 * The acknowledgement checkbox sits at the end of the reading flow; the
 * primary action stays disabled until the staff member has confirmed it. A
 * focused Modal then confirms the action, and the SERVER re-validates
 * everything (acknowledgement, version, all-steps-completed, eligibility)
 * before completing. Opening this page or ticking the box alone never
 * completes anything.
 *
 * This is an operational acknowledgement only — NOT another employment
 * agreement, appointment acceptance or activation action. On success the
 * staff member is returned to the unified journey, which shows the terminal
 * state ("Onboarding completed — You are ready to begin your FinFam
 * assignment"); the onboarding stage itself is closed (one-way).
 */
export function OnboardingDecision({
  reference,
  version,
  acknowledgementLabel,
  /**
   * POST endpoint that completes onboarding. Legacy reference door
   * (default): /api/onboarding/[reference]/complete. Authenticated Staff
   * Portal door: /api/staff/onboarding/complete. Both close the ONE
   * onboarding state.
   */
  endpoint,
  /** Where to send the staff member after completion. Legacy default:
   *  the unified journey; Staff Portal: /staff. */
  completedHref,
}: {
  reference: string;
  version: string;
  acknowledgementLabel: string;
  endpoint?: string;
  completedHref?: string;
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
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<OnboardingView>(
        endpoint ?? `/api/onboarding/${reference}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ acknowledgement: acknowledged, version }),
        },
      );
      modal.close();
      toast("Onboarding complete.", {
        description: "You are ready to begin your FinFam assignment.",
        variant: "success",
      });
      // Onboarding is closed — the server decides the authoritative view.
      router.push(completedHref ?? `/application/${reference}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields?.acknowledgement) {
        setAcknowledgementError(error.fields.acknowledgement);
      } else if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "We couldn't complete your onboarding. Please check your connection and try again.",
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
        id="onboarding-confirmation"
        className="mt-10 scroll-mt-20 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Acknowledgement
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
            Complete Onboarding
          </Button>
        </div>

        <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          After you complete onboarding, this step is recorded on your
          application page and the onboarding workflow closes. Your recruitment
          record and Staff ID are unaffected.
        </p>
      </div>

      <Modal isOpen={modal.isOpen} onOpenChange={handleOpenChange}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Complete onboarding">
              <Modal.Header>
                <Modal.Heading
                  slot="title"
                  className="text-lg font-bold text-foreground"
                >
                  Complete onboarding?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  Completing onboarding confirms you have reviewed your
                  communication, resources, reporting and professional
                  expectations — and prepares you to begin your FinFam
                  assignment.
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
                <Button onPress={handleComplete} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Completing…" : "Complete Onboarding"}
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
