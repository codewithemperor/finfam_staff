// Stage 5 API + DB verification — activation, idempotency, concurrency,
// sequence integrity, cleanup. Follows the appointment-verify.ts pattern:
// throwaway candidates only; real fixtures untouched.
//
// Run: set -a && source .env && set +a && bun .zscripts/activation-verify.ts
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
  | { ok: false; error: { code: string; message: string } };

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
  const text = await res.text();
  let parsed: Envelope<unknown>;
  try {
    parsed = JSON.parse(text) as Envelope<unknown>;
  } catch {
    console.log(`[DEBUG] non-JSON response for ${path}: HTTP ${res.status}: ${text.slice(0, 300)}`);
    parsed = { ok: false, error: { code: "NON_JSON", message: text.slice(0, 200) } };
  }
  return { status: res.status, body: parsed };
}

type ActivationView = {
  referenceNumber: string;
  fullName: string;
  status: string;
  eligible: boolean;
  appointment: { appointmentReference: string; roleTitle: string; issuedAt: string } | null;
  staff: { staffId: string; version: string; roleTitle: string; activatedAt: string } | null;
  content: { version: string };
};

async function seedAppointed(
  reference: string,
  fullName: string,
  appointmentRef: string,
): Promise<string> {
  const candidate = await db.candidate.create({
    data: {
      referenceNumber: reference,
      fullName,
      email: `${reference.toLowerCase()}@verify.example.com`,
      phone: "0700 000 0000",
      status: "APPOINTMENT_ISSUED",
      applications: { create: { roleTitle: "Staff Member" } },
      agreement: { create: { version: "1.1", acceptedAt: new Date() } },
      appointment: {
        create: {
          appointmentReference: appointmentRef,
          version: "1.0",
          printedName: fullName,
          roleTitle: "Remote Staff",
          issuedAt: new Date(),
        },
      },
    },
  });
  return candidate.id;
}

async function cleanup(reference: string) {
  await db.candidate.deleteMany({ where: { referenceNumber: reference } });
}

async function main() {
  const seqBefore = (await db.staffIdSequence.findFirst())!.value;
  console.log(`staff sequence value before: ${seqBefore} (0001/0002 already issued to FF-GWSA26/FF-WVA24D via UI)`);

  /* ---- 1. First activation + idempotent repeat (throwaway) -------------- */
  const T1 = "FF-ACTTST";
  await cleanup(T1);
  await seedAppointed(T1, "Activation Verify One", "FFL/HR/PLA/9901");

  const activate1 = await post(`/api/activation/${T1}/activate`, { acknowledgement: true, version: "1.0" });
  const v1 = activate1.body.ok ? (activate1.body.data as ActivationView) : null;
  check("first activation → 200 ok", activate1.status === 200 && activate1.body.ok && v1 !== null);
  check("status → APPROVED_STAFF", v1?.status === "APPROVED_STAFF");
  check("staff record present with version 1.0", v1?.staff?.version === "1.0");
  check("staff ID continues the sequence", v1?.staff?.staffId === `FF-STF-${String(seqBefore + 1).padStart(4, "0")}`, `got ${v1?.staff?.staffId}`);
  check("designation snapshotted from appointment (Remote Staff)", v1?.staff?.roleTitle === "Remote Staff");
  check("appointment context present in view", v1?.appointment?.appointmentReference === "FFL/HR/PLA/9901");
  check("staff ID format FF-STF-NNNN", /^FF-STF-\d{4,}$/.test(v1?.staff?.staffId ?? ""));

  const t1Staff = await db.staff.findFirst({ where: { candidate: { referenceNumber: T1 } } });
  check("Staff row persisted", t1Staff !== null);
  check("appointment reference snapshotted on row", t1Staff?.appointmentReference === "FFL/HR/PLA/9901");
  const t1Events = await db.stageEvent.findMany({
    where: { stage: "ACTIVATION", candidate: { referenceNumber: T1 } },
    orderBy: { occurredAt: "asc" },
  });
  check("exactly ONE ENTERED (direct API preserves trail) + ONE COMPLETED", t1Events.length === 2 && t1Events[0].type === "ENTERED" && t1Events[1].type === "COMPLETED", JSON.stringify(t1Events.map((e) => e.type)));
  check("COMPLETED description names the Staff ID", t1Events[1]?.description === `Staff profile activated. Staff ID ${v1?.staff?.staffId} assigned.`);

  // Idempotent repeat
  const repeat = await post(`/api/activation/${T1}/activate`, { acknowledgement: true, version: "1.0" });
  const rv = repeat.body.ok ? (repeat.body.data as ActivationView) : null;
  check("repeat activation → 200, same record", repeat.status === 200 && rv?.staff?.staffId === v1?.staff?.staffId && rv?.staff?.activatedAt === v1?.staff?.activatedAt);
  const repeatGet = await get(`/api/activation/${T1}`);
  const rgv = repeatGet.body.ok ? (repeatGet.body.data as ActivationView) : null;
  check("GET after activation → read-only record, eligible:false", rgv?.eligible === false && rgv?.staff?.staffId === v1?.staff?.staffId);
  const t1StaffCount = await db.staff.count({ where: { candidate: { referenceNumber: T1 } } });
  const t1EventCount = await db.stageEvent.count({ where: { stage: "ACTIVATION", candidate: { referenceNumber: T1 } } });
  check("no duplicate Staff rows or events after repeats", t1StaffCount === 1 && t1EventCount === 2);

  /* ---- 2. Client-supplied identity fields are ignored -------------------- */
  const T2 = "FF-ACTVER";
  await cleanup(T2);
  await seedAppointed(T2, "Activation Verify Client", "FFL/HR/PLA/9902");
  const hostile = await post(`/api/activation/${T2}/activate`, {
    acknowledgement: true,
    version: "1.0",
    staffId: "FF-STF-9999",
    status: "APPROVED_STAFF",
    activatedAt: "1999-01-01T00:00:00.000Z",
  });
  if (!hostile.body.ok) {
    console.log(`[DEBUG] hostile POST → HTTP ${hostile.status}: ${JSON.stringify(hostile.body)}`);
  }
  const hv = hostile.body.ok ? (hostile.body.data as ActivationView) : null;
  check("hostile body → 200 but server decides identity", hostile.status === 200 && hv?.staff !== null);
  check("client staffId IGNORED — sequence ID allocated instead", hv?.staff?.staffId === `FF-STF-${String(seqBefore + 2).padStart(4, "0")}`, `got ${hv?.staff?.staffId}`);
  check("client status/activatedAt IGNORED — server values used", hv?.status === "APPROVED_STAFF" && hv?.staff?.activatedAt !== "1999-01-01T00:00:00.000Z");

  /* ---- 3. Concurrency: 10 simultaneous activations (throwaway) ---------- */
  const T3 = "FF-ACTCCR";
  await cleanup(T3);
  await seedAppointed(T3, "Activation Verify Concurrency", "FFL/HR/PLA/9903");
  const N = 10;
  console.log(`firing ${N} concurrent activations for ${T3}…`);
  const results = await Promise.all(
    Array.from({ length: N }, () => post(`/api/activation/${T3}/activate`, { acknowledgement: true, version: "1.0" })),
  );
  const allOk = results.every((r) => r.status === 200 && r.body.ok);
  check(`all ${N} concurrent activations → 200 ok`, allOk);
  const views = results.map((r) => (r.body as { ok: true; data: ActivationView }).data);
  const staffIds = new Set(views.map((v) => v.staff!.staffId));
  const activatedAts = new Set(views.map((v) => v.staff!.activatedAt));
  const statuses = new Set(views.map((v) => v.status));
  check("every concurrent response carries the staff record", views.every((v) => v.staff !== null && v.status === "APPROVED_STAFF"));
  check("exactly ONE Staff ID across all responses", staffIds.size === 1, `ids=${[...staffIds].join(",")}`);
  check("exactly ONE activatedAt across all responses", activatedAts.size === 1);
  check("every response reports APPROVED_STAFF", statuses.size === 1 && statuses.has("APPROVED_STAFF"));
  check("concurrent ID continues the sequence (no skips from parallel winners)", staffIds.has(`FF-STF-${String(seqBefore + 3).padStart(4, "0")}`), `expected FF-STF-${String(seqBefore + 3).padStart(4, "0")}`);

  const t3Rows = await db.staff.count({ where: { candidate: { referenceNumber: T3 } } });
  const t3Events = await db.stageEvent.count({ where: { stage: "ACTIVATION", candidate: { referenceNumber: T3 } } });
  const seqAfter = (await db.staffIdSequence.findFirst())!.value;
  check("exactly ONE Staff row", t3Rows === 1);
  check("exactly TWO events (ENTERED + COMPLETED) despite 10 requests", t3Events === 2, `got ${t3Events}`);
  check("sequence advanced exactly 3 (three activations total)", seqAfter === seqBefore + 3, `before=${seqBefore} after=${seqAfter}`);

  /* ---- 4. Journey after activation (throwaway, before cleanup) ---------- */
  const jRes = await get(`/api/journey/${T3}`);
  const j = jRes.body.ok ? (jRes.body.data as { status: string; currentStage: string | null; nextAction: unknown; staffRecord: { staffId: string; roleTitle: string; activatedAt: string } | null; stages: { id: string; state: string }[] }) : null;
  check("journey APPROVED_STAFF → currentStage null (journey complete)", j?.currentStage === null);
  check("journey APPROVED_STAFF → no CTA", j?.nextAction === null);
  check("journey APPROVED_STAFF → staffRecord present with ID + role", j?.staffRecord?.staffId?.startsWith("FF-STF-") === true && j?.staffRecord?.roleTitle === "Remote Staff");
  check("journey APPROVED_STAFF → all six stages completed", j?.stages.every((s) => s.state === "completed") === true);

  /* ---- 5. Cleanup: zero residue ----------------------------------------- */
  await cleanup(T1);
  await cleanup(T2);
  await cleanup(T3);
  const residueStaff = await db.staff.count();
  const residueEvents = await db.stageEvent.count({ where: { stage: "ACTIVATION" } });
  check("cleanup: only the 2 real staff rows remain", residueStaff === 2);
  check("cleanup: only the 4 real activation events remain", residueEvents === 4);
  const seqFinal = (await db.staffIdSequence.findFirst())!.value;
  check("sequence unchanged by cleanup (numbers never reused)", seqFinal === seqBefore + 3, `final=${seqFinal}`);

  // Real fixtures untouched beyond designed state
  const real = await db.candidate.findMany({
    where: { referenceNumber: { in: ["FF-GWSA26", "FF-WVA24D"] } },
    select: { referenceNumber: true, status: true, staff: { select: { staffId: true } }, appointment: { select: { appointmentReference: true } } },
  });
  check("real fixtures: FF-GWSA26 APPROVED_STAFF + FF-STF-0001 + letter 013 intact",
    real.find((c) => c.referenceNumber === "FF-GWSA26")?.status === "APPROVED_STAFF" &&
    real.find((c) => c.referenceNumber === "FF-GWSA26")?.staff?.staffId === "FF-STF-0001" &&
    real.find((c) => c.referenceNumber === "FF-GWSA26")?.appointment?.appointmentReference === "FFL/HR/PLA/013");
  check("real fixtures: FF-WVA24D APPROVED_STAFF + FF-STF-0002 + letter 017 intact",
    real.find((c) => c.referenceNumber === "FF-WVA24D")?.status === "APPROVED_STAFF" &&
    real.find((c) => c.referenceNumber === "FF-WVA24D")?.staff?.staffId === "FF-STF-0002" &&
    real.find((c) => c.referenceNumber === "FF-WVA24D")?.appointment?.appointmentReference === "FFL/HR/PLA/017");

  console.log(`\nactivation-verify complete: ${failures} failure(s)`);
  await db.$disconnect();
  if (failures > 0) process.exit(1);
}

main();
