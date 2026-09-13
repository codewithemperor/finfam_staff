import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * GET /api/health — infrastructure health check (database connectivity).
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("[api] Health check failed:", error);
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
