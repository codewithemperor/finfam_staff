// Read-only full snapshot for before/after integrity comparison.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const [candidates, agreements, orientations, orientationSections, attempts, attemptQuestions, answers, events, appointments, sequences] = await Promise.all([
  db.candidate.findMany({ orderBy: { referenceNumber: "asc" }, select: { referenceNumber: true, status: true, fullName: true, email: true, phone: true, city: true } }),
  db.agreement.findMany({ orderBy: { id: "asc" } }),
  db.orientation.findMany({ orderBy: { id: "asc" } }),
  db.orientationSection.findMany({ orderBy: { id: "asc" } }),
  db.assessmentAttempt.findMany({ orderBy: { id: "asc" } }),
  db.assessmentAttemptQuestion.findMany({ orderBy: { id: "asc" } }),
  db.assessmentAnswer.findMany({ orderBy: { id: "asc" } }),
  db.stageEvent.findMany({ orderBy: { occurredAt: "asc" }, select: { candidateId: true, stage: true, type: true, description: true, occurredAt: true } }),
  db.appointment.findMany({ orderBy: { id: "asc" } }),
  db.appointmentSequence.findMany(),
]);
const counts = { candidates: candidates.length, agreements: agreements.length, orientations: orientations.length, orientationSections: orientationSections.length, attempts: attempts.length, attemptQuestions: attemptQuestions.length, answers: answers.length, events: events.length, appointments: appointments.length };
console.log(JSON.stringify({ counts, candidates, agreements, events, appointments, sequences }, null, 1));
await db.$disconnect();
