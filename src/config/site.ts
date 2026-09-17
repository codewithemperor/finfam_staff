/**
 * Global site configuration.
 * Contact details are placeholders until the business supplies final values —
 * see docs/CONTENT-QUESTIONS.md.
 */
export const siteConfig = {
  name: "FinFam Recruitment",
  shortName: "FinFam",
  description:
    "Apply for the FinFam Staff Member role and follow your recruitment journey.",
  support: {
    /**
     * BUSINESS INPUT REQUIRED (production-readiness remediation §35): no
     * real support inbox has been supplied. This reserved `.example`
     * address is a placeholder that must NEVER render to production users —
     * the footer renders a real mailto link ONLY when the production
     * deployment configures SUPPORT_CONTACT_EMAIL (see .env.example), and
     * otherwise shows honest pending copy. Never fabricate a real-looking
     * FinFam address here.
     */
    placeholderEmail: "recruitment@finfam.example",
  },
  nav: [
    { href: "/", label: "Open roles" },
    { href: "/#process", label: "How it works" },
    { href: "/continue", label: "Continue application" },
  ],
} as const;
