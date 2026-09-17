import Image from "next/image";

import { getReleaseDetails, type ReleaseArea } from "@/server/config/release";

export function ReleaseInProgress({ area }: { area: ReleaseArea }) {
  const release = getReleaseDetails(area);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12 sm:px-8">
      <div className="w-full max-w-lg text-center">
        <Image
          src="/icon-192.png"
          alt="FinFam"
          width={64}
          height={64}
          className="mx-auto size-16 object-contain"
          priority
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          FinFam Recruitment
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Development in progress
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
          The {release.label.toLowerCase()} is being prepared and is not open
          yet. Please return after the scheduled release time.
        </p>
        <div className="mx-auto mt-8 max-w-sm border border-border bg-surface px-5 py-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Scheduled release
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {release.releaseAt.toLocaleString("en-GB", {
              timeZone: "Africa/Lagos",
              dateStyle: "long",
              timeStyle: "short",
            })}{" "}
            {" WAT"}
          </p>
        </div>
      </div>
    </main>
  );
}
