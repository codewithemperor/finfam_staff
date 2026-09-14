/**
 * FinFam Recruitment Portal - Weekly Progress Report (.docx)
 * Recipe: R1 (Pure Paragraph Left) cover, DS-1 Deep Sea palette.
 * Structure: Cover (no page #) -> Front matter (TOC, Roman) -> Body (Arabic from 1).
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableLayoutType, SectionType,
  TableOfContents,
} = require("docx");
const fs = require("fs");

// ---------------------------------------------------------------- palette
const P = {
  bg: "0B1C2C",            // DS-1 Deep Sea background
  accent: "529286",        // DS-1 accent (green-teal, matches FinFam brand green)
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
  ink: "0B1C2C",           // body heading ink
  body: "000000",
  secondary: "808080",
  tableHeaderBg: "529286",
  tableHeaderText: "FFFFFF",
  innerLine: "BECFCC",
  surface: "E8ECEB",
};

const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const FONT_H = { ascii: "Times New Roman", eastAsia: "SimHei" };

// ---------------------------------------------------------------- guards
function safeText(value, placeholder) {
  if (value === undefined || value === null || value === "" ||
      String(value) === "NaN" || String(value) === "undefined") {
    return placeholder || "[to be completed]";
  }
  return String(value);
}

// ---------------------------------------------------------------- borders
const NB = { style: BorderStyle.NONE, size: 0, color: "auto" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

// ---------------------------------------------------------------- cover title layout (English-aware)
function splitTitleLinesEn(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length <= charsPerLine || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcTitleLayoutEn(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // Latin proportional width approximation: ~11 twips per pt per character (safe upper bound incl. bold)
  const charWidth = (pt) => pt * 11;
  // Prefer a single-line title when achievable at a dignified size (>= 28pt)
  for (let pt = preferredPt; pt >= 28; pt -= 2) {
    const cpl = Math.floor(maxWidthTwips / charWidth(pt));
    if (cpl >= title.length) return { titlePt: pt, titleLines: [title] };
  }
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = Math.floor(maxWidthTwips / charWidth(titlePt));
    if (cpl < 4) { titlePt -= 2; continue; }
    lines = splitTitleLinesEn(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = Math.floor(maxWidthTwips / charWidth(minPt));
    lines = splitTitleLinesEn(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight +
                        metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ---------------------------------------------------------------- Recipe R1 cover
function buildCoverR1(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayoutEn(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. Top whitespace (dynamic)
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing, line: 312 } }));

  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500, line: 312 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Arial", eastAsia: "SimHei" }, characterSpacing: 40,
      })],
    }));
  }

  // 3. Main title (dynamic size + explicit line spacing to avoid clipping)
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 300,
        line: Math.ceil(titlePt * 23), lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" },
      })],
    }));
  }

  // 4. Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800, line: 312 },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 5. Meta lines with left accent border
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80, line: 312 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: safeText(line), size: 24, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 6. Bottom whitespace (dynamic)
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing, line: 312 } }));

  // 7. Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200, line: 312 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        ", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ---------------------------------------------------------------- body helpers
function t(text, opts = {}) {
  return new TextRun({ text, size: 24, color: P.body, font: FONT, ...opts });
}
function b(text, opts = {}) { return t(text, { bold: true, ...opts }); }

function para(runsOrText, opts = {}) {
  const children = Array.isArray(runsOrText) ? runsOrText : [t(runsOrText)];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 140, ...(opts.spacing || {}) },
    ...opts, children,
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, keepNext: true,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.ink, font: FONT_H })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, keepNext: true,
    spacing: { before: 260, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.ink, font: FONT_H })],
  });
}

function bullet(runsOrText) {
  const children = Array.isArray(runsOrText) ? runsOrText : [t(runsOrText)];
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children,
  });
}

function caption(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.ink, font: FONT })],
  });
}

function cellPara(text, opts = {}) {
  return new Paragraph({
    spacing: { line: 312 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: safeText(text), size: 21,
      bold: !!opts.bold, color: opts.color || P.body, font: FONT,
    })],
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((h, i) => new TableCell({
          children: [cellPara(h, { bold: true, color: P.tableHeaderText })],
          shading: { type: ShadingType.CLEAR, fill: P.tableHeaderBg },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) => new TableCell({
          children: [cellPara(c)],
          shading: ri % 2 === 1
            ? { type: ShadingType.CLEAR, fill: P.surface }
            : { type: ShadingType.CLEAR, fill: "FFFFFF" },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
}

function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary, font: FONT })],
    })],
  });
}

// ---------------------------------------------------------------- content
const coverConfig = {
  title: "Weekly Progress Report",
  subtitle: "FinFam Recruitment Portal - MVP build: platform foundation and recruitment stages 1-3 delivered and verified",
  englishLabel: "FINFAM RECRUITMENT PORTAL",
  metaLines: [
    "Reporting period: week ending 14 September 2026",
    "Prepared by: Engineering (Z.ai Code)",
    "Status: Stages 1-3 complete and verified; Stage 4 awaiting planning",
    "Distribution: FinFam project stakeholders",
  ],
  footerLeft: "FinFam Recruitment Portal - Weekly Report",
  footerRight: "14 September 2026",
};

const body = [];

// ============ 1. Executive Summary ============
body.push(h1("1. Executive Summary"));
body.push(para(
  "This report summarises the engineering work completed on the FinFam Recruitment Portal Minimum Viable Product (MVP) during the week ending 14 September 2026. The portal is being built as one continuous candidate journey - Application, Orientation (the FinFam Staff Orientation Workshop, FSOW), automated Assessment, Responsibility and Reward Agreement, Provisional Appointment, then Activation - delivered one stage at a time under a plan-implement-verify gate. This week the platform foundation and the first three candidate-facing stages were built, integrated and verified end to end."
));
body.push(para([
  t("Concretely, the week delivered: the application foundation (Next.js 16 with App Router and TypeScript, the HeroUI v3 component library on Tailwind v4, and PostgreSQL 17 behind Prisma); "),
  b("Stage 1"), t(", the eight-section FSOW orientation; "),
  b("Stage 2"), t(", a 30-question automated assessment scored exclusively on the server (150 marks, 70% pass mark); a "),
  b("journey unification"), t(" pass that merged all stages into one continuous application behind a single reference number; and "),
  b("Stage 3"), t(", the Responsibility and Reward Agreement - planned against the existing architecture, approved with an explicit scope adjustment, and shipped on an accept-only basis. A candidate can now apply, read the orientation, sit the assessment, review the agreement and explicitly accept it, after which the journey shows the appointment stage as an honest, locked placeholder."),
]));
body.push(para(
  "The delivered system currently comprises 4 additive database migrations, 14 API endpoints under one consistent response envelope, 9 data tables, and browser-verified golden paths at four viewport widths (375, 768, 1024 and 1440 pixels) for every stage. Lint is clean at every closure point and no runtime errors remain open. Unconfirmed business content - reward figures, the decline policy and final agreement wording - was deliberately withheld from the product and is tracked in docs/CONTENT-QUESTIONS.md. Stage 4 (Provisional Appointment) has not been started and awaits a separate planning instruction."
));

// ============ 2. Objectives and Scope ============
body.push(h1("2. Objectives and Scope of the Week"));
body.push(h2("2.1 Objectives"));
body.push(para(
  "Work followed the stage-gated brief agreed for this engagement: for each stage, inspect the existing architecture first, write the plan before code, implement only that stage, verify it end to end, document any unresolved business questions, and stop. The specific objectives for this week were:"
));
body.push(bullet("Build and verify the shared platform foundation: design system, data layer, API conventions and public pages."));
body.push(bullet("Deliver Stage 1 (FSOW orientation) end to end, with server-enforced progression rules."));
body.push(bullet("Deliver Stage 2 (automated interview assessment) end to end, with answer-key security and exact scoring boundaries."));
body.push(bullet("Unify Application, Orientation and Assessment into one continuous journey behind a single candidate reference."));
body.push(bullet("Plan Stage 3 (Responsibility and Reward Agreement), and on approval implement it strictly within the approved accept-only scope."));
body.push(h2("2.2 Explicitly Out of Scope"));
body.push(para(
  "The following were excluded from this week by instruction and remain untouched:"
));
body.push(bullet("Stage 4 (Provisional Appointment) and the later activation and onboarding stages."));
body.push(bullet("Administrative tooling and analytics."));
body.push(bullet("A decline workflow for the agreement - deferred by business decision; the database holds no decline column and no decline interface exists."));
body.push(bullet("Publication of any unconfirmed business figures (rewards, thresholds or amounts of any kind)."));

// ============ 3. Work Completed ============
body.push(h1("3. Work Completed"));
body.push(para(
  "This section reviews each delivery in order, with the outcomes that matter for stakeholders. Every item below is verified; the verification methods themselves are summarised in Section 4."
));

body.push(h2("3.1 Platform Foundation and Design System"));
body.push(para(
  "The foundation sets the conventions every later stage reuses, so it received the deepest verification of the week. The application is a strictly layered Next.js 16 (App Router) and TypeScript system: UI components call route handlers, route handlers call services, services own every business rule, and Prisma communicates with PostgreSQL. All responses share one envelope ({ok, data | error}); all errors flow through one application error taxonomy (422 validation, 404 not found, 409 conflict); and all input is re-validated on the server with shared schemas."
));
body.push(bullet([b("Design system. "), t("HeroUI v3 on Tailwind v4 with the Manrope typeface and a single green accent (#0C7A43) defined as a design token; documented in docs/DESIGN-SYSTEM.md with an anti-slop checklist. The result reads as a professional recruitment document, not a dashboard.")]));
body.push(bullet([b("Data platform. "), t("PostgreSQL 17 running from embedded binaries, managed by Prisma with a real migration history; a core schema of Candidate, Application and StageEvent; a 12-state candidate status model spanning the full journey; and a 6-value recruitment stage enum.")]));
body.push(bullet([b("Candidate identity. "), t("An unambiguous FF-XXXXXX reference alphabet, excluding easily confused characters.")]));
body.push(bullet([b("Public pages. "), t("Landing page; a validated application form with server-side duplicate detection surfaced as an inline field error; and a status lookup page.")]));
body.push(bullet([b("Documentation. "), t("README with architecture and API contract, docs/DESIGN-SYSTEM.md, and docs/CONTENT-QUESTIONS.md as the running register of pending business decisions.")]));

body.push(h2("3.2 Stage 1 - FinFam Staff Orientation Workshop (FSOW)"));
body.push(para(
  "Stage 1 turns a fresh applicant into an orientation-completed candidate through an eight-section, strictly sequential reading experience, built strictly from the supplied workshop material."
));
body.push(bullet([b("Content. "), t("Eight sections from About FinFam through to Fraud and Misrepresentation, each with structured blocks and key points. Reward figures are intentionally unpublished: the reward section carries a figures-being-finalised notice rather than invented numbers.")]));
body.push(bullet([b("Data. "), t("An Orientation record holding the resume point, acknowledgement and completion timestamps, plus append-only per-section completion rows; one additive migration.")]));
body.push(bullet([b("Server-enforced rules. "), t("Sections must be read in order (out-of-order requests fail with a helpful validation error); completing the first section moves the candidate from applicant to orientation-in-progress with an ENTERED event; explicit completion requires every section read plus an acknowledgement checkbox and records ORIENTATION_COMPLETED with a COMPLETED event; repeats are idempotent and mutating a completed orientation is rejected.")]));
body.push(bullet([b("API. "), t("GET orientation state; POST section completion; POST explicit completion.")]));
body.push(bullet([b("UI. "), t("Entry form; overview page with a sticky progress rail and an accessible progress bar; per-section reading pages with mark-as-read-and-continue; a completion modal with acknowledgement; locked-section gating; and full resume support.")]));

body.push(h2("3.3 Stage 2 - Automated Interview Assessment"));
body.push(para(
  "Stage 2 assesses candidates with a 30-question multiple-choice instrument scored exclusively on the server: 5 marks per question, 150 in total, pass mark 70%. The boundary was verified exactly - 21 of 30 correct answers score 105/150 and pass."
));
body.push(bullet([b("Security split. "), t("The client-safe configuration carries only question identifiers, text, options and category; the answer key, per-option insights and scoring policy live in a server-only module enforced by the server-only package. A scan of the compiled output confirmed the answer key never reaches client bundles.")]));
body.push(bullet([b("Data. "), t("AssessmentAttempt with the folded result (correct count, marks, percentage, pass flag), per-attempt persisted question order, and one answer row per question; one additive migration.")]));
body.push(bullet([b("Service rules. "), t("Eligibility requires a completed orientation; starting resumes the active attempt safely under concurrency; starting after a pass is blocked; the retake policy is configuration-driven; submitted answers are validated against the attempt's own persisted question set; scoring runs server-side only; and submission is idempotent.")]));
body.push(bullet([b("API. "), t("GET assessment state; POST start; POST answer autosave; POST submit.")]));
body.push(bullet([b("UI. "), t("A hub covering eligibility gate, introduction, resume and result phases, plus an attempt runner that shows one question at a time with previous/next navigation, optimistic autosave (latest value wins, with retry on failure), a question jump grid, and a submit modal that states the unanswered-question consequence before final submission.")]));

body.push(h2("3.4 Journey Unification - One Continuous Application"));
body.push(para(
  "With two stages live, a correction pass merged them - and every later stage - into one continuous journey so candidates never choose an entry point again. The server, not the URL, decides where a candidate is."
));
body.push(bullet([b("Single source of truth. "), t("getRecruitmentJourney(reference) derives completed, current and locked stages, exactly one next action, honest coming-next notes, per-stage resume detail (for example, 2 of 30 questions answered), submitted result records and the full event history.")]));
body.push(bullet([b("Pages. "), t("/application/[reference] as the journey screen with a single primary call to action; /continue as the only returning-candidate entry; and /continue/recover for reference recovery, requiring full name, email and phone to all match, with an identical neutral not-found response for every mismatch so enumeration is pointless.")]));
body.push(bullet([b("Hardening. "), t("Duplicate entry forms were deleted; legacy status and stage-entry URLs redirect; direct URLs are never a side door into a locked or completed stage; browser back cannot re-open a closed stage; and future-stage addresses return not-found naturally.")]));
body.push(bullet([b("API. "), t("GET journey view; POST recover-reference.")]));

body.push(h2("3.5 Stage 3 - Responsibility and Reward Agreement"));
body.push(para(
  "Stage 3 closed the week's delivery: the Responsibility and Reward Agreement. It was planned against the existing architecture first, approved with an explicit scope adjustment, then implemented. The approved adjustment was honoured literally: the database holds no decline column, no decline endpoint exists and no decline interface was built - the decline decision stays open without schema debt."
));
body.push(bullet([b("Content v1.0. "), t("Seven sections - Your Role; Responsibilities; Support Package; Reward Structure; Performance and Accountability; Professional Conduct; Policy Updates - built strictly from the supplied material. The reward section names the structure with a figures-pending notice and encodes no amounts; the Important Conditions section is omitted until its wording is approved.")]));
body.push(bullet([b("Data. "), t("An Agreement table, one row per candidate with a unique candidate reference, the content version accepted, and the acceptance timestamp; one additive migration verified against all existing rows.")]));
body.push(bullet([b("Semantics. "), t("First view of the agreement - whether the page or the GET API - lazily and idempotently moves a passed candidate into the agreement-pending state with exactly one ENTERED event, race-safe by conditional update. Acceptance requires an explicit checkbox, a confirmation modal and a server-checked version echo; the transaction moves the candidate to agreement-accepted, writes the versioned acceptance row and a COMPLETED event. Repeat accepts return the same result; acceptance attempts from any other stage are rejected with a conflict.")]));
body.push(bullet([b("API. "), t("GET agreement view; POST accept. No decline endpoint exists, per the approved scope.")]));
body.push(bullet([b("UI. "), t("The /agreement/[reference] document page mirrors the assessment hub: a document column plus a sticky context rail showing status, reference, version and contents. The decision component enables the accept button only after the checkbox, confirms intent in a modal, raises a success toast and returns the candidate to the journey.")]));
body.push(bullet([b("Journey integration. "), t("The next action after passing is now Review Agreement; the offer stage is relabelled Agreement for candidates; a latent configuration defect that would have let a declined status advance the journey was found and fixed defensively; and after acceptance the journey shows Agreement completed with the appointment stage as an honest, locked placeholder - no fake links.")]));

// ============ 4. QA ============
body.push(h1("4. Quality Assurance and Verification"));
body.push(para(
  "Every stage closed only after its own verification pass. The working rule throughout the week: if a feature was not verified both at the API contract level and in the browser, it was not called done. Table 1 summarises the coverage."
));
body.push(caption("Table 1: Verification coverage by delivery area"));
body.push(makeTable(
  ["Delivery area", "What was verified", "Method and result"],
  [
    ["Platform foundation", "Landing page; application form validation and duplicate handling; status lookup", "API contract via curl plus browser end-to-end at 375/768/1024/1440 - pass"],
    ["Stage 1 - FSOW", "Sequential gating, completion rules, resume, locked sections", "curl matrix (200/404/422/409 including idempotency) plus full golden-path browser run - pass"],
    ["Stage 2 - Assessment", "Start and resume, autosave, scoring, retake, answer-key security", "curl matrix including the exact 70% boundary; fresh-candidate browser run; compiled-output leak scan - pass"],
    ["Journey unification", "All five reachable statuses; recovery; URL and back-button guards", "Journey sweep across every status plus browser runs of guard and recovery paths - pass"],
    ["Stage 3 - Agreement", "Lazy entry, eligibility, accept semantics, one-way lock", "curl matrix including idempotent accept and version mismatch; browser accept flow; responsive and keyboard pass - pass"],
  ],
  [20, 36, 44]
));
body.push(para(
  "API contracts were verified with request matrices covering success, validation (422), not-found (404), conflict (409) and idempotency paths for every endpoint - including the exact assessment pass boundary and the agreement version-echo mismatch.",
  { spacing: { before: 160 } }
));
body.push(para(
  "Browser verification ran the real golden paths: fresh candidates through application, orientation and assessment; resume flows; failed candidates; unknown references; recovery with wrong details; and, for the agreement, the checkbox-modal-accept sequence through to the updated journey. Responsive behaviour was checked at 375, 768, 1024 and 1440 pixels with zero horizontal overflow and a verified two-column recomposition from 768 pixels upward. Footers stick to the viewport bottom on short pages and are pushed naturally on long ones."
));
body.push(para(
  "Accessibility was verified rather than assumed: semantic landmarks, aria-current stepper states, an accessible progress bar, real labels on every control, keyboard-operable navigation including modal focus flow, and screen-reader-only state text on the journey stepper. ESLint exits clean at every closure point and the development log is clean at each stage boundary."
));
body.push(para(
  "Regression fixtures are in place: 10 test candidates now span every reachable status, including three at the agreement stage (two accepted, one entered but not accepted), so later stages can be verified against realistic data immediately."
));
body.push(para(
  "One known cosmetic item remains: a console warning emitted by the HeroUI modal library, present identically on the untouched Stage 2 page. It is a library-level warning rather than an error and was left untouched under the no-rebuild rule."
));

// ============ 5. System Inventory ============
body.push(h1("5. System Inventory"));
body.push(para(
  "The week's net additions to the system are summarised below for reference. Four additive migrations define the current database; none has ever required a destructive change."
));
body.push(caption("Table 2: Database migrations delivered"));
body.push(makeTable(
  ["Migration", "Applied", "Scope"],
  [
    ["20260913201513_init", "13 September 2026", "Core schema: Candidate, Application, StageEvent and the status, stage and event enums"],
    ["20260913203601_orientation_stage", "13 September 2026", "Stage 1: Orientation and OrientationSection tables"],
    ["20260914073449_assessment_stage", "14 September 2026", "Stage 2: AssessmentAttempt, AssessmentAttemptQuestion and AssessmentAnswer tables"],
    ["20260914102716_agreement_stage", "14 September 2026", "Stage 3: Agreement table (additive; no decline column by design)"],
  ],
  [30, 20, 50]
));
body.push(para(
  "Fourteen endpoints now serve the portal, all under the shared response envelope and error conventions:",
  { spacing: { before: 160 } }
));
body.push(caption("Table 3: API endpoint inventory"));
body.push(makeTable(
  ["Method", "Endpoint", "Purpose"],
  [
    ["GET", "/api/health", "Liveness check for monitoring"],
    ["POST", "/api/applications", "Submit an application; the server assigns the role and issues the reference"],
    ["GET", "/api/candidates/[reference]", "Candidate status view (personally identifiable data excluded)"],
    ["GET", "/api/orientation/[reference]", "Orientation state: per-section progress and resume point"],
    ["POST", "/api/orientation/[reference]/sections", "Mark a section as read (sequential gating enforced)"],
    ["POST", "/api/orientation/[reference]/complete", "Explicit completion requiring acknowledgement"],
    ["GET", "/api/assessment/[reference]", "Assessment state: eligibility, active attempt, recorded result"],
    ["POST", "/api/assessment/[reference]/start", "Start or resume the active attempt"],
    ["POST", "/api/assessment/[reference]/answers", "Autosave one answer against the attempt"],
    ["POST", "/api/assessment/[reference]/submit", "Server-side scoring and status transition"],
    ["GET", "/api/journey/[reference]", "Server-derived journey view (single source of truth)"],
    ["POST", "/api/recruitment/recover-reference", "Reference recovery with three-field verification"],
    ["GET", "/api/agreement/[reference]", "Agreement content and version; performs idempotent stage entry"],
    ["POST", "/api/agreement/[reference]/accept", "Explicit acceptance with version-echo validation"],
  ],
  [12, 40, 48]
));
body.push(para(
  "The data model now holds nine tables - Candidate, Application, StageEvent (append-only audit), Orientation, OrientationSection, AssessmentAttempt, AssessmentAttemptQuestion, AssessmentAnswer and Agreement. The status model is unchanged since the foundation design: 12 candidate statuses across 6 recruitment stages, with 4 append-only event types (ENTERED, COMPLETED, FAILED, NOTE) providing the audit trail that the journey screen renders as the Updates timeline.",
  { spacing: { before: 160 } }
));

// ============ 6. Open Items ============
body.push(h1("6. Open Items and Pending Business Decisions"));
body.push(para(
  "A deliberate governance rule ran all week: nothing unresolved was published to candidates as confirmed fact. Where content depends on a business decision, the product names it as pending and the register in docs/CONTENT-QUESTIONS.md carries the detail. Table 4 lists the decisions now awaiting stakeholders."
));
body.push(caption("Table 4: Open items carried in docs/CONTENT-QUESTIONS.md"));
body.push(makeTable(
  ["Item", "Register", "Status this week"],
  [
    ["Reward figures and the Established Member threshold", "Items 1, 15", "Open - both stage pages use a figures-being-finalised treatment; no amounts are encoded anywhere"],
    ["Decline and reversal policy for the agreement", "Item 16", "Deferred by business decision - accept-only scope shipped; no decline column, endpoint or interface"],
    ["Agreement wording approval, including whether to add Important Conditions", "Item 18", "Open - the section is omitted until approved wording exists; the acknowledgement label is flagged for review"],
    ["Agreement versioning and re-acceptance policy", "Item 17", "Open - each acceptance records version 1.0; the policy for future versions is undecided"],
    ["Identity model for consequential actions", "Items 13, 19", "Open - the reference-only lookup model is retained for now; to be revisited before high-stakes actions"],
    ["Reference recovery verification strength", "Item 11", "Interim three-field match is live; the known limitation is documented"],
    ["Assessment interim policies (retry cap, insight visibility, randomisation)", "Items 6-9", "Configured at service level and labelled as pending in the UI; nothing unresolved published as fact"],
    ["Advertised NGN 500 cashback claim", "Item 10", "Unconfirmed - the claim is encoded nowhere in the product"],
  ],
  [32, 12, 56]
));

// ============ 7. Engineering Notes ============
body.push(h1("7. Engineering Notes and Operational Resilience"));
body.push(para(
  "Two operational lessons from this week are worth recording, because both will recur in future weeks.",
  { spacing: { before: 160 } }
));
body.push(para([
  b("Sandbox resets. "),
  t("The working environment wiped runtime state mid-week: environment variables reverted, database files and the development server were removed, while committed code and migrations survived intact. A restore procedure is now documented and rehearsed - restore the database URL, restart PostgreSQL, re-apply migrations, and relaunch the development server as a daemon. After one reset the whole of Stage 1 was re-verified end to end with no product-code changes needed beyond a one-line framework advisory fix."),
]));
body.push(para([
  b("Server survival. "),
  t("Development servers launched normally were reaped between sessions. The fix was true double-fork daemonisation plus a self-healing watchdog that health-checks the server every five seconds and respawns it when needed. Database scripts are also wrapped so that a globally exported file-type database URL cannot silently override the project's PostgreSQL setting."),
]));
body.push(para(
  "Process discipline that held throughout: a written plan before code for every stage; no stage bleeding into the next; verified code never rebuilt (new stages integrate with it, and only stale copy was refreshed); and a worklog entry for every task, which is the source for this report."
));

// ============ 8. Next Week ============
body.push(h1("8. Plan for the Coming Week"));
body.push(para(
  "Stage 4 (Provisional Appointment) has not been started, in line with the engagement's stage gate; it awaits a separate planning instruction. The coming week's plan, under the same gate, is:"
));
body.push(bullet([b("Stage 4 planning on instruction. "), t("Derive the appointment stage from the existing agreement-accepted state, following the same inspect-plan-implement-verify sequence used for Stages 1-3.")]));
body.push(bullet([b("Business inputs to close open items. "), t("Confirmed reward figures and thresholds (a content-only change behind the versioned configuration once available); the decline and reversal decision (the schema stays clean until then); and approved agreement wording, including whether Important Conditions is added - which raises the documented version-bump and re-acceptance question.")]));
body.push(bullet([b("Content refresh on confirmation. "), t("When reward figures are confirmed, update the orientation and agreement content and re-verify the affected pages.")]));
body.push(bullet([b("Regression baseline. "), t("The ten fixture candidates across all statuses keep every future verification cheap and realistic.")]));
body.push(para(
  "No risks to the delivered stages are currently open. All known issues are either documented library-level warnings or business decisions parked in Section 6, each with a clear owner action once inputs arrive.",
  { spacing: { before: 120 } }
));

// ---------------------------------------------------------------- document
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  features: { updateFields: true },
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_H, size: 32, bold: true, color: P.ink },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: FONT_H, size: 28, bold: true, color: P.ink },
        paragraph: { spacing: { before: 260, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: FONT_H, size: 24, bold: true, color: P.ink },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  sections: [
    // -------- Section 1: Cover (margin 0, no page number, no footer)
    {
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1(coverConfig),
    },
    // -------- Section 2: Front matter (TOC) - Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({
            text: "Table of Contents", bold: true, size: 32, color: P.ink,
            font: { eastAsia: "SimHei", ascii: "Times New Roman" },
          })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888", font: FONT,
          })],
        }),
      ],
    },
    // -------- Section 3: Body - Arabic numerals from 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: "FinFam Recruitment Portal - Weekly Progress Report",
              size: 18, color: P.secondary, font: FONT,
            })],
          })],
        }),
      },
      footers: { default: pageNumFooter() },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/report.docx", buf);
  console.log("OK: /home/z/my-project/report.docx written,", buf.length, "bytes");
});
