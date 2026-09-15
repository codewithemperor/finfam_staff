import { ORIENTATION_SECTIONS, getOrientationSection } from "@/config/orientation";
import { db } from "@/lib/db";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import { conflictError, notFoundError, validationError } from "@/lib/errors";
import { REFERENCE_NUMBER_PATTERN } from "@/lib/reference";
import type {
  OrientationCompleteInput,
  OrientationSectionCompleteInput,
} from "@/lib/validation/orientation";
import type { OrientationView } from "@/types/recruitment";

/**
 * Orientation (FSOW) stage service.
 *
 * All stage rules live here — UI and route handlers never touch Prisma and
 * never decide whether a candidate may progress:
 *
 * - The first completed section moves the candidate from APPLICANT to
 *   ORIENTATION_PENDING and records an ENTERED StageEvent ("started").
 * - Sections must be completed in order; completing a section out of order
 *   is rejected server-side.
 * - Orientation is only complete when the candidate explicitly confirms it
 *   (with the integrity acknowledgement) after every section has been read.
 *   Completing moves the candidate to ORIENTATION_COMPLETED and records a
 *   COMPLETED StageEvent.
 * - Completion actions are idempotent for safe double submits.
 */

const NOT_FOUND_MESSAGE =
  "We couldn't find an application with that reference number. Check the number and try again, or contact us if you have lost it.";

type OrientationRelation = {
  currentSectionId: string | null;
  completedAt: Date | null;
  acknowledgedAt: Date | null;
  sections: { sectionId: string; completedAt: Date }[];
};

type CandidateWithOrientation = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  status: OrientationView["status"];
  orientation: OrientationRelation | null;
};

const CANDIDATE_SELECT = {
  id: true,
  referenceNumber: true,
  fullName: true,
  email: true,
  status: true,
  orientation: {
    select: {
      currentSectionId: true,
      completedAt: true,
      acknowledgedAt: true,
      sections: {
        orderBy: { completedAt: "asc" as const },
        select: { sectionId: true, completedAt: true },
      },
    },
  },
} as const;

function toView(candidate: CandidateWithOrientation): OrientationView {
  return {
    referenceNumber: candidate.referenceNumber,
    fullName: candidate.fullName,
    status: candidate.status,
    orientation: candidate.orientation
      ? {
          currentSectionId: candidate.orientation.currentSectionId,
          completedAt: candidate.orientation.completedAt?.toISOString() ?? null,
          acknowledgedAt:
            candidate.orientation.acknowledgedAt?.toISOString() ?? null,
          sections: candidate.orientation.sections.map((section) => ({
            id: section.sectionId,
            completedAt: section.completedAt.toISOString(),
          })),
        }
      : null,
  };
}

async function loadCandidate(reference: string): Promise<CandidateWithOrientation> {
  const normalized = reference.trim().toUpperCase();

  if (!REFERENCE_NUMBER_PATTERN.test(normalized)) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  const candidate = await db.candidate.findUnique({
    where: { referenceNumber: normalized },
    select: CANDIDATE_SELECT,
  });

  if (!candidate) {
    throw notFoundError(NOT_FOUND_MESSAGE);
  }

  return candidate as CandidateWithOrientation;
}

/** Read a candidate's orientation state. */
export async function getOrientationView(
  reference: string,
): Promise<OrientationView> {
  return toView(await loadCandidate(reference));
}

/**
 * Mark one section as read. Enforces sequential progress and moves
 * APPLICANT → ORIENTATION_PENDING on the candidate's first completed
 * section. Re-completing an already-completed section is an idempotent
 * no-op (safe against double submits and races).
 */
export async function completeOrientationSection(
  reference: string,
  input: OrientationSectionCompleteInput,
): Promise<OrientationView> {
  const candidate = await loadCandidate(reference);
  const section = getOrientationSection(input.sectionId);

  if (!section) {
    throw validationError("That section does not exist.", {
      sectionId: "That section does not exist.",
    });
  }

  if (candidate.orientation?.completedAt) {
    throw conflictError(
      "Your orientation is already complete, so sections can no longer be changed.",
    );
  }

  const completedIds = new Set(
    candidate.orientation?.sections.map((s) => s.sectionId) ?? [],
  );

  // Idempotent: the section is already marked as read.
  if (completedIds.has(section.id)) {
    return toView(candidate);
  }

  // Sequential enforcement — everything before this section must be read.
  const sectionIndex = ORIENTATION_SECTIONS.findIndex(
    (s) => s.id === section.id,
  );
  const missingPrior = ORIENTATION_SECTIONS.slice(0, sectionIndex).find(
    (s) => !completedIds.has(s.id),
  );

  if (missingPrior) {
    throw validationError(
      `Sections are completed in order. Finish "${missingPrior.title}" first.`,
      { sectionId: `Finish "${missingPrior.title}" first.` },
    );
  }

  await db.$transaction(async (tx) => {
    const orientation = await tx.orientation.upsert({
      where: { candidateId: candidate.id },
      create: { candidateId: candidate.id },
      update: {},
      select: { id: true },
    });

    await tx.orientationSection.create({
      data: { orientationId: orientation.id, sectionId: section.id },
    });

    const remainingIds = new Set(completedIds);
    remainingIds.add(section.id);
    const nextSection = ORIENTATION_SECTIONS.find(
      (s) => !remainingIds.has(s.id),
    );

    await tx.orientation.update({
      where: { id: orientation.id },
      data: { currentSectionId: nextSection?.id ?? section.id },
    });

    // First section completed → the candidate has started orientation.
    if (candidate.status === "APPLICANT") {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "ORIENTATION_PENDING" },
      });
      await tx.stageEvent.create({
        data: {
          candidateId: candidate.id,
          stage: "ORIENTATION",
          type: "ENTERED",
          description: "Started the Staff Orientation Workshop",
        },
      });
    }
  });

  return getOrientationView(reference);
}

/**
 * Explicitly complete the orientation. Requires every section to be read
 * and the integrity acknowledgement to be confirmed. Moves the candidate to
 * ORIENTATION_COMPLETED and records the COMPLETED StageEvent.
 */
export async function completeOrientation(
  reference: string,
  input: OrientationCompleteInput,
): Promise<OrientationView> {
  const candidate = await loadCandidate(reference);

  // Idempotent: orientation is already complete.
  if (candidate.orientation?.completedAt) {
    return toView(candidate);
  }

  const completedCount = candidate.orientation?.sections.length ?? 0;
  if (completedCount < ORIENTATION_SECTIONS.length) {
    throw validationError(
      "Every section must be marked as read before you can complete your orientation.",
    );
  }

  if (input.acknowledgement !== true) {
    throw validationError(
      "Please confirm the declaration to complete your orientation.",
      {
        acknowledgement:
          "Please confirm the declaration to complete your orientation.",
      },
    );
  }

  const now = new Date();

  // The ORIENTATION_COMPLETED intent is queued in the SAME transaction as
  // the completion itself (outbox pattern — brief §13); the Mailjet send
  // happens only after the commit, fire-and-forget (§12/§16).
  let deliveryId: string | null = null;
  await db.$transaction(async (tx) => {
    await tx.orientation.update({
      where: { candidateId: candidate.id },
      data: {
        completedAt: now,
        acknowledgedAt: now,
        currentSectionId:
          candidate.orientation?.currentSectionId ??
          ORIENTATION_SECTIONS[ORIENTATION_SECTIONS.length - 1].id,
      },
    });

    // Only advance the status when the candidate is actually at the
    // orientation stage — never downgrade a later status.
    if (
      candidate.status === "APPLICANT" ||
      candidate.status === "ORIENTATION_PENDING"
    ) {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "ORIENTATION_COMPLETED" },
      });
    }

    await tx.stageEvent.create({
      data: {
        candidateId: candidate.id,
        stage: "ORIENTATION",
        type: "COMPLETED",
        description: "Completed the Staff Orientation Workshop",
      },
    });

    const enqueued = await enqueueNotification(tx, {
      type: "ORIENTATION_COMPLETED",
      dedupeKey: buildDedupeKey("ORIENTATION_COMPLETED", candidate.id),
      candidateId: candidate.id,
      recipientEmail: candidate.email,
    });
    deliveryId = enqueued.deliveryId;
  });

  if (deliveryId) {
    dispatchNotification(deliveryId);
  }

  return getOrientationView(reference);
}
