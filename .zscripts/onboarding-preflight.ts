// Stage 6 API + DB verification — eligibility, entry, steps, completion,
// idempotency, concurrency, hostile bodies, sensitive fields, cleanup.
// Follows the activation-verify.ts pattern: throwaway candidates only for
// destructive/mutating tests; the real fixtures FF-GWSA26 (stays
// NOT_STARTED) and FF-WVA24D (browser E2E target) are never onboarded here.
//
// Run: set -a && source .env && set +a && bun .zscripts/onboarding-preflight.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://127.0.0.1:3000";

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  const status = pass ? "PASS" : "FAIL";
  if (!pass) failures += 1;
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

type OnboardingData = {
  referenceNumber: string;
  fullName: string;
  status: string;
  eligible: boolean;
  staff: { staffId: string; version: string; roleTitle: string; activatedAt: string; appointmentReference: string } | null;
  onboarding: {
    state: string;
    version: string;
    currentStepId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    steps: { id: string; completedAt: string }[];
  } | null;
  content: { version: string; acknowledgementLabel: string; whatsappNumber: string | null; whatsappMessage: string; steps: { id: string; title: string }[] };
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log(`  [non-JSON response] http ${res.status}: ${text.slice(0, 200)}`);
    return { ok: false, error: { code: "NON_JSON", message: text.slice(0, 120) } };
  }
}

async function getOnboarding(reference: string): Promise<{ status: number; body: Envelope<OnboardingData> }> {
  const res = await fetch(`${BASE}/api/onboarding/${reference}`, { method: "GET" });
  return { status: res.status, body: (await parseJson(res)) as Envelope<OnboardingData> };
}

async function postStep(reference: string, body: unknown): Promise<{ status: number; body: Envelope<OnboardingData> }> {
  const res = await fetch(`${BASE}/api/onboarding/${reference}/steps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await parseJson(res)) as Envelope<OnboardingData> };
}

async function postComplete(reference: string, body: unknown): Promise<{ status: number; body: Envelope<OnboardingData> }> {
  const res = await fetch(`${BASE}/api/onboarding/${reference}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await parseJson(res)) as Envelope<OnboardingData> };
}

/** Create a throwaway candidate at OFFER_ACCEPTED, then walk appointment + activation via the real APIs. */
async function createThrowawayStaff(): Promise<string> {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const ref = `FF-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;

  const emails = [`${ref.toLowerCase()}@throwaway.test`];
  await db.candidate.create({
    data: {
      referenceNumber: ref,
      fullName: `Throwaway ${ref}`,
      email: emails[0],
      phone: `080${Math.floor(10000000 + Math.random() * 89999999)}`,
      status: "OFFER_ACCEPTED",
      applications: { create: { roleTitle: "Remote Staff" } },
      agreement: { create: { version: "1.1", acceptedAt: new Date() } },
      events: {
        create: [
          { stage: "OFFER", type: "ENTERED", description: "Opened the Responsibility & Reward Agreement" },
          { stage: "OFFER", type: "COMPLETED", description: "Accepted the Responsibility & Reward Agreement (version 1.1)" },
        ],
      },
    },
  });

  await fetch(`${BASE}/api/appointment/${ref}`, { method: "GET" });
  const act = await fetch(`${BASE}/api/activation/${ref}/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ acknowledgement: true, version: "1.0" }),
  });
  const actBody = (await act.json()) as Envelope<{ status: string; staff: { staffId: string } | null }>;
  if (!actBody.ok || actBody.data.status !== "APPROVED_STAFF") {
    throw new Error(`throwaway ${ref} failed to activate: ${JSON.stringify(actBody)}`);
  }
  return ref;
}

async function main() {
  // Make reruns idempotent: remove any leftovers from previous runs.
  await db.candidate.deleteMany({ where: { email: { endsWith: "@throwaway.test" } } });

  console.log("=== A. ELIGIBILITY — every non-approved status is blocked ===");
  const ineligible: [string, string][] = [
    ["APPLICANT", "FF-Z4KNTU"],
    ["ORIENTATION_PENDING", "FF-M8RDV2"],
    ["ORIENTATION_COMPLETED", "FF-P3KQ7M"],
    ["ASSESSMENT_PENDING", "FF-89C68X"],
    ["ASSESSMENT_FAILED", "FF-6JUYHG"],
    ["ASSESSMENT_PASSED-throwaway", ""], // created below
    ["OFFER_PENDING", "FF-QEY98E"],
    ["OFFER_ACCEPTED", "FF-E9KUVN"],
    ["OFFER_DECLINED-throwaway", ""],
    ["APPOINTMENT_ISSUED-throwaway", ""],
    ["ACTIVATION_PENDING-throwaway", ""],
  ];

  // Throwaways for the four statuses the seed doesn't cover.
  // ASSESSMENT_PASSED: direct insert (orientation+assessment complete, agreement NOT yet accepted).
  const refPassedChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const randRef = () => `FF-${Array.from({ length: 6 }, () => refPassedChars[Math.floor(Math.random() * refPassedChars.length)]).join("")}`;

  const refPassed = randRef();
  await db.candidate.create({
    data: {
      referenceNumber: refPassed, fullName: `Throwaway ${refPassed}`, email: `${refPassed.toLowerCase()}@throwaway.test`,
      phone: `081${Math.floor(10000000 + Math.random() * 89999999)}`, status: "ASSESSMENT_PASSED",
    },
  });
  ineligible[5][1] = refPassed;

  const refDeclined = randRef();
  await db.candidate.create({
    data: {
      referenceNumber: refDeclined, fullName: `Throwaway ${refDeclined}`, email: `${refDeclined.toLowerCase()}@throwaway.test`,
      phone: `081${Math.floor(10000000 + Math.random() * 89999999)}`, status: "OFFER_DECLINED",
    },
  });
  ineligible[8][1] = refDeclined;

  // APPOINTMENT_ISSUED + ACTIVATION_PENDING: OFFER_ACCEPTED + agreement, then lazy issue / lazy entry via APIs.
  const refIssued2 = randRef();
  await db.candidate.create({
    data: {
      referenceNumber: refIssued2, fullName: `Throwaway ${refIssued2}`, email: `${refIssued2.toLowerCase()}@throwaway.test`,
      phone: `081${Math.floor(10000000 + Math.random() * 89999999)}`, status: "OFFER_ACCEPTED",
      agreement: { create: { version: "1.1", acceptedAt: new Date() } },
    },
  });
  await fetch(`${BASE}/api/appointment/${refIssued2}`, { method: "GET" }); // lazy issue → APPOINTMENT_ISSUED
  await fetch(`${BASE}/api/activation/${refIssued2}`, { method: "GET" }); // lazy entry → ACTIVATION_PENDING (no POST = no staff row)

  ineligible[9][1] = refIssued2;
  ineligible[10][1] = refIssued2;

  for (const [status, reference] of ineligible) {
    const g = await getOnboarding(reference);
    const okGet = g.status === 200 && g.body.ok && g.body.data.eligible === false && g.body.data.onboarding === null && g.body.data.staff === null;
    check(`${status}: GET eligible:false + onboarding:null`, okGet, `http ${g.status}`);

    const s = await postStep(reference, { stepId: "welcome" });
    check(`${status}: POST steps → 409`, s.status === 409 && !s.body.ok, `http ${s.status} code ${s.body.ok ? "-" : s.body.error.code}`);

    const c = await postComplete(reference, { acknowledgement: true, version: "1.0" });
    check(`${status}: POST complete → 409`, c.status === 409 && !c.body.ok, `http ${c.status} code ${c.body.ok ? "-" : c.body.error.code}`);

    const row = await db.staffOnboarding.findFirst({ where: { staff: { candidate: { referenceNumber: reference } } } });
    check(`${status}: zero onboarding rows written`, row === null);
  }

  console.log("=== B. UNKNOWN / MALFORMED REFERENCES ===");
  const unknown = randRef();
  let r = await getOnboarding(unknown);
  check("unknown reference → neutral 404", r.status === 404 && !r.body.ok && /couldn't find/i.test(r.body.ok ? "" : r.body.error.message));
  r = await getOnboarding("FF-ILLO00"); // I/L/O excluded from the reference alphabet
  check("malformed reference → neutral 404", r.status === 404 && !r.body.ok);
  const lower = (await db.candidate.findUnique({ where: { referenceNumber: "FF-Z4KNTU" } }))!.referenceNumber.toLowerCase();
  r = await getOnboarding(lower);
  check("lowercase reference normalised → honest eligible:false", r.status === 200 && r.body.ok && r.body.data.eligible === false);

  console.log("=== C. ENTRY — lazy creation, idempotency (throwaway) ===");
  const staffRef = await createThrowawayStaff();
  console.log(`  throwaway staff: ${staffRef}`);
  // Baseline BEFORE any onboarding call — onboarding must not add StageEvents.
  const eventsBaseline = await db.stageEvent.count({ where: { candidate: { referenceNumber: staffRef } } });
  const statusBaseline = (await db.candidate.findUnique({ where: { referenceNumber: staffRef }, select: { status: true } }))!.status;
  const g1 = await getOnboarding(staffRef);
  const g1ok = g1.status === 200 && g1.body.ok && g1.body.data.eligible && g1.body.data.onboarding?.state === "IN_PROGRESS" && g1.body.data.onboarding.currentStepId === "welcome" && g1.body.data.onboarding.steps.length === 0 && g1.body.data.onboarding.version === "1.0";
  check("first GET creates record: IN_PROGRESS / welcome / v1.0", g1ok);
  const startedAt1 = g1.body.ok ? g1.body.data.onboarding!.startedAt : "";
  const g2 = await getOnboarding(staffRef);
  check("repeat GET: same record, same startedAt", g2.body.ok && g2.body.data.onboarding!.startedAt === startedAt1);
  const recordCount = await db.staffOnboarding.count({ where: { staff: { candidate: { referenceNumber: staffRef } } } });
  check("repeat GET: still exactly one record", recordCount === 1);

  console.log("=== D. STEPS — sequential gating, idempotency, hostile bodies ===");
  let s = await postStep(staffRef, { stepId: "engagement" });
  check("skip-ahead step → 422 naming blocker", s.status === 422 && /welcome/i.test(s.body.ok ? "" : (s.body.error.fields?.stepId ?? s.body.error.message)));
  s = await postStep(staffRef, { stepId: "bogus-step" });
  check("unknown step → 422", s.status === 422);
  s = await postStep(staffRef, { stepId: "welcome", state: "COMPLETED", completedAt: "1999-01-01T00:00:00Z", currentStepId: "ready" });
  check("step 1 with hostile extra fields → ok, extras ignored", s.status === 200 && s.body.ok);
  check("step 1 advances resume point to communication", s.body.ok && s.body.data.onboarding!.currentStepId === "communication");
  check("step 1 recorded once", s.body.ok && s.body.data.onboarding!.steps.length === 1);
  s = await postStep(staffRef, { stepId: "welcome" });
  check("duplicate step 1 idempotent (still 1 row)", s.status === 200 && s.body.ok && s.body.data.onboarding!.steps.length === 1);
  const stepRows1 = await db.staffOnboardingStep.count({ where: { onboarding: { staff: { candidate: { referenceNumber: staffRef } } }, stepId: "welcome" } });
  check("DB: exactly one welcome row", stepRows1 === 1);

  console.log("=== E. COMPLETION — gating, ack/version, exactly-once ===");
  let c = await postComplete(staffRef, { acknowledgement: true, version: "1.0" });
  check("complete too early → 422", c.status === 422);
  c = await postComplete(staffRef, { acknowledgement: false, version: "1.0" });
  check("false acknowledgement → 422", c.status === 422);
  c = await postComplete(staffRef, { acknowledgement: true, version: "9.9" });
  check("stale version → 422", c.status === 422);
  c = await postComplete(staffRef, {});
  check("missing fields → 422", c.status === 422);

  for (const stepId of ["communication", "resources", "engagement", "reporting", "standards", "ready"]) {
    s = await postStep(staffRef, { stepId });
    if (!s.body.ok) { check(`sequential step ${stepId}`, false, s.body.error.message); }
  }
  s = await getOnboarding(staffRef);
  check("all 7 steps recorded, resume at ready", s.body.ok && s.body.data.onboarding!.steps.length === 7 && s.body.data.onboarding!.currentStepId === "ready");

  c = await postComplete(staffRef, { acknowledgement: true, version: "1.0", completedAt: "1999-01-01T00:00:00Z", state: "IN_PROGRESS", staffId: "FF-STF-9999" });
  check("valid completion → ok (hostile extras ignored)", c.status === 200 && c.body.ok && c.body.data.onboarding!.state === "COMPLETED");
  const completedAt1 = c.body.ok ? c.body.data.onboarding!.completedAt : "";
  c = await postComplete(staffRef, { acknowledgement: true, version: "1.0" });
  check("repeat completion idempotent — same completedAt", c.status === 200 && c.body.ok && c.body.data.onboarding!.completedAt === completedAt1);
  s = await postStep(staffRef, { stepId: "welcome" });
  check("POST step after completion → 409 (closed)", s.status === 409);
  const record = await db.staffOnboarding.findFirst({ where: { staff: { candidate: { referenceNumber: staffRef } } } });
  const statusAfter = await db.candidate.findUnique({ where: { referenceNumber: staffRef }, select: { status: true } });
  check("status still APPROVED_STAFF (no candidate churn)", statusAfter?.status === statusBaseline && statusBaseline === "APPROVED_STAFF");
  const eventsAfter = await db.stageEvent.count({ where: { candidate: { referenceNumber: staffRef } } });
  check("no StageEvent rows added by onboarding", eventsAfter === eventsBaseline, `before=${eventsBaseline} after=${eventsAfter}`);

  console.log("=== F. CONCURRENCY ===");
  const concRef = await createThrowawayStaff();
  console.log(`  concurrency throwaway: ${concRef}`);
  // 8 concurrent first GETs → one record, one startedAt.
  const gets = await Promise.all(Array.from({ length: 8 }, () => getOnboarding(concRef)));
  const allOk = gets.every((g) => g.status === 200 && g.body.ok);
  const startedAts = new Set(gets.map((g) => (g.body.ok ? g.body.data.onboarding!.startedAt : "x")));
  check("8 concurrent first GETs all succeed", allOk);
  check("8 concurrent first GETs → ONE record/startedAt", startedAts.size === 1 && (await db.staffOnboarding.count({ where: { staff: { candidate: { referenceNumber: concRef } } } })) === 1);

  // 8 concurrent step-1 completions → one row.
  const steps8 = await Promise.all(Array.from({ length: 8 }, () => postStep(concRef, { stepId: "welcome" })));
  const welcomeRows = await db.staffOnboardingStep.count({ where: { onboarding: { staff: { candidate: { referenceNumber: concRef } } }, stepId: "welcome" } });
  check("8 concurrent step-1 POSTs → exactly one step row", welcomeRows === 1, `rows=${welcomeRows}`);
  check("concurrent step POSTs respond sanely (200/422, no 500)", steps8.every((x) => x.status === 200 || x.status === 422));

  // Finish the remaining steps, then 8 concurrent completions → one timestamp.
  for (const stepId of ["communication", "resources", "engagement", "reporting", "standards", "ready"]) {
    await postStep(concRef, { stepId });
  }
  const completes8 = await Promise.all(Array.from({ length: 8 }, () => postComplete(concRef, { acknowledgement: true, version: "1.0" })));
  const timestamps = new Set(completes8.map((x) => (x.body.ok ? x.body.data.onboarding!.completedAt : "x")));
  check("8 concurrent completions → ONE completedAt", timestamps.size === 1 && !timestamps.has("x"), `distinct=${timestamps.size}`);
  check("concurrent completions all succeed (idempotent)", completes8.every((x) => x.status === 200 && x.body.ok));

  console.log("=== G. SENSITIVE FIELDS + CONTENT ===");
  const gAll = await getOnboarding(concRef);
  const raw = JSON.stringify(gAll.body);
  // Scan for sensitive FIELD NAMES (quoted JSON keys) and fabricated links.
  const forbiddenKeys = ["nin", "bvn", "bank", "account", "password", "phone", "email", "nextofkin", "token"];
  const leakedKeys = forbiddenKeys.filter((f) => raw.toLowerCase().includes(`"${f}"`));
  const leakedLinks = ["wa.me", "chat.whatsapp", "api.whatsapp"].filter((l) => raw.toLowerCase().includes(l));
  check("response contains no sensitive fields/links", leakedKeys.length === 0 && leakedLinks.length === 0, [...leakedKeys, ...leakedLinks].join(","));
  check("whatsappNumber is null in content", gAll.body.ok && gAll.body.data.content.whatsappNumber === null);
  check("scripted message present verbatim", gAll.body.ok && gAll.body.data.content.whatsappMessage === "Hello, I have received my FinFam Provisional Letter of Appointment and I am ready for onboarding.");
  check("content has 7 steps in approved order", gAll.body.ok && JSON.stringify(gAll.body.data.content.steps.map((x) => x.id)) === JSON.stringify(["welcome", "communication", "resources", "engagement", "reporting", "standards", "ready"]));
  check("staff identity includes appointmentReference", gAll.body.ok && /^[0-9]+$/.test(gAll.body.data.staff!.appointmentReference.split("/").pop() ?? ""));

  console.log("=== H. JOURNEY INTEGRATION (API) ===");
  // H0. UI-path completion: steps 1–6 reviewed, final "ready" step recorded
  // BY the acknowledgement (the onboarding page never POSTs "ready").
  const uiRef = await createThrowawayStaff();
  console.log(`  ui-path throwaway: ${uiRef}`);
  for (const stepId of ["welcome", "communication", "resources", "engagement", "reporting", "standards"]) {
    await postStep(uiRef, { stepId });
  }
  const uiComplete = await postComplete(uiRef, { acknowledgement: true, version: "1.0" });
  check("UI-path completion (6 steps + ack) succeeds", uiComplete.status === 200 && uiComplete.body.ok && uiComplete.body.data.onboarding?.state === "COMPLETED");
  const uiRows = await db.staffOnboardingStep.count({ where: { onboarding: { staff: { candidate: { referenceNumber: uiRef } } } } });
  check("UI-path completion recorded all 7 step rows (ready auto-recorded)", uiRows === 7, `rows=${uiRows}`);

  const jr = await fetch(`${BASE}/api/journey/${concRef}`);
  const jb = { body: (await parseJson(jr)) as Envelope<{ status: string; onboarding: { state: string; completedSteps: number; totalSteps: number } | null; stages: { id: string; state: string }[]; nextAction: unknown }> };
  check("journey: onboarding COMPLETED with 7/7", jb.body.ok && jb.body.data.onboarding?.state === "COMPLETED" && jb.body.data.onboarding.completedSteps === 7 && jb.body.data.onboarding.totalSteps === 7);
  check("journey: recruitment stages all completed", jb.body.ok && jb.body.data.stages.every((x) => x.state === "completed"));
  check("journey: nextAction null (CTA owned by the card)", jb.body.ok && jb.body.data.nextAction === null);
  const jg = await fetch(`${BASE}/api/journey/FF-GWSA26`);
  const jgb = { body: (await parseJson(jg)) as Envelope<{ onboarding: { state: string; completedSteps: number } | null }> };
  check(
    "journey FF-GWSA26: never completed by this suite (no step rows)",
    jgb.body.ok &&
      jgb.body.data.onboarding != null &&
      jgb.body.data.onboarding.state !== "COMPLETED" &&
      jgb.body.data.onboarding.completedSteps === 0,
    `state=${jgb.body.ok ? jgb.body.data.onboarding?.state : "-"}`,
  );

  console.log("=== I. CLEANUP (zero residue) ===");
  const throwaways = [staffRef, concRef, uiRef, refPassed, refDeclined, refIssued2];
  for (const ref of throwaways) {
    await db.candidate.delete({ where: { referenceNumber: ref } }).catch(() => undefined);
  }
  const residue = await db.candidate.count({ where: { referenceNumber: { in: throwaways } } });
  check("throwaway candidates deleted (cascade clears onboarding)", residue === 0);
  const onboardRows = await db.staffOnboarding.count({ where: { staff: { candidate: { referenceNumber: { in: throwaways } } } } });
  check("zero StaffOnboarding rows remain for throwaways", onboardRows === 0);
  const staffRows = await db.staff.findMany({ select: { staffId: true } });
  check("only the two real staff records remain", staffRows.length === 2 && staffRows.map((x) => x.staffId).sort().join(",") === "FF-STF-0001,FF-STF-0002");
  const seq = await db.staffIdSequence.findFirst();
  check("staff ID sequence intact (throwaway activations consumed IDs — monotonic, never reused)", seq !== null && seq.value >= 2, `value=${seq?.value}`);
  const fixtureStatus = await db.candidate.findUnique({ where: { referenceNumber: "FF-GWSA26" }, select: { status: true } });
  check("FF-GWSA26 untouched (APPROVED_STAFF, never onboarded here)", fixtureStatus?.status === "APPROVED_STAFF");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("FATAL:", error);
  await db.$disconnect();
  process.exit(1);
});
