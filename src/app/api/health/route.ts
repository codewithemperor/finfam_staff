import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { getProductionConfigSummary } from "@/server/config/production";

/**
 * GET /api/health — infrastructure health check (database connectivity).
 *
 * Production-readiness remediation (§30/§46): the payload also carries a
 * MASKED production-config summary (booleans only — never secret values)
 * so a deployment smoke test immediately detects dev OTP echo left on, a
 * missing/non-HTTPS APP_BASE_URL, or notifications enabled without Mailjet
 * credentials.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      config: getProductionConfigSummary(),
    });
  } catch (error) {
    logServerError("api/health", error);
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
