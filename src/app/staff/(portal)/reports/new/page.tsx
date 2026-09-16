import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStaffSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createOrGetDailyReport } from "@/server/services/daily-reports";

export const metadata: Metadata = {
  title: "Start a daily report — FinFam Staff Portal",
  robots: { index: false },
};

/**
 * /staff/reports/new — the START action for today's report (Stage 8).
 *
 * This page renders nothing: it resolves the report to work on through
 * the race-safe create-or-get service (no date input — the server decides
 * it is Africa/Lagos TODAY) and redirects to its editor. Two tabs, a
 * double-click or a racing retry all end at the SAME one report row.
 *
 * If today already holds a SUBMITTED report, the redirect simply opens
 * its read-only view — the page never offers a second report for a date.
 * An authenticated staff member with incomplete onboarding is redirected
 * to the onboarding flow (the service's 403 FORBIDDEN → /staff/onboarding).
 */
export default async function NewDailyReportPage() {
  const session = await getStaffSession();
  if (!session) {
    // The layout already guards this — defensive double-check.
    redirect("/staff/login");
  }

  let reportId: string;
  try {
    const result = await createOrGetDailyReport(session);
    reportId = result.report.id;
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      redirect("/staff/onboarding");
    }
    throw error;
  }

  redirect(`/staff/reports/${reportId}`);
}
