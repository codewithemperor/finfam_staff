import { Alert } from "@heroui/react";

import type { OnboardingStep, OnboardingView } from "@/types/recruitment";

/**
 * Renders one onboarding step's content as plain, readable typography —
 * the same document philosophy as the activation screen: whitespace, not
 * nested cards. SHARED by both doors of the one onboarding state:
 * the legacy reference route (/onboarding/[reference]) and the
 * authenticated Staff Portal (/staff/onboarding).
 *
 * Step-aware extras (Stage 7 v2.0):
 * - `verification` step: the server-derived system checks (✓ — from real
 *   persisted records) and the external onboarding actions (never auto-
 *   ticked, always labelled) rendered beneath the static framing copy.
 * - `communication` step: when the official WhatsApp number is configured,
 *   a real wa.me button with the pre-filled first message (brief §29); no
 *   number → the honest pending copy from the config blocks only.
 */
export function OnboardingStepContent({
  step,
  view,
}: {
  step: OnboardingStep;
  view: OnboardingView;
}) {
  const isVerificationStep = step.id === "verification";
  const isCommunicationStep = step.id === "communication";
  const whatsappHref =
    isCommunicationStep && view.content.whatsappNumber
      ? `https://wa.me/${view.content.whatsappNumber}?text=${encodeURIComponent(view.content.whatsappMessage)}`
      : null;

  return (
    <div className="flex flex-col">
      {step.blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={index}
                className="mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul
                key={index}
                className="mt-4 max-w-[68ch] list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "alert":
            return (
              <Alert
                key={index}
                status={block.tone}
                className="mt-4 max-w-[68ch] first:mt-0"
              >
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{block.title}</Alert.Title>
                  <Alert.Description>{block.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            );
          case "facts":
            return (
              <dl
                key={index}
                className="mt-4 max-w-[68ch] rounded-lg border border-border bg-surface p-5 first:mt-0"
              >
                {block.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 first:pt-0 last:pb-0"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          case "tagline":
            return (
              <div
                key={index}
                className="mt-8 max-w-[68ch] border-t border-divider pt-8 first:mt-0"
              >
                <p className="text-xl font-bold tracking-tight text-foreground">
                  {block.lines[0]}
                </p>
                {block.lines[1] && (
                  <p className="mt-2 max-w-[60ch] text-[15px] leading-7 text-muted-foreground">
                    {block.lines[1]}
                  </p>
                )}
                <p className="mt-6 flex flex-col text-sm font-bold tracking-[0.2em] text-primary">
                  {block.lines.slice(2).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </div>
            );
          default:
            return null;
        }
      })}

      {isVerificationStep && view.verification && (
        <div className="mt-6 grid max-w-[68ch] gap-6">
          {/* System-verified — derived from real persisted records */}
          <section
            aria-labelledby="verification-system"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h3
              id="verification-system"
              className="text-sm font-semibold text-foreground"
            >
              Verified by FinFam system
            </h3>
            <ul className="mt-4 space-y-3">
              {view.verification.systemChecks.map((check) => (
                <li
                  key={check.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {check.label}
                    </p>
                    <p className="mt-0.5 break-all text-sm text-muted-foreground">
                      {check.detail}
                    </p>
                  </div>
                  <span
                    aria-label="Verified"
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                  >
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* External — the portal cannot truthfully verify these (§14/§30) */}
          <section
            aria-labelledby="verification-external"
            className="rounded-lg border border-border p-5"
          >
            <h3
              id="verification-external"
              className="text-sm font-semibold text-foreground"
            >
              External communication setup
            </h3>
            <ul className="mt-4 space-y-3">
              {view.verification.externalActions.map((action) => (
                <li key={action.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {action.label}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {action.detail}
                    </p>
                  </div>
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    External onboarding action
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {whatsappHref && (
        <div className="mt-6">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Contact FinFam Onboarding Team
            <span className="sr-only">
              {" "}
              — opens WhatsApp with your pre-filled onboarding message
            </span>
          </a>
          <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
            Opens WhatsApp with your first message pre-filled — no need to
            compose it yourself.
          </p>
        </div>
      )}
    </div>
  );
}
