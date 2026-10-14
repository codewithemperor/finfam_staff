import type { AgreementSection } from "@/types/recruitment";

/**
 * FinFam Responsibility & Reward Policy — stage 3 content (CLIENT-SAFE).
 *
 * Section 5: FINFAM RESPONSIBILITY & REWARD POLICY ACCEPTANCE
 * Marketing & Customer Care Executive Offer Review.
 *
 * The `version` below is the content identifier recorded with every acceptance
 * (agreements.version) — any meaning-bearing change MUST bump the version so
 * accepted versions stay auditable.
 *
 * v2.0 (current): Full official policy text and reward structure update.
 * Reward structure confirmed:
 * - Monthly Earnings = Established Member (₦650) + Referral Bonus (₦500)
 * - 1 Established Member = ₦650
 * - 1 Referral Bonus = ₦500 (per New User onboarded who reaches threshold of ₦2,000)
 * - Established Member threshold = ₦2,000 maintained within first month
 * - Worked examples: 100 members = ₦115,000; 200 members = ₦230,000
 * - Monthly Performance Target = 200 Established Members (8/day for 25 days)
 * - Below target earnings paid based on number achieved
 */
export const AGREEMENT_META = {
  version: "2.0",
} as const;

/**
 * The acknowledgement the candidate must explicitly confirm before the
 * Accept action opens.
 */
export const AGREEMENT_ACKNOWLEDGEMENT_LABEL =
  "I Accept the FinFam Responsibility & Reward Policy";

export const AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    id: "your-role",
    title: "YOUR ROLE AT FINFAM",
    blocks: [
      {
        type: "heading",
        text: "Marketing & Customer Care Executive",
      },
      {
        type: "paragraph",
        text: "As a Marketing & Customer Care Executive, you are a FINFAM GROWTH AMBASSADOR.",
      },
      {
        type: "paragraph",
        text: "Your responsibility is to help build a strong financial community by:",
      },
      {
        type: "list",
        items: [
          "✓ Introducing individuals, groups, and businesses to FinFam",
          "✓ Educating prospective members about FinFam opportunities",
          "✓ Supporting members during their onboarding journey",
          "✓ Encouraging consistent savings habits",
          "✓ Providing excellent customer care",
          "✓ Building trust and long-term relationships",
        ],
      },
      {
        type: "paragraph",
        text: "You are not only acquiring members. You are helping people build stronger financial futures.",
      },
    ],
  },
  {
    id: "core-responsibilities",
    title: "CORE RESPONSIBILITIES",
    blocks: [
      {
        type: "heading",
        text: "A. Community Building",
      },
      {
        type: "paragraph",
        text: "Your primary responsibility is to contribute to FinFam community growth. You are expected to:",
      },
      {
        type: "list",
        items: [
          "✓ Identify potential individuals, groups, and communities that can benefit from FinFam",
          "✓ Create and maintain a list of prospects",
          "✓ Introduce prospects to FinFam professionally",
          "✓ Support successful membership registration",
          "✓ Guide members through their first steps",
          "✓ Maintain positive relationships with members",
        ],
      },
      {
        type: "heading",
        text: "B. Supporting Consistent Savings",
      },
      {
        type: "paragraph",
        text: "Your role continues after member registration. You should encourage members to:",
      },
      {
        type: "list",
        items: [
          "✓ Make their first deposit",
          "✓ Activate savings goals",
          "✓ Build consistent saving habits",
          "✓ Fund their Main Balance regularly",
          "✓ Remain active within the FinFam ecosystem",
        ],
      },
      {
        type: "paragraph",
        text: "Remember: A registered member is the beginning. An active and consistent member represents meaningful growth.",
      },
      {
        type: "heading",
        text: "C. Connections Explore",
      },
      {
        type: "paragraph",
        text: "FinFam believes in the power of community. You are expected to encourage members to:",
      },
      {
        type: "list",
        items: [
          "✓ Connect trusted family members and friends",
          "✓ Build supportive financial networks",
          "✓ Participate actively in the FinFam community",
        ],
      },
      {
        type: "paragraph",
        text: "Strong connections help members achieve better financial outcomes.",
      },
    ],
  },
  {
    id: "support-package",
    title: "FINFAM STAFF SUPPORT PACKAGE",
    blocks: [
      {
        type: "paragraph",
        text: "Every approved Marketing & Customer Care Executive receives support resources to help perform effectively. These include:",
      },
      {
        type: "list",
        items: [
          "✓ FinFam Identity Card",
          "✓ FinFam Branded Shirt Design",
          "✓ Customisable Marketing Flyers",
          "✓ Orientation Materials",
          "✓ Training Resources",
        ],
      },
      {
        type: "paragraph",
        text: "FinFam provides the tools. Your responsibility is to use them professionally to grow the community.",
      },
    ],
  },
  {
    id: "reward-structure",
    title: "REWARD STRUCTURE",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam rewards staff based on meaningful community growth.",
      },
      {
        type: "paragraph",
        text: "Your monthly earnings are calculated using: MONTHLY EARNINGS = Established Member + Referral Bonus",
      },
      {
        type: "heading",
        text: "UNDERSTANDING POINT VALUE (PV):",
      },
      {
        type: "list",
        items: [
          "• 1 Established Member = ₦650",
          "• 1 Referral Bonus = ₦500",
        ],
      },
      {
        type: "paragraph",
        text: "PLEASE NOTE: ₦500 per New User you onboard that reaches threshold of ₦2,000.",
      },
      {
        type: "heading",
        text: "WHAT MAKES AN ESTABLISHED MEMBER AND REFERRAL BONUS",
      },
      {
        type: "paragraph",
        text: "A member qualifies as an Established Member when they complete all three requirements:",
      },
      {
        type: "list",
        items: [
          "1. Complete FinFam Membership Signup",
          "2. Make Their First Deposit",
          "3. Maintain Savings/Transaction Volume of Not Less Than ₦2,000 Within Their First Month",
        ],
      },
      {
        type: "paragraph",
        text: "The moment a member deposits minimum of ₦2,000, you get ₦500 Referral Bonus credited to your Main Balance.",
      },
      {
        type: "paragraph",
        text: "Earnings apply based on: ✅ Established Members created AND(+) ✅ Referral Bonus",
      },
      {
        type: "heading",
        text: "Earnings Examples",
      },
      {
        type: "list",
        items: [
          "100 Established Members: 100 × (₦650 + ₦500) = ₦115,000",
          "200 Established Members: 200 × (₦650 + ₦500) = ₦230,000",
        ],
      },
      {
        type: "heading",
        text: "Monthly Performance Target",
      },
      {
        type: "paragraph",
        text: "The FinFam monthly performance target is: 200 Established Members — that's 8 New Members Per Day for 25 Days. This target represents the level of strong community contribution expected from high-performing staff.",
      },
      {
        type: "paragraph",
        text: "However: 200 Established Members is not an earning limit. Every additional Established Member continues to attract ₦650 earnings and ₦500 Referral Bonus (that's altogether ₦1,150) for you.",
      },
      {
        type: "alert",
        tone: "accent",
        title: "Earning Security Note",
        text: "While we expect you to meet your target and earn fully, if you still perform below the expected target of 200 New Established Members, you will still be paid based on the number of Established Member(s) you achieve for the month.",
      },
    ],
  },
  {
    id: "staff-performance-reporting",
    title: "STAFF PERFORMANCE & REPORTING",
    blocks: [
      {
        type: "paragraph",
        text: "Although this is a remote role, FinFam operates as a digitally connected organisation. Every staff member is expected to demonstrate:",
      },
      {
        type: "list",
        items: [
          "✓ Accountability",
          "✓ Professionalism",
          "✓ Consistency",
          "✓ Transparency",
        ],
      },
      {
        type: "heading",
        text: "Daily Activity Reporting",
      },
      {
        type: "paragraph",
        text: "Every staff member shall submit daily reports covering:",
      },
      {
        type: "list",
        items: [
          "Community Building: Prospects contacted, Individuals/groups engaged, New members acquired, Established Members created",
          "Savings Activation: First deposits achieved, Savings goals activated, Member savings support provided",
          "Connections Explore: New community connections, Referral encouragement activities, Member engagement activities",
        ],
      },
      {
        type: "paragraph",
        text: "Daily reports shall be individually submitted and evaluated.",
      },
    ],
  },
  {
    id: "professional-conduct-ethics",
    title: "PROFESSIONAL CONDUCT & ETHICS",
    blocks: [
      {
        type: "paragraph",
        text: "Every FinFam representative must protect: Customer trust, Customer privacy, FinFam reputation, and Professional standards.",
      },
      {
        type: "heading",
        text: "Staff Must NOT:",
      },
      {
        type: "list",
        items: [
          "✗ Request customer passwords",
          "✗ Access customer accounts without authorization",
          "✗ Provide false information",
          "✗ Create fake accounts",
          "✗ Submit fraudulent reports",
          "✗ Misrepresent FinFam products or opportunities",
        ],
      },
      {
        type: "heading",
        text: "Fraud & Misrepresentation Policy",
      },
      {
        type: "paragraph",
        text: "Any fraudulent or unethical activity may result in: Immediate sanctions, Termination of appointment, Report to relevant government authorities, and Legal action and litigation where applicable.",
      },
    ],
  },
  {
    id: "quality-assurance-monitoring",
    title: "QUALITY ASSURANCE & MONITORING",
    blocks: [
      {
        type: "paragraph",
        text: "To maintain excellent service standards, FinFam may conduct: Performance reviews, Physical Monitoring and Evaluation visits, Unannounced spot checks, and Secret shopper assessments.",
      },
      {
        type: "paragraph",
        text: "Secret shoppers may engage staff as customers to evaluate: Response quality, Communication skills, Product knowledge, Professional behaviour, and Customer support effectiveness.",
      },
      {
        type: "paragraph",
        text: "Poor performance or unethical conduct may result in: Corrective actions, Additional training, Sanctions, or Termination of appointment where necessary.",
      },
    ],
  },
  {
    id: "policy-review",
    title: "POLICY REVIEW",
    blocks: [
      {
        type: "paragraph",
        text: "FinFam is a growing organisation. Therefore, all documents, policies, reward structures, and operational procedures are subject to continuous review and improvement. Staff will be informed of important updates when necessary.",
      },
    ],
  },
];
