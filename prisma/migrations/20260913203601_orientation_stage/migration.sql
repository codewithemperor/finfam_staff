-- CreateTable
CREATE TABLE "orientations" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "currentSectionId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orientations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientation_sections" (
    "id" TEXT NOT NULL,
    "orientationId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orientation_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orientations_candidateId_key" ON "orientations"("candidateId");

-- CreateIndex
CREATE INDEX "orientation_sections_orientationId_idx" ON "orientation_sections"("orientationId");

-- CreateIndex
CREATE UNIQUE INDEX "orientation_sections_orientationId_sectionId_key" ON "orientation_sections"("orientationId", "sectionId");

-- AddForeignKey
ALTER TABLE "orientations" ADD CONSTRAINT "orientations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientation_sections" ADD CONSTRAINT "orientation_sections_orientationId_fkey" FOREIGN KEY ("orientationId") REFERENCES "orientations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
