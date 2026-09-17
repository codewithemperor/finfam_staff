import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { cn } from "@/lib/utils";

/**
 * Global site footer. Sticks to the bottom of the viewport when content is
 * short (mt-auto inside the page shell) and is pushed down naturally when
 * content is long.
 *
 * Support contact (production-readiness remediation §35): a real mailto
 * link renders ONLY when the deployment configures SUPPORT_CONTACT_EMAIL.
 * Without it the footer shows safe pending copy — the reserved `.example`
 * placeholder can never ship to production users, and no FinFam address is
 * ever fabricated.
 */
export function SiteFooter({ className }: { className?: string }) {
  // BUSINESS INPUT REQUIRED (§35): set SUPPORT_CONTACT_EMAIL once the
  // business supplies the real support inbox (see .env.example).
  const supportEmail = process.env.SUPPORT_CONTACT_EMAIL?.trim() ?? "";

  return (
    <footer className={cn("mt-auto border-t border-border bg-background print:hidden", className)}>
      <PageContainer>
        <div className="flex flex-col gap-1 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} FinFam. All rights reserved.
          </p>
          {supportEmail ? (
            <p>
              Questions?{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {supportEmail}
              </a>
            </p>
          ) : (
            <p>Support contact details will be published here shortly.</p>
          )}
        </div>
      </PageContainer>
    </footer>
  );
}
