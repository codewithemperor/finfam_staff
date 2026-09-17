import "server-only";

import { isProduction } from "@/server/config/production";

export type ReleaseArea = "applicant" | "admin" | "staff";

interface ReleaseScheduleEntry {
  label: string;
  envName: string;
  defaultReleaseAt: string;
}

const RELEASE_SCHEDULE: Record<ReleaseArea, ReleaseScheduleEntry> = {
  applicant: {
    label: "Applicant flow",
    envName: "APPLICANT_RELEASE_AT",
    defaultReleaseAt: "2026-09-22T09:00:00+01:00",
  },
  admin: {
    label: "Admin portal",
    envName: "ADMIN_RELEASE_AT",
    defaultReleaseAt: "2026-09-28T09:00:00+01:00",
  },
  staff: {
    label: "Staff portal",
    envName: "STAFF_RELEASE_AT",
    defaultReleaseAt: "2026-10-07T09:00:00+01:00",
  },
};

export interface ReleaseDetails {
  area: ReleaseArea;
  label: string;
  releaseAt: Date;
}

/**
 * Release dates are enforced only in production. The environment override is
 * useful for a deployment that needs to move a release window without a code
 * change; the checked-in schedule remains the safe default.
 */
export function getReleaseDetails(area: ReleaseArea): ReleaseDetails {
  const schedule = RELEASE_SCHEDULE[area];
  const configuredValue = process.env[schedule.envName]?.trim();
  const releaseAtValue = configuredValue || schedule.defaultReleaseAt;
  const releaseAt = new Date(releaseAtValue);

  if (Number.isNaN(releaseAt.getTime())) {
    throw new Error(
      `${schedule.envName} must be a valid ISO date-time, for example ${schedule.defaultReleaseAt}.`,
    );
  }

  return { area, label: schedule.label, releaseAt };
}

export function isReleaseAvailable(area: ReleaseArea): boolean {
  if (!isProduction()) return true;
  return Date.now() >= getReleaseDetails(area).releaseAt.getTime();
}
