import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Global site footer. Sticks to the bottom of the viewport when content is
 * short (mt-auto inside the page shell) and is pushed down naturally when
 * content is long.
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t border-border bg-background print:hidden", className)}>
      <PageContainer>
        <div className="flex flex-col gap-1 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} FinFam. All rights reserved.
          </p>
          <p>
            Questions?{" "}
            <a
              href={`mailto:${siteConfig.support.email}`}
              className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {siteConfig.support.email}
            </a>
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
