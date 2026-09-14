"use client";

import { useEffect } from "react";

import { Button } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";

/**
 * Route-level error boundary for the orientation segment.
 *
 * Shows a human-readable message — never the raw error — while the real
 * error is logged for developers.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[orientation] Unhandled page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        We couldn&apos;t load your orientation
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
        Something went wrong on our side. Your progress is safe — please try
        again.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onPress={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Go to homepage
        </ButtonLink>
      </div>
    </div>
  );
}
