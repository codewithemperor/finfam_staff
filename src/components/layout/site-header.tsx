import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { SiteNavLinks } from "@/components/layout/site-nav-links";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

/**
 * Global site header. Intentionally minimal: brand, navigation links, and
 * the primary call to action. On the smallest screens the nav wraps to a
 * second row rather than hiding destinations; if navigation grows further,
 * introduce a mobile drawer (HeroUI Drawer).
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("border-b border-border bg-background print:hidden", className)}>
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 sm:h-16 sm:flex-nowrap sm:gap-4 sm:py-0">
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
            <SiteNavLinks />

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
