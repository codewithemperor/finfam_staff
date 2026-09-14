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
    email: "recruitment@finfam.example", // TODO(business): replace with the real support inbox
  },
  nav: [
    { href: "/", label: "Open roles" },
    { href: "/orientation", label: "Orientation" },
    { href: "/status", label: "Check status" },
  ],
} as const;
