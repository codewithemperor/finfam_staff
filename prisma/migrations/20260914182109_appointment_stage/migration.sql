-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "appointmentReference" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "printedName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_sequences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "appointment_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointments_candidateId_key" ON "appointments"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointmentReference_key" ON "appointments"("appointmentReference");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_sequences_name_key" ON "appointment_sequences"("name");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Seed the singleton appointment sequence.
--
-- Documented assumption (docs/CONTENT-QUESTIONS.md §22): the supplied
-- official sample letter FFL/HR/PLA/012 is treated as the most recently
-- existing appointment reference. The sample itself is an externally
-- issued document and is deliberately NOT inserted into the database.
-- `value` holds the LAST allocated number, so the first system-issued
-- appointment becomes FFL/HR/PLA/013. Idempotent: existing rows are kept.
-- ---------------------------------------------------------------------------
INSERT INTO "appointment_sequences" ("id", "name", "value")
VALUES ('seq_provisional_appointment', 'PROVISIONAL_APPOINTMENT', 12)
ON CONFLICT ("name") DO NOTHING;
