import { ButtonLink } from "@/components/ui/button-link";

/**
 * Shared "application not found" panel for the unified journey. The
 * reference number is a lookup key — a wrong one is a dead end unless the
 * candidate is offered a way back, so this panel always offers one.
 */
export function JourneyNotFoundPanel({ message }: { message: string }) {
  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">
        We couldn&apos;t find that application
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {message}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/continue" variant="outline">
          Try another reference
        </ButtonLink>
        <ButtonLink href="/continue/recover" variant="outline">
          Forgot your reference?
        </ButtonLink>
        <ButtonLink href="/apply" variant="ghost">
          Start a new application
        </ButtonLink>
      </div>
    </div>
  );
}
