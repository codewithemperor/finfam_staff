import Link from "next/link";
import Image from "next/image";

import { MobileSiteNavDrawer } from "@/components/layout/mobile-site-nav-drawer";
import { PageContainer } from "@/components/layout/page-container";
import { SiteNavLinks } from "@/components/layout/site-nav-links";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

/**
 * Global site header. Intentionally minimal: brand, navigation links, and
 * the primary call to action. On mobile, destinations live inside a HeroUI
 * drawer so the header stays compact.
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
            <Image
              src="/icon-192.png"
              alt=""
              width={32}
              height={32}
              className="size-8 object-contain"
              priority
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              FinFam
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Recruitment
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-5">
            <div className="hidden sm:block">
              <SiteNavLinks />
            </div>

            <ButtonLink
              href="/apply"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Apply now
            </ButtonLink>
            <MobileSiteNavDrawer />
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
