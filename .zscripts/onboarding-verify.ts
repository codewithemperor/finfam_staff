// Stage 6 final integrity verification — Stage 6 writes must not have
// touched anything outside the two onboarding tables. Structural audit of
// every protected store (statuses, events, staff rows, appointments,
// agreements, orientations, assessments, applications, both sequences) plus
// the expected onboarding end-state for the two real fixtures.
//
// Run: set -a && source .env && set +a && bun .zscripts/onboarding-verify.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  const status = pass ? "PASS" : "FAIL";
  if (!pass) failures += 1;
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("=== 1. CANDIDATE STATUS INTEGRITY (no churn from onboarding) ===");
  const statuses = await db.candidate.groupBy({ by: ["status"], _count: true });
  const map = Object.fromEntries(statuses.map((s) => [s.status, s._count]));
  check("no new CandidateStatus values exist", Object.keys(map).every((k) =>
    ["APPLICANT", "ORIENTATION_PENDING", "ORIENTATION_COMPLETED", "ASSESSMENT_PENDING", "ASSESSMENT_PASSED", "ASSESSMENT_FAILED", "OFFER_PENDING", "OFFER_ACCEPTED", "OFFER_DECLINED", "APPOINTMENT_ISSUED", "ACTIVATION_PENDING", "APPROVED_STAFF"].includes(k),
  ));
  check("fixture statuses intact", map["APPROVED_STAFF"] === 2 && map["OFFER_PENDING"] === 1 && map["OFFER_ACCEPTED"] === 1 && map["APPLICANT"] === 1);
  const wv = await db.candidate.findUnique({ where: { referenceNumber: "FF-WVA24D" }, select: { status: true } });
  check("FF-WVA24D completed onboarding but status still APPROVED_STAFF", wv?.status === "APPROVED_STAFF");

  console.log("=== 2. STAGEEVENT INTEGRITY (recruitment-only timeline) ===");
  const events = await db.stageEvent.groupBy({ by: ["stage", "type"], _count: true });
  check("no onboarding events in StageEvent (stages remain the 6 recruitment stages)",
    events.every((e) => ["APPLICATION", "ORIENTATION", "ASSESSMENT", "OFFER", "APPOINTMENT", "ACTIVATION"].includes(e.stage)));
  const wvEvents = await db.stageEvent.findMany({
    where: { candidate: { referenceNumber: "FF-WVA24D" } },
    orderBy: { occurredAt: "asc" },
    select: { stage: true, type: true, description: true },
  });
  check("FF-WVA24D has exactly its 9 recruitment events (no onboarding events appended)",
    wvEvents.length === 9 &&
      wvEvents[0].stage === "ORIENTATION" && wvEvents[0].type === "ENTERED" &&
      wvEvents[1].stage === "ORIENTATION" && wvEvents[1].type === "COMPLETED" &&
      wvEvents[2].stage === "ASSESSMENT" && wvEvents[2].type === "ENTERED" &&
      wvEvents[3].stage === "ASSESSMENT" && wvEvents[3].type === "COMPLETED" &&
      wvEvents[4].stage === "OFFER" && wvEvents[4].type === "ENTERED" &&
      wvEvents[5].stage === "OFFER" && wvEvents[5].type === "COMPLETED" &&
      wvEvents[6].stage === "APPOINTMENT" &&
      wvEvents[7].stage === "ACTIVATION" && wvEvents[7].type === "ENTERED" &&
      wvEvents[8].stage === "ACTIVATION" && wvEvents[8].type === "COMPLETED",
    `count=${wvEvents.length}`);

  console.log("=== 3. STAFF ROWS IMMUTABLE ===");
  const staff = await db.staff.findMany({
    orderBy: { staffId: "asc" },
    include: { candidate: { select: { referenceNumber: true } } },
  });
  check("exactly 2 staff rows", staff.length === 2);
  const g = staff.find((s) => s.candidate.referenceNumber === "FF-GWSA26");
  const w = staff.find((s) => s.candidate.referenceNumber === "FF-WVA24D");
  check("FF-STF-0001 (FF-GWSA26) snapshots intact", g?.staffId === "FF-STF-0001" && g?.roleTitle === "Remote Staff" && g?.appointmentReference === "FFL/HR/PLA/013" && g?.version === "1.0");
  check("FF-STF-0002 (FF-WVA24D) snapshots intact", w?.staffId === "FF-STF-0002" && w?.roleTitle === "Remote Staff" && w?.appointmentReference === "FFL/HR/PLA/014" && w?.version === "1.0");

  console.log("=== 4. APPOINTMENTS / AGREEMENTS / ORIENTATION / ASSESSMENT / APPLICATIONS ===");
  const appts = await db.appointment.findMany({ select: { appointmentReference: true, roleTitle: true, version: true, printedName: true } });
  check("2 appointments intact (letters unchanged)", appts.length === 2 && appts.every((a) => a.roleTitle === "Remote Staff" && a.version === "1.0"));
  const agreements = await db.agreement.findMany({ select: { version: true } });
  check("agreements intact", agreements.length >= 2);
  const orientations = await db.orientation.count();
  check("orientation records intact", orientations >= 8);
  const attempts = await db.assessmentAttempt.count();
  check("assessment attempts intact", attempts >= 7, `attempts=${attempts}`);
  const applications = await db.application.count();
  check("applications intact", applications >= 10);

  console.log("=== 5. SEQUENCES (monotonic, untouched by onboarding) ===");
  const staffSeq = await db.staffIdSequence.findFirst();
  const maxStaffNum = Math.max(...staff.map((s) => parseInt(s.staffId.replace("FF-STF-", ""), 10)));
  check("staff ID sequence >= max allocated ID (monotonic; throwaway activations burned IDs)", (staffSeq?.value ?? 0) >= maxStaffNum, `seq=${staffSeq?.value} maxAllocated=${maxStaffNum}`);
  const apptSeq = await db.appointmentSequence.findFirst();
  check("appointment sequence monotonic (throwaway issuances burned numbers — never reused)", (apptSeq?.value ?? 0) >= 14, `value=${apptSeq?.value}`);

  console.log("=== 6. ONBOARDING END-STATE (the only tables Stage 6 writes) ===");
  const onboards = await db.staffOnboarding.findMany({
    include: { staff: { select: { staffId: true } }, steps: { orderBy: { completedAt: "asc" }, select: { stepId: true, completedAt: true } } },
  });
  const wvOn = onboards.find((o) => o.staff.staffId === "FF-STF-0002");
  const gOn = onboards.find((o) => o.staff.staffId === "FF-STF-0001");
  check("exactly 2 onboarding records (one per staff member)", onboards.length === 2);
  check("FF-WVA24D onboarding COMPLETED with version 1.0", wvOn?.completedAt != null && wvOn.version === "1.0");
  check("FF-WVA24D has all 7 steps in the approved order",
    wvOn != null && JSON.stringify(wvOn.steps.map((s) => s.stepId)) === JSON.stringify(["welcome", "communication", "resources", "engagement", "reporting", "standards", "ready"]),
    wvOn ? `steps=${wvOn.steps.map((s) => s.stepId).join(",")}` : "-");
  check("FF-WVA24D final step completed at the acknowledgement (same moment as completion)",
    wvOn != null && wvOn.completedAt != null &&
      Math.abs((wvOn.steps.find((s) => s.stepId === "ready")?.completedAt.getTime() ?? 0) - wvOn.completedAt.getTime()) < 1500);
  check("FF-GWSA26 onboarding entry-only (IN_PROGRESS, 0 steps, resume at welcome)",
    gOn != null && gOn.completedAt === null && gOn.steps.length === 0 && gOn.currentStepId === "welcome" && gOn.version === "1.0");
  const totalStepRows = await db.staffOnboardingStep.count();
  check("exactly 7 step rows exist in total", totalStepRows === 7, `rows=${totalStepRows}`);

  console.log(failures === 0 ? "\nINTEGRITY VERIFICATION PASSED" : `\n${failures} CHECK(S) FAILED`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("FATAL:", error);
  await db.$disconnect();
  process.exit(1);
});
