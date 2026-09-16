"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { OnboardingView } from "@/types/recruitment";

/**
 * The "Continue" action for onboarding steps 1–6 (brief §20): one obvious
 * action meaning "I have reviewed this onboarding section". No checkbox is
 * required on these steps — the single final acknowledgement at the last
 * step is the only confirmation in onboarding.
 *
 * The POST is server-validated (sequential order, existence, exactly-once);
 * on success the server component re-renders at the new resume point. A
 * duplicate submission is idempotent server-side — this client simply
 * re-renders whatever the authoritative state is.
 */
export function OnboardingContinue({
  reference,
  stepId,
  stepTitle,
  /**
   * POST endpoint that records the step. Legacy reference door (default):
   * /api/onboarding/[reference]/steps. Authenticated Staff Portal door:
   * /api/staff/onboarding/steps. Both write the ONE onboarding state.
   */
  endpoint,
}: {
  reference: string;
  stepId: string;
  stepTitle: string;
  endpoint?: string;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch<OnboardingView>(
        endpoint ?? `/api/onboarding/${reference}/steps`,
        {
          method: "POST",
          body: JSON.stringify({ stepId }),
        },
      );
      // The server advanced the resume point — re-render at the next step.
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(
          "We couldn't save your progress. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 border-t border-divider pt-6">
      {submitError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {submitError}
        </p>
      )}
      <Button onPress={handleContinue} isPending={submitting} size="lg">
        {({ isPending }) => (
          <>
            {isPending ? "Saving…" : "Continue"}
            <span className="sr-only">
              {" "}
              — mark {stepTitle} as reviewed and continue
            </span>
          </>
        )}
      </Button>
      <p className="mt-3 max-w-[60ch] text-sm leading-6 text-muted-foreground">
        Continue means you have reviewed this section. Your progress is saved
        on the server, so you can leave and return at any time.
      </p>
    </div>
  );
}
