/**
 * FinFam Recruitment Portal - Weekly Progress Report
 * STRAIGHT format per user template: no cover page, no TOC - content flows directly.
 * Mirrors /home/z/my-project/report.md with identical corrected facts.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");

const INK = "000000";          // straight working report -> black headings
const SECONDARY = "555555";
const RULE = "BECFCC";
const ACCENT = "0c7a43";       // FinFam green for quote bars only
const HEADER_BG = "529286";
const SURFACE = "E8ECEB";

const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const MONO = { ascii: "Courier New", eastAsia: "SimSun" };

function t(text, opts = {}) {
  return new TextRun({ text, size: 24, color: INK, font: FONT, ...opts });
}
function b(text, opts = {}) { return t(text, { bold: true, ...opts }); }
function code(text, opts = {}) {
  return new TextRun({ text, size: 22, color: INK, font: MONO, ...opts });
}
function codeB(text) { return code(text, { bold: true }); }

function p(runsOrText, opts = {}) {
  const children = Array.isArray(runsOrText) ? runsOrText : [t(runsOrText)];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120, ...(opts.spacing || {}) },
    ...opts, children,
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, keepNext: true,
    spacing: { before: 320, after: 130, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: INK, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, keepNext: true,
    spacing: { before: 220, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 26, color: INK, font: FONT })],
  });
}
function bullet(runsOrText) {
  const children = Array.isArray(runsOrText) ? runsOrText : [t(runsOrText)];
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 40 },
    children,
  });
}
function numbered(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { line: 312, after: 40 },
    children: [t(text)],
  });
}
function chain(text) {
  // bold state-transition / architecture chain on its own line
  return new Paragraph({
    spacing: { line: 312, before: 60, after: 140 },
    children: [codeB(text, { size: 23 })],
  });
}
function chainSans(text) {
  return new Paragraph({
    spacing: { line: 312, before: 60, after: 140 },
    children: [b(text)],
  });
}
function quote(runsOrText) {
  const children = Array.isArray(runsOrText) ? runsOrText : [t(runsOrText)];
  return new Paragraph({
    indent: { left: 480, right: 480 },
    spacing: { line: 312, before: 80, after: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 12 } },
    children,
  });
}
function rule() {
  return new Paragraph({
    spacing: { before: 120, after: 200, line: 312 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } },
    children: [new TextRun({ text: "", size: 2 })],
  });
}
function meta(label, value) {
  return new Paragraph({
    spacing: { line: 312, after: 40 },
    children: [b(label + ": "), t(value)],
  });
}

// ---------------- content ----------------
const body = [];

// Title block (straight - no cover page)
body.push(new Paragraph({
  spacing: { line: 480, lineRule: "atLeast", after: 60 },
  children: [new TextRun({ text: "FINFAM RECRUITMENT PORTAL", bold: true, size: 40, color: INK, font: FONT })],
}));
body.push(new Paragraph({
  spacing: { line: 340, lineRule: "atLeast", after: 200 },
  children: [new TextRun({ text: "Weekly Project Progress Report", bold: true, size: 28, color: SECONDARY, font: FONT })],
}));
body.push(meta("Project", "FinFam Recruitment Portal MVP"));
body.push(meta("Reporting Period", "Project Start \u2013 14 September 2026"));
body.push(meta("Current Position", "Stage 3 \u2014 Responsibility & Reward Agreement"));
body.push(meta("Status", "Architecture and Stages 1\u20133 implemented and verified; Stage 4 awaiting planning"));
body.push(rule());

// 1
body.push(h1("1. Project Overview"));
body.push(p("Development of the FinFam Recruitment Portal is focused on creating a structured, largely automated recruitment journey that takes a candidate from initial application through orientation, assessment, agreement, provisional appointment, activation, and onboarding."));
body.push(p("The objective is to reduce manual intervention while ensuring that each recruitment stage is properly controlled, recorded, and auditable."));
body.push(p([t("The recruitment journey is designed as "), b("one continuous application"), t(", rather than a collection of independent pages or systems.")]));
body.push(h2("Recruitment Journey"));
body.push(chainSans("Application \u2192 FSOW Orientation \u2192 Automated Assessment \u2192 Responsibility & Reward Agreement \u2192 Provisional Appointment \u2192 Staff Activation \u2192 Onboarding"));
body.push(p("The current implementation has progressed through the application, orientation, assessment, unified journey architecture, and agreement stages."));
body.push(rule());

// 2
body.push(h1("2. Initial Project Scaffold"));
body.push(p("The project was first established with the technical and architectural foundation required for the recruitment portal."));
body.push(h2("Technology Stack"));
["Next.js 16", "TypeScript", "Next.js API Route Handlers", "Prisma ORM", "PostgreSQL", "HeroUI v3", "Tailwind CSS v4", "Manrope typography", "Zod validation"].forEach(x => body.push(bullet(x)));
body.push(h2("Initial Architecture"));
body.push(p("A strict application architecture was established:"));
body.push(chainSans("UI \u2192 API Route \u2192 Service \u2192 Prisma \u2192 PostgreSQL"));
body.push(p("This ensures that business rules are not implemented only in the frontend and that important recruitment decisions are enforced server-side."));
body.push(h2("Initial Design System"));
body.push(p("A FinFam-specific design system was established around:"));
body.push(bullet("White and neutral surfaces"));
body.push(bullet([t("FinFam green "), code("#0c7a43")]));
body.push(bullet("Dark neutral typography"));
body.push(bullet("Manrope"));
body.push(bullet("Generous whitespace"));
body.push(bullet("Minimal borders and shadows"));
body.push(bullet("No gradients"));
body.push(bullet("No glassmorphism"));
body.push(bullet("No unnecessary decorative elements"));
body.push(bullet("Professional B2B/recruitment visual language"));
body.push(p([t("An explicit effort was made to prevent generic \u201cAI-generated SaaS\u201d design patterns.")]));
body.push(h2("Database Foundation"));
body.push(p("The initial database architecture introduced:"));
["Candidate", "Application", "CandidateStatus", "StageEvent"].forEach(x => body.push(bullet(x)));
body.push(p("The recruitment reference was established as the candidate's persistent identifier throughout the recruitment journey."));
body.push(p("Example:"));
body.push(p([code("FF-XXXXXX")]));
body.push(p("The reference is generated once during application and remains associated with the candidate throughout the entire process."));
body.push(rule());

// 3
body.push(h1("3. Application Stage"));
body.push(p("The initial application flow was implemented and verified."));
body.push(h2("Candidate information collected"));
body.push(p("The initial MVP application collects:"));
["Full name", "Email", "Phone number", "City (optional)", "Role selection (validated server-side against the open position)", "Consent confirmation"].forEach(x => body.push(bullet(x)));
body.push(p("The shared validation schema is authoritative and is re-run on the server for every submission, so the collected data set can be extended in later stages without changing the validation architecture."));
body.push(h2("Application functionality"));
body.push(p("The application stage established:"));
["Candidate creation", "Recruitment reference generation", "Server-side validation", "Client-side validation", "Duplicate email handling", "API error conventions", "Confirmation state", "Reference display", "Candidate status tracking"].forEach(x => body.push(bullet(x)));
body.push(h2("Verification"));
body.push(p("The application flow was tested at:"));
["375px", "768px", "1024px", "1440px"].forEach(x => body.push(bullet(x)));
body.push(p("Validation, duplicate records, reference generation, API responses, and responsive behaviour were verified."));
body.push(rule());

// 4
body.push(h1("4. FSOW Orientation Stage"));
body.push(p([t("The second major feature stage introduced the "), b("FinFam Staff Orientation Workshop (FSOW)"), t(".")]));
body.push(p("A dedicated orientation system was implemented without creating a separate candidate/application identity."));
body.push(h2("Orientation structure"));
body.push(p("The orientation contains eight sequential sections:"));
["About FinFam", "Products & Services", "Your Role", "Support Package", "Reward Structure", "Professional Standards", "Monitoring & Accountability", "Fraud & Misrepresentation"].forEach(x => body.push(numbered(x, "sec4")));
body.push(h2("Key functionality"));
body.push(p("The orientation system supports:"));
["Sequential section progression", "Server-side section gating", "Resume from the candidate's previous position", "Section completion records", "Explicit \u201cMark as read & continue\u201d", "Completion acknowledgement", "Orientation completion timestamp", "Stage events"].forEach(x => body.push(bullet(x)));
body.push(h2("State transitions"));
body.push(p("The system introduced controlled transitions including:"));
body.push(chain("APPLICANT \u2192 ORIENTATION_PENDING \u2192 ORIENTATION_COMPLETED"));
body.push(p("Each important transition is recorded using the existing append-only StageEvent system."));
body.push(h2("Important content decision"));
body.push(p([t("The supplied business materials contained conflicting information regarding the definition of an "), b("Established Member"), t(", particularly around the savings threshold.")]));
body.push(p("Rather than inventing a value, the issue was documented in:"));
body.push(p([code("docs/CONTENT-QUESTIONS.md")]));
body.push(p("The reward section therefore uses a pending-confirmation treatment where necessary."));
body.push(h2("Verification"));
body.push(p("The orientation journey was tested for:"));
["Fresh candidates", "Returning candidates", "Section gating", "Resume functionality", "Completion acknowledgement", "Invalid references", "Invalid sections", "Duplicate completion", "API errors", "Responsive layouts", "Keyboard accessibility", "Console errors", "Development log cleanliness"].forEach(x => body.push(bullet(x)));
body.push(rule());

// 5
body.push(h1("5. Automated Assessment Stage"));
body.push(p("The next feature stage introduced the automated recruitment assessment."));
body.push(h2("Assessment structure"));
body.push(p("The assessment consists of:"));
["30 multiple-choice questions", "4 options per question", "5 marks per question", "150 total marks", "70% pass mark", "21/30 required to pass"].forEach(x => body.push(bullet(x)));
body.push(h2("Assessment functionality"));
body.push(p("Implemented features include:"));
["Assessment eligibility gating", "Attempt creation", "Question ordering", "One-question-at-a-time interface", "Previous/Next navigation", "Question progress", "Answer persistence", "Optimistic autosave", "Saved-state indicator", "Retry handling", "Question navigation rail", "Submission confirmation modal", "Automatic scoring", "Persistent result", "Pass/fail status", "Retake support"].forEach(x => body.push(bullet(x)));
body.push(h2("Security"));
body.push(p("A significant security measure was implemented around assessment content."));
body.push(p("Correct answers and insights are kept server-side and are not exposed to the client."));
body.push(p("The generated application bundles were inspected to verify that:"));
body.push(bullet([code("correctIndex")]));
body.push(bullet("answer keys"));
body.push(bullet("assessment insights"));
body.push(p("were not exposed to client-side code."));
body.push(h2("Assessment state transitions"));
body.push(p("The assessment introduced:"));
body.push(chain("ORIENTATION_COMPLETED \u2192 ASSESSMENT_PENDING"));
body.push(p("Then:"));
body.push(chain("ASSESSMENT_PENDING \u2192 ASSESSMENT_PASSED"));
body.push(p("or:"));
body.push(chain("ASSESSMENT_PENDING \u2192 ASSESSMENT_FAILED"));
body.push(h2("Testing"));
body.push(p("The following cases were verified:"));
["Unknown candidate", "Assessment before orientation", "Invalid question", "Invalid answer", "Resume", "Duplicate start", "All-correct result", "Exact 70% pass result", "Failed result", "Unanswered questions", "Duplicate submission", "Retake", "Answers after submission", "Start after passing"].forEach(x => body.push(bullet(x)));
body.push(p([t("A precise "), b("21/30 = 70%"), t(" pass case was also verified.")]));
body.push(p("Responsive testing was completed at:"));
["375px", "768px", "1024px", "1440px"].forEach(x => body.push(bullet(x)));
body.push(rule());

// 6
body.push(h1("6. Architecture Correction \u2014 Unified Recruitment Journey"));
body.push(p("During development, an important architectural issue was identified."));
body.push(p("Initially, Application, Orientation, and Assessment could appear to users as separate modules."));
body.push(p("This was corrected before continuing to later stages."));
body.push(p("The portal was redesigned conceptually as:"));
body.push(quote([b("One recruitment application progressing through controlled stages.")]));
body.push(h2("Core architectural decisions"));
body.push(p("The portal now has:"));
["One Candidate", "One Application", "One recruitment reference", "One status/state machine", "One unified journey", "Server-driven stage resolution"].forEach(x => body.push(bullet(x)));
body.push(p("The candidate does not select which stage to enter."));
body.push(p("Instead, the system determines the candidate's current stage from persisted recruitment state."));
body.push(rule());

// 7
body.push(h1("7. Centralized Recruitment Journey Service"));
body.push(p("A centralized service was introduced:"));
body.push(p([code("src/server/services/journey.ts")]));
body.push(p("with:"));
body.push(p([code("getRecruitmentJourney(reference)")]));
body.push(p("This service derives:"));
["Current stage", "Completed stages", "Locked stages", "Next action", "Resume information", "Assessment result", "Stage history", "Coming-next information"].forEach(x => body.push(bullet(x)));
body.push(p("This prevents the frontend from independently deciding which stage a candidate should access."));
body.push(p("The server remains the authoritative source of recruitment progression."));
body.push(rule());

// 8
body.push(h1("8. Unified Candidate Access"));
body.push(p([t("A dedicated "), b("Continue Application"), t(" experience was introduced.")]));
body.push(h2("Returning candidate flow"));
body.push(chainSans("Landing page \u2192 Continue Application \u2192 Reference \u2192 Unified Journey \u2192 Current Stage"));
body.push(p("The candidate no longer needs to enter their reference separately on:"));
["Orientation", "Assessment", "Future stages"].forEach(x => body.push(bullet(x)));
body.push(p("Duplicate reference forms were removed."));
body.push(h2("Reference recovery"));
body.push(p("A recovery flow was also introduced:"));
body.push(p([code("/continue/recover")]));
body.push(p("The candidate provides:"));
["Name", "Email", "Phone"].forEach(x => body.push(bullet(x)));
body.push(p("All three must match before the recruitment reference is revealed."));
body.push(p("Invalid attempts return the same neutral response to reduce account/reference enumeration."));
body.push(p("The security limitation of using the reference as a lookup key was documented for future review."));
body.push(rule());

// 9
body.push(h1("9. Unified Application Journey Page"));
body.push(p("A central journey page was introduced:"));
body.push(p([code("/application/[reference]")]));
body.push(p("It communicates:"));
["Current recruitment stage", "Completed stages", "Locked stages", "Current next action", "Resume progress", "Stage history", "Coming-next information"].forEach(x => body.push(bullet(x)));
body.push(p("The journey uses a single primary CTA based on the candidate's current stage."));
body.push(p("For example:"));
body.push(quote([b("Your application is currently at: Assessment")]));
body.push(p("or, after passing:"));
body.push(quote([b("Your application is currently at: Agreement")]));
body.push(p([t("The journey progress indicator is informational and is "), b("not a navigation menu"), t(".")]));
body.push(rule());

// 10
body.push(h1("10. Stage Access and One-Way Progression"));
body.push(p("Server-side guards were implemented to ensure that candidates cannot bypass the recruitment sequence."));
body.push(p("For example:"));
[
  "A candidate who has not completed orientation cannot directly access assessment.",
  "A candidate who has not passed assessment cannot access the agreement.",
  "A completed stage cannot be reopened as an active workflow.",
  "Direct URLs cannot bypass eligibility.",
  "Browser back navigation cannot reopen a completed workflow.",
].forEach(x => body.push(bullet(x)));
body.push(p("The browser may return to a previous page, but the server remains authoritative."));
body.push(p("This establishes a proper one-way recruitment progression."));
body.push(rule());

// 11
body.push(h1("11. Navigation Simplification"));
body.push(p("The main navigation was reduced to focus on the actual recruitment experience:"));
["Open Roles", "How It Works", "Continue Application"].forEach(x => body.push(bullet(x)));
body.push(p("Separate navigation items for:"));
["Application", "Orientation", "Assessment", "Agreement", "Appointment", "Activation", "Onboarding"].forEach(x => body.push(bullet(x)));
body.push(p("were intentionally removed."));
body.push(p("These are stages of one recruitment journey, not separate products or modules."));
body.push(rule());

// 12
body.push(h1("12. Responsive and Accessibility Improvements"));
body.push(p("Responsive behaviour was treated as a layout-composition requirement rather than simply shrinking the mobile interface."));
body.push(h2("Mobile"));
body.push(p("A single-column layout is used where appropriate."));
body.push(h2("Tablet/Desktop"));
body.push(p("Meaningful two-column compositions are used when the content hierarchy supports them."));
body.push(p("The application was tested at:"));
["375px", "768px", "1024px", "1440px"].forEach(x => body.push(bullet(x)));
body.push(p("Verification included:"));
["No horizontal overflow", "Appropriate spacing", "Desktop/tablet recomposition", "Footer behaviour", "Keyboard navigation", "Visible focus states", "Accessible controls", "Screen-reader-friendly states", "No console errors"].forEach(x => body.push(bullet(x)));
body.push(rule());

// 13
body.push(h1("13. Stage 3 \u2014 Responsibility & Reward Agreement Planning"));
body.push(p("Following completion of the unified journey architecture, Stage 3 planning was carried out."));
body.push(p("The planned stage is:"));
body.push(chainSans("Assessment Passed \u2192 Responsibility & Reward Agreement \u2192 Provisional Appointment"));
body.push(p("The planning inspection confirmed that the existing database already contains:"));
[["OFFER_PENDING"], ["OFFER_ACCEPTED"], ["OFFER_DECLINED"], ["OFFER", " recruitment stage"]].forEach(parts => {
  body.push(bullet(parts.length === 1 ? [code(parts[0])] : [code(parts[0]), t(parts[1])]));
});
body.push(p([t("Therefore, it was determined that a new "), code("AGREEMENT"), t(" enum/state should "), b("not"), t(" be introduced.")]));
body.push(p("Instead:"));
body.push(quote([b("Internal "), codeB("OFFER"), b(" stage = candidate-facing Agreement")]));
body.push(p("This avoids unnecessary database migrations and duplicate architecture."));
body.push(p([t("Planning was approved with one explicit scope adjustment: the implementation would be "), b("accept-only"), t(" \u2014 no decline column, no decline API, and no decline interface \u2014 keeping the database clean until the decline policy is formally confirmed.")]));
body.push(rule());

// 14
body.push(h1("14. Stage 3 Agreement Functionality"));
body.push(p("The agreement allows candidates who have passed the assessment to review a versioned agreement document containing seven sections:"));
["Your Role", "Responsibilities", "Support Package", "Reward Structure", "Performance & Accountability", "Professional Conduct", "Policy Updates"].forEach(x => body.push(numbered(x, "sec14")));
body.push(p([t("The content was built strictly from the supplied business material. The reward section names the structure with a figures-pending treatment and encodes no amounts; the \u201cImportant Conditions\u201d section was omitted until its wording is approved.")]));
body.push(p("The candidate explicitly acknowledges the agreement (checkbox plus a confirmation modal) and selects:"));
body.push(quote([b("Accept Agreement")]));
body.push(p([t("Acceptance is recorded against a specific agreement version ("), b("version 1.0"), t(").")]));
body.push(p("The implemented agreement model includes:"));
["Candidate (one-to-one)", "Agreement version", "Acceptance timestamp", "Append-only StageEvent audit records"].forEach(x => body.push(bullet(x)));
body.push(p("The design supports future agreement versioning."));
body.push(p("Viewing the agreement for the first time \u2014 on the page or via the API \u2014 also performs a lazy, idempotent stage entry: an assessment-passed candidate moves into the agreement-pending state with exactly one ENTERED event, safe against concurrent requests."));
body.push(rule());

// 15
body.push(h1("15. Stage 3 Security and State Control"));
body.push(p("The agreement uses:"));
["Server-side eligibility checks", "Zod validation", "Transactional state updates", "Append-only StageEvents", "Idempotent acceptance", "Agreement version verification", "The existing API envelope", "The existing AppError conventions"].forEach(x => body.push(bullet(x)));
body.push(p("The system ensures that:"));
body.push(chain("ASSESSMENT_PASSED \u2192 OFFER_PENDING \u2192 OFFER_ACCEPTED"));
body.push(p("and that accepting an agreement cannot be repeated in a way that creates duplicate records or events."));
body.push(p("Additional enforced behaviour:"));
[
  "Acceptance from any other recruitment stage is rejected with a conflict response.",
  "Unknown references receive the same neutral not-found response as elsewhere in the portal.",
  "After acceptance, the agreement address redirects back to the unified journey: browser back, direct URLs, and direct API calls cannot re-open or repeat the workflow.",
  "The journey displays the agreement as completed and shows the appointment stage as an honest, locked placeholder with no fake links.",
].forEach(x => body.push(bullet(x)));
body.push(rule());

// 16
body.push(h1("16. Important Business Questions Identified"));
body.push(p("Several business decisions remain intentionally unresolved."));
body.push(p("These have been documented rather than assumed."));
body.push(h2("Reward structure"));
body.push(p("The supplied materials contain unresolved information around:"));
["\u20A6650 per Established Member", "Target bonus", "Established Member savings threshold", "\u20A6500 cashback claim"].forEach(x => body.push(bullet(x)));
body.push(p("These figures require business confirmation before being presented as final agreement terms."));
body.push(h2("Decline policy"));
body.push(p("It still needs to be confirmed:"));
["Whether candidates can decline through the portal", "Whether a decline can be reversed", "Whether there is a response deadline"].forEach(x => body.push(bullet(x)));
body.push(p([t("Stage 3 was therefore implemented on an "), b("accept-only"), t(" basis. No decline column, endpoint, or interface exists; the schema remains clean until the policy is formally confirmed.")]));
body.push(h2("Candidate identity/security"));
body.push(p("The existing reference-based access model should be reviewed before consequential actions such as agreement acceptance."));
body.push(p("An additional verification mechanism such as OTP may be considered in a later security improvement."));
body.push(h2("Agreement wording"));
body.push(p("The final wording of the agreement and acknowledgement statement requires business approval."));
body.push(p("These issues have been documented in:"));
body.push(p([code("docs/CONTENT-QUESTIONS.md")]));
body.push(rule());

// 17 - status table
body.push(h1("17. Current Project Status"));
const statusRows = [
  ["Project scaffold", "\u2705 Complete"],
  ["Database foundation", "\u2705 Complete"],
  ["Application", "\u2705 Complete"],
  ["FSOW Orientation", "\u2705 Complete"],
  ["Automated Assessment", "\u2705 Complete"],
  ["Unified Recruitment Journey", "\u2705 Complete"],
  ["Continue Application", "\u2705 Complete"],
  ["Reference Recovery", "\u2705 Complete"],
  ["Stage access guards", "\u2705 Complete"],
  ["Responsive verification", "\u2705 Complete"],
  ["Accessibility verification", "\u2705 Complete"],
  ["Stage 3 planning", "\u2705 Complete"],
  ["Stage 3 implementation", "\u2705 Complete (accept-only scope)"],
  ["Provisional Appointment", "\u23F3 Not started"],
  ["Staff Activation", "\u23F3 Not started"],
  ["Onboarding", "\u23F3 Not started"],
  ["Admin tooling", "\u23F3 Not started"],
  ["Analytics", "\u23F3 Not started"],
];
body.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 6, color: HEADER_BG },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: HEADER_BG },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
  },
  rows: [
    new TableRow({
      tableHeader: true, cantSplit: true,
      children: [
        ["Area", "Status"].map((txt, i) => new TableCell({
          children: [new Paragraph({
            spacing: { line: 312 },
            children: [new TextRun({ text: txt, bold: true, size: 22, color: "FFFFFF", font: FONT })],
          })],
          shading: { type: ShadingType.CLEAR, fill: HEADER_BG },
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          width: { size: i === 0 ? 55 : 45, type: WidthType.PERCENTAGE },
        })),
      ].flat(),
    }),
    ...statusRows.map((r, ri) => new TableRow({
      cantSplit: true,
      children: r.map((txt, i) => new TableCell({
        children: [new Paragraph({
          spacing: { line: 312 },
          children: [new TextRun({ text: txt, size: 22, color: INK, font: FONT })],
        })],
        shading: ri % 2 === 1
          ? { type: ShadingType.CLEAR, fill: SURFACE }
          : { type: ShadingType.CLEAR, fill: "FFFFFF" },
        margins: { top: 70, bottom: 70, left: 120, right: 120 },
        width: { size: i === 0 ? 55 : 45, type: WidthType.PERCENTAGE },
      })),
    })),
  ],
}));
body.push(rule());

// 18
body.push(h1("18. Technical Quality"));
body.push(p("Across the completed stages, the following practices have been maintained:"));
[
  "TypeScript", "Server-side validation", "Zod validation", "Prisma transactions", "PostgreSQL persistence",
  "Append-only stage events", "Idempotent operations", "Server-side recruitment state enforcement",
  "Consistent API response envelopes", "Reusable UI components", "Responsive layouts", "Accessibility considerations",
  "Clean development logs", "Additive-only database migrations", "No unnecessary package upgrades", "No unnecessary database duplication",
].forEach(x => body.push(bullet(x)));
body.push(p("The project has also been repeatedly browser-verified at mobile, tablet, and desktop breakpoints."));
body.push(rule());

// 19
body.push(h1("19. Current Milestone"));
body.push(p("The project has now reached the point where the foundational recruitment architecture is stable."));
body.push(p("The important architectural correction has ensured that the system behaves as:"));
body.push(quote([b("One candidate \u2192 One application \u2192 One reference \u2192 One continuous recruitment journey")]));
body.push(p("rather than separate Application, Orientation, Assessment, and Agreement applications."));
body.push(p("With Stage 3 delivered and verified, the recruitment flow now runs end to end from application through an explicitly accepted agreement."));
body.push(p("The next development milestone is:"));
body.push(h2("Stage 4 \u2014 Provisional Appointment"));
body.push(p([t("Stage 4 has "), b("not"), t(" been started. In line with the stage-gated process used throughout the project, it will be planned separately before any implementation begins.")]));
body.push(rule());

// 20
body.push(h1("20. Overall Assessment"));
body.push(p([b("Overall project status: ON TRACK")]));
body.push(p("The project has progressed from a basic technical scaffold to a functioning recruitment workflow with:"));
[
  "Structured candidate applications",
  "Automated orientation",
  "Automated assessment and scoring",
  "Persistent recruitment state",
  "Controlled stage progression",
  "Unified candidate access",
  "Reference recovery",
  "Audit events",
  "Explicit, versioned agreement acceptance with one-way progression",
  "Responsive UI",
  "Accessibility support",
  "Clear separation between completed, current, and locked stages",
].forEach(x => body.push(bullet(x)));
body.push(p("The major architectural foundation is now in place, allowing subsequent recruitment stages to be added without creating separate systems or duplicating candidate access logic."));

// ---------------- document ----------------
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: INK },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 32, bold: true, color: INK },
        paragraph: { spacing: { before: 320, after: 130, line: 312 } },
      },
      heading2: {
        run: { font: FONT, size: 26, bold: true, color: INK },
        paragraph: { spacing: { before: 220, after: 100, line: 312 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "sec4",
        levels: [{
          level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "sec14",
        levels: [{
          level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
        })],
      }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/report.docx", buf);
  console.log("OK: /home/z/my-project/report.docx written,", buf.length, "bytes");
});
