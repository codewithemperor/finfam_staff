-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('APPLICANT', 'ORIENTATION_PENDING', 'ORIENTATION_COMPLETED', 'ASSESSMENT_PENDING', 'ASSESSMENT_PASSED', 'ASSESSMENT_FAILED', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'APPOINTMENT_ISSUED', 'ACTIVATION_PENDING', 'APPROVED_STAFF');

-- CreateEnum
CREATE TYPE "RecruitmentStage" AS ENUM ('APPLICATION', 'ORIENTATION', 'ASSESSMENT', 'OFFER', 'APPOINTMENT', 'ACTIVATION');

-- CreateEnum
CREATE TYPE "StageEventType" AS ENUM ('ENTERED', 'COMPLETED', 'FAILED', 'NOTE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'APPLICANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_events" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" "RecruitmentStage" NOT NULL,
    "type" "StageEventType" NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidates_referenceNumber_key" ON "candidates"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");

-- CreateIndex
CREATE INDEX "applications_candidateId_idx" ON "applications"("candidateId");

-- CreateIndex
CREATE INDEX "stage_events_candidateId_occurredAt_idx" ON "stage_events"("candidateId", "occurredAt");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
