import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getOfficialWhatsappGroupLink } from "@/server/services/system-settings";

export const metadata: Metadata = {
  title: "Settings · FinFam Admin",
  description: "Configure system-wide settings, including the official Staff WhatsApp group link.",
};

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const initialWhatsappGroupLink = await getOfficialWhatsappGroupLink();

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        System Configuration
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Settings
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Manage platform-wide settings, official communication channels, and staff access links.
      </p>

      <div className="mt-8">
        <AdminSettingsForm initialWhatsappGroupLink={initialWhatsappGroupLink} />
      </div>
    </div>
  );
}
