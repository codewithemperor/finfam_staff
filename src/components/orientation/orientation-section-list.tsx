import { ArrowRight, Check, Lock } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { OrientationSectionView } from "@/lib/orientation";

const stateStyles: Record<
  OrientationSectionView["state"],
  { marker: string; title: string }
> = {
  completed: {
    marker: "border-primary bg-primary text-primary-foreground",
    title: "text-foreground",
  },
  current: {
    marker: "border-2 border-primary bg-accent/10 text-primary",
    title: "font-semibold text-foreground",
  },
  locked: {
    marker: "border-border bg-background text-disabled",
    title: "text-muted-foreground",
  },
};

/**
 * The workshop's table of contents: every section with its state.
 * Completed and current sections link to their pages; locked sections are
 * plain text — the server, not this list, decides what is open.
 */
export function OrientationSectionList({
  sections,
  className,
}: {
  sections: OrientationSectionView[];
  className?: string;
}) {
  return (
    <ol className={cn("m-0 list-none p-0", className)}>
      {sections.map((section) => {
        const styles = stateStyles[section.state];

        return (
          <li
            key={section.id}
            aria-current={section.state === "current" ? "step" : undefined}
            className="border-b border-divider py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  styles.marker,
                )}
              >
                {section.state === "completed" ? (
                  <Check className="size-3.5" />
                ) : section.state === "locked" ? (
                  <Lock className="size-3" />
                ) : (
                  section.index
                )}
              </span>

              <div className="min-w-0 flex-1">
                {section.state === "locked" ? (
                  <p className={cn("text-sm leading-6", styles.title)}>
                    {section.title}
                    <span className="sr-only"> — locked</span>
                  </p>
                ) : (
                  <Link
                    href={section.href}
                    className={cn(
                      "rounded-md text-sm leading-6 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
                      styles.title,
                    )}
                  >
                    {section.title}
                    <span className="sr-only"> — read section</span>
                  </Link>
                )}
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {section.summary}
                </p>
              </div>

              {section.state === "current" && (
                <span className="mt-1 hidden items-center gap-1 text-sm font-medium text-primary sm:flex">
                  Continue
                  <ArrowRight aria-hidden className="size-3.5" />
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
