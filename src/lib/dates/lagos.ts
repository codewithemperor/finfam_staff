/**
 * Africa/Lagos reporting-date utilities (Stage 8).
 *
 * The single place in the application that converts between wall-clock
 * instants and Nigerian reporting-calendar dates. NO reporting business
 * logic may depend on the host machine's timezone — every conversion goes
 * through this file (Stage 8 brief §3).
 *
 * Why a fixed offset: Africa/Lagos observes +01:00 year-round with no
 * daylight-saving time (IANA), so a constant 60-minute shift is exact for
 * every past and future date and needs no timezone database or external
 * dependency.
 *
 * Storage convention for `DailyReport.reportDate` (a Postgres DATE via
 * Prisma `@db.Date`): the calendar date is represented in JavaScript as
 * UTC midnight of that date (e.g. Lagos "2026-09-16" is stored as
 * 2026-09-16T00:00:00.000Z). Prisma serialises that instant verbatim and
 * Postgres stores the plain date; reading it back yields the same UTC
 * midnight, so the calendar date round-trips exactly. The helpers below
 * are the ONLY code aware of this convention.
 */

import "server-only";

/** Africa/Lagos is permanently UTC+01:00 (no DST). */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Strict "YYYY-MM-DD" shape. */
const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Shift an instant into Lagos wall-clock (then read with UTC getters). */
function lagosShifted(instant: Date): Date {
  return new Date(instant.getTime() + LAGOS_OFFSET_MS);
}

/** The current instant. Named for intent — never `new Date()` ad hoc. */
export function lagosNow(): Date {
  return new Date();
}

/** Today's reporting date in Africa/Lagos, as "YYYY-MM-DD". */
export function lagosTodayISO(): string {
  return toLagosDateString(lagosNow());
}

/** The Lagos calendar date ("YYYY-MM-DD") a given instant falls on. */
export function toLagosDateString(instant: Date): string {
  const shifted = lagosShifted(instant);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a strict "YYYY-MM-DD" string and validate it as a real calendar
 * date (rejects e.g. "2026-02-31" and "2026-9-16"). Returns null when
 * invalid — callers decide the error surface.
 */
export function parseLagosDateISO(value: string): string | null {
  if (!DATE_ISO_PATTERN.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

/**
 * The UTC-midnight representation of a Lagos calendar date — the exact
 * value stored in the `reportDate` DATE column (see storage convention).
 * Input must already be validated with `parseLagosDateISO`.
 */
export function lagosDateISOToUtcMidnight(dateISO: string): Date {
  return new Date(
    Date.UTC(
      Number(dateISO.slice(0, 4)),
      Number(dateISO.slice(5, 7)) - 1,
      Number(dateISO.slice(8, 10)),
    ),
  );
}

/**
 * Read a stored `reportDate` (UTC midnight of the calendar date) back to
 * its "YYYY-MM-DD" Lagos date. Reads the UTC parts directly — a stored
 * DATE is exactly UTC midnight, so no shift is applied.
 */
export function lagosDateISOFromUtcMidnight(stored: Date): string {
  const year = stored.getUTCFullYear();
  const month = String(stored.getUTCMonth() + 1).padStart(2, "0");
  const day = String(stored.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The first day (UTC-midnight representation) of the Lagos month a
 * "YYYY-MM" string refers to. Used for month-bounded history queries.
 */
export function lagosMonthToUtcMidnight(monthISO: string): Date {
  return new Date(
    Date.UTC(Number(monthISO.slice(0, 4)), Number(monthISO.slice(5, 7)) - 1, 1),
  );
}

/** The month immediately after a "YYYY-MM" string, as "YYYY-MM". */
export function nextLagosMonth(monthISO: string): string {
  const year = Number(monthISO.slice(0, 4));
  const month = Number(monthISO.slice(5, 7));
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The month immediately before a "YYYY-MM" string, as "YYYY-MM". */
export function previousLagosMonth(monthISO: string): string {
  const year = Number(monthISO.slice(0, 4));
  const month = Number(monthISO.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** The current Lagos month, as "YYYY-MM". */
export function lagosCurrentMonthISO(): string {
  return toLagosDateString(lagosNow()).slice(0, 7);
}

/**
 * Calendar-day difference from `a` to `b` (positive when b is later).
 * Both are "YYYY-MM-DD" strings; computed on the UTC timeline of their
 * midnights so DST can never distort the count (Lagos has none).
 */
export function lagosDaysBetween(a: string, b: string): number {
  const ms =
    lagosDateISOToUtcMidnight(b).getTime() -
    lagosDateISOToUtcMidnight(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/* -------------------------------------------------------------------------
 * Machine-independent LABELS. date-fns' `format` renders in the HOST
 * timezone, so labels here shift the instant into Lagos wall-clock and
 * format its UTC parts by hand — identical output on any server.
 * ---------------------------------------------------------------------- */

/** "16 September 2026" — the human label for a "YYYY-MM-DD" date. */
export function formatLagosDateLabel(dateISO: string): string {
  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  const day = Number(dateISO.slice(8, 10));
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Tue, 16 Sep 2026" — compact history-row label with weekday. */
export function formatLagosDateCompact(dateISO: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ] as const;
  const weekday = lagosDateISOToUtcMidnight(dateISO).getUTCDay();
  return `${days[weekday]}, ${Number(dateISO.slice(8, 10))} ${
    shortMonths[Number(dateISO.slice(5, 7)) - 1]
  } ${dateISO.slice(0, 4)}`;
}

/** "6:42 PM" — the Lagos wall-clock time of an instant. */
export function formatLagosTimeLabel(instant: Date): string {
  const shifted = lagosShifted(instant);
  const hours24 = shifted.getUTCHours();
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${suffix}`;
}

/** "16 September 2026 at 6:42 PM" — full submission-time label. */
export function formatLagosDateTimeLabel(instant: Date): string {
  return `${formatLagosDateLabel(toLagosDateString(instant))} at ${formatLagosTimeLabel(instant)}`;
}
