import type { Metadata } from "next";

import {
  STAFF_RESOURCES_PENDING_NOTICE,
  STAFF_RESOURCE_CATEGORIES,
} from "@/config/staff-portal";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Resources — FinFam Staff Portal",
  description:
    "The staff resources FinFam provides through your approved communication/onboarding channel.",
};

/**
 * /staff/resources — honest resource status (Stage 7, brief §42). No real
 * resource assets exist yet, so this page LIST ONLY the approved categories
 * with the honest availability copy — no fabricated downloads, no dead
 * links. The architecture is ready for future real assets (a future
 * StaffResource model would slot in here without changing the page shape).
 */
export default async function StaffResourcesPage() {
  const session = await getStaffSession();

  return (
          <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Staff Resources
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          The resources FinFam provides to staff members as part of
          onboarding and ongoing work.
        </p>

        <section
          aria-labelledby="resources-list"
          className="mt-8 rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="resources-list" className="text-sm font-semibold text-foreground">
            Provided resources
          </h2>
          <ul className="mt-4 space-y-3">
            {STAFF_RESOURCE_CATEGORIES.map((category) => (
              <li
                key={category}
                className="flex items-start gap-3 text-[15px] leading-7 text-foreground"
              >
                <span
                  aria-hidden
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                {category}
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-divider pt-5 text-sm leading-6 text-muted-foreground">
            {STAFF_RESOURCES_PENDING_NOTICE}
          </p>
        </section>

        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          {session
            ? `Availability for your account (${session.staff.staffId}) is shown honestly — nothing is listed as downloadable until the business supplies real assets.`
            : ""}
        </p>
      </div>
    
  );
}
