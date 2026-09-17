import {
  STAFF_ID_CARD_LABEL,
  STAFF_ID_CARD_TEMPLATE_VERSION,
} from "@/config/staff-id-card";
import Image from "next/image";

export interface StaffIdCardProps {
  fullName: string;
  staffId: string;
  designation: string;
  operationalRole: string;
  /** Preformatted "d MMMM yyyy" activation label (Africa/Lagos facts). */
  activatedAtLabel: string;
}

/**
 * StaffIdCard (Stage 10, brief §11–§29) — the visual credential.
 *
 * FULLY DERIVED presentation: every value comes from the verified session
 * chain; nothing is editable, persisted, or re-typed. Approved decisions
 * encoded in the markup:
 *  - Semantic HTML (section → heading → dl → dt/dd) — the card is real
 *    text, never an image/canvas (brief §29).
 *  - The brand tile reuses the EXACT in-product treatment from the portal
 *    header (green tile + wordmark) — no invented logo, seal, signature,
 *    watermark, gradient or hologram (brief §18). The tile is decorative
 *    (aria-hidden); the wordmark is real text.
 *  - NO photo, NO QR, NO signature, NO expiry — structurally absent
 *    (brief §17/§21/§22/§23). The only identifier is the official
 *    FF-STF-NNNN Staff ID (brief §15).
 *  - Screen proportions follow the standard ID-card aspect ratio; print
 *    renders the card at true 85.6mm × 54mm via the shared print
 *    architecture (brief §26–§28) — not a FinFam manufacturing spec.
 *  - `print-color-adjust: exact` keeps the brand tile green in printed
 *    output without touching the global stylesheet.
 */
export function StaffIdCard({
  fullName,
  staffId,
  designation,
  operationalRole,
  activatedAtLabel,
}: StaffIdCardProps) {
  return (
    <section
      aria-labelledby="staff-id-card-title"
      data-testid="staff-id-card"
      className="mx-auto flex aspect-[856/540] w-full max-w-[26rem] flex-col justify-between overflow-hidden rounded-xl border border-border bg-white p-5 text-foreground shadow-sm [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:mt-2 print:w-[85.6mm] print:max-w-none print:rounded-md print:p-3"
    >
      {/* Brand row — the established in-product brand treatment. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src="/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain print:size-6"
          />
          <span className="text-base font-bold tracking-tight text-foreground print:text-sm">
            FinFam
          </span>
        </div>
        <h2
          id="staff-id-card-title"
          className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] print:text-[8px]"
        >
          {STAFF_ID_CARD_LABEL}
        </h2>
      </div>

      {/* Name + official Staff ID — the visual anchors. */}
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl print:text-sm">
          {fullName}
        </p>
        <p className="mt-1 font-mono text-sm font-semibold tracking-[0.18em] text-foreground sm:text-base print:mt-0.5 print:text-xs">
          {staffId}
        </p>
      </div>

      {/* Designation and operational role as SEPARATE facts (brief §14). */}
      <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-1 text-[11px] sm:text-xs print:text-[8px]">
        <dt className="text-muted-foreground">Appointment designation</dt>
        <dd className="min-w-0 font-semibold text-foreground">{designation}</dd>
        <dt className="text-muted-foreground">Operational role</dt>
        <dd className="min-w-0 font-semibold text-foreground">{operationalRole}</dd>
        <dt className="text-muted-foreground">Activated</dt>
        <dd className="min-w-0 font-semibold text-foreground">{activatedAtLabel}</dd>
      </dl>

      {/* Card footer — template version only; no serial, no expiry. */}
      <div className="flex items-center justify-between gap-3 border-t border-divider pt-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px] print:pt-1 print:text-[7px]">
        <span>Identity reference only</span>
        <span>{`Card template v${STAFF_ID_CARD_TEMPLATE_VERSION}`}</span>
      </div>
    </section>
  );
}
