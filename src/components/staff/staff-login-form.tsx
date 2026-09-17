"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Staff Portal login (Stage 7, brief §14) — the two-step email-OTP flow:
 *
 *   1. Enter the registered email → "Send login code"
 *   2. Enter the 6-digit code → "Sign in"
 *
 * The response to step 1 is the neutral anti-enumeration message for every
 * email (brief §8); in development (STAFF_AUTH_DEV_CODE_ECHO=true) a small,
 * clearly-labelled dev notice shows the echoed code so sandbox flows can
 * complete without a real inbox — production MUST run with the flag false
 * (then no code is ever shown in the browser).
 *
 * Accessibility (brief §50; production-readiness remediation §25): labelled
 * email + code fields, the code input uses autocomplete="one-time-code" +
 * inputMode="numeric", errors are announced via role="alert", the step
 * change / status notice is announced through an aria-live="polite" region,
 * focus moves to the code field on step change, and the resend action
 * carries a visible 60-second cooldown.
 */
export function StaffLoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [requesting, setRequesting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  async function handleRequestCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (requesting) return;
    setEmailError(null);
    setCodeError(null);
    setNotice(null);
    setRequesting(true);

    try {
      const data = await apiFetch<{ message: string; devCode?: string }>(
        "/api/staff/auth/request-code",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      setNotice(data.message);
      setDevCode(data.devCode ?? null);
      setStep("code");
      setResendSeconds(60);
      requestAnimationFrame(() => codeInputRef.current?.focus());
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields?.email) setEmailError(error.fields.email);
        else setEmailError(error.message);
      } else {
        setEmailError(
          "We couldn't send a login code right now. Please check your connection and try again.",
        );
      }
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (signingIn) return;
    setCodeError(null);
    setSigningIn(true);

    try {
      await apiFetch<{ next: string }>("/api/staff/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      // Session cookie is set on this response — enter the portal.
      router.replace("/staff");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setCodeError(error.fields?.code ?? error.message);
      } else {
        setCodeError(
          "We couldn't sign you in right now. Please check your connection and try again.",
        );
      }
      setSigningIn(false);
    }
  }

  async function handleResend() {
    if (resendSeconds > 0 || requesting) return;
    await handleRequestCode();
  }

  if (step === "email") {
    return (
      <form noValidate onSubmit={handleRequestCode} className="flex flex-col gap-5">
        <TextField isInvalid={Boolean(emailError)}>
          <Label htmlFor="staff-login-email">Registered email address</Label>
          <Input
            id="staff-login-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            spellCheck={false}
            required
          />
          <FieldError>{emailError}</FieldError>
        </TextField>

        <Button type="submit" isPending={requesting} size="lg">
          {({ isPending }) => (
            <>
              {isPending && <Spinner color="current" size="sm" />}
              {isPending ? "Sending code…" : "Send login code"}
            </>
          )}
        </Button>


      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Step-change/status region: announced politely by screen readers
       * when the code step appears (remediation §25). */}
      <div aria-live="polite">
        <p className="text-sm leading-6 text-foreground">{notice}</p>
        {devCode && (
          <p
            role="status"
            className="mt-3 rounded-md border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground"
          >
            <span className="font-semibold text-foreground">
              Development mode:
            </span>{" "}
            notifications are disabled, so your login code is{" "}
            <span className="font-mono text-base font-bold tracking-widest text-foreground">
              {devCode}
            </span>
            . This must never appear in production.
          </p>
        )}
      </div>

      <form noValidate onSubmit={handleVerify} className="flex flex-col gap-5">
        <TextField isInvalid={Boolean(codeError)}>
          <Label htmlFor="staff-login-code">6-digit login code</Label>
          <Input
            id="staff-login-code"
            ref={codeInputRef}
            name="code"
            placeholder="••••••"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            className="font-mono text-lg tracking-[0.4em]"
            required
          />
          <FieldError>{codeError}</FieldError>
        </TextField>

        <Button
          type="submit"
          isPending={signingIn}
          size="lg"
          isDisabled={code.length !== 6}
        >
          {({ isPending }) => (
            <>
              {isPending && <Spinner color="current" size="sm" />}
              {isPending ? "Signing in…" : "Sign in"}
            </>
          )}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendSeconds > 0 || requesting}
          className="inline-flex min-h-11 items-center rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:font-normal disabled:text-muted-foreground disabled:no-underline sm:min-h-9"
        >
          {resendSeconds > 0
            ? `Resend code available in ${resendSeconds}s`
            : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setDevCode(null);
            setNotice(null);
            setCodeError(null);
          }}
          className="rounded-md text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
