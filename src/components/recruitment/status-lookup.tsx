"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Skeleton,
  TextField,
} from "@heroui/react";

import { PageHeader } from "@/components/layout/page-header";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { CANDIDATE_STATUS_DETAILS } from "@/config/recruitment";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { CandidateStatusView } from "@/types/recruitment";

type LookupView =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; data: CandidateStatusView }
  | { kind: "notfound"; message: string }
  | { kind: "error"; message: string };

/**
 * Status lookup flow: reference form → loading → result or a clear,
 * actionable failure state. States live in the page (not toasts) because
 * they must stay visible while the candidate reads them.
 */
export function StatusLookup({
  initialReference,
}: {
  initialReference?: string;
}) {
  const router = useRouter();
  const [reference, setReference] = useState(initialReference ?? "");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [view, setView] = useState<LookupView>(
    initialReference ? { kind: "loading" } : { kind: "idle" },
  );

  function toFailureView(error: unknown): LookupView {
    if (error instanceof ApiClientError && error.status === 404) {
      return { kind: "notfound", message: error.message };
    }
    return {
      kind: "error",
      message:
        error instanceof ApiClientError
          ? error.message
          : "We couldn't check your status right now. Please check your connection and try again.",
    };
  }

  const lookup = useCallback(
    async (rawReference: string) => {
      const normalized = rawReference.trim().toUpperCase();

      if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
        setReferenceError(
          "Reference numbers look like FF-4KD9PW. Check the number on your application confirmation.",
        );
        setView({ kind: "idle" });
        return;
      }
      setReferenceError(null);
      setView({ kind: "loading" });

      try {
        const data = await apiFetch<CandidateStatusView>(
          `/api/candidates/${normalized}`,
        );
        setView({ kind: "result", data });
        // Keep the lookup shareable without triggering a server round-trip.
        router.replace(`/status?ref=${normalized}`, { scroll: false });
      } catch (error) {
        setView(toFailureView(error));
      }
    },
    [router],
  );

  // Auto-lookup when arriving with ?ref=... from the application
  // confirmation. The loading view is set by the state initializer above;
  // state updates happen in the async continuations, never synchronously.
  useEffect(() => {
    if (!initialReference) return;
    let cancelled = false;

    apiFetch<CandidateStatusView>(`/api/candidates/${initialReference}`)
      .then((data) => {
        if (cancelled) return;
        setView({ kind: "result", data });
        router.replace(`/status?ref=${initialReference}`, { scroll: false });
      })
      .catch((error) => {
        if (!cancelled) setView(toFailureView(error));
      });

    return () => {
      cancelled = true;
    };
  }, [initialReference, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(reference);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Check your application status"
        description="Enter the reference number you received when you applied to see where you are in the FinFam recruitment process."
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col gap-4 sm:max-w-md"
      >
        <TextField isInvalid={Boolean(referenceError)}>
          <Label>
            Reference number <span aria-hidden className="text-danger">*</span>
          </Label>
          <Input
            name="reference"
            placeholder="FF-4KD9PW"
            value={reference}
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
          />
          <FieldError>{referenceError}</FieldError>
        </TextField>
        <Button type="submit" className="sm:self-start">
          Check status
        </Button>
      </form>

      <div className="mt-10">
        {view.kind === "loading" && <LookupSkeleton />}

        {view.kind === "idle" && referenceError === null && null}

        {view.kind === "notfound" && (
          <div className="max-w-xl rounded-lg border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-foreground">
              We couldn&apos;t find that application
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {view.message}
            </p>
          </div>
        )}

        {view.kind === "error" && (
          <Alert status="danger" className="max-w-xl">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>We couldn&apos;t check your status right now.</Alert.Title>
              <Alert.Description>{view.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {view.kind === "result" && <ResultCard data={view.data} />}
      </div>
    </div>
  );
}

function LookupSkeleton() {
  return (
    <div
      className="max-w-xl rounded-lg border border-border p-5"
      aria-hidden
      role="presentation"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-5 w-40 rounded" />
        </div>
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-3 w-64 rounded" />
      <div className="mt-6 space-y-5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ data }: { data: CandidateStatusView }) {
  const statusDefinition = CANDIDATE_STATUS_DETAILS[data.status];

  return (
    <section
      aria-label="Application status"
      className="max-w-xl rounded-lg border border-border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Reference number</p>
          <p className="font-mono text-base font-bold tracking-widest text-foreground">
            {data.referenceNumber}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="mt-5">
        <p className="text-lg font-semibold text-foreground">{data.fullName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Applied for {data.roleTitle} on{" "}
          {format(new Date(data.submittedAt), "d MMMM yyyy")}
        </p>
      </div>

      <RecruitmentProgress
        currentStage={statusDefinition.stage}
        showDescriptions={false}
        className="mt-7 max-w-xs"
      />

      <div className="mt-7 rounded-lg bg-surface p-4">
        <p className="text-sm font-semibold text-foreground">
          What happens next
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {statusDefinition.nextStep}
        </p>
      </div>

      {data.events.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-semibold text-foreground">Updates</h3>
          <ul className="mt-1 list-none p-0">
            {data.events.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-4 border-b border-divider py-3 last:border-b-0 last:pb-0"
              >
                <span className="text-sm text-foreground">
                  {event.description ?? event.type}
                </span>
                <time
                  dateTime={event.occurredAt}
                  className="shrink-0 text-sm text-muted-foreground"
                >
                  {format(new Date(event.occurredAt), "d MMM yyyy, HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
