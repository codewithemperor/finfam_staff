// Read-only DB snapshot for Stage 4 verification (mirrors agreement-db-check.ts).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const seq = await db.appointmentSequence.findMany();
const appts = await db.appointment.findMany({ include: { candidate: { select: { referenceNumber: true, status: true } } } });
const apptEvents = await db.stageEvent.findMany({ where: { stage: "APPOINTMENT" } });
console.log(JSON.stringify({ sequences: seq, appointments: appts, appointmentEvents: apptEvents }, null, 2));
await db.$disconnect();
