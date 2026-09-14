
import { Button } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
        The page you are looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Go to homepage</ButtonLink>
        <ButtonLink href="/status" variant="outline">
          Check application status
        </ButtonLink>
      </div>
    </div>
  );
}
