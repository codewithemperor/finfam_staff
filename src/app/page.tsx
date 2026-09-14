
import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button-link";
import { PageShell } from "@/components/layout/page-shell";
import {
  ContinueApplicationForm,
} from "@/components/recruitment/continue-application-form";
import {
  RecruitmentProgress,
} from "@/components/recruitment/recruitment-progress";
import { OPEN_POSITION } from "@/config/content";
import { Alert } from "@heroui/react";

/**
 * Welcome page.
 *
 * Answers, in order: what is FinFam, what is the role, what does the work
 * involve, what to expect, and how to apply. Layout is deliberately flat —
 * strong typography and spacing instead of decoration.
 */
export default function WelcomePage() {
  return (
    <PageShell>
      {/* Introduction */}
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Join FinFam as a {OPEN_POSITION.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          FinFam is growing and we are recruiting {OPEN_POSITION.title}s.
          Complete your application to begin the FinFam recruitment process.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/apply">Apply now</ButtonLink>
          <ButtonLink href="/continue" variant="outline">
            Continue application
          </ButtonLink>
        </div>
      </section>

      {/* Continue Application — the single returning-candidate entry point.
          Same shared form as /continue; one journey, one reference. */}
      <section
        id="continue"
        className="mt-16 scroll-mt-20 border-t border-divider pt-10 sm:mt-20"
      >
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Already started an application?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Continue where you left off using your application reference.
            We&apos;ll take you straight to your current stage — you don&apos;t
            need to remember where you stopped.
          </p>
        </div>
        <div className="mt-6">
          <ContinueApplicationForm />
        </div>
      </section>

      {/* The role */}
      <section id="the-role" className="mt-16 scroll-mt-20 sm:mt-20">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          The role
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {OPEN_POSITION.summary}
        </p>

        <dl className="mt-6 grid max-w-2xl grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Position</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">
              {OPEN_POSITION.title}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Location</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">
              {OPEN_POSITION.location}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Commitment</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">
              {OPEN_POSITION.commitment}
            </dd>
          </div>
        </dl>

        <div className="mt-10 grid max-w-4xl grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What the work involves
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {OPEN_POSITION.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What we expect
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {OPEN_POSITION.expectations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Rewards */}
      <section id="rewards" className="mt-16 scroll-mt-20 sm:mt-20">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Responsibility and reward
        </h2>
        {OPEN_POSITION.rewardsPending ? (
          <Alert status="accent" className="mt-4 max-w-2xl">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Reward figures are being finalised.</Alert.Title>
              <Alert.Description>{OPEN_POSITION.rewardsNote}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {OPEN_POSITION.rewardsNote}
          </p>
        )}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Candidates who reach the offer stage receive the full responsibility
          and reward policy before deciding whether to accept.
        </p>
      </section>

      {/* Process */}
      <section id="process" className="mt-16 scroll-mt-20 sm:mt-20">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          How the recruitment process works
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Every candidate moves through the same six stages. After you apply,
          you can check where you are at any time using your reference number.
        </p>
        <RecruitmentProgress
          currentStage="APPLICATION"
          className="mt-8 max-w-md"
        />
      </section>

      {/* Closing call to action */}
      <section className="mt-16 border-t border-divider pt-10 sm:mt-20">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ready to apply?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Complete your application to begin the FinFam recruitment process.
            It takes a few minutes.
          </p>
          <ButtonLink href="/apply" className="mt-6">
            Apply now
          </ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
