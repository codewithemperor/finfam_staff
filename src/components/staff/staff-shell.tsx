import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { StaffNav } from "@/components/staff/staff-nav";

/**
 * Staff Portal shell: the navigation is a fixed-height desktop rail and a
 * HeroUI drawer on smaller screens. The content column remains independently
 * scrollable, so the rail never pushes the document taller than the viewport.
 */
export function StaffShell({
  staffId,
  fullName,
  children,
}: {
  staffId: string;
  fullName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background md:grid md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SkipLink />
      <StaffNav staffId={staffId} fullName={fullName} />
      <div className="flex min-h-[100dvh] min-w-0 flex-col">
        <main id="main-content" className="flex-1">
          <PageContainer size="default">
            <div className="py-8 sm:py-10 lg:py-12">{children}</div>
          </PageContainer>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
