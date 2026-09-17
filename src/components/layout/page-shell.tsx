import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { connection } from "next/server";
import { ReleaseInProgress } from "@/components/release/release-in-progress";
import { isReleaseAvailable, type ReleaseArea } from "@/server/config/release";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  /**
   * Maximum content width for the page body. The header and footer keep
   * their own container; only the main content area is constrained here.
   */
  size?: "narrow" | "default" | "wide";
  className?: string;
  releaseArea?: ReleaseArea;
}

/**
 * Standard page composition:
 *
 *   Header
 *   Main → PageContainer (content)
 *   Footer
 *
 * The footer sticks to the bottom of the viewport on short pages and is
 * pushed down naturally on long pages. Pages that need a different shell
 * (e.g. error screens) can compose the parts themselves.
 */
export async function PageShell({
  children,
  size = "default",
  className,
  releaseArea = "applicant",
}: PageShellProps) {
  await connection();

  if (!isReleaseAvailable(releaseArea)) {
    return <ReleaseInProgress area={releaseArea} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main-content" className={cn("flex-1", className)}>
        <PageContainer size={size}>
          <div className="py-10 print:py-0 sm:py-12">{children}</div>
        </PageContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
