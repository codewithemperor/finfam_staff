import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { StaffNav } from "@/components/staff/staff-nav";

/**
 * Staff Portal shell (Stage 7): its own header + navigation over the same
 * footer — the portal is the Staff member's ongoing operational home, a
 * distinct experience from the recruitment portal while keeping the FinFam
 * visual rules. The footer sticks to the bottom on short pages and is
 * pushed naturally on long pages (same pattern as PageShell).
 */
export function StaffShell({
  staffId,
  children,
}: {
  staffId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SkipLink />
      <header className="border-b border-border bg-background print:hidden">
        <PageContainer>
          <StaffNav staffId={staffId} />
        </PageContainer>
      </header>
      <main id="main-content" className="flex-1">
        <PageContainer size="default">
          <div className="py-10 sm:py-12">{children}</div>
        </PageContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
