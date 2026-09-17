import { cn } from "@/lib/utils";

/**
 * Keyboard skip link (production-readiness remediation §25): the first
 * focusable element of every major shell. Visually hidden until focused,
 * then clearly visible above the header — jumps straight past navigation
 * to `#main-content` (all three shells mark their <main> with that id).
 */
export function SkipLink({ className }: { className?: string }) {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
        "focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5",
        "focus:text-sm focus:font-semibold focus:text-primary-foreground",
        "focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-primary",
        className,
      )}
    >
      Skip to main content
    </a>
  );
}
