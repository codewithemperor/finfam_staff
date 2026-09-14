"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { RecruitmentJourneyView } from "@/types/recruitment";

/**
 * The ONE "Continue Application" entry form.
 *
 * The candidate supplies only their application reference — never a stage.
 * The server resolves the application and decides the current stage; the
 * browser is simply taken to the unified application journey. A wrong
 * reference gets a neutral, inline message (states stay visible — no
 * toasts for persistent context).
 */
export function ContinueApplicationForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const normalized = reference.trim().toUpperCase();

    if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
      setError(
        "Reference numbers look like FF-4KD9PW. You'll find yours on your application confirmation.",
      );
      return;
    }

    setError(null);
    setPending(true);

    try {
      // Resolve the journey first so a wrong reference shows an inline
      // error here instead of a dead end on the journey page.
      await apiFetch<RecruitmentJourneyView>(`/api/journey/${normalized}`);
      router.push(`/application/${normalized}`);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "We couldn't open your application right now. Please check your connection and try again.",
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 sm:max-w-md"
    >
      <TextField isInvalid={Boolean(error)}>
        <Label>
          Application reference{" "}
          <span aria-hidden className="text-danger">
            *
          </span>
        </Label>
        <Input
          name="reference"
          placeholder="FF-XXXXXX"
          value={reference}
          onChange={(event) => setReference(event.target.value.toUpperCase())}
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono"
          autoComplete="off"
        />
        <FieldError>{error}</FieldError>
      </TextField>
      <Button type="submit" isPending={pending} className="sm:self-start">
        {({ isPending }) => (
          <>
            {isPending && <Spinner color="current" size="sm" />}
            {isPending ? "Finding your application…" : "Continue"}
          </>
        )}
      </Button>
    </form>
  );
}
