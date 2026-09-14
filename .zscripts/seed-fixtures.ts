// One-off fixture seed restoring the pre-wipe candidate set (read the
// worklog: these mirrors the Stage 1-3 verification fixtures). Idempotent:
// skips candidates that already exist.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

type Fixture = {
  referenceNumber: string; fullName: string; email: string; phone: string; city: string;
  status: "APPLICANT" | "ORIENTATION_PENDING" | "ORIENTATION_COMPLETED" | "ASSESSMENT_PENDING" | "ASSESSMENT_PASSED" | "ASSESSMENT_FAILED" | "OFFER_PENDING" | "OFFER_ACCEPTED";
  createdAt: Date;
  orientationSections?: number[]; orientationCompleted?: boolean;
  attempts?: { attemptNumber: number; submitted: boolean; passed?: boolean; marksAwarded?: number; totalMarks?: number; answers?: number; questions?: number }[];
  agreement?: { version: string; acceptedAt: Date };
  events: { stage: "ORIENTATION" | "ASSESSMENT" | "OFFER" | "APPOINTMENT"; type: "ENTERED" | "COMPLETED" | "FAILED"; description: string; occurredAt: Date }[];
};

const fixtures: Fixture[] = [
  {
    referenceNumber: "FF-Z4KNTU", fullName: "Adaeze Nwosu", email: "adaeze.nwosu@example.com", phone: "0803 111 2233", city: "Lagos",
    status: "APPLICANT", createdAt: new Date("2026-09-10T09:12:00Z"),
    events: [],
  },
  {
    referenceNumber: "FF-M8RDV2", fullName: "Tunde Bakare", email: "tunde.bakare@example.com", phone: "0805 222 3344", city: "Ibadan",
    status: "ORIENTATION_PENDING", createdAt: new Date("2026-09-10T10:00:00Z"),
    orientationSections: [0, 1],
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-10T10:05:00Z") },
    ],
  },
  {
    referenceNumber: "FF-P3KQ7M", fullName: "Chioma Eze", email: "chioma.eze@example.com", phone: "0807 333 4455", city: "Enugu",
    status: "ORIENTATION_COMPLETED", createdAt: new Date("2026-09-11T08:30:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-11T08:35:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-11T09:20:00Z") },
    ],
  },
  {
    referenceNumber: "FF-89C68X", fullName: "Emeka Obi", email: "emeka.obi@example.com", phone: "0810 444 5566", city: "Abuja",
    status: "ASSESSMENT_PENDING", createdAt: new Date("2026-09-11T11:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: false, answers: 2, questions: 30 }],
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-11T11:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-11T12:00:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-11T12:10:00Z") },
    ],
  },
  {
    referenceNumber: "FF-6JUYHG", fullName: "Ngozi Aliyu", email: "ngozi.aliyu@example.com", phone: "0812 555 6677", city: "Kano",
    status: "ASSESSMENT_FAILED", createdAt: new Date("2026-09-12T09:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: true, passed: false, marksAwarded: 0, totalMarks: 150, answers: 30, questions: 30 }],
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-12T09:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-12T10:00:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-12T10:10:00Z") },
      { stage: "ASSESSMENT", type: "FAILED", description: "Assessment not passed — 0 of 150 marks (20%)", occurredAt: new Date("2026-09-12T10:55:00Z") },
    ],
  },
  {
    referenceNumber: "FF-UEPKGX", fullName: "Sadiq Bello", email: "sadiq.bello@example.com", phone: "0813 666 7788", city: "Kaduna",
    status: "ASSESSMENT_PENDING", createdAt: new Date("2026-09-12T13:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: false, answers: 0, questions: 30 }],
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-12T13:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-12T14:00:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-12T14:10:00Z") },
    ],
  },
  {
    referenceNumber: "FF-QEY98E", fullName: "Funmi Adeyemi", email: "funmi.adeyemi@example.com", phone: "0815 777 8899", city: "Port Harcourt",
    status: "OFFER_PENDING", createdAt: new Date("2026-09-13T09:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: true, passed: true, marksAwarded: 150, totalMarks: 150, answers: 30, questions: 30 }],
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-13T09:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-13T10:00:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-13T10:10:00Z") },
      { stage: "ASSESSMENT", type: "COMPLETED", description: "Assessment passed — 150 of 150 marks (100%)", occurredAt: new Date("2026-09-13T10:50:00Z") },
      { stage: "OFFER", type: "ENTERED", description: "Opened the Responsibility & Reward Agreement", occurredAt: new Date("2026-09-13T11:00:00Z") },
    ],
  },
  {
    referenceNumber: "FF-E9KUVN", fullName: "Bola Ogunleye", email: "bola.ogunleye@example.com", phone: "0817 888 9900", city: "Lagos",
    status: "OFFER_ACCEPTED", createdAt: new Date("2026-09-13T12:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: true, passed: true, marksAwarded: 150, totalMarks: 150, answers: 30, questions: 30 }],
    agreement: { version: "1.0", acceptedAt: new Date("2026-09-13T14:00:00Z") },
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-13T12:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-13T13:00:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-13T13:10:00Z") },
      { stage: "ASSESSMENT", type: "COMPLETED", description: "Assessment passed — 150 of 150 marks (100%)", occurredAt: new Date("2026-09-13T13:50:00Z") },
      { stage: "OFFER", type: "ENTERED", description: "Opened the Responsibility & Reward Agreement", occurredAt: new Date("2026-09-13T13:55:00Z") },
      { stage: "OFFER", type: "COMPLETED", description: "Accepted the Responsibility & Reward Agreement (version 1.0)", occurredAt: new Date("2026-09-13T14:00:00Z") },
    ],
  },
  {
    referenceNumber: "FF-WVA24D", fullName: "Halima Sule", email: "halima.sule@example.com", phone: "0818 999 0011", city: "Sokoto",
    status: "OFFER_ACCEPTED", createdAt: new Date("2026-09-14T08:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: true, passed: true, marksAwarded: 129, totalMarks: 150, answers: 30, questions: 30 }],
    agreement: { version: "1.0", acceptedAt: new Date("2026-09-14T09:30:00Z") },
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-14T08:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-14T08:40:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-14T08:50:00Z") },
      { stage: "ASSESSMENT", type: "COMPLETED", description: "Assessment passed — 129 of 150 marks (86%)", occurredAt: new Date("2026-09-14T09:20:00Z") },
      { stage: "OFFER", type: "ENTERED", description: "Opened the Responsibility & Reward Agreement", occurredAt: new Date("2026-09-14T09:25:00Z") },
      { stage: "OFFER", type: "COMPLETED", description: "Accepted the Responsibility & Reward Agreement (version 1.0)", occurredAt: new Date("2026-09-14T09:30:00Z") },
    ],
  },
  {
    // Stable Stage 4 browser fixture — will receive its appointment letter
    // during end-to-end verification (agreement accepted under v1.1).
    referenceNumber: "FF-GWSA26", fullName: "Giwa Sahoban Olakunle", email: "giwa.olakunle@example.com", phone: "0819 111 0223", city: "Abeokuta",
    status: "OFFER_ACCEPTED", createdAt: new Date("2026-09-14T10:00:00Z"),
    orientationSections: [0,1,2,3,4,5,6,7], orientationCompleted: true,
    attempts: [{ attemptNumber: 1, submitted: true, passed: true, marksAwarded: 141, totalMarks: 150, answers: 30, questions: 30 }],
    agreement: { version: "1.1", acceptedAt: new Date("2026-09-14T11:00:00Z") },
    events: [
      { stage: "ORIENTATION", type: "ENTERED", description: "Started the Staff Orientation Workshop", occurredAt: new Date("2026-09-14T10:05:00Z") },
      { stage: "ORIENTATION", type: "COMPLETED", description: "Completed the Staff Orientation Workshop", occurredAt: new Date("2026-09-14T10:35:00Z") },
      { stage: "ASSESSMENT", type: "ENTERED", description: "Started the automated assessment (attempt 1)", occurredAt: new Date("2026-09-14T10:45:00Z") },
      { stage: "ASSESSMENT", type: "COMPLETED", description: "Assessment passed — 141 of 150 marks (94%)", occurredAt: new Date("2026-09-14T10:50:00Z") },
      { stage: "OFFER", type: "ENTERED", description: "Opened the Responsibility & Reward Agreement", occurredAt: new Date("2026-09-14T10:55:00Z") },
      { stage: "OFFER", type: "COMPLETED", description: "Accepted the Responsibility & Reward Agreement (version 1.1)", occurredAt: new Date("2026-09-14T11:00:00Z") },
    ],
  },
];

const ORIENTATION_SECTION_IDS = ["about-finfam","your-role","how-finfam-works","support-package","reward-structure","reporting","fraud-and-ethics","next-steps"];

for (const f of fixtures) {
  const exists = await db.candidate.findUnique({ where: { referenceNumber: f.referenceNumber } });
  if (exists) { console.log(`skip ${f.referenceNumber}`); continue; }
  const candidate = await db.candidate.create({
    data: {
      referenceNumber: f.referenceNumber, fullName: f.fullName, email: f.email, phone: f.phone, city: f.city,
      status: f.status, createdAt: f.createdAt,
      applications: { create: { roleTitle: "Staff Member", submittedAt: f.createdAt } },
      orientation: f.orientationSections ? {
        create: {
          currentSectionId: f.orientationCompleted ? null : ORIENTATION_SECTION_IDS[Math.min(f.orientationSections.length, 7)],
          acknowledgedAt: f.orientationCompleted ? new Date("2026-09-13T10:00:00Z") : null,
          completedAt: f.orientationCompleted ? f.events.find(e => e.stage === "ORIENTATION" && e.type === "COMPLETED")?.occurredAt ?? null : null,
          sections: { create: f.orientationSections.map((i) => ({ sectionId: ORIENTATION_SECTION_IDS[i] ?? `section-${i}`, completedAt: new Date(f.createdAt.getTime() + i * 600000) })) },
        },
      } : undefined,
      attempts: f.attempts ? {
        create: f.attempts.map((a) => ({
          attemptNumber: a.attemptNumber,
          startedAt: new Date(f.createdAt.getTime() + 3600000),
          submittedAt: a.submitted ? new Date(f.createdAt.getTime() + 3600000) : null,
          marksAwarded: a.marksAwarded ?? null, totalMarks: a.totalMarks ?? null,
          percentage: a.marksAwarded != null && a.totalMarks ? (a.marksAwarded / a.totalMarks) * 100 : null,
          passed: a.passed ?? null,
          questions: a.submitted ? { create: Array.from({ length: a.questions ?? 30 }, (_, i) => ({ questionId: `q-${String(i + 1).padStart(2, "0")}`, position: i })) } : undefined,
          answers: (a.answers ?? 0) > 0 ? { create: Array.from({ length: a.answers ?? 0 }, (_, i) => ({ questionId: `q-${String(i + 1).padStart(2, "0")}`, selectedOption: i % 4 })) } : undefined,
        })),
      } : undefined,
      agreement: f.agreement ? { create: { version: f.agreement.version, acceptedAt: f.agreement.acceptedAt } } : undefined,
      events: { create: f.events.map((e) => ({ stage: e.stage, type: e.type, description: e.description, occurredAt: e.occurredAt })) },
    },
  });
  console.log(`created ${candidate.referenceNumber} (${candidate.status})`);
}
await db.$disconnect();
