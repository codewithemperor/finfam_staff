// §36 part 2: NEW issuances use the (moved) current pointer; old letters stay v1.0.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const ref = "FF-APTHST";
await db.candidate.deleteMany({ where: { referenceNumber: ref } });
await db.candidate.create({
  data: {
    referenceNumber: ref, fullName: "Historical Integrity Verify",
    email: `${ref.toLowerCase()}@verify.example.com`, phone: "0700 000 0001",
    status: "OFFER_ACCEPTED",
    applications: { create: { roleTitle: "Staff Member" } },
    agreement: { create: { version: "1.1", acceptedAt: new Date() } },
  },
});
const res = await fetch("http://localhost:3000/api/appointment/" + ref);
const body = await res.json();
const a = body.data.appointment;
console.log("new issuance version:", a.version, "| ref:", a.appointmentReference, "| simulated content:", JSON.stringify(a.content).includes("SIMULATED FUTURE VERSION 1.1"));
console.log(a.version === "1.1" ? "PASS: new issuance uses new pointer" : "FAIL");
await db.candidate.deleteMany({ where: { referenceNumber: ref } });
console.log("throwaway cleaned");
await db.$disconnect();
