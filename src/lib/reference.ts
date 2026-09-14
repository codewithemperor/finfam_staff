import { randomInt } from "crypto";

/**
 * Candidate reference numbers.
 *
 * Format: FF-XXXXXX where X comes from an unambiguous alphabet
 * (no I, L, O, 0, 1) so candidates can read them out or type them correctly.
 * A reference number is a lookup key, not an authentication token — the
 * status API only ever returns information the candidate already knows.
 */

export const REFERENCE_NUMBER_LENGTH = 6;

export const REFERENCE_NUMBER_PATTERN = /^FF-[A-HJ-KM-NP-Z2-9]{6}$/;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferenceNumber(): string {
  let suffix = "";
  for (let i = 0; i < REFERENCE_NUMBER_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `FF-${suffix}`;
}

/** Normalise user input before lookup (trim, uppercase, common mistakes). */
export function normalizeReferenceNumber(input: string): string {
  return input.trim().toUpperCase();
}
