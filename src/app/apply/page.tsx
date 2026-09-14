import type { Metadata } from "next";

import { ApplyForm } from "@/components/forms/apply-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { OPEN_POSITION } from "@/config/content";
import { Alert } from "@heroui/react";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Complete your application for the FinFam Staff Member role.",
};

export default function ApplyPage() {
  return (
    <PageShell size="narrow">
      <PageHeader
        title={`Apply for the ${OPEN_POSITION.title} role`}
        description="Fill in your details below. You'll receive a reference number as soon as you submit — save it somewhere safe; it identifies your whole application journey."
      />

      <Alert status="accent" className="mt-6">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Before you start</Alert.Title>
          <Alert.Description>
            Have your contact details ready. After you submit, your reference
            number unlocks the orientation workshop — the first stage of the
            recruitment journey — and we contact every applicant by email.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="mt-8">
        <ApplyForm />
      </div>
    </PageShell>
  );
}
