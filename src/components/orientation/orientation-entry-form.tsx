"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input, Label, TextField } from "@heroui/react";

import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";

/**
 * Entry point for the orientation: the candidate identifies themselves with
 * their application reference number (the same lookup key used on the
 * status page). Format is checked client-side for immediate feedback; the
 * server decides whether the reference actually exists.
 */
export function OrientationEntryForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (navigating) return;

    const normalized = reference.trim().toUpperCase();
    if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
      setError(
        "Reference numbers look like FF-4KD9PW. Check the number on your application confirmation.",
      );
      return;
    }

    setError(null);
    setNavigating(true);
    router.push(`/orientation/${normalized}`);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 sm:max-w-md"
    >
      <TextField isInvalid={Boolean(error)}>
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
        <FieldError>{error}</FieldError>
      </TextField>
      <Button type="submit" isPending={navigating} className="sm:self-start">
        Open my orientation
      </Button>
    </form>
  );
}
