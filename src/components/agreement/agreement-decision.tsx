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

import { AGREEMENT_ACKNOWLEDGEMENT_LABEL } from "@/config/agreement";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { AgreementView } from "@/types/recruitment";

/**
 * "Your decision" — the explicit acceptance action of the agreement.
 *
 * The acknowledgement checkbox lives at the end of the document, exactly
 * where reading finishes; the primary action stays disabled until the
 * candidate has confirmed it. A focused Modal then confirms the decision,
 * and the SERVER re-validates everything (acknowledgement, version,
 * eligibility) before recording the acceptance. Viewing or ticking the box
 * alone never accepts anything.
 *
 * On success the candidate is returned to the unified journey, which shows
 * the agreement as completed and the honest next step — the agreement stage
 * itself is closed (one-way progression).
 */
export function AgreementDecision({
  reference,
  version,
}: {
  reference: string;
  version: string;
}) {
  const router = useRouter();
  const modal = useOverlayState();
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<
    string | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<AgreementView>(
        `/api/agreement/${reference}/accept`,
        {
          method: "POST",
          body: JSON.stringify({ acknowledgement: acknowledged, version }),
        },
      );
      modal.close();
      toast("Agreement accepted", {
        description:
          "Your acceptance has been recorded and your journey has been updated.",
        variant: "success",
      });
      // The agreement stage is closed — the unified journey (where the
      // server decides the current stage) is the authoritative next view.
      router.push(`/application/${reference}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.fields?.acknowledgement) {
        setAcknowledgementError(error.fields.acknowledgement);
      } else if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "We couldn't record your acceptance. Please check your connection and try again.",
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
        id="your-decision"
        className="mt-10 scroll-mt-20 rounded-lg border border-border bg-surface p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Your decision
        </h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          Accepting records your formal agreement to everything above. Make
          sure you have read each section — this decision closes the
          agreement stage.
        </p>

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
              {AGREEMENT_ACKNOWLEDGEMENT_LABEL}
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
            Accept Agreement
          </Button>
        </div>

        <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          After you accept, this stage is recorded as complete and the next
          step of your journey opens on your application page.
        </p>
      </div>

      <Modal isOpen={modal.isOpen} onOpenChange={handleOpenChange}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Accept agreement">
              <Modal.Header>
                <Modal.Heading
                  slot="title"
                  className="text-lg font-bold text-foreground"
                >
                  Accept this agreement?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  You are accepting version {version} of the Responsibility
                  &amp; Reward Agreement — the responsibilities, support
                  package, reward structure, reporting requirements,
                  professional standards and applicable policies described
                  above. Your acceptance is recorded immediately and closes
                  this stage.
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
                <Button onPress={handleAccept} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Recording…" : "Accept agreement"}
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
