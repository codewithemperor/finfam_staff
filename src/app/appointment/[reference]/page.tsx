import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Alert } from "@heroui/react";

import { AppointmentLetter } from "@/components/appointment/appointment-letter";
import { DownloadAppointmentButton } from "@/components/appointment/download-appointment-button";
import { JourneyNotFoundPanel } from "@/components/recruitment/journey-not-found";
import { PageShell } from "@/components/layout/page-shell";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { StatusBadge } from "@/components/recruitment/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CANDIDATE_STATUS_DETAILS, getStageStates } from "@/config/recruitment";
import { AppError } from "@/lib/errors";
import { normalizeReferenceNumber } from "@/lib/reference";
import { getAppointmentView } from "@/server/services/appointment";

export const metadata: Metadata = {
  title: "Provisional Appointment",
  description:
    "Your Provisional Letter of Appointment from FinFam — issued, read-only, and always available here.",
};

/**
 * The Provisional Appointment — the home of stage 4 and a READ-ONLY
 * document view. There is no decision to make here (the Responsibility &
 * Reward Agreement already carries the candidate's explicit acceptance)
 * and no reference-entry form: the server decides everything from the
 * candidate's persisted state.
 *
 * - Unknown reference → the established neutral not-found panel.
 * - Not issued (earlier stage or declined) → redirected to the unified
 *   journey, which is the authoritative view; reading never issues or
 *   implies anything for ineligible candidates.
 * - Eligible (OFFER_ACCEPTED) → the first open issues the letter exactly
 *   once, server-side; this and every later visit render the same issued
 *   letter. Reopening the document is the one-way-lock exception — the
 *   issued RECORD is viewable, never an issuance workflow.
 *
 * Layout: mobile is a single-column reading flow (title → reference/date
 * → letter → print → back); tablet/desktop recomposes into the document
 * plus a useful secondary rail (status, reference, issue date, version,
 * download, journey, activation).
 */
export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let view;
  try {
    view = await getAppointmentView(normalizeReferenceNumber(reference));
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return (
        <PageShell size="narrow">
          <JourneyNotFoundPanel message={error.message} />
        </PageShell>
      );
    }
    throw error;
  }

  // Server-enforced stage lock (mirrors the service rule): no issued
  // letter → no document view for this candidate. Stale links are pointed
  // at the candidate's real current stage.
  if (!view.issued || !view.appointment) {
    redirect(`/application/${view.referenceNumber}`);
  }

  const appointment = view.appointment;
  const statusDefinition = CANDIDATE_STATUS_DETAILS[view.status];

  return (
    <PageShell size="default">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        {/* ------------------------------------------------------- */}
        {/* Screen chrome, then the letter document                   */}
        {/* ------------------------------------------------------- */}
        <section aria-label="Provisional appointment" className="min-w-0">
          <div className="print:hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Provisional Appointment
              </h1>
              <StatusBadge status={view.status} />
            </div>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Your formal appointment letter from FinFam. It has been issued
              in your name and stays available here — you can reopen it at
              any time, and you should download the official PDF copy for
              your records.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              For {view.fullName} ·{" "}
              <span className="font-mono tracking-widest">
                {view.referenceNumber}
              </span>
            </p>
          </div>

          <Alert status="warning" className="mt-6 print:hidden">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Download your appointment letter</Alert.Title>
              <Alert.Description>
                Please download and keep the PDF copy before continuing to
                activation. The downloaded PDF includes the official stamp.
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <div className="mt-8 md:mt-10">
            <AppointmentLetter appointment={appointment} />
          </div>

          {/* Mobile action row — the secondary rail is desktop-only */}
          <div className="mt-10 flex flex-col gap-3 border-t border-divider pt-6 print:hidden sm:flex-row md:hidden">
            <DownloadAppointmentButton reference={view.referenceNumber} />
            <ButtonLink
              href={`/activation/${view.referenceNumber}`}
              variant="outline"
            >
              Continue to Activation
            </ButtonLink>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* Secondary rail: useful information only                   */}
        {/* ------------------------------------------------------- */}
        <aside
          aria-label="About this letter"
          className="self-start md:sticky md:top-8 print:hidden"
        >
          <div className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              About this letter
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={view.status} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="text-sm font-mono font-semibold tracking-wider text-foreground">
                  {appointment.appointmentReference}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Issue date</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {format(new Date(appointment.issuedAt), "d MMMM yyyy")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Version</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {appointment.version}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-divider pt-5">
              <div className="flex flex-col gap-3">
                <DownloadAppointmentButton
                  reference={view.referenceNumber}
                  className="w-full"
                />
                <ButtonLink
                  href={`/activation/${view.referenceNumber}`}
                  variant="outline"
                  fullWidth
                >
                  Continue to Activation
                </ButtonLink>
              </div>
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <h3 className="text-sm font-semibold text-foreground">
                Recruitment journey
              </h3>
              <RecruitmentProgress
                currentStage={statusDefinition.stage}
                states={getStageStates(view.status)}
                showDescriptions={false}
                className="mt-4"
              />
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <ButtonLink href={`/application/${view.referenceNumber}`} variant="ghost" size="sm">
                Back to your application
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
