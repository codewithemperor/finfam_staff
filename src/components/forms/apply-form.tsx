"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Checkbox,
  Description,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from "@heroui/react";

import { OPEN_POSITION } from "@/config/content";
import { ButtonLink } from "@/components/ui/button-link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  applicationFormSchema,
  getFieldErrors,
} from "@/lib/validation/application";
import type { ApplicationSubmissionResult } from "@/types/recruitment";

/**
 * Reference implementation of the FinFam form conventions (see README):
 *
 * - Labels are always visible; required fields are marked with *.
 * - Description text explains the field where it genuinely helps.
 * - Validation is owned by the shared zod schema (client AND server).
 *   The <form> is noValidate so our accessible messages replace the
 *   browser's native bubbles.
 * - Field errors render under the field; page-level errors render as an
 *   Alert (they must stay visible), never as a toast.
 * - The submit button shows a pending state and blocks duplicate submits.
 * - Success feedback: a short toast (transient) plus persistent page
 *   content (the reference number).
 */
export function ApplyForm() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApplicationSubmissionResult | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const candidate = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? "") || undefined,
      roleTitle: String(formData.get("roleTitle") ?? ""),
      consent: formData.get("consent") === "on",
    };

    // Client-side validation with the same schema the server uses.
    const parsed = applicationFormSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const data = await apiFetch<ApplicationSubmissionResult>(
        "/api/applications",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      setResult(data);
      toast("Application submitted", {
        description:
          "Save your reference number — you'll use it to continue your application.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        setFieldErrors(error.fields);
      } else {
        setFormError(
          error instanceof ApiClientError
            ? error.message
            : "We couldn't submit your application. Please check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <SubmissionConfirmation result={result} />;
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* The role is decided by the portal configuration; the server
          re-validates it. Kept in the form for transparency. */}
      <input type="hidden" name="roleTitle" value={OPEN_POSITION.title} />

      {formError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>We couldn&apos;t submit your application.</Alert.Title>
            <Alert.Description>{formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField name="fullName" isInvalid={Boolean(fieldErrors.fullName)}>
        <Label>
          Full name <span aria-hidden className="text-danger">*</span>
        </Label>
        <Input name="fullName" placeholder="Enter your full name" autoComplete="name" />
        <FieldError>{fieldErrors.fullName}</FieldError>
      </TextField>

      <TextField name="email" isInvalid={Boolean(fieldErrors.email)}>
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
        <Description>
          We&apos;ll use this email to contact you about your application.
        </Description>
        <FieldError>{fieldErrors.email}</FieldError>
      </TextField>

      <TextField name="phone" isInvalid={Boolean(fieldErrors.phone)}>
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
        <Description>
          The number we&apos;ll use to reach you about orientation and next steps.
        </Description>
        <FieldError>{fieldErrors.phone}</FieldError>
      </TextField>

      <TextField name="city" isInvalid={Boolean(fieldErrors.city)}>
        <Label>City</Label>
        <Input name="city" placeholder="e.g. Lagos" autoComplete="address-level2" />
        <Description>Optional — where you are based.</Description>
        <FieldError>{fieldErrors.city}</FieldError>
      </TextField>

      <div className="pt-1">
        <Checkbox name="consent" isInvalid={Boolean(fieldErrors.consent)}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span>
              I confirm the information provided is accurate
              <span aria-hidden className="text-danger"> *</span>
            </span>
          </Checkbox.Content>
          <FieldError>{fieldErrors.consent}</FieldError>
        </Checkbox>
      </div>

      <Button
        type="submit"
        isPending={submitting}
        fullWidth
        className="sm:w-auto sm:self-start"
      >
        {({ isPending }) => (
          <>
            {isPending && <Spinner color="current" size="sm" />}
            {isPending ? "Submitting application…" : "Submit application"}
          </>
        )}
      </Button>
    </form>
  );
}

function SubmissionConfirmation({ result }: { result: ApplicationSubmissionResult }) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(result.referenceNumber);
      setCopied(true);
      toast("Reference number copied");
    } catch {
      // Clipboard unavailable (permissions/insecure context) — the number
      // remains visible and selectable on the page.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Application received
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Thank you — your application for the Staff Member role has been
          submitted. Save your reference number somewhere safe; it identifies
          your whole application journey and you&apos;ll use it every time you
          return.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Your reference number</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xl font-bold tracking-widest text-foreground">
            {result.referenceNumber}
          </span>
          <Button size="sm" variant="outline" onPress={copyReference}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>What happens next</Alert.Title>
          <Alert.Description>
            Your orientation is ready now. It covers how FinFam works, your
            role, and the standards expected from every team member. You can
            start it straight away — your progress is saved as you go.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/orientation/${result.referenceNumber}`}>
          Continue to orientation
        </ButtonLink>
        <ButtonLink
          href={`/application/${result.referenceNumber}`}
          variant="outline"
        >
          View your application journey
        </ButtonLink>
      </div>
    </div>
  );
}

