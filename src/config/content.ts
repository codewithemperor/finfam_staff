/**
 * Scaffold landing-page content.
 *
 * Rules for this file:
 * - No marketing copy. Plain, human sentences.
 * - Nothing here may state reward figures until the business confirms them.
 */

export interface OpenPosition {
  /** The role title used across the portal (forms, applications, offers). */
  title: string;
  location: string;
  commitment: string;
  summary: string;
  responsibilities: string[];
  expectations: string[];
  /** Whether the public page should show reward figures. */
  showRewardFigures: boolean;
  rewardsNote: string;
}

export const OPEN_POSITION: OpenPosition = {
  title: "Marketing & Customer Care Executive",
  location: "Nigeria",
  commitment: "Full-time",
  summary:
    "FinFam is recruiting Marketing & Customer Care Executives to attract and onboard new members, support their savings contributions, and provide day-to-day customer care.",
  // TODO(business): replace with the official responsibilities list.
  responsibilities: [
    "Attract and onboard new FinFam members.",
    "Support FinFam members with their savings and contributions.",
    "Answer member questions accurately and politely.",
    "Keep member records complete and up to date.",
  ],
  // TODO(business): replace with the official expectations list.
  expectations: [
    "Communicate clearly and honestly with members.",
    "Handle member information with care and confidentiality.",
    "Follow FinFam policies and processes exactly as written.",
  ],
  showRewardFigures: false,
  rewardsNote:
    "The exact reward amount to earn and the savings threshold to become an Established Member will be shared with you in subsequent sections. This orientation does not publish figures, and no figure you may have seen elsewhere should be treated as final. You will receive the confirmed structure through this recruitment process before you are asked to accept any offer.",
};
