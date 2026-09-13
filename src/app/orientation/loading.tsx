import { Spinner } from "@heroui/react";

/**
 * Route-level loading state for the orientation segment.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" />
      <span className="text-sm text-muted-foreground">
        Loading your orientation…
      </span>
    </div>
  );
}
