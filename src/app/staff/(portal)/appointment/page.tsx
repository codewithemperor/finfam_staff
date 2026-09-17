import type { Metadata } from "next";
import { format } from "date-fns";

import { AppointmentLetter } from "@/components/appointment/appointment-letter";
import { DownloadAppointmentButton } from "@/components/appointment/download-appointment-button";
import { PrintButton } from "@/components/appointment/print-button";
import { ButtonLink } from "@/components/ui/button-link";
import { getStaffSession } from "@/lib/auth/session";
import { getStaffAppointmentView } from "@/server/services/staff-portal";

export const metadata: Metadata = {
  title: "My Appointment — FinFam Staff Portal",
  description:
    "Your Provisional Letter of Appointment, available in the Staff Portal from your appointment record.",
};

/**
 * /staff/appointment — the AUTHENTICATED view of the Staff member's issued
 * provisional letter (Stage 7, brief §41). It loads the existing Appointment
 * record through the SESSION-owned Staff → Candidate relation — no
 * recruitment reference in the URL — and reuses the SAME immutable snapshot
 * + content registry + letter renderer as the recruitment stage. Nothing is
 * duplicated; the letter is read-only and immutable by design.
 */
export default async function StaffAppointmentPage() {
  const session = await getStaffSession();
  const staffRowId = session?.staff.rowId ?? "";

  // Not-found here means the impossible (an approved Staff member without
  // an issued appointment) — render the neutral panel rather than throw.
  let view;
  try {
    view = await getStaffAppointmentView(staffRowId);
  } catch {
    return (
      <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My Appointment
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Your provisional appointment letter could not be found. Please
            contact support.
          </p>
          <div className="mt-8">
            <ButtonLink href="/staff" variant="outline">
              Back to the Staff Portal home
            </ButtonLink>
          </div>
        </div>
    );
  }

  return (
    <>
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:gap-14">
        <section aria-label="Provisional appointment" className="min-w-0">
          <div className="print:hidden">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              My Appointment
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Your formal appointment letter from FinFam. It has been issued
              in your name and stays available in your Staff Portal — you can
              reopen it at any time, or print a copy for your records.
            </p>
          </div>

          <div className="mt-8 md:mt-10">
            <AppointmentLetter appointment={view} />
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-divider pt-6 print:hidden sm:flex-row md:hidden">
            <PrintButton />
            <DownloadAppointmentButton reference={session?.candidate.referenceNumber ?? ""} />
            <ButtonLink href="/staff" variant="outline">
              Back to the Staff Portal home
            </ButtonLink>
          </div>
        </section>

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
                <dt className="text-sm text-muted-foreground">
                  Appointment reference
                </dt>
                <dd className="text-right font-mono text-sm font-semibold tracking-wider text-foreground">
                  {view.appointmentReference}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Issue date</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {format(new Date(view.issuedAt), "d MMMM yyyy")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Version</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {view.version}
                </dd>
              </div>
            </dl>

            {/* <div className="mt-6 border-t border-divider pt-5">
              <PrintButton />
            </div> */}

            <div className="mt-4">
              <DownloadAppointmentButton
                reference={session?.candidate.referenceNumber ?? ""}
                className="w-full"
              />
            </div>

            <div className="mt-6 border-t border-divider pt-5">
              <ButtonLink href="/staff" variant="ghost" size="sm">
                Back to the Staff Portal home
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
