import type { Metadata } from "next";
import { format } from "date-fns";
import { Alert } from "@heroui/react";

import { ButtonLink } from "@/components/ui/button-link";
import { STAFF_PORTAL_OPERATIONAL_ROLE } from "@/config/staff-portal";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profile — FinFam Staff Portal",
  description:
    "Your FinFam staff identity — read-only in the Staff Portal.",
};

/**
 * /staff/profile — read-only identity summary (Stage 7, brief §43).
 * Only safe staff identity facts are shown, resolved from the session
 * chain. Deliberately NOT editable (no self-service email change), and
 * there is nothing sensitive to expose: the platform never stores NIN,
 * BVN, bank details, next-of-kin or identity documents anywhere.
 */
export default async function StaffProfilePage() {
  const session = await getStaffSession();
  if (!session) return null;

  return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Profile
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Your staff identity, exactly as recorded by FinFam. This page is
          read-only — contact the onboarding team if something needs
          correcting.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] lg:items-start">
        <dl className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Full name</dt>
            <dd className="text-sm font-semibold text-foreground">
              {session.candidate.fullName}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">
              Login email address
            </dt>
            <dd className="text-right text-sm font-semibold text-foreground">
              {session.candidate.email}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Staff ID</dt>
            <dd className="font-mono text-sm font-semibold tracking-wider text-foreground">
              {session.staff.staffId}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">
              Appointment designation
            </dt>
            <dd className="text-sm font-semibold text-foreground">
              {session.staff.roleTitle}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Operational role</dt>
            <dd className="text-sm font-semibold text-foreground">
              {STAFF_PORTAL_OPERATIONAL_ROLE}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">
              Appointment reference
            </dt>
            <dd className="text-right font-mono text-sm font-semibold tracking-wider text-foreground">
              {session.staff.appointmentReference}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Activated</dt>
            <dd className="text-sm font-semibold text-foreground">
              {format(new Date(session.staff.activatedAt), "d MMMM yyyy")}
            </dd>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Account status</dt>
            <dd className="text-sm font-semibold text-foreground">
              {session.account.status}
              <span className="sr-only"> — portal account status</span>
            </dd>
          </div>
        </dl>

        <div className="space-y-6">
          {/* Staff ID Card entry point (Stage 10, brief §30) — a short
              explanation and the action only. Profile stays read-only; no
              Staff data is duplicated or made editable. */}
          <section
            aria-labelledby="profile-id-card"
            className="rounded-lg border border-border bg-surface p-6"
          >
          <h2
            id="profile-id-card"
            className="text-sm font-semibold text-foreground"
          >
            Staff ID Card
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">
            A printable identity representation generated from your verified
            Staff Portal records — the same identity shown above.
          </p>
          <div className="mt-4">
            <ButtonLink href="/staff/id-card" variant="outline" size="sm">
              View Staff ID Card
            </ButtonLink>
          </div>
          </section>

        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Security</Alert.Title>
            <Alert.Description>
              Signing in uses a secure 6-digit code sent to your login email —
              there is no password. If you lose access to that email address,
              contact FinFam support; recovery is handled offline.
            </Alert.Description>
          </Alert.Content>
        </Alert>
        </div>
        </div>
      </div>
    
  );
}
