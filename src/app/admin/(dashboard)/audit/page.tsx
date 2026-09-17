import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ADMIN_AUDIT_ACTION_LABELS } from "@/config/admin";
import { getAdminSession } from "@/lib/auth/admin-session";
import { formatLagosDateTimeLabel } from "@/lib/dates/lagos";
import { listAdminAuditEvents } from "@/server/services/admin-audit";

export const metadata: Metadata = {
  title: "Audit Log · FinFam Admin",
  description:
    "Append-only record of privileged actions taken in the FinFam Admin console.",
};

/**
 * /admin/audit — the append-only audit log (Stage 11, brief §46). Every
 * privileged action recorded by the backend, newest first, read-only:
 * there is deliberately NO edit, delete or clear path anywhere. Each row
 * shows WHAT (action label), WHO (actor email), WHEN (Africa/Lagos
 * timestamp), and the WHY/WHEN-USEFUL context (reason, previous→new
 * status) as plain text — never colour-only.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    // The layout already guards this — defensive double-check (Next 16
    // serves layout redirects as HTTP-200 shells while pages render).
    redirect("/admin/login");
  }

  const params = await searchParams;
  const rawPage =
    typeof params.page === "string"
      ? Number.parseInt(params.page, 10)
      : undefined;
  const page =
    typeof rawPage === "number" && Number.isFinite(rawPage) && rawPage > 0
      ? rawPage
      : 1;

  const audit = await listAdminAuditEvents({ page });

  return (
    <div className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        FinFam Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Audit Log
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Every privileged action taken in this console, newest first.
        Append-only record. Entries cannot be edited or deleted.
      </p>

      {audit.events.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No privileged actions recorded yet.
          </p>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
            Suspensions and reactivations performed in this console are
            recorded here automatically and permanently.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-lg border border-border bg-surface">
          {audit.events.map((event) => (
            <li key={event.id} className="p-4 sm:p-5">
              <p className="text-sm font-semibold text-foreground">
                {ADMIN_AUDIT_ACTION_LABELS[event.action] ?? event.action}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatLagosDateTimeLabel(new Date(event.createdAt))}</span>
                <span>
                  by{" "}
                  <span className="font-medium text-foreground">
                    {event.actorEmail}
                  </span>
                </span>
                {event.staffId && (
                  <span className="font-mono tracking-wider">
                    {event.staffId}
                  </span>
                )}
                {event.previousStatus && event.newStatus && (
                  <span>
                    {event.previousStatus} → {event.newStatus}
                  </span>
                )}
              </p>
              {event.reason && (
                <p className="mt-2 max-w-[68ch] text-sm leading-6 text-foreground">
                  <span className="font-medium">Reason: </span>
                  {event.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Page {audit.page} of {audit.totalPages} · {audit.total} entr
        {audit.total === 1 ? "y" : "ies"}
      </p>

      {audit.totalPages > 1 && (
        <nav
          aria-label="Audit log pages"
          className="mt-2 flex items-center justify-between text-sm"
        >
          {audit.page > 1 ? (
            <Link
              href={`/admin/audit?page=${audit.page - 1}`}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              ← Previous
            </Link>
          ) : (
            <span className="px-2 py-1 text-muted-foreground/50">← Previous</span>
          )}
          {audit.page < audit.totalPages ? (
            <Link
              href={`/admin/audit?page=${audit.page + 1}`}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Next →
            </Link>
          ) : (
            <span className="px-2 py-1 text-muted-foreground/50">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}
