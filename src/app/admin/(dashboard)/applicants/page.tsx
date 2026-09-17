import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Table } from "@heroui/react";
import type { CandidateStatus } from "@prisma/client";

import { ButtonLink } from "@/components/ui/button-link";
import { getAdminSession } from "@/lib/auth/admin-session";
import { formatLagosDateLabel, toLagosDateString } from "@/lib/dates/lagos";
import {
  listApplicants,
  type ApplicantStatusFilter,
} from "@/server/services/admin-applicants";

export const metadata: Metadata = {
  title: "Applicants · FinFam Admin",
  description: "Review FinFam recruitment applicants and their current status.",
};

const STATUS_OPTIONS: ApplicantStatusFilter[] = [
  "ALL",
  "APPLICANT",
  "ORIENTATION_PENDING",
  "ORIENTATION_COMPLETED",
  "ASSESSMENT_PENDING",
  "ASSESSMENT_PASSED",
  "ASSESSMENT_FAILED",
  "OFFER_PENDING",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "APPOINTMENT_ISSUED",
  "ACTIVATION_PENDING",
  "APPROVED_STAFF",
];

const STATUS_LABELS: Record<string, string> = {
  APPLICANT: "Applicant",
  ORIENTATION_PENDING: "Orientation pending",
  ORIENTATION_COMPLETED: "Orientation complete",
  ASSESSMENT_PENDING: "Assessment pending",
  ASSESSMENT_PASSED: "Assessment passed",
  ASSESSMENT_FAILED: "Assessment failed",
  OFFER_PENDING: "Offer pending",
  OFFER_ACCEPTED: "Offer accepted",
  OFFER_DECLINED: "Offer declined",
  APPOINTMENT_ISSUED: "Appointment issued",
  ACTIVATION_PENDING: "Activation pending",
  APPROVED_STAFF: "Approved Staff",
};

function parseStatus(raw: string | undefined): ApplicantStatusFilter {
  return STATUS_OPTIONS.includes(raw as ApplicantStatusFilter)
    ? (raw as ApplicantStatusFilter)
    : "ALL";
}

function statusColor(
  status: CandidateStatus,
): "success" | "danger" | "warning" | "accent" | "default" {
  if (status === "APPROVED_STAFF" || status === "ASSESSMENT_PASSED") return "success";
  if (status === "ASSESSMENT_FAILED" || status === "OFFER_DECLINED") return "danger";
  if (status.endsWith("PENDING") || status === "APPLICANT") return "warning";
  if (status === "ORIENTATION_COMPLETED" || status === "OFFER_ACCEPTED") return "accent";
  return "default";
}

function ApplicantStatusChip({ status }: { status: CandidateStatus }) {
  return (
    <Chip color={statusColor(status)} variant="soft" size="sm">
      {STATUS_LABELS[status] ?? status}
      <span className="sr-only">Status: {status.toLowerCase().replaceAll("_", " ")}.</span>
    </Chip>
  );
}

function appliedDate(applicant: {
  application: { submittedAt: Date } | null;
  createdAt: Date;
}) {
  return formatLagosDateLabel(
    toLagosDateString(applicant.application?.submittedAt ?? applicant.createdAt),
  );
}

export default async function AdminApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseStatus(typeof params.status === "string" ? params.status : undefined);
  const rawPage = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const directory = await listApplicants({ q: q || undefined, status, page });

  function pageHref(nextPage: number) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "ALL") search.set("status", status);
    search.set("page", String(nextPage));
    return `/admin/applicants?${search.toString()}`;
  }

  return (
    <div className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">FinFam Admin</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Applicants</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Review recruitment applicants and their current journey status.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{directory.total} total</p>
      </div>

      <form method="get" action="/admin/applicants" role="search" aria-label="Search applicants" className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="applicant-search-q" className="block text-sm font-medium text-foreground">Search applicants</label>
            <input id="applicant-search-q" name="q" type="search" defaultValue={q} placeholder="Name, email, phone or reference" className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
          </div>
          <div>
            <label htmlFor="applicant-search-status" className="block text-sm font-medium text-foreground">Status</label>
            <select id="applicant-search-status" name="status" defaultValue={status} className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto">
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === "ALL" ? "All statuses" : STATUS_LABELS[option]}</option>)}
            </select>
          </div>
          <button type="submit" className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Apply filters</button>
        </div>
      </form>

      {directory.applicants.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">No applicants found.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Applications will appear here once they are submitted.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden md:block">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Applicants" className="min-w-[760px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Applicant</Table.Column>
                    <Table.Column>Contact</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Applied</Table.Column>
                    <Table.Column>Action</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {directory.applicants.map((applicant) => (
                      <Table.Row key={applicant.id}>
                        <Table.Cell>
                          <div>
                            <p className="font-semibold text-foreground">{applicant.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{applicant.referenceNumber}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <p>{applicant.email}</p>
                          <p className="text-xs text-muted-foreground">{applicant.phone}</p>
                        </Table.Cell>
                        <Table.Cell><ApplicantStatusChip status={applicant.status} /></Table.Cell>
                        <Table.Cell>{appliedDate(applicant)}</Table.Cell>
                        <Table.Cell><ButtonLink href={`/admin/applicants/${applicant.id}`} variant="ghost" size="sm">View details</ButtonLink></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {directory.applicants.map((applicant) => (
              <li key={applicant.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-foreground">{applicant.fullName}</h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{applicant.referenceNumber}</p>
                  </div>
                  <ApplicantStatusChip status={applicant.status} />
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="text-right text-foreground">{applicant.email}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Phone</dt><dd className="text-foreground">{applicant.phone}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Applied</dt><dd className="text-foreground">{appliedDate(applicant)}</dd></div>
                </dl>
                <div className="mt-4"><ButtonLink href={`/admin/applicants/${applicant.id}`} fullWidth size="sm">View details</ButtonLink></div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {directory.page} of {directory.totalPages}</span>
        {directory.totalPages > 1 && <nav aria-label="Applicant pages" className="flex gap-3"><Link href={directory.page > 1 ? pageHref(directory.page - 1) : "#"} aria-disabled={directory.page === 1} className="text-primary aria-disabled:pointer-events-none aria-disabled:opacity-40">Previous</Link><Link href={directory.page < directory.totalPages ? pageHref(directory.page + 1) : "#"} aria-disabled={directory.page === directory.totalPages} className="text-primary aria-disabled:pointer-events-none aria-disabled:opacity-40">Next</Link></nav>}
      </div>
    </div>
  );
}
