import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminResourcesView } from "@/components/admin/resources/admin-resources-view";
import { getAdminSession } from "@/lib/auth/admin-session";
import { listStaffResources } from "@/server/services/staff-resources";

export const metadata: Metadata = {
  title: "Resources · FinFam Admin",
  description: "Upload and manage downloadable marketing, training, and operational resources for staff.",
};

export default async function AdminResourcesPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const resources = await listStaffResources();

  return (
    <div className="max-w-6xl">
      <AdminResourcesView
        initialResources={resources.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
