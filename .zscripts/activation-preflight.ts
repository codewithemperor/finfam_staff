// Stage 5 preflight verification — READ-ONLY paths + stage entry + security
// failures only. Does NOT allocate any Staff ID (the first activation is
// reserved for the browser E2E golden path). Real fixtures are never mutated
// beyond the designed lazy stage entry on FF-GWSA26.
//
// Run: set -a && source .env && set +a && bun .zscripts/activation-preflight.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  const status = pass ? "PASS" : "FAIL";
  if (!pass) failures += 1;
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

async function get(path: string): Promise<{ status: number; body: Envelope<unknown> }> {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: (await res.json()) as Envelope<unknown> };
}

async function post(path: string, body: unknown): Promise<{ status: number; body: Envelope<unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Envelope<unknown> };
}

type ActivationView = {
  referenceNumber: string;
  fullName: string;
  status: string;
  eligible: boolean;
  appointment: { appointmentReference: string; roleTitle: string; issuedAt: string } | null;
  staff: { staffId: string; version: string; roleTitle: string; activatedAt: string } | null;
  content: { version: string; intro: string; acknowledgementLabel: string; sections: { id: string; title: string }[] };
};

type JourneyView = {
  referenceNumber: string;
  status: string;
  stages: { id: string; label: string; state: string }[];
  currentStage: string | null;
  nextAction: { label: string; href: string } | null;
  upcomingNote: string | null;
  staffRecord: { staffId: string; roleTitle: string; activatedAt: string } | null;
  appointmentRecord: { appointmentReference: string } | null;
};

async function main() {
  const staffCountBefore = await db.staff.count();
  const activationEventsBefore = await db.stageEvent.count({ where: { stage: "ACTIVATION" } });
  console.log(`before: staffRows=${staffCountBefore} activationEvents=${activationEventsBefore}`);

  /* ---- 1. Unknown + malformed references → neutral 404, nothing written - */
  const unknown = await get("/api/activation/FF-ZZZZZZ");
  check("unknown reference → 404 NOT_FOUND", unknown.status === 404 && !unknown.body.ok && (unknown.body as { error: { code: string } }).error.code === "NOT_FOUND");
  const malformed = await get("/api/activation/not-a-reference");
  check("malformed reference → 404", malformed.status === 404 && !malformed.body.ok);
  const lower = await get("/api/activation/ff-gwsa26");
  check("lowercase reference normalises → 200", lower.status === 200 && lower.body.ok);
  const staffAfterUnknown = await db.staff.count();
  check("unknown/malformed reads created no Staff rows", staffAfterUnknown === staffCountBefore);

  /* ---- 2. Ineligible candidates → eligible:false, nothing written ------- */
  const ineligibleRefs: [string, string][] = [
    ["FF-Z4KNTU", "APPLICANT"],
    ["FF-M8RDV2", "ORIENTATION_PENDING"],
    ["FF-P3KQ7M", "ORIENTATION_COMPLETED"],
    ["FF-89C68X", "ASSESSMENT_PENDING"],
    ["FF-6JUYHG", "ASSESSMENT_FAILED"],
    ["FF-UEPKGX", "ASSESSMENT_PENDING"],
    ["FF-QEY98E", "OFFER_PENDING"],
    ["FF-E9KUVN", "OFFER_ACCEPTED"],
  ];
  for (const [ref, label] of ineligibleRefs) {
    const res = await get(`/api/activation/${ref}`);
    const data = res.body.ok ? (res.body.data as ActivationView) : null;
    check(
      `ineligible ${label} → eligible:false, no appointment/staff`,
      res.status === 200 && res.body.ok && data!.eligible === false && data!.appointment === null && data!.staff === null,
    );
    // Wrong-stage POST must 409 and write nothing.
    const postRes = await post(`/api/activation/${ref}/activate`, { acknowledgement: true, version: "1.0" });
    check(
      `wrong-stage POST ${label} → 409 CONFLICT`,
      postRes.status === 409 && !postRes.body.ok && (postRes.body as { error: { code: string } }).error.code === "CONFLICT",
    );
  }
  const eventsForIneligible = await db.stageEvent.count({
    where: { stage: "ACTIVATION", candidate: { referenceNumber: { in: ineligibleRefs.map(([r]) => r) } } },
  });
  check("no ACTIVATION events for ineligible candidates", eventsForIneligible === 0);

  /* ---- 3. Journey BEFORE entry (FF-WVA24D still APPOINTMENT_ISSUED) ----- */
  const journeyRes = await get("/api/journey/FF-WVA24D");
  const journey = journeyRes.body.ok ? (journeyRes.body.data as JourneyView) : null;
  check("journey APPOINTMENT_ISSUED → currentStage ACTIVATION", journey?.currentStage === "ACTIVATION");
  check("journey APPOINTMENT_ISSUED → CTA Continue to Staff Activation", journey?.nextAction?.label === "Continue to Staff Activation" && journey?.nextAction?.href === "/activation/FF-WVA24D");
  check("journey APPOINTMENT_ISSUED → staffRecord null", journey?.staffRecord === null);
  check("journey APPOINTMENT_ISSUED → appointment + 4 earlier stages completed",
    journey?.stages.filter((s) => ["APPLICATION", "ORIENTATION", "ASSESSMENT", "OFFER", "APPOINTMENT"].includes(s.id)).every((s) => s.state === "completed") === true);
  check("journey APPOINTMENT_ISSUED → activation current, onboarding-free stepper",
    journey?.stages.find((s) => s.id === "ACTIVATION")?.state === "current");

  /* ---- 4. Lazy stage entry on FF-GWSA26 (APPOINTMENT_ISSUED) ------------ */
  const entry1 = await get("/api/activation/FF-GWSA26");
  const entry1Data = entry1.body.ok ? (entry1.body.data as ActivationView) : null;
  check("first open → 200 with view", entry1.status === 200 && entry1.body.ok && entry1Data !== null);
  check("first open → eligible:true", entry1Data?.eligible === true);
  check("first open → status transitioned to ACTIVATION_PENDING", entry1Data?.status === "ACTIVATION_PENDING");
  check("first open → appointment context present (ref/role/date)", entry1Data?.appointment?.appointmentReference === "FFL/HR/PLA/013" && entry1Data?.appointment?.roleTitle === "Remote Staff" && typeof entry1Data?.appointment?.issuedAt === "string");
  check("first open → staff still null (viewing never activates)", entry1Data?.staff === null);
  check("first open → content v1.0 with acknowledgement label + 3 sections",
    entry1Data?.content?.version === "1.0" &&
    entry1Data?.content?.acknowledgementLabel === "I confirm that I am ready to activate my FinFam staff profile and proceed to onboarding." &&
    entry1Data?.content?.sections?.length === 3);
  const enteredCount1 = await db.stageEvent.count({ where: { stage: "ACTIVATION", candidate: { referenceNumber: "FF-GWSA26" } } });
  check("first open → exactly ONE ACTIVATION/ENTERED event", enteredCount1 === 1);

  const entry2 = await get("/api/activation/FF-GWSA26");
  const entry2Data = entry2.body.ok ? (entry2.body.data as ActivationView) : null;
  check("repeat open → still eligible, still ACTIVATION_PENDING", entry2Data?.eligible === true && entry2Data?.status === "ACTIVATION_PENDING");
  const enteredCount2 = await db.stageEvent.count({ where: { stage: "ACTIVATION", candidate: { referenceNumber: "FF-GWSA26" } } });
  check("repeat open → NO second ENTERED event", enteredCount2 === 1);
  const gwsaStaff = await db.staff.count({ where: { candidate: { referenceNumber: "FF-GWSA26" } } });
  check("openings created NO Staff row", gwsaStaff === 0);

  /* ---- 5. Security: invalid POST bodies rejected BEFORE any service write */
  const noAck = await post("/api/activation/FF-GWSA26/activate", { version: "1.0" });
  check("acknowledgement missing → 422 VALIDATION_ERROR", noAck.status === 422 && !noAck.body.ok && (noAck.body as { error: { code: string } }).error.code === "VALIDATION_ERROR");
  const falseAck = await post("/api/activation/FF-GWSA26/activate", { acknowledgement: false, version: "1.0" });
  check("acknowledgement false → 422", falseAck.status === 422 && !falseAck.body.ok);
  const staleVersion = await post("/api/activation/FF-GWSA26/activate", { acknowledgement: true, version: "9.9" });
  check("stale version echo → 422", staleVersion.status === 422 && !staleVersion.body.ok);
  // NOTE: a VALID body with extra client-supplied fields (staffId/status) is
  // deliberately NOT tested here — Zod strips unknown keys, so it would
  // reach the service and activate this real fixture. That behaviour
  // (client fields ignored, server allocates) is verified on a throwaway
  // candidate in activation-verify.ts instead.
  const staffStillZero = await db.staff.count();
  check("failed POSTs wrote no Staff rows", staffStillZero === 0);
  const eventsStillOne = await db.stageEvent.count({ where: { stage: "ACTIVATION", candidate: { referenceNumber: "FF-GWSA26" } } });
  check("failed POSTs wrote no extra events", eventsStillOne === 1);

  /* ---- 6. Sensitive fields absent from every payload -------------------- */
  const raw = JSON.stringify(entry1Data);
  const sensitive = ["NIN", "BVN", "bank", "nextOfKin", "next_of_kin", "identityNumber", "bvn", "accountNumber"];
  check("payload contains no sensitive fields", sensitive.every((s) => !raw.includes(s)));

  /* ---- 7. Journey for entered state (FF-GWSA26 now ACTIVATION_PENDING) -- */
  const journey2Res = await get("/api/journey/FF-GWSA26");
  const journey2 = journey2Res.body.ok ? (journey2Res.body.data as JourneyView) : null;
  check("journey ACTIVATION_PENDING → currentStage ACTIVATION", journey2?.currentStage === "ACTIVATION");
  check("journey ACTIVATION_PENDING → CTA Continue to Staff Activation", journey2?.nextAction?.label === "Continue to Staff Activation");
  check("journey ACTIVATION_PENDING → honest in-progress nextStep", (journey2?.upcomingNote ?? "").includes("Staff activation is in progress") === true);

  console.log(`\npreflight complete: ${failures} failure(s)`);
  await db.$disconnect();
  if (failures > 0) process.exit(1);
}

main();
