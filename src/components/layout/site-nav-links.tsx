"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Candidate-facing header navigation (client island inside the otherwise
 * server-rendered SiteHeader) — production-readiness remediation §25:
 * announces the active destination with `aria-current="page"` and provides
 * comfortable touch targets (44px on mobile, 36px from sm up).
 */
export function SiteNavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-5">
        {siteConfig.nav.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-1 text-[13px] font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:min-h-9 sm:text-sm",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
