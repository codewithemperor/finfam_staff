import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { PrintButton } from "@/components/appointment/print-button";
import { StaffIdCard } from "@/components/id-card/staff-id-card";
import { ButtonLink } from "@/components/ui/button-link";
import {
  STAFF_ID_CARD_ABOUT_IS,
  STAFF_ID_CARD_ABOUT_IS_NOT,
  STAFF_ID_CARD_DISCLAIMER,
  STAFF_ID_CARD_PAGE_INTRO,
  STAFF_ID_CARD_PAGE_TITLE,
} from "@/config/staff-id-card";
import { STAFF_PORTAL_WORK_ARRANGEMENT } from "@/config/staff-portal";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff ID Card — FinFam Staff Portal",
  description:
    "Your printable FinFam Staff Identity Card, generated from your verified Staff Portal records.",
};

/**
 * /staff/id-card — the printable Staff Identity Card (Stage 10).
 *
 * Identity comes EXCLUSIVELY from the session chain (Session →
 * StaffAccount → Staff → Candidate) — query parameters such as
 * ?staffId= are never read, so a card always renders its owner's own
 * verified data (brief §25/§39). Suspended accounts do not resolve a
 * session at all and are redirected to login by the portal layout — the
 * existing revocation behaviour, no card status table (brief §25).
 *
 * PRINT (brief §26/§27): reuses the appointment print architecture —
 * `window.print()` via the shared PrintButton, `print:hidden` chrome and
 * supporting copy, so the printed page contains THE ID CARD ONLY at true
 * ID-card proportions. No PDF package, no canvas, no new dependency.
 *
 * NO new API exists for this page (brief §32): it is a server component
 * over the session + config. It writes ZERO database rows (brief §40).
 */
export default async function StaffIdCardPage() {
  const session = await getStaffSession();
  if (!session) {
    // Page-level self-gate: the layout redirect and the page render run
    // in PARALLEL in this runtime — the card must never render (or emit
    // content) without a verified session (brief §25 — never rely on
    // UI hiding).
    redirect("/staff/login");
  }

  return (
    <div className="max-w-2xl">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {STAFF_ID_CARD_PAGE_TITLE}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {STAFF_ID_CARD_PAGE_INTRO}
        </p>
      </div>

      {/* The card itself — the ONLY element that survives printing. */}
      <div className="mt-8 print:mt-0">
        <StaffIdCard
          fullName={session.candidate.fullName}
          staffId={session.staff.staffId}
          role={session.staff.roleTitle}
          workArrangement={STAFF_PORTAL_WORK_ARRANGEMENT}
          activatedAtLabel={format(
            new Date(session.staff.activatedAt),
            "d MMMM yyyy",
          )}
        />
      </div>

      <div className="mt-8 print:hidden">
        {/* Required disclaimer (brief §24). */}
        <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
          {STAFF_ID_CARD_DISCLAIMER}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="id-card-about-is">
            <h2
              id="id-card-about-is"
              className="text-sm font-semibold text-foreground"
            >
              What this card is
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {STAFF_ID_CARD_ABOUT_IS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="id-card-about-is-not">
            <h2
              id="id-card-about-is-not"
              className="text-sm font-semibold text-foreground"
            >
              What it is not
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {STAFF_ID_CARD_ABOUT_IS_NOT.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <PrintButton />
          <ButtonLink href="/staff/profile" variant="ghost" size="sm">
            Back to Profile
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
