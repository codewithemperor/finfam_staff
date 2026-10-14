"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Modal,
  Spinner,
  toast,
  useOverlayState,
} from "@heroui/react";
import { CheckCircle2, XCircle } from "lucide-react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { AgreementView } from "@/types/recruitment";

export function AgreementDecision({
  reference,
  version,
}: {
  reference: string;
  version: string;
}) {
  const router = useRouter();
  const acceptModal = useOverlayState();
  const declineModal = useOverlayState();

  const [decision, setDecision] = useState<"ACCEPT" | "DECLINE" | null>(null);
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
          body: JSON.stringify({ acknowledgement: true, version }),
        },
      );
      acceptModal.close();
      toast("Offer accepted successfully", {
        description:
          "Your acceptance has been recorded. Your Provisional Letter of Appointment is ready.",
        variant: "success",
      });
      router.push(`/application/${reference}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
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

  async function handleDecline() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<AgreementView>(
        `/api/agreement/${reference}/decline`,
        {
          method: "POST",
          body: JSON.stringify({ version }),
        },
      );
      declineModal.close();
      toast("Offer declined", {
        description: "Your decision has been recorded.",
        variant: "warning",
      });
      router.push(`/application/${reference}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "We couldn't record your decision. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        id="your-decision"
        className="mt-10 scroll-mt-20 rounded-xl border border-border bg-surface p-6 sm:p-8"
      >
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Final Step Before Appointment
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            ACCEPTANCE DECLARATION
          </h2>
          <p className="mt-2 text-sm font-medium text-foreground">
            By clicking ACCEPT OFFER, I confirm that:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>I have read and understood the FinFam Responsibility &amp; Reward Policy.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>I understand my responsibilities as a Marketing &amp; Customer Care Executive.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>I understand the reward structure and performance expectations.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>I agree to maintain professional, ethical, and customer-focused standards.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>I understand that failure to meet expectations or violation of FinFam policies may affect my appointment.</span>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            ACTION REQUIRED
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select an option below to proceed:
          </p>

          <div className="mt-4 space-y-3">
            <label
              className={`flex cursor-pointer items-start gap-3.5 rounded-lg border p-4 transition-all ${
                decision === "ACCEPT"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-background hover:border-foreground/30"
              }`}
            >
              <input
                type="radio"
                name="offerDecision"
                value="ACCEPT"
                checked={decision === "ACCEPT"}
                onChange={() => {
                  setDecision("ACCEPT");
                  setSubmitError(null);
                }}
                className="mt-1 size-4 accent-primary"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  I Accept the FinFam Responsibility &amp; Reward Policy
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Confirm and finalize your appointment as a Marketing &amp; Customer Care Executive.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3.5 rounded-lg border p-4 transition-all ${
                decision === "DECLINE"
                  ? "border-danger bg-danger/5 ring-2 ring-danger/20"
                  : "border-border bg-background hover:border-foreground/30"
              }`}
            >
              <input
                type="radio"
                name="offerDecision"
                value="DECLINE"
                checked={decision === "DECLINE"}
                onChange={() => {
                  setDecision("DECLINE");
                  setSubmitError(null);
                }}
                className="mt-1 size-4 accent-danger"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  I Decline the Offer
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Decline this appointment offer. Your recruitment process will end.
                </p>
              </div>
            </label>
          </div>
        </div>

        {decision === "ACCEPT" && (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/5 p-4 text-sm leading-relaxed text-foreground">
            <p className="font-semibold text-foreground">Upon acceptance:</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground sm:text-sm">
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>Your FinFam Provisional Letter of Appointment will be generated and sent to your registered email.</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>You will receive instructions for immediate onboarding and resumption.</span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-border/50 text-xs font-semibold tracking-wider text-primary">
              Welcome to FinFam. WE SAVE. WE GROW. WE PROSPER.
            </div>
          </div>
        )}

        {submitError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {submitError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {decision === "ACCEPT" && (
            <Button
              onPress={() => acceptModal.setOpen(true)}
              size="lg"
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Accept Offer
            </Button>
          )}

          {decision === "DECLINE" && (
            <Button
              variant="danger"
              onPress={() => declineModal.setOpen(true)}
              size="lg"
              className="gap-2"
            >
              <XCircle className="size-4" />
              Decline Offer
            </Button>
          )}

          {!decision && (
            <Button isDisabled size="lg">
              Select an option above to continue
            </Button>
          )}
        </div>
      </div>

      {/* Accept Confirmation Modal */}
      <Modal isOpen={acceptModal.isOpen} onOpenChange={acceptModal.setOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Confirm acceptance">
              <Modal.Header>
                <Modal.Heading slot="title" className="text-lg font-bold text-foreground">
                  Confirm Acceptance of Offer?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  You are accepting version {version} of the FinFam Responsibility
                  &amp; Reward Policy. Your acceptance will generate your official
                  Provisional Letter of Appointment and transition you to onboarding.
                </p>
                {submitError && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {submitError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline"
                  onPress={() => acceptModal.setOpen(false)}
                  isDisabled={submitting}
                >
                  Back
                </Button>
                <Button onPress={handleAccept} isPending={submitting}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Generating appointment…" : "Confirm & Accept Offer"}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Decline Confirmation Modal */}
      <Modal isOpen={declineModal.isOpen} onOpenChange={declineModal.setOpen}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog aria-label="Confirm decline">
              <Modal.Header>
                <Modal.Heading slot="title" className="text-lg font-bold text-foreground">
                  Decline this Offer?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm leading-6 text-muted-foreground">
                  Are you sure you want to decline the offer? This will close your application and you will not receive an appointment letter.
                </p>
                {submitError && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {submitError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline"
                  onPress={() => declineModal.setOpen(false)}
                  isDisabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={handleDecline}
                  isPending={submitting}
                >
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner color="current" size="sm" />}
                      {isPending ? "Declining…" : "Yes, Decline Offer"}
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
