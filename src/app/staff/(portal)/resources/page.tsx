import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import {
  STAFF_COMMUNICATION_REFERENCE,
  STAFF_RESOURCES,
  STAFF_RESOURCE_AVAILABILITY_LABELS,
} from "@/config/staff-resources";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Resources — FinFam Staff Portal",
  description:
    "The approved FinFam staff resources, with honest availability — real portal destinations where they exist, honest copy everywhere else.",
};

/**
 * /staff/resources — the real Staff resource library (Stage 10, brief §9).
 *
 * Rendered ENTIRELY from the source-controlled registry
 * (src/config/staff-resources.ts). Categories appear in approved order;
 * only real in-portal destinations render an action link; everything else
 * shows honest availability copy. There are ZERO file-backed entries
 * today, so this page can never render a fabricated or disabled download
 * button (brief §5) — pinned by tests. No second resources area exists:
 * this page IS the library (brief §9).
 */
export default async function StaffResourcesPage() {
  const session = await getStaffSession();
  if (!session) {
    // Page-level self-gate: in this runtime the layout redirect and the
    // page render run in PARALLEL, so the page must never emit content
    // for a missing session (brief §5/§25 — never rely on UI hiding).
    redirect("/staff/login");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Staff Resources
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        The approved FinFam materials for staff members, and where you
        receive them. Only real, available resources show an action —
        everything else states honestly how it is provided.
      </p>

      <section
        aria-labelledby="resources-list"
        className="mt-8 rounded-lg border border-border bg-surface p-6"
      >
        <h2 id="resources-list" className="text-sm font-semibold text-foreground">
          Resource categories
        </h2>
        <ul className="mt-4 divide-y divide-divider">
          {STAFF_RESOURCES.map((entry) => (
            <li key={entry.id} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {entry.title}
                </h3>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STAFF_RESOURCE_AVAILABILITY_LABELS[entry.availability]}
                  <span className="sr-only"> — {entry.title} availability</span>
                </p>
              </div>
              <p className="mt-1.5 max-w-[64ch] text-sm leading-6 text-muted-foreground">
                {entry.description}
              </p>
              {entry.availability === "in_portal" && entry.href && (
                <div className="mt-3">
                  <ButtonLink href={entry.href} variant="outline" size="sm">
                    {entry.actionLabel}
                  </ButtonLink>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Communication reference — channel context, never a fabricated
          link (brief §6). */}
      <section
        aria-labelledby="resources-communication"
        className="mt-6 rounded-lg border border-border bg-surface p-6"
      >
        <h2
          id="resources-communication"
          className="text-sm font-semibold text-foreground"
        >
          {STAFF_COMMUNICATION_REFERENCE.title}
        </h2>
        <p className="mt-2 max-w-[64ch] text-sm leading-6 text-muted-foreground">
          {STAFF_COMMUNICATION_REFERENCE.copy}
        </p>
      </section>

      <p className="mt-6 max-w-[64ch] text-sm leading-6 text-muted-foreground">
        Availability is shown honestly for your account
        {session ? ` (${session.staff.staffId})` : ""} — a resource is only
        listed with an action when it really exists. Nothing becomes
        downloadable until the business supplies the approved file.
      </p>
    </div>
  );
}
