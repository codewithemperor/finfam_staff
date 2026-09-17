-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_events_bucket_clientKey_createdAt_idx" ON "rate_limit_events"("bucket", "clientKey", "createdAt");

-- CreateIndex
CREATE INDEX "daily_reports_status_reportDate_idx" ON "daily_reports"("status", "reportDate");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_createdAt_idx" ON "notification_deliveries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "staff_activatedAt_idx" ON "staff"("activatedAt");
