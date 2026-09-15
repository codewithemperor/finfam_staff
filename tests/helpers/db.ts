/**
 * Database access + cleanup for the flow test suite.
 *
 * Tests create their own candidates through the real API and track the
 * emails they created; afterAll removes exactly those candidates. Every
 * related row (application, stage events, orientation, attempts, agreement,
 * appointment, staff, onboarding) disappears via the schema's cascade
 * deletes, so the dev database is left as it was found.
 *
 * The one deliberate residue: singleton sequences (appointment reference,
 * Staff ID) stay advanced — the project's documented never-reuse behaviour,
 * same as every previous verification run (see worklog.md).
 */
import { db } from "@/lib/db";

export { db };

/** Every test email starts with this prefix so stray rows are identifiable. */
export const TEST_EMAIL_PREFIX = "flow-test-";

let emailCounter = 0;

/** A fresh, unique email for one test candidate. */
export function uniqueEmail(label: string): string {
  emailCounter += 1;
  return `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${emailCounter}@test.example.com`;
}

/** Remove every candidate this suite created (cascades wipe related rows). */
export async function cleanupTestCandidates(emails: string[]): Promise<number> {
  if (emails.length === 0) return 0;
  const result = await db.candidate.deleteMany({
    where: { email: { in: emails } },
  });
  return result.count;
}
