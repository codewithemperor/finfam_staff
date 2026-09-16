/**
 * Staff Identity Card (Stage 10, CLIENT-SAFE) — presentation constants.
 *
 * The card is FULLY DERIVED from existing verified Staff records
 * (Session → StaffAccount → Staff → Candidate). Nothing here creates or
 * persists data: there is no StaffIdentityCard row, no card serial, no
 * expiry and no revocation state (brief §11/§15/§21/§25). This config owns
 * only the card's presentation-template identity.
 *
 * Approved MVP decisions encoded here (brief §14–§24):
 *  - Fields: full name, Staff ID, appointment designation ("Remote Staff"),
 *    operational role ("FinFam Growth Ambassador"), activated date, card
 *    label and template version. Designation and operational role stay
 *    SEPARATE facts.
 *  - FORBIDDEN on the card: NIN, BVN, bank details, address, next of kin,
 *    candidate reference, appointment reference, email, phone,
 *    government-ID numbers, account/session identifiers.
 *  - NO photo (the platform stores no photograph — brief §17), NO QR
 *    (no verification system exists — brief §22), NO signature (no
 *    approved signature asset exists — brief §23), NO expiry (no policy
 *    exists — brief §21).
 *  - Branding uses the established in-product brand treatment only;
 *    public/logo.svg is unconfirmed and must not be used on the card
 *    until FinFam supplies/confirms an official print-safe logo
 *    (brief §18).
 */

/** Presentation-template version only — never persisted (brief §19). */
export const STAFF_ID_CARD_TEMPLATE_VERSION = "1.0";

/** The card's own label (also the accessible heading of the card). */
export const STAFF_ID_CARD_LABEL = "Staff Identity Card";

/** Required disclaimer, shown under the card (brief §24, verbatim). */
export const STAFF_ID_CARD_DISCLAIMER =
  "This card is generated from your FinFam Staff Portal records. It is an identity reference only and is not a government-issued identity document.";

/** Page copy for /staff/id-card. */
export const STAFF_ID_CARD_PAGE_TITLE = "Staff ID Card";
export const STAFF_ID_CARD_PAGE_INTRO =
  "A printable identity representation generated from your verified FinFam Staff Portal records. Your Staff ID is shown exactly as issued.";

/** What the card is — honest scope (kept short, brief §24). */
export const STAFF_ID_CARD_ABOUT_IS = [
  "Generated from your verified Staff Portal records.",
  "An identity reference for FinFam staff purposes.",
  "Carries your official Staff ID, assigned at activation.",
] as const;

/** What the card is not. */
export const STAFF_ID_CARD_ABOUT_IS_NOT = [
  "A government-issued identity document.",
  "A replacement for NIN or any official ID.",
  "A login credential — your Staff ID is never used to sign in.",
] as const;
