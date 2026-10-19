import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StaffResourcesView } from "@/components/staff/staff-resources-view";
import { STAFF_COMMUNICATION_REFERENCE } from "@/config/staff-resources";
import { getStaffSession } from "@/lib/auth/session";
import { listStaffResources } from "@/server/services/staff-resources";

export const metadata: Metadata = {
  title: "Staff Resources — FinFam Staff Portal",
  description:
    "The approved FinFam staff resources, with honest availability — real portal destinations where they exist, downloadable resources where supplied.",
};

/**
 * /staff/resources — the Staff resource library.
 *
 * Displays approved FinFam materials for staff members. Staff can preview and download
 * resources uploaded by administrators under each category.
 */
export default async function StaffResourcesPage() {
  const session = await getStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  const uploadedResources = await listStaffResources();

  return (
    <div className="max-w-3xl">
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
        <div className="mt-4">
          <StaffResourcesView
            uploadedResources={uploadedResources.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        </div>
      </section>

      {/* Communication reference — channel context */}
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
        Availability is shown honestly for your account ({session.staff.staffId}) — a
        resource is only listed with a download action when it really exists.
      </p>
    </div>
  );
}
