import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Alert } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";
import { PageShell } from "@/components/layout/page-shell";
import { ContinueApplicationForm } from "@/components/recruitment/continue-application-form";
import { RecruitmentProgress } from "@/components/recruitment/recruitment-progress";
import { OPEN_POSITION } from "@/config/content";

const quickFacts = [
  {
    label: "Role",
    value: OPEN_POSITION.title,
    icon: ClipboardCheck,
  },
  {
    label: "Location",
    value: OPEN_POSITION.location,
    icon: MapPin,
  },
  {
    label: "Commitment",
    value: OPEN_POSITION.commitment,
    icon: Clock3,
  },
];

const processHighlights = [
  "Apply and receive your reference number.",
  "Complete orientation and assessment steps online.",
  "Review the agreement before accepting the role.",
];

/**
 * Landing page.
 *
 * This page gives new candidates a confident first step and gives returning
 * candidates an obvious recovery path without hiding the role details.
 */
export default function WelcomePage() {
  return (
    <PageShell size="wide" className="bg-surface/40">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            FinFam recruitment portal
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Apply to become a FinFam {OPEN_POSITION.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start your application, move through each recruitment step, and
            return anytime with your reference number. The portal keeps your
            journey clear from application to staff activation.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/apply" size="lg" className="gap-2">
              Apply now
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/continue" size="lg" variant="outline">
              Continue application
            </ButtonLink>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {quickFacts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.label}
                  className="rounded-md border border-border bg-surface p-4"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="size-4 text-primary" aria-hidden />
                    {fact.label}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {fact.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <aside
          aria-labelledby="returning-candidates"
          className="rounded-lg border border-border bg-background p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent/10 text-primary">
              <FileText className="size-5" aria-hidden />
            </span>
            <div>
              <h2
                id="returning-candidates"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                Already applied?
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Enter your reference number and we will open your current
                recruitment stage.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ContinueApplicationForm />
          </div>
        </aside>
      </section>

      <section
        id="the-role"
        className="mt-10 grid gap-8 rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Open role
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What the role is about
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            {OPEN_POSITION.summary}
          </p>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                <h3 className="text-base font-semibold text-foreground">
                  What the work involves
                </h3>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                {OPEN_POSITION.responsibilities.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                <h3 className="text-base font-semibold text-foreground">
                  What we expect
                </h3>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                {OPEN_POSITION.expectations.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-md bg-surface p-5">
          <h3 className="text-base font-semibold text-foreground">
            Before you apply
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            {processHighlights.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href="/apply" className="mt-6" fullWidth>
            Start application
          </ButtonLink>
        </div>
      </section>

      <section
        id="process"
        className="mt-10 grid gap-8 rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8 lg:grid-cols-[22rem_minmax(0,1fr)]"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Recruitment process
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            A clear path from application to activation
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Every candidate follows the same staged journey. Your reference
            number lets you continue from the exact point you reached.
          </p>
        </div>
        <RecruitmentProgress currentStage="APPLICATION" className="max-w-xl" />
      </section>

      <section
        id="rewards"
        className="mt-10 rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Responsibility and reward
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Review the terms before you accept
          </h2>
          {OPEN_POSITION.rewardsPending ? (
            <Alert status="accent" className="mt-5">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Reward figures are being finalised.</Alert.Title>
                <Alert.Description>
                  {OPEN_POSITION.rewardsNote}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {OPEN_POSITION.rewardsNote}
            </p>
          )}
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Candidates who reach the agreement stage review the full
            Responsibility &amp; Reward Agreement before deciding whether to
            accept.
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-lg bg-foreground p-6 text-background sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to begin?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-background/75">
              Complete the application form and keep your reference number
              safe. You will use it to continue your recruitment journey.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <ButtonLink href="/apply" variant="secondary">
              Apply now
            </ButtonLink>
            <ButtonLink
              href="/continue"
              variant="outline"
              className="border-background/50 text-background hover:bg-background/10"
            >
              Continue
            </ButtonLink>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
