-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "appointmentReference" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_id_sequences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "staff_id_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_candidateId_key" ON "staff"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_staffId_key" ON "staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_id_sequences_name_key" ON "staff_id_sequences"("name");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Seed the singleton Staff ID sequence.
--
-- Approved Stage 5 MVP convention (docs/CONTENT-QUESTIONS.md §30): `value`
-- holds the LAST allocated number and starts at 0, so the first
-- system-issued Staff ID becomes FF-STF-0001. No candidate is activated by
-- this migration and no Staff ID is assigned here — Staff rows are created
-- only by the explicit, server-validated activation action. Idempotent:
-- existing rows are kept.
-- ---------------------------------------------------------------------------
INSERT INTO "staff_id_sequences" ("id", "name", "value")
VALUES ('seq_staff_id', 'STAFF_ID', 0)
ON CONFLICT ("name") DO NOTHING;
