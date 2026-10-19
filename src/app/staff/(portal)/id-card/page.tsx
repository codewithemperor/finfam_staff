import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { StaffIdCardView } from "@/components/id-card/staff-id-card-view";
import {
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
 * /staff/id-card — the printable Staff Identity Card.
 *
 * Identity comes EXCLUSIVELY from the session chain (Session →
 * StaffAccount → Staff → Candidate).
 * If the candidate has not yet uploaded a passport photo, the page displays
 * a passport photo upload gate before revealing the card.
 */
export default async function StaffIdCardPage() {
  const session = await getStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  return (
    <div className="max-w-5xl">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {STAFF_ID_CARD_PAGE_TITLE}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {STAFF_ID_CARD_PAGE_INTRO}
        </p>
      </div>

      <StaffIdCardView
        fullName={session.candidate.fullName}
        staffId={session.staff.staffId}
        role={session.staff.roleTitle}
        workArrangement={STAFF_PORTAL_WORK_ARRANGEMENT}
        activatedAtLabel={format(
          new Date(session.staff.activatedAt),
          "d MMMM yyyy",
        )}
        initialPassportUrl={session.candidate.passportPhotoUrl}
      />
    </div>
  );
}
