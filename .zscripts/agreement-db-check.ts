// Read-only verification snapshot for the Stage 3 reconciliation.
// Usage: set -a && source .env && set +a && bun .zscripts/agreement-db-check.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const candidates = await db.candidate.findMany({
  where: {
    referenceNumber: { in: ["FF-E9KUVN", "FF-QEY98E", "FF-WVA24D"] },
  },
  select: { referenceNumber: true, status: true, updatedAt: true },
  orderBy: { referenceNumber: "asc" },
});

const agreements = await db.agreement.findMany({
  select: {
    candidateId: true,
    version: true,
    acceptedAt: true,
    createdAt: true,
    updatedAt: true,
    candidate: { select: { referenceNumber: true } },
  },
  orderBy: { createdAt: "asc" },
});

const offerEvents = await db.stageEvent.groupBy({
  by: ["type"],
  _count: { _all: true },
  where: { stage: "OFFER" },
});

console.log(
  JSON.stringify(
    { candidates, agreements, offerEvents: offerEvents ?? [] },
    null,
    2,
  ),
);

await db.$disconnect();
