import { ButtonLink } from "@/components/ui/button-link";

/**
 * Not-found panel for unknown assessment references — mirrors the
 * orientation page's in-page panel convention.
 */
export function AssessmentNotFoundPanel({ message }: { message: string }) {
  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
      <h1 className="text-base font-semibold text-foreground">
        We couldn&apos;t find that application
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {message}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/assessment">Back to the assessment</ButtonLink>
        <ButtonLink href="/status" variant="outline">
          Check application status
        </ButtonLink>
      </div>
    </div>
  );
}
