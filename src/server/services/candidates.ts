import { db } from "@/lib/db";
import { OPEN_POSITION } from "@/config/content";
import { notFoundError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type { CandidateStatusView } from "@/types/recruitment";

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

/**
 * Look up a candidate by their public reference number.
 *
 * The reference number is the only credential needed here by design — the
 * response contains only what the candidate already knows about themselves,
 * and sensitive details (phone, email, city) are deliberately excluded.
 */
export async function getCandidateStatus(
  reference: string,
): Promise<CandidateStatusView> {
  const normalized = reference.trim().toUpperCase();

  if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  const candidate = await db.candidate.findUnique({
    where: { referenceNumber: normalized },
    select: {
      referenceNumber: true,
      fullName: true,
      status: true,
      createdAt: true,
      applications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { roleTitle: true },
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: {
          id: true,
          stage: true,
          type: true,
          description: true,
          occurredAt: true,
        },
      },
    },
  });

  if (!candidate) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    roleTitle: candidate.applications[0]?.roleTitle ?? OPEN_POSITION.title,
    status: candidate.status,
    submittedAt: candidate.createdAt.toISOString(),
    events: candidate.events.map((event) => ({
      id: event.id,
      stage: event.stage,
      type: event.type,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}
