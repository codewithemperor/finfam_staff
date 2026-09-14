/**
 * FinFam Automated Interview Assessment — stage 2 content (CLIENT-SAFE).
 *
 * This file is intentionally safe to import from client components: it
 * contains ONLY the question id, text, options and a display category.
 *
 * The answer key, the per-question insight and the attempt policy live in
 * `src/server/assessment-content.ts`, which is guarded by `server-only` and
 * must NEVER be imported from client code. Scoring happens exclusively on
 * the server (see src/server/services/assessment.ts).
 *
 * Content rules (see docs/CONTENT-QUESTIONS.md):
 * - Every question is derived strictly from the FinFam Staff Orientation
 *   Workshop content (src/config/orientation.ts).
 * - No reward figures, no Established Member threshold numbers, and no
 *   unconfirmed benefit claims (including the ₦500 cashback item).
 */

export type AssessmentCategory =
  | "FinFam identity"
  | "Products & services"
  | "Your role"
  | "Professional standards"
  | "Ethics & integrity";

export interface AssessmentQuestion {
  /** Stable id — the only question identifier exposed to the client. */
  id: string;
  text: string;
  /** Exactly four options, in display order. */
  options: [string, string, string, string];
  /** Display-only grouping. */
  category: AssessmentCategory;
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ------------------------------------------------------------------
  // FinFam identity
  // ------------------------------------------------------------------
  {
    id: "q-01",
    text: "What does FINFAM stand for?",
    options: [
      "Financially Blessed Family",
      "Family Finance Foundation",
      "Financial Freedom Family",
      "Fintech for Families",
    ],
    category: "FinFam identity",
  },
  {
    id: "q-02",
    text: "Which of the following best describes what FinFam is?",
    options: [
      "A private lending company",
      "A government-registered digital cooperative ecosystem",
      "A foreign exchange trading platform",
      "A government ministry for family welfare",
    ],
    category: "FinFam identity",
  },
  {
    id: "q-03",
    text: "FinFam is built around one central purpose. What is it?",
    options: [
      "Helping people save, grow and prosper",
      "Providing free bank accounts to everyone",
      "Selling insurance products to families",
      "Offering interest-free loans to businesses",
    ],
    category: "FinFam identity",
  },
  {
    id: "q-04",
    text: "In the Save. Grow. Prosper. purpose, what does “Prosper” describe?",
    options: [
      "Winning rewards for inviting the most members",
      "Doubling savings within a fixed period",
      "Financial stability that members can sustain and pass on to their families",
      "Reaching the top membership tier as quickly as possible",
    ],
    category: "FinFam identity",
  },
  {
    id: "q-05",
    text: "According to the orientation, why do members trust FinFam with their money and personal information?",
    options: [
      "Because FinFam guarantees a profit on every deposit",
      "Because it is a registered cooperative they can hold accountable",
      "Because staff personally guarantee each member's savings",
      "Because the government insures all member savings",
    ],
    category: "FinFam identity",
  },

  // ------------------------------------------------------------------
  // Products & services
  // ------------------------------------------------------------------
  {
    id: "q-06",
    text: "Which service is described as the core of FinFam?",
    options: [
      "Fixed asset trading",
      "Emergency cash loans",
      "Foreign currency exchange",
      "Structured savings",
    ],
    category: "Products & services",
  },
  {
    id: "q-07",
    text: "What makes structured savings work for a member?",
    options: [
      "Saving large amounts once or twice a year",
      "Consistency — saving regularly on a schedule",
      "Saving only when there is money left over",
      "Moving savings between products every week",
    ],
    category: "Products & services",
  },
  {
    id: "q-08",
    text: "A member asks you exactly how much financial support they will receive and when. What should you do?",
    options: [
      "Promise an amount so the member stays motivated",
      "Estimate a timeline based on what other members received",
      "Never promise an amount, timeline or outcome you have not had confirmed — point to the member policies",
      "Tell the member that support is always paid within one week",
    ],
    category: "Products & services",
  },
  {
    id: "q-09",
    text: "The details and conditions of FinFam's growth opportunities may change over time. How should you share them with members?",
    options: [
      "Point members to the current, official information rather than quoting from memory",
      "Share what you learned during your own onboarding",
      "Explain the details from memory — members prefer a personal touch",
      "Avoid discussing growth opportunities with members at all",
    ],
    category: "Products & services",
  },
  {
    id: "q-10",
    text: "What is the one rule that applies to representing every FinFam service?",
    options: [
      "Present it in the way that attracts the most new members",
      "Emphasise the benefits and leave out the conditions",
      "Adapt the details to suit each member's situation",
      "Represent it exactly as FinFam defines it — ask rather than guess",
    ],
    category: "Products & services",
  },

  // ------------------------------------------------------------------
  // Your role
  // ------------------------------------------------------------------
  {
    id: "q-11",
    text: "What is the official role title used in this recruitment?",
    options: [
      "FinFam Sales Officer",
      "Marketing & Customer Care Executive",
      "Community Savings Manager",
      "Member Relations Officer",
    ],
    category: "Your role",
  },
  {
    id: "q-12",
    text: "The role is also known by another name. Which one?",
    options: [
      "FinFam Field Officer",
      "FinFam Cooperative Secretary",
      "FinFam Growth Ambassador",
      "FinFam Branch Coordinator",
    ],
    category: "Your role",
  },
  {
    id: "q-13",
    text: "Which four responsibilities make up the core of the role?",
    options: [
      "Recruitment, training, auditing and reporting",
      "Marketing, accounting, lending and compliance",
      "Community building, savings consistency, customer care and member support",
      "Sales, promotions, collections and administration",
    ],
    category: "Your role",
  },
  {
    id: "q-14",
    text: "According to the orientation, which member benefits more from FinFam?",
    options: [
      "A member who saves once and stops",
      "A member who saves small amounts regularly",
      "A member who saves only when rewards are announced",
      "A member who saves a single large amount once a year",
    ],
    category: "Your role",
  },
  {
    id: "q-15",
    text: "A member asks you a question you cannot answer from memory. What does the orientation expect from you?",
    options: [
      "Give your best guess so the member is not kept waiting",
      "Politely decline to answer and end the conversation",
      "Refer the member to a senior manager immediately",
      "Respond politely, give honest answers and follow up until the question is resolved",
    ],
    category: "Your role",
  },

  // ------------------------------------------------------------------
  // Professional standards
  // ------------------------------------------------------------------
  {
    id: "q-16",
    text: "How does the orientation describe the professional standards for FinFam team members?",
    options: [
      "As aspirations to work towards over time",
      "As conditions of the role, not suggestions",
      "As guidelines that apply only to new staff",
      "As targets that apply only during monitoring weeks",
    ],
    category: "Professional standards",
  },
  {
    id: "q-17",
    text: "What does “report accurately” require from you?",
    options: [
      "Reporting activity and results exactly as they happened — including when the numbers are low",
      "Reporting the numbers your team lead expects to see",
      "Adjusting figures slightly to reflect your effort",
      "Reporting only your strongest results",
    ],
    category: "Professional standards",
  },
  {
    id: "q-18",
    text: "Which of the following is part of staying accountable?",
    options: [
      "Fixing problems quietly so nobody has to know",
      "Blaming system errors for missed results",
      "Waiting until an issue is fully resolved before mentioning it",
      "Being responsible for your own activity and raising problems early",
    ],
    category: "Professional standards",
  },
  {
    id: "q-19",
    text: "How should you treat member information you handle in your role?",
    options: [
      "Use it for FinFam business only — never share or use it outside your role",
      "Share it with other members who might help them",
      "Keep it after you leave the role in case you return",
      "Use it for personal follow-ups with members you like",
    ],
    category: "Professional standards",
  },
  {
    id: "q-20",
    text: "When representing FinFam products and services, what is expected of you?",
    options: [
      "Describe them exactly as they are — never exaggerate, promise outcomes, or leave out conditions to close a sale",
      "Highlight whatever gets the member to sign up fastest",
      "Focus on the benefits; conditions can be explained after someone joins",
      "Give members the version of the details that suits their goals",
    ],
    category: "Professional standards",
  },
  {
    id: "q-21",
    text: "What role does daily reporting play in your work?",
    options: [
      "It is only needed at the end of each month",
      "It replaces the need for performance evaluation",
      "It is required only when a manager asks for it",
      "Reporting your activity and results is part of your routine work",
    ],
    category: "Professional standards",
  },
  {
    id: "q-22",
    text: "What does the orientation say about secret shoppers?",
    options: [
      "From time to time, people interact with staff as ordinary members so FinFam can anonymously check service quality",
      "They are only engaged when a member files a formal complaint",
      "They buy products in bulk so FinFam can resell them",
      "They are competitors gathering market information",
    ],
    category: "Professional standards",
  },
  {
    id: "q-23",
    text: "FinFam issues an update to an operational policy. What are you expected to do?",
    options: [
      "Wait for your team lead to summarise it before acting",
      "Review the update and apply it from the moment it takes effect — ask if anything is unclear",
      "Continue with the version you already know until reminded",
      "Decide for yourself whether the update applies to your work",
    ],
    category: "Professional standards",
  },

  // ------------------------------------------------------------------
  // Ethics & integrity
  // ------------------------------------------------------------------
  {
    id: "q-24",
    text: "Which of the following would be treated as fraud against FinFam and its members?",
    options: [
      "Reporting a member complaint to your team lead",
      "Registering a member who did not agree to join",
      "Asking a member to update their contact details",
      "Suggesting a member increase their savings amount",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-25",
    text: "A staff member inflates their daily numbers so their report looks better. How is this treated?",
    options: [
      "As normal sales enthusiasm",
      "As a minor oversight if the real numbers improve later",
      "As a false report — prohibited conduct that leads to dismissal",
      "As acceptable as long as the member activity was real",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-26",
    text: "Which of these is an example of misrepresenting FinFam products or services?",
    options: [
      "Telling a member what a product costs and what it does not guarantee",
      "Recommending that a member speak to FinFam before committing",
      "Reading a product's conditions aloud before a member joins",
      "Promising a member a guaranteed outcome the product does not provide",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-27",
    text: "A member shares their account password with you as a shortcut. What should you do?",
    options: [
      "Use it once to help them, then ask them to change it",
      "Accept it — helping members is part of the role",
      "Share it only with a team lead you trust",
      "Never use it — misuse of passwords or account access is prohibited",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-28",
    text: "What does the orientation say about fabricating member activity to create results?",
    options: [
      "It is fraud — there is no acceptable version of it",
      "It is tolerated during onboarding targets",
      "It is acceptable if no member loses money",
      "It is a matter for the member to report, not staff",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-29",
    text: "You realise you made an honest mistake in your work. What does the orientation advise?",
    options: [
      "Correct it silently to avoid drawing attention",
      "Stop and report it early — an honest mistake reported early is handled very differently from one that is covered up",
      "Discuss it only with the members affected",
      "Wait to see whether anyone notices before acting",
    ],
    category: "Ethics & integrity",
  },
  {
    id: "q-30",
    text: "You are unsure whether a certain action is acceptable. What should you do?",
    options: [
      "Check what other staff are doing and follow the majority",
      "Stop and ask before you act",
      "Proceed — intent matters more than the action itself",
      "Do it only once, then report it afterwards",
    ],
    category: "Ethics & integrity",
  },
];

export const ASSESSMENT_QUESTION_IDS = ASSESSMENT_QUESTIONS.map((q) => q.id);

/** Public, display-safe assessment facts (also shown in the introduction). */
export const ASSESSMENT_META = {
  totalQuestions: ASSESSMENT_QUESTIONS.length,
  /** Marks awarded per fully correct answer. */
  marksPerQuestion: 5,
  /** Maximum achievable score. */
  totalMarks: ASSESSMENT_QUESTIONS.length * 5,
  /** Pass mark as a percentage of total marks. */
  passMarkPercent: 70,
} as const;

export function getAssessmentQuestion(
  id: string,
): AssessmentQuestion | undefined {
  return ASSESSMENT_QUESTIONS.find((question) => question.id === id);
}
