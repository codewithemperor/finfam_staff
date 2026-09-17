import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Chip } from "@heroui/react";

import {
  ADMIN_DIRECTORY_EMPTY_MESSAGE,
} from "@/config/admin";
import { getAdminSession } from "@/lib/auth/admin-session";
import type { StaffDirectoryStatusFilter } from "@/server/services/admin-directory";
import { listStaffDirectory } from "@/server/services/admin-directory";

export const metadata: Metadata = {
  title: "Staff · FinFam Admin",
  description:
    "Directory of FinFam Staff members with account, onboarding and training states.",
};

const STATUS_FILTERS = ["ALL", "ACTIVE", "SUSPENDED"] as const;

function parseStatus(raw: string | undefined): StaffDirectoryStatusFilter {
  return STATUS_FILTERS.includes(raw as StaffDirectoryStatusFilter)
    ? (raw as StaffDirectoryStatusFilter)
    : "ALL";
}

/** The account-status chip + the onboarding/training text labels. */
function AccountStatusChip({
  status,
}: {
  status: "ACTIVE" | "SUSPENDED";
}) {
  if (status === "ACTIVE") {
    return (
      <Chip color="success" variant="soft" size="sm">
        Active
        <span className="sr-only">Status: active.</span>
      </Chip>
    );
  }
  return (
    <Chip color="danger" variant="soft" size="sm">
      Suspended
      <span className="sr-only">Status: suspended.</span>
    </Chip>
  );
}

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/**
 * /admin/staff — Staff directory (Stage 11, brief §18). Server-rendered
 * search/filter (a plain GET <form> that works without JavaScript), the
 * whitelisted q/status/page parameters only, and a linked list of Staff
 * rows. Status is never communicated by colour alone — every chip and
 * state label carries a text/sr-only reading.
 */
export default async function AdminStaffDirectoryPage({
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
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseStatus(
    typeof params.status === "string" ? params.status : undefined,
  );
  const rawPage =
    typeof params.page === "string"
      ? Number.parseInt(params.page, 10)
      : undefined;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const directory = await listStaffDirectory({ q: q || undefined, status, page });

  /** Build a pagination href that preserves the current search/filter. */
  function pageHref(nextPage: number): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "ALL") search.set("status", status);
    search.set("page", String(nextPage));
    return `/admin/staff?${search.toString()}`;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        FinFam Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Staff
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Every FinFam Staff member, newest activation first. Select a Staff
        member to view their full record.
      </p>

      {/* Server-rendered search + filter — works without JavaScript. */}
      <form
        method="get"
        action="/admin/staff"
        role="search"
        aria-label="Search and filter Staff"
        className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="staff-search-q"
              className="block text-sm font-medium text-foreground"
            >
              Search by Staff ID, name or email
            </label>
            <input
              id="staff-search-q"
              name="q"
              type="text"
              defaultValue={q}
              autoComplete="off"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder="e.g. FF-STF-0142"
            />
          </div>
          <div>
            <label
              htmlFor="staff-search-status"
              className="block text-sm font-medium text-foreground"
            >
              Account status
            </label>
            <select
              id="staff-search-status"
              name="status"
              defaultValue={status}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Apply
          </button>
        </div>
      </form>

      {directory.staff.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {ADMIN_DIRECTORY_EMPTY_MESSAGE}
          </p>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
            Try a different search term, or set the status filter back to
            &ldquo;All statuses&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {directory.staff.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/staff/${row.id}`}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-background sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-semibold tracking-wider text-foreground">
                      {row.staffId}
                    </span>
                    <AccountStatusChip status={row.accountStatus} />
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {row.fullName}
                  </p>
                  <p className="mt-0.5 hidden truncate text-sm text-muted-foreground md:block">
                    {row.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.designation} · Activated{" "}
                    {format(new Date(row.activatedAt), "d MMMM yyyy")}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  <p>
                    Onboarding: {STATE_LABELS[row.onboardingState]}
                    <span className="sr-only"> Status: {row.onboardingState.toLowerCase().replace("_", " ")}.</span>
                  </p>
                  <p className="mt-0.5">
                    Training: {STATE_LABELS[row.trainingState]}
                    <span className="sr-only"> Status: {row.trainingState.toLowerCase().replace("_", " ")}.</span>
                  </p>
                  <span
                    className="mt-1 hidden text-sm font-medium text-primary sm:inline-block"
                    aria-hidden="true"
                  >
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Page {directory.page} of {directory.totalPages} · {directory.total}{" "}
        staff
      </p>

      {directory.totalPages > 1 && (
        <nav
          aria-label="Directory pages"
          className="mt-2 flex items-center justify-between text-sm"
        >
          {directory.page > 1 ? (
            <Link
              href={pageHref(directory.page - 1)}
              className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              ← Previous
            </Link>
          ) : (
            <span className="px-2 py-1 text-muted-foreground/50">← Previous</span>
          )}
          {directory.page < directory.totalPages ? (
            <Link
              href={pageHref(directory.page + 1)}
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
