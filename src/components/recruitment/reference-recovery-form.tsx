"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { getFieldErrors } from "@/lib/validation/application";
import {
  referenceRecoverySchema,
  type ReferenceRecoveryInput,
} from "@/lib/validation/recovery";

type RecoveryOutcome =
  | { kind: "idle" }
  | { kind: "found"; referenceNumber: string }
  | { kind: "notfound"; message: string };

/**
 * Reference recovery — a focused flow for candidates who lost their
 * application reference. They must supply the full name, email and phone
 * they applied with; only the reference is revealed, and every mismatch
 * returns the same neutral message (no application enumeration).
 *
 * Final verification policy is an open business question — see
 * docs/CONTENT-QUESTIONS.md §11.
 */
export function ReferenceRecoveryForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<RecoveryOutcome>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const candidate: ReferenceRecoveryInput = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    };

    // Client-side validation with the same schema the server uses.
    const parsed = referenceRecoverySchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setPending(true);

    try {
      const data = await apiFetch<{ referenceNumber: string }>(
        "/api/recruitment/recover-reference",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      setOutcome({ kind: "found", referenceNumber: data.referenceNumber });
      toast("Application reference recovered", {
        description: "Save it somewhere safe this time — you'll use it every time you return.",
        variant: "success",
      });
    } catch (error) {
      setPending(false);
      if (error instanceof ApiClientError && error.fields) {
        setFieldErrors(error.fields);
        return;
      }
      setOutcome({
        kind: "notfound",
        message:
          error instanceof ApiClientError
            ? error.message
            : "We couldn't check those details right now. Please try again in a moment.",
      });
    }
  }

  if (outcome.kind === "found") {
    return (
      <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          We found your application
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Use this reference to continue your application. Save it somewhere
          safe — you&apos;ll need it every time you come back.
        </p>
        <p className="mt-4 font-mono text-xl font-bold tracking-widest text-foreground">
          {outcome.referenceNumber}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/application/${outcome.referenceNumber}`}>
            Continue to your application
          </ButtonLink>
          <Button
            variant="outline"
            onPress={() => {
              setOutcome({ kind: "idle" });
              router.refresh();
            }}
          >
            Recover a different reference
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 sm:max-w-md"
      >
        {outcome.kind === "notfound" && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>No matching application found.</Alert.Title>
              <Alert.Description>{outcome.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <TextField isInvalid={Boolean(fieldErrors.fullName)}>
          <Label>
            Full name <span aria-hidden className="text-danger">*</span>
          </Label>
          <Input
            name="fullName"
            placeholder="The name you applied with"
            autoComplete="name"
          />
          <FieldError>{fieldErrors.fullName}</FieldError>
        </TextField>

        <TextField isInvalid={Boolean(fieldErrors.email)}>
          <Label>
            Email address <span aria-hidden className="text-danger">*</span>
          </Label>
          <Input
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
          <Description>The email address you used when you applied.</Description>
          <FieldError>{fieldErrors.email}</FieldError>
        </TextField>

        <TextField isInvalid={Boolean(fieldErrors.phone)}>
          <Label>
            Phone number <span aria-hidden className="text-danger">*</span>
          </Label>
          <Input
            type="tel"
            name="phone"
            placeholder="0803 000 0000"
            autoComplete="tel"
            inputMode="tel"
          />
          <Description>The phone number you used when you applied.</Description>
          <FieldError>{fieldErrors.phone}</FieldError>
        </TextField>

        <Button
          type="submit"
          isPending={pending}
          fullWidth
          className="sm:w-auto sm:self-start"
        >
          {({ isPending }) => (
            <>
              {isPending && <Spinner color="current" size="sm" />}
              {isPending ? "Checking…" : "Find my reference"}
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
        For your protection we can only reveal the application reference —
        never the details of the application itself. All three details must
        match the ones you supplied when you applied.
      </p>
    </div>
  );
}
