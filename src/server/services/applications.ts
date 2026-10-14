import { OPEN_POSITION } from "@/config/content";
import { db } from "@/lib/db";
import { conflictError } from "@/lib/errors";
import { generateReferenceNumber } from "@/lib/reference";
import { dispatchNotification, enqueueNotification } from "@/server/notifications/notification-service";
import { buildDedupeKey } from "@/server/notifications/notification-types";
import type { ApplicationFormInput } from "@/lib/validation/application";
import type { ApplicationSubmissionResult } from "@/types/recruitment";

const PRISMA_UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(
  error: unknown,
  field: string,
): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = Array.isArray(meta?.target) ? meta?.target : undefined;
  return code === PRISMA_UNIQUE_VIOLATION && (!target || target.includes(field));
}

/**
 * Create a candidate and their first application.
 *
 * The MVP has exactly one open role, so the server decides the role title —
 * the client never supplies it. Candidate PII lives only in the database and
 * is never logged here.
 *
 * The APPLICATION_RECEIVED notification intent is queued in the SAME
 * transaction as the candidate/application/event creation (outbox pattern —
 * brief §13); the Mailjet delivery is attempted only after the transaction
 * commits, fire-and-forget, and can never fail or delay the response (§12).
 */
export async function submitApplication(
  input: ApplicationFormInput,
): Promise<ApplicationSubmissionResult> {
  const roleTitle = OPEN_POSITION.title;

  try {
    const { candidate, deliveryId } = await db.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          referenceNumber: generateReferenceNumber(),
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          residentialAddress: input.residentialAddress,
          city: input.city,
          state: input.state,
          highestQualification: input.highestQualification,
          institution: input.institution,
          courseOfStudy: input.courseOfStudy,
          graduationYear: input.graduationYear,
          cvUrl: input.cvUrl,
          passportPhotoUrl: input.passportPhotoUrl,
          idCardUrl: input.idCardUrl,
          status: "APPLICANT",
          applications: {
            create: {
              roleTitle,
            },
          },
          events: {
            create: {
              stage: "APPLICATION",
              type: "COMPLETED",
              description: "Application submitted",
            },
          },
        },
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          createdAt: true,
        },
      });

      const enqueued = await enqueueNotification(tx, {
        type: "APPLICATION_RECEIVED",
        dedupeKey: buildDedupeKey("APPLICATION_RECEIVED", candidate.id),
        candidateId: candidate.id,
        recipientEmail: input.email,
      });

      return { candidate, deliveryId: enqueued.deliveryId };
    });

    // Post-commit: attempt the actual send without blocking the response.
    if (deliveryId) {
      dispatchNotification(deliveryId);
    }

    return {
      referenceNumber: candidate.referenceNumber,
      status: candidate.status,
      submittedAt: candidate.createdAt.toISOString(),
    };
  } catch (error) {
    if (isUniqueViolation(error, "email")) {
      throw conflictError(
        "An application with this email address already exists. Check your application status with your reference number, or contact us if you have lost it.",
        { email: "This email address has already been used to apply." },
      );
    }
    throw error;
  }
}
