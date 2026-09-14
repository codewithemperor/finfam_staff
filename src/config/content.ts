/**
 * Scaffold landing-page content.
 *
 * TODO(business): the official FinFam recruitment material (role details,
 * responsibilities, expectations, reward figures) is applied in the next
 * phase. Figures in the source material contain contradictions that must be
 * resolved first — see docs/CONTENT-QUESTIONS.md.
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
  /**
   * True while reward figures await business confirmation. When false, the
   * confirmed reward content replaces the placeholder notice.
   */
  rewardsPending: boolean;
  rewardsNote: string;
}

export const OPEN_POSITION: OpenPosition = {
  title: "Staff Member",
  location: "Nigeria",
  commitment: "Full-time",
  summary:
    "FinFam is recruiting Staff Members to support members with savings, contributions and day-to-day service. Details of the role will be published here as the business finalises the official recruitment content.",
  // TODO(business): replace with the official responsibilities list.
  responsibilities: [
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
  rewardsPending: true,
  rewardsNote:
    "The reward structure for this role is being finalised. FinFam does not publish reward figures until they are confirmed by the business, so this page will be updated once the confirmed structure is available.",
};
