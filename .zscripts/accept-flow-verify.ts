// Throwaway write-path verification for the Stage 3 reconciliation.
// Usage: set -a && source .env && set +a && bun .zscripts/accept-flow-verify.ts seed|state|cleanup
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const mode = process.argv[2] ?? "seed";
const REF = "FF-RECCHK";

if (mode === "seed") {
  await db.candidate.deleteMany({ where: { referenceNumber: REF } });
  const c = await db.candidate.create({
    data: {
      referenceNumber: REF,
      fullName: "Reconciliation Write Path Check",
      email: "rec-check+writepath@example.com",
      phone: "+234000000000",
      city: "Lagos",
      status: "ASSESSMENT_PASSED",
      applications: { create: { roleTitle: "Staff Member" } },
    },
  });
  console.log("seeded", c.referenceNumber, c.status);
} else if (mode === "state") {
  const c = await db.candidate.findUnique({
    where: { referenceNumber: REF },
    select: {
      referenceNumber: true,
      status: true,
      agreement: { select: { version: true, acceptedAt: true } },
      events: {
        where: { stage: "OFFER" },
        orderBy: { occurredAt: "asc" },
        select: { type: true, description: true },
      },
    },
  });
  console.log(JSON.stringify(c, null, 1));
} else if (mode === "cleanup") {
  await db.candidate.deleteMany({ where: { referenceNumber: REF } });
  const left = await db.candidate.findUnique({ where: { referenceNumber: REF } });
  const orphanAgreements = await db.agreement.count({
    where: { candidate: { referenceNumber: REF } },
  });
  console.log(
    "cleanup done; candidate remains:",
    left === null ? 0 : 1,
    "| orphan agreement rows:",
    orphanAgreements,
  );
}

await db.$disconnect();
