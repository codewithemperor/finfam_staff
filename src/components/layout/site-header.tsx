import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Global site header. Intentionally minimal: brand, two navigation links,
 * and the primary call to action. Navigation grows → introduce a mobile
 * drawer (HeroUI Drawer) only when links no longer fit on small screens.
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("border-b border-border bg-background", className)}>
      <PageContainer>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            aria-label="FinFam Recruitment home"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
            >
              F
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              FinFam
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Recruitment
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-5">
            <nav aria-label="Main navigation">
              <ul className="flex items-center gap-4 sm:gap-5">
                {siteConfig.nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="rounded-md text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <ButtonLink
              href="/apply"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Apply now
            </ButtonLink>
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
