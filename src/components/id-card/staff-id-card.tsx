import { STAFF_ID_CARD_LABEL } from "@/config/staff-id-card";
import Image from "next/image";

export interface StaffIdCardProps {
  fullName: string;
  staffId: string;
  role: string;
  workArrangement: string;
  /** Preformatted "d MMMM yyyy" activation label (Africa/Lagos facts). */
  activatedAtLabel: string;
  /** Verified passport photograph URL for the card. */
  passportPhotoUrl?: string | null;
}

/**
 * StaffIdCard — official FRONT of the printable Staff Identity Card.
 *
 * Screen proportions follow standard ISO/IEC 7810 ID-1 proportions (856:540).
 * Print renders the card at true 85.6mm × 54mm.
 * Passport photo is positioned on the right-hand side.
 */
export function StaffIdCard({
  fullName,
  staffId,
  role,
  workArrangement,
  activatedAtLabel,
  passportPhotoUrl,
}: StaffIdCardProps) {
  return (
    <section
      aria-labelledby="staff-id-card-title"
      data-testid="staff-id-card"
      className="mx-auto flex aspect-[856/540] w-full max-w-[28rem] flex-col justify-between overflow-hidden rounded-xl border border-border bg-white p-4 text-foreground shadow-sm [-webkit-print-color-adjust:exact] [print-color-adjust:exact] sm:p-5 print:mt-2 print:h-[54mm] print:w-[85.6mm] print:max-w-none print:rounded-md print:p-2.5 print:shadow-none"
    >
      {/* Brand row — top header */}
      <div className="flex items-center justify-between gap-2 border-b border-divider/60 pb-2 print:pb-1">
        <div className="flex items-center gap-2">
          <Image
            src="/icon-192.png"
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain print:size-5"
          />
          <span className="text-base font-bold tracking-tight text-foreground print:text-xs">
            FinFam
          </span>
        </div>
        <h2
          id="staff-id-card-title"
          className="rounded bg-emerald-50 px-2 py-0.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 border border-emerald-200/60 sm:text-[11px] print:border-none print:bg-transparent print:p-0 print:text-[7.5px]"
        >
          {STAFF_ID_CARD_LABEL}
        </h2>
      </div>

      {/* Main card body: details on left, passport on right */}
      <div className="my-auto flex items-center justify-between gap-3 sm:gap-4 print:gap-2">
        {/* Left column: Name, Staff ID, and employment details */}
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2 print:space-y-0.5">
          <div>
            <p className="truncate text-base font-extrabold leading-tight tracking-tight text-foreground sm:text-lg print:text-xs">
              {fullName}
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold tracking-[0.16em] text-emerald-700 sm:text-sm print:mt-0 print:text-[9px]">
              {staffId}
            </p>
          </div>

          <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-2.5 gap-y-0.5 text-[10.5px] sm:text-xs print:gap-x-1.5 print:text-[7.5px]">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="truncate font-semibold text-foreground">{role}</dd>
            <dt className="text-muted-foreground">Work</dt>
            <dd className="truncate font-semibold text-foreground">{workArrangement}</dd>
            <dt className="text-muted-foreground">Activated</dt>
            <dd className="truncate font-semibold text-foreground">{activatedAtLabel}</dd>
          </dl>
        </div>

        {/* Right column: Passport photograph */}
        <div className="flex shrink-0 items-center justify-center">
          <div className="relative aspect-[35/45] w-20 overflow-hidden rounded-md border-2 border-emerald-700/20 bg-zinc-100 shadow-xs sm:w-24 print:h-[26mm] print:w-[21mm] print:border-black/30">
            {passportPhotoUrl ? (
              <img
                src={passportPhotoUrl}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-muted-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-wider print:text-[6px]">
                  Passport Photo
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative clean bottom accent bar */}
      <div
        aria-hidden="true"
        className="h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 print:h-1"
      />
    </section>
  );
}

export interface StaffIdCardBackProps {
  staffId?: string;
}

/**
 * StaffIdCardBack — official BACK of the printable Staff Identity Card.
 *
 * Contains legal property notice, terms of use, and loss/return instructions.
 */
export function StaffIdCardBack({ staffId: _staffId }: StaffIdCardBackProps = {}) {
  return (
    <section
      aria-labelledby="staff-id-card-back-title"
      data-testid="staff-id-card-back"
      className="mx-auto flex aspect-[856/540] w-full max-w-[28rem] flex-col justify-between overflow-hidden rounded-xl border border-border bg-white p-4 text-foreground shadow-sm [-webkit-print-color-adjust:exact] [print-color-adjust:exact] sm:p-5 print:mt-2 print:h-[54mm] print:w-[85.6mm] print:max-w-none print:rounded-md print:p-2.5 print:shadow-none"
    >
      {/* Brand row — top header */}
      <div className="flex items-center justify-between gap-2 border-b border-divider/60 pb-2 print:pb-1">
        <div className="flex items-center gap-2">
          <Image
            src="/icon-192.png"
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain print:size-4"
          />
          <span className="text-xs font-bold tracking-tight text-foreground sm:text-sm print:text-[8.5px]">
            FinFam Official Identification
          </span>
        </div>
        <span
          id="staff-id-card-back-title"
          className="rounded bg-emerald-50 px-2 py-0.5 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-800 border border-emerald-200/60 print:border-none print:bg-transparent print:p-0 print:text-[6.5px]"
        >
          Card Terms
        </span>
      </div>

      {/* Main card back content */}
      <div className="my-auto space-y-3 text-[10px] leading-relaxed text-zinc-600 sm:space-y-4 sm:text-[11.5px] print:space-y-2 print:text-[7.5px]">
        <div>
          <p className="font-bold uppercase tracking-wider text-zinc-900 text-[9px] sm:text-[10px] print:text-[6.5px]">
            Property of FinFam
          </p>
          <p className="mt-1">
            This card is the exclusive property of FinFam and is issued to authorized personnel only. It must be surrendered immediately upon cessation of engagement or on official demand.
          </p>
        </div>

        <div>
          <p className="font-bold uppercase tracking-wider text-zinc-900 text-[9px] sm:text-[10px] print:text-[6.5px]">
            Loss & Return Instructions
          </p>
          <p className="mt-1">
            If found, please return to any FinFam branch office or the nearest police station.
          </p>
        </div>
      </div>
    </section>
  );
}
