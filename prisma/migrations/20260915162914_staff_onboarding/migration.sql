-- CreateTable
CREATE TABLE "staff_onboarding" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "currentStepId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_onboarding_steps" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_onboarding_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_onboarding_staffId_key" ON "staff_onboarding"("staffId");

-- CreateIndex
CREATE INDEX "staff_onboarding_steps_onboardingId_idx" ON "staff_onboarding_steps"("onboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_onboarding_steps_onboardingId_stepId_key" ON "staff_onboarding_steps"("onboardingId", "stepId");

-- AddForeignKey
ALTER TABLE "staff_onboarding" ADD CONSTRAINT "staff_onboarding_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_onboarding_steps" ADD CONSTRAINT "staff_onboarding_steps_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "staff_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
