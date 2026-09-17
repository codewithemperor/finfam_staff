import { AdminNav } from "@/components/admin/admin-nav";
import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";

/**
 * FinFam Admin console shell: the privileged console uses the same responsive
 * rail/drawer structure as Staff while retaining its distinct brand label.
 */
export function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background md:grid md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SkipLink />
      <AdminNav adminEmail={adminEmail} />
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
