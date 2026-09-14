"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@heroui/react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { AssessmentView } from "@/types/recruitment";

/**
 * "Start assessment" — the explicit action that creates the attempt.
 * The server re-checks eligibility (orientation completed, no passed
 * attempt, retake policy) before creating anything; the UI only navigates
 * on success and surfaces the server's message otherwise.
 */
export function StartAssessmentButton({
  reference,
  label = "Start assessment",
  pendingLabel = "Starting…",
}: {
  reference: string;
  label?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setError(null);

    try {
      const view = await apiFetch<AssessmentView>(
        `/api/assessment/${reference}/start`,
        { method: "POST", body: JSON.stringify({}) },
      );

      if (view.phase === "IN_PROGRESS") {
        router.push(`/assessment/${reference}/attempt`);
        return;
      }

      // The server responded with a non-active phase (e.g. already
      // submitted) — the hub renders the right thing after a refresh.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "We couldn't start your assessment. Please check your connection and try again.",
      );
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onPress={handleStart}
        isPending={starting}
        size="lg"
        className="sm:self-start"
      >
        {({ isPending }) => (
          <>
            {isPending && <Spinner color="current" size="sm" />}
            {isPending ? pendingLabel : label}
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="max-w-md text-sm leading-6 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
