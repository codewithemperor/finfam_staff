import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * FinFam Admin console shell (Stage 11): its own header + navigation over
 * the same footer — structurally the Staff Portal shell, but the brand
 * block is VISIBLY DISTINCT so the privileged console can never be
 * mistaken for the Staff Portal: "FinFam Admin" + a permanent
 * "Management console" label (brief §16). The footer sticks to the bottom
 * on short pages and is pushed naturally on long pages.
 */
export function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border bg-background print:hidden">
        <PageContainer>
          <AdminNav adminEmail={adminEmail} />
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
