import { format } from "date-fns";

import {
  APPOINTMENT_DOCUMENT_TITLE,
  APPOINTMENT_ORGANISATION,
  APPOINTMENT_SIGNATORY_LINES,
} from "@/config/appointment";
import type {
  AppointmentBlock,
  IssuedAppointmentView,
} from "@/types/recruitment";

/**
 * Renders one appointment-letter body block as plain, readable document
 * typography — the same philosophy as the agreement renderer: whitespace
 * and hierarchy, not nested cards. Rendered identically on screen and in
 * print/save-as-PDF (single content source, no duplicate template).
 */
function AppointmentLetterBlock({ block }: { block: AppointmentBlock }) {
  switch (block.type) {
    case "subheading":
      return (
        <h3 className="print-break-after-avoid mt-8 text-base font-semibold tracking-tight text-foreground first:mt-0">
          {block.text}
        </h3>
      );
    case "paragraph":
      return (
        <p className="print-avoid-break mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground first:mt-0">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul className="mt-4 max-w-[68ch] list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0">
          {block.items.map((item) => (
            <li key={item} className="print-avoid-break">
              {item}
            </li>
          ))}
        </ul>
      );
    case "alert":
      return (
        <div
          className="print-avoid-break mt-6 max-w-[68ch] rounded-lg border-l-4 border-primary bg-surface px-4 py-3.5 first:mt-0"
          role="note"
          aria-label={block.title}
        >
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

/**
 * The Provisional Letter of Appointment — a formal, self-contained
 * document: letterhead, dated metadata, subject, salutation, body and a
 * text-only closing. Every value comes from the issued record's snapshot
 * (never from client input) and the content from the version pinned on
 * that record, so a printed copy always matches the issued letter.
 *
 * There are no signature images by design: no official signature assets
 * exist, and none may be invented — the letter closes with
 * "Management, FinFam" as text.
 */
export function AppointmentLetter({
  appointment,
}: {
  appointment: IssuedAppointmentView;
}) {
  return (
    <article
      aria-label="Provisional Letter of Appointment"
      className="max-w-[720px]"
    >
      {/* Letterhead */}
      <header className="print-break-after-avoid">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {APPOINTMENT_ORGANISATION}
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {APPOINTMENT_DOCUMENT_TITLE}
        </h2>
      </header>

      {/* Document metadata — printed, part of the letter itself */}
      <dl className="mt-6 grid gap-x-10 gap-y-2 border-t border-divider pt-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-sm text-muted-foreground">Date</dt>
        <dd className="text-sm font-semibold text-foreground">
          {format(new Date(appointment.issuedAt), "d MMMM yyyy")}
        </dd>
        <dt className="text-sm text-muted-foreground">
          Appointment reference
        </dt>
        <dd className="text-sm font-mono font-semibold tracking-wider text-foreground">
          {appointment.appointmentReference}
        </dd>
        <dt className="text-sm text-muted-foreground">Name</dt>
        <dd className="text-sm font-semibold text-foreground">
          {appointment.printedName}
        </dd>
      </dl>

      {/* Subject + salutation */}
      <p className="mt-8 max-w-[68ch] text-[15px] font-semibold leading-7 text-foreground">
        Subject: {appointment.content.subject}
      </p>
      <p className="mt-6 max-w-[68ch] text-[15px] leading-7 text-foreground">
        Dear {appointment.printedName},
      </p>

      {/* Body — resolved from the version pinned on the issued record */}
      <div className="mt-6 flex flex-col">
        {appointment.content.body.map((block, index) => (
          <AppointmentLetterBlock key={index} block={block} />
        ))}
      </div>

      {/* Closing — text only; no signature images are invented */}
      <div className="print-avoid-break mt-10 max-w-[68ch] text-[15px] leading-7 text-foreground">
        <p>Best regards,</p>
        {APPOINTMENT_SIGNATORY_LINES.map((line) => (
          <p key={line} className="mt-4 first:mt-8">
            {line}
          </p>
        ))}
      </div>
    </article>
  );
}
