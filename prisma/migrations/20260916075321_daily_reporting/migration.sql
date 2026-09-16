-- CreateEnum
CREATE TYPE "DailyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_REPORT_SUBMITTED';

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DailyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "individualsContacted" INTEGER NOT NULL DEFAULT 0,
    "groupsApproached" INTEGER NOT NULL DEFAULT 0,
    "followUpActivities" INTEGER NOT NULL DEFAULT 0,
    "newRegistrations" INTEGER NOT NULL DEFAULT 0,
    "establishedMembersCreated" INTEGER NOT NULL DEFAULT 0,
    "firstDepositsAchieved" INTEGER NOT NULL DEFAULT 0,
    "savingsGoalsActivated" INTEGER NOT NULL DEFAULT 0,
    "memberEngagement" INTEGER NOT NULL DEFAULT 0,
    "connectionsBuilt" INTEGER NOT NULL DEFAULT 0,
    "activitySummary" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_staffId_reportDate_key" ON "daily_reports"("staffId", "reportDate");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
