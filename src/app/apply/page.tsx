import type { Metadata } from "next";
import { Alert } from "@heroui/react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { ApplyForm } from "@/components/forms/apply-form";
import { PageShell } from "@/components/layout/page-shell";
import { OPEN_POSITION } from "@/config/content";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Complete your application for the FinFam Marketing & Customer Care Executive role.",
};

const nextSteps = [
  "Submit your bio data, educational details, and upload credentials.",
  "Save the reference number shown after submission.",
  "Continue to the orientation workshop from your confirmation screen.",
];

const guidance = [
  "Use your real name, contact address, and reachable details.",
  "Upload clear credentials (CV, passport photo, and national ID).",
  "Keep your reference number private and easy to find.",
  "Return with the same reference whenever you need to continue.",
];

export default function ApplyPage() {
  return (
    <PageShell size="wide" className="bg-surface/40">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_26rem]">
        <main className="min-w-0 rounded-lg border border-border bg-background p-5 shadow-sm sm:p-7 lg:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-primary">
              Application form
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Apply for the {OPEN_POSITION.title} role
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Fill in your bio data, educational background, and upload your
              credentials below. You will receive a reference number as soon as
              you submit; save it somewhere safe because it identifies your full
              recruitment journey.
            </p>
          </div>

          <Alert status="accent" className="mt-6">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Before you start</Alert.Title>
              <Alert.Description>
                Have your contact details, educational details, and credentials
                (CV, passport photo, and national means of ID) ready.
                After you submit, your reference number unlocks the orientation
                workshop, the first stage of the recruitment journey.
              </Alert.Description>
            </Alert.Content>
          </Alert>

          <div className="mt-8 max-w-2xl">
            <ApplyForm />
          </div>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-8">
          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-accent/10 text-primary">
                <ClipboardList className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Application information
                </h2>
                <p className="text-sm text-muted-foreground">
                  {OPEN_POSITION.location} · {OPEN_POSITION.commitment}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {OPEN_POSITION.summary}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" aria-hidden />
              <h2 className="text-base font-bold text-foreground">
                What happens next
              </h2>
            </div>
            <ol className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <h2 className="text-base font-bold text-foreground">
                Applicant guidance
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {guidance.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" aria-hidden />
              <h2 className="text-base font-bold text-foreground">
                Email updates
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              FinFam uses your submitted email address for application updates
              and sign-in codes later in the process. Check it carefully before
              submitting.
            </p>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
