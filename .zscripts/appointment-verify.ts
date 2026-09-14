// Stage 4 API + DB verification (§38). Follows the accept-flow-verify.ts
// pattern: seed throwaway candidates, exercise the API, check the DB,
// clean up. Read-only for real fixtures.
//
// Run: set -a && source .env && set +a && bun run .zscripts/appointment-verify.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  const status = pass ? "PASS" : "FAIL";
  if (!pass) failures += 1;
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function get(path: string): Promise<{ status: number; body: Envelope<unknown> }> {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: (await res.json()) as Envelope<unknown> };
}

async function seedOfferAccepted(reference: string, fullName: string): Promise<string> {
  const candidate = await db.candidate.create({
    data: {
      referenceNumber: reference,
      fullName,
      email: `${reference.toLowerCase()}@verify.example.com`,
      phone: "0700 000 0000",
      status: "OFFER_ACCEPTED",
      applications: { create: { roleTitle: "Staff Member" } },
      agreement: { create: { version: "1.1", acceptedAt: new Date() } },
    },
  });
  return candidate.id;
}

async function cleanup(reference: string) {
  await db.candidate.deleteMany({ where: { referenceNumber: reference } });
}

type AppointmentView = {
  referenceNumber: string;
  fullName: string;
  status: string;
  issued: boolean;
  appointment: {
    appointmentReference: string;
    version: string;
    printedName: string;
    roleTitle: string;
    issuedAt: string;
    content: { subject: string; body: { type: string; text?: string; title?: string }[] };
  } | null;
};

async function main() {
  const seqBefore = (await db.appointmentSequence.findFirst())!.value;
  console.log(`sequence value before: ${seqBefore}`);

  /* ---- 1. Unknown + malformed references → neutral 404 ------------------ */
  const unknown = await get("/api/appointment/FF-ZZZZZZ");
  check("unknown reference → 404", unknown.status === 404 && !unknown.body.ok && unknown.body.error.code === "NOT_FOUND");
  const unknownAppointments = await db.appointment.count();
  check("unknown reference created nothing", unknownAppointments === 1); // only FF-GWSA26

  const malformed = await get("/api/appointment/not-a-reference");
  check("malformed reference → 404", malformed.status === 404 && !malformed.body.ok);

  /* ---- 2. Ineligible candidates → issued:false, nothing written --------- */
  const ineligibleRefs: [string, string][] = [
    ["FF-Z4KNTU", "APPLICANT"],
    ["FF-M8RDV2", "ORIENTATION_PENDING"],
    ["FF-P3KQ7M", "ORIENTATION_COMPLETED"],
    ["FF-89C68X", "ASSESSMENT_PENDING"],
    ["FF-6JUYHG", "ASSESSMENT_FAILED"],
    ["FF-QEY98E", "OFFER_PENDING (agreement not accepted)"],
  ];
  for (const [ref, label] of ineligibleRefs) {
    const res = await get(`/api/appointment/${ref}`);
    const data = res.body.ok ? (res.body.data as AppointmentView) : null;
    check(
      `ineligible ${label} → issued:false (200)`,
      res.status === 200 && res.body.ok && data!.issued === false && data!.appointment === null,
    );
  }
  const eventsForIneligible = await db.stageEvent.count({
    where: { stage: "APPOINTMENT", candidate: { referenceNumber: { in: ineligibleRefs.map(([r]) => r) } } },
  });
  check("no APPOINTMENT events for ineligible candidates", eventsForIneligible === 0);

  /* ---- 3. OFFER_ACCEPTED issuance under concurrency ---------------------- */
  const T1 = "FF-APTTST";
  await cleanup(T1);
  await seedOfferAccepted(T1, "Concurrency Verify One");

  const N = 10;
  console.log(`firing ${N} concurrent GETs for ${T1}…`);
  const results = await Promise.all(
    Array.from({ length: N }, () => get(`/api/appointment/${T1}`)),
  );
  const allOk = results.every((r) => r.status === 200 && r.body.ok);
  check(`all ${N} concurrent requests → 200 ok`, allOk);

  const views = results.map((r) => (r.body as { ok: true; data: AppointmentView }).data);
  const refs = new Set(views.map((v) => v.appointment!.appointmentReference));
  const issuedAts = new Set(views.map((v) => v.appointment!.issuedAt));
  const statuses = new Set(views.map((v) => v.status));
  check("every concurrent response reports the letter issued", views.every((v) => v.issued && v.appointment));
  check("exactly ONE appointment reference across all responses", refs.size === 1, `refs=${[...refs].join(",")}`);
  check("exactly ONE issuedAt across all responses", issuedAts.size === 1);
  check("every response reports APPOINTMENT_ISSUED", statuses.size === 1 && statuses.has("APPOINTMENT_ISSUED"));

  const issuedRef = views[0].appointment!.appointmentReference;
  const expectedRef = `FFL/HR/PLA/${String(seqBefore + 1).padStart(3, "0")}`;
  check("reference continues the sequence (next after sample 012 → 013)",
    issuedRef === expectedRef, `got ${issuedRef}, expected ${expectedRef}`);
  check("reference format FFL/HR/PLA/NNN", /^FFL\/HR\/PLA\/\d{3,}$/.test(issuedRef));
  check("snapshot: printedName from server record", views[0].appointment!.printedName === "Concurrency Verify One");
  check("snapshot: roleTitle = Remote Staff (approved default)", views[0].appointment!.roleTitle === "Remote Staff");
  check("version pinned = 1.0", views[0].appointment!.version === "1.0");
  check("subject line matches official wording",
    views[0].appointment!.content.subject === "Provisional Letter of Appointment – Remote Staff");
  const bodyText = views[0].appointment!.content.body.map((b) => `${b.title ?? ""}${b.text ?? ""}`).join(" ");
  check("no ₦2,000 anywhere in letter content", !bodyText.includes("2,000") && !views[0].appointment!.content.body.some((b) => (b.text ?? "").includes("2,000")));
  check("letter contains December 2026 confirmation note (content only)", bodyText.includes("December 2026"));

  /* ---- 4. DB invariants after concurrent issuance ------------------------ */
  const apptRows = await db.appointment.findMany({ where: { candidate: { referenceNumber: T1 } } });
  check("exactly ONE Appointment row", apptRows.length === 1);
  const apptEvents = await db.stageEvent.findMany({
    where: { candidate: { referenceNumber: T1 }, stage: "APPOINTMENT" },
  });
  check("exactly ONE APPOINTMENT StageEvent", apptEvents.length === 1);
  check("event type COMPLETED (not ENTERED)", apptEvents.length === 1 && apptEvents[0].type === "COMPLETED");
  check("event description contains the reference",
    apptEvents[0].description === `Provisional appointment ${issuedRef} issued.`);

  const cand = await db.candidate.findUnique({ where: { referenceNumber: T1 } });
  check("candidate status = APPOINTMENT_ISSUED", cand!.status === "APPOINTMENT_ISSUED");

  const seqAfter = (await db.appointmentSequence.findFirst())!.value;
  check("sequence advanced by exactly 1 (no burn on races)", seqAfter === seqBefore + 1, `${seqBefore} → ${seqAfter}`);

  /* ---- 5. Re-read idempotency (sequential duplicates) --------------------- */
  for (let i = 0; i < 3; i += 1) {
    const reread = await get(`/api/appointment/${T1}`);
    const data = (reread.body as { ok: true; data: AppointmentView }).data;
    check(`re-read ${i + 1} idempotent (same ref + issuedAt)`,
      data.appointment!.appointmentReference === issuedRef && data.appointment!.issuedAt === views[0].appointment!.issuedAt);
  }
  const rowsAfterRereads = await db.appointment.count({ where: { candidate: { referenceNumber: T1 } } });
  const eventsAfterRereads = await db.stageEvent.count({ where: { candidate: { referenceNumber: T1 }, stage: "APPOINTMENT" } });
  check("re-reads created no extra rows/events", rowsAfterRereads === 1 && eventsAfterRereads === 1);

  /* ---- 6. Second candidate → distinct, unique, monotonic reference ------- */
  const T2 = "FF-APTTST";
  await cleanup("FF-APTSQ2");
  const t2Id = await seedOfferAccepted("FF-APTSQ2", "Sequence Verify Two");
  const res2 = await get("/api/appointment/FF-APTSQ2");
  const view2 = (res2.body as { ok: true; data: AppointmentView }).data;
  const ref2 = view2.appointment!.appointmentReference;
  check("second issuance gets the next number", ref2 === `FFL/HR/PLA/${String(seqAfter + 1).padStart(3, "0")}`, ref2);
  check("references unique across candidates", ref2 !== issuedRef);
  const seq2 = (await db.appointmentSequence.findFirst())!.value;
  check("sequence value matches second allocation", seq2 === seqAfter + 1);
  void t2Id;

  /* ---- 7. Journey API integration ---------------------------------------- */
  const jPre = await get("/api/journey/FF-E9KUVN");
  const jPreData = (jPre.body as { ok: true; data: { status: string; currentStage: string; nextAction: { label: string; href: string } | null; appointmentRecord: unknown } }).data;
  check("OFFER_ACCEPTED journey: Appointment current",
    jPreData.currentStage === "APPOINTMENT" && jPreData.status === "OFFER_ACCEPTED");
  check("OFFER_ACCEPTED journey: CTA View Provisional Appointment → /appointment/FF-E9KUVN",
    jPreData.nextAction?.label === "View Provisional Appointment" && jPreData.nextAction?.href === "/appointment/FF-E9KUVN");
  check("OFFER_ACCEPTED journey: no appointmentRecord yet", jPreData.appointmentRecord === null);

  const jPost = await get(`/api/journey/${T1}`);
  const jPostData = (jPost.body as { ok: true; data: { status: string; stages: { id: string; state: string }[]; nextAction: unknown; upcomingNote: string | null; appointmentRecord: { appointmentReference: string; version: string } | null } }).data;
  check("APPOINTMENT_ISSUED journey: status updated", jPostData.status === "APPOINTMENT_ISSUED");
  const stageMap = Object.fromEntries(jPostData.stages.map((s) => [s.id, s.state]));
  check("journey stages: Appointment completed",
    stageMap["APPLICATION"] === "completed" && stageMap["ORIENTATION"] === "completed" && stageMap["ASSESSMENT"] === "completed" && stageMap["OFFER"] === "completed" && stageMap["APPOINTMENT"] === "completed");
  check("journey stages: Activation current", stageMap["ACTIVATION"] === "current");
  check("journey: no next action (Activation not implemented)", jPostData.nextAction === null);
  check("journey: honest activation note", (jPostData.upcomingNote ?? "").includes("Staff Activation"));
  check("journey: appointmentRecord present with reference",
    jPostData.appointmentRecord?.appointmentReference === issuedRef && jPostData.appointmentRecord?.version === "1.0");

  /* ---- 8. Journey sweep: earlier statuses unchanged ----------------------- */
  const sweep: [string, string, string | null][] = [
    ["FF-Z4KNTU", "APPLICANT", "ORIENTATION"],
    ["FF-P3KQ7M", "ORIENTATION_COMPLETED", "ASSESSMENT"],
    ["FF-QEY98E", "OFFER_PENDING", "OFFER"],
    ["FF-6JUYHG", "ASSESSMENT_FAILED", "ASSESSMENT"],
  ];
  for (const [ref, status, stage] of sweep) {
    const r = await get(`/api/journey/${ref}`);
    const d = (r.body as { ok: true; data: { status: string; currentStage: string | null } }).data;
    check(`journey sweep ${ref} (${status}) unchanged`, d.status === status && d.currentStage === stage);
  }

  /* ---- 9. Cleanup + final integrity --------------------------------------- */
  await cleanup(T1);
  await cleanup("FF-APTSQ2");
  const remaining = await db.appointment.count();
  check("cleanup removed throwaway appointments (FF-GWSA26 letter remains)", remaining === 1);
  const seqFinal = (await db.appointmentSequence.findFirst())!.value;
  check("sequence never reuses numbers after cleanup", seqFinal === seqAfter + 1);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
