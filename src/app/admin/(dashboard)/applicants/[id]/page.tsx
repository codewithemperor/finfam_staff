import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chip } from "@heroui/react";
import type { CandidateStatus } from "@prisma/client";

import { ButtonLink } from "@/components/ui/button-link";
import { getAdminSession } from "@/lib/auth/admin-session";
import { formatLagosDateLabel, toLagosDateString } from "@/lib/dates/lagos";
import { AppError } from "@/lib/errors";
import { getApplicantDetail } from "@/server/services/admin-applicants";

export const metadata: Metadata = {
  title: "Applicant · FinFam Admin",
  robots: { index: false },
};

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

function statusColor(status: CandidateStatus): "success" | "danger" | "warning" | "accent" | "default" {
  if (status === "APPROVED_STAFF" || status === "ASSESSMENT_PASSED") return "success";
  if (status === "ASSESSMENT_FAILED" || status === "OFFER_DECLINED") return "danger";
  if (status.endsWith("PENDING") || status === "APPLICANT") return "warning";
  if (status === "ORIENTATION_COMPLETED" || status === "OFFER_ACCEPTED") return "accent";
  return "default";
}

export default async function AdminApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;

  let applicant;
  try {
    applicant = await getApplicantDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="max-w-6xl">
      <Link href="/admin/applicants" className="text-sm text-muted-foreground hover:text-foreground">← Applicants</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Applicant record</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{applicant.fullName}</h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{applicant.referenceNumber}</p>
        </div>
        <Chip color={statusColor(applicant.status)} variant="soft">{STATUS_LABELS[applicant.status] ?? applicant.status}</Chip>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="applicant-personal" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 id="applicant-personal" className="text-sm font-semibold text-foreground">Personal information</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Full name</dt><dd className="font-semibold text-foreground">{applicant.fullName}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="font-semibold text-foreground">{applicant.email}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Phone</dt><dd className="font-semibold text-foreground">{applicant.phone}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Contact address</dt><dd className="font-semibold text-foreground">{applicant.residentialAddress ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">City</dt><dd className="font-semibold text-foreground">{applicant.city ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">State</dt><dd className="font-semibold text-foreground">{applicant.state ?? "Not provided"}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="applicant-education" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 id="applicant-education" className="text-sm font-semibold text-foreground">Educational Details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Highest qualification</dt><dd className="font-semibold text-foreground">{applicant.highestQualification ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Institution / School</dt><dd className="font-semibold text-foreground">{applicant.institution ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Course of study</dt><dd className="font-semibold text-foreground">{applicant.courseOfStudy ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Graduation year</dt><dd className="font-semibold text-foreground">{applicant.graduationYear ?? "Not provided"}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="applicant-credentials" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 id="applicant-credentials" className="text-sm font-semibold text-foreground">Uploaded Credentials (Cloudinary)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3 bg-background">
                <p className="text-xs font-semibold text-muted-foreground">Curriculum Vitae (CV)</p>
                {applicant.cvUrl ? (
                  <a
                    href={applicant.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-primary underline"
                  >
                    View / Download CV ↗
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not uploaded</p>
                )}
              </div>

              <div className="rounded-md border border-border p-3 bg-background">
                <p className="text-xs font-semibold text-muted-foreground">Passport Photo</p>
                {applicant.passportPhotoUrl ? (
                  <div className="mt-2 space-y-1.5">
                    <img
                      src={applicant.passportPhotoUrl}
                      alt="Passport"
                      className="size-16 rounded object-cover border border-border"
                    />
                    <a
                      href={applicant.passportPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-medium text-primary underline"
                    >
                      View full photo ↗
                    </a>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not uploaded</p>
                )}
              </div>

              <div className="rounded-md border border-border p-3 bg-background">
                <p className="text-xs font-semibold text-muted-foreground">National Means of ID</p>
                {applicant.idCardUrl ? (
                  <a
                    href={applicant.idCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-primary underline"
                  >
                    View ID document ↗
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not uploaded</p>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="applicant-application" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 id="applicant-application" className="text-sm font-semibold text-foreground">Application</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Role</dt><dd className="font-semibold text-foreground">{applicant.application?.roleTitle ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Application status</dt><dd className="font-semibold text-foreground">{applicant.application?.status ?? "Not provided"}</dd></div>
              <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">Submitted</dt><dd className="font-semibold text-foreground">{applicant.application ? formatLagosDateLabel(toLagosDateString(applicant.application.submittedAt)) : "Not provided"}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="applicant-status" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 id="applicant-status" className="text-sm font-semibold text-foreground">Journey status</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">The status below is the candidate status persisted by the recruitment flow.</p>
            <div className="mt-4"><Chip color={statusColor(applicant.status)} variant="soft">{STATUS_LABELS[applicant.status] ?? applicant.status}</Chip></div>
            <dl className="mt-5 space-y-3 border-t border-divider pt-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Created</dt><dd className="font-semibold text-foreground">{formatLagosDateLabel(toLagosDateString(applicant.createdAt))}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last updated</dt><dd className="font-semibold text-foreground">{formatLagosDateLabel(toLagosDateString(applicant.updatedAt))}</dd></div>
            </dl>
          </section>
          <ButtonLink href={`/application/${applicant.referenceNumber}`} variant="outline" fullWidth>Open applicant journey</ButtonLink>
        </aside>
      </div>
    </div>
  );
}
