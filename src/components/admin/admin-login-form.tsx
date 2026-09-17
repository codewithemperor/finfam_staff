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
 * FinFam Admin console login (Stage 11) — the two-step email-OTP flow,
 * mirroring the Staff Portal login but for the SEPARATE admin identity
 * domain (`/api/admin/auth/*` + the `ff_admin_session` cookie):
 *
 *   1. Enter the administrator email → "Send sign-in code"
 *   2. Enter the 6-digit code → "Sign in"
 *
 * The response to step 1 is the neutral anti-enumeration message for every
 * email; in development (ADMIN_AUTH_DEV_CODE_ECHO=true) a small,
 * clearly-labelled dev notice shows the echoed code so sandbox flows can
 * complete without a real inbox — production MUST run with the flag false
 * (then no code is ever shown in the browser).
 *
 * There is deliberately NO signup and NO forgot-password path anywhere:
 * administrator accounts are provisioned offline (bootstrap script).
 *
 * Accessibility: labelled email + code fields, the code input uses
 * autocomplete="one-time-code" + inputMode="numeric", errors are announced
 * via role="alert", the step-change/status notice is announced through an
 * aria-live="polite" region (remediation §25), focus moves to the code
 * field on step change, and the resend action carries a visible 60-second
 * cooldown.
 */
export function AdminLoginForm() {
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
        "/api/admin/auth/request-code",
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
          "We couldn't send a sign-in code right now. Please check your connection and try again.",
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
      await apiFetch<{ next: string }>("/api/admin/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      // Session cookie is set on this response — enter the console.
      router.replace("/admin");
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
          <Label htmlFor="admin-login-email">Administrator email address</Label>
          <Input
            id="admin-login-email"
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
              {isPending ? "Sending code…" : "Send sign-in code"}
            </>
          )}
        </Button>

        <p className="max-w-[46ch] text-sm leading-6 text-muted-foreground">
          Enter the email address registered to your FinFam administrator
          account. We will send a secure 6-digit sign-in code — there is no
          password. If you have lost access, contact FinFam support; recovery
          is handled offline.
        </p>
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
            notifications are disabled, so your sign-in code is{" "}
            <span className="font-mono text-base font-bold tracking-widest text-foreground">
              {devCode}
            </span>
            . This must never appear in production.
          </p>
        )}
      </div>

      <form noValidate onSubmit={handleVerify} className="flex flex-col gap-5">
        <TextField isInvalid={Boolean(codeError)}>
          <Label htmlFor="admin-login-code">6-digit sign-in code</Label>
          <Input
            id="admin-login-code"
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
          className="rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:font-normal disabled:text-muted-foreground disabled:no-underline"
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
