# FINFAM RECRUITMENT PORTAL

## Weekly Project Progress Report

**Project:** FinFam Recruitment Portal MVP
**Reporting Period:** Project Start – 14 September 2026
**Current Position:** Stage 3 — Responsibility & Reward Agreement
**Status:** Architecture and Stages 1–3 implemented and verified; Stage 4 awaiting planning

---

## 1. Project Overview

Development of the FinFam Recruitment Portal is focused on creating a structured, largely automated recruitment journey that takes a candidate from initial application through orientation, assessment, agreement, provisional appointment, activation, and onboarding.

The objective is to reduce manual intervention while ensuring that each recruitment stage is properly controlled, recorded, and auditable.

The recruitment journey is designed as **one continuous application**, rather than a collection of independent pages or systems.

### Recruitment Journey

**Application → FSOW Orientation → Automated Assessment → Responsibility & Reward Agreement → Provisional Appointment → Staff Activation → Onboarding**

The current implementation has progressed through the application, orientation, assessment, unified journey architecture, and agreement stages.

---

# 2. Initial Project Scaffold

The project was first established with the technical and architectural foundation required for the recruitment portal.

### Technology Stack

* Next.js 16
* TypeScript
* Next.js API Route Handlers
* Prisma ORM
* PostgreSQL
* HeroUI v3
* Tailwind CSS v4
* Manrope typography
* Zod validation

### Initial Architecture

A strict application architecture was established:

**UI → API Route → Service → Prisma → PostgreSQL**

This ensures that business rules are not implemented only in the frontend and that important recruitment decisions are enforced server-side.

### Initial Design System

A FinFam-specific design system was established around:

* White and neutral surfaces
* FinFam green `#0c7a43`
* Dark neutral typography
* Manrope
* Generous whitespace
* Minimal borders and shadows
* No gradients
* No glassmorphism
* No unnecessary decorative elements
* Professional B2B/recruitment visual language

An explicit effort was made to prevent generic "AI-generated SaaS" design patterns.

### Database Foundation

The initial database architecture introduced:

* Candidate
* Application
* CandidateStatus
* StageEvent

The recruitment reference was established as the candidate's persistent identifier throughout the recruitment journey.

Example:

`FF-XXXXXX`

The reference is generated once during application and remains associated with the candidate throughout the entire process.

---

# 3. Application Stage

The initial application flow was implemented and verified.

### Candidate information collected

The initial MVP application collects:

* Full name
* Email
* Phone number
* City (optional)
* Role selection (validated server-side against the open position)
* Consent confirmation

The shared validation schema is authoritative and is re-run on the server for every submission, so the collected data set can be extended in later stages without changing the validation architecture.

### Application functionality

The application stage established:

* Candidate creation
* Recruitment reference generation
* Server-side validation
* Client-side validation
* Duplicate email handling
* API error conventions
* Confirmation state
* Reference display
* Candidate status tracking

### Verification

The application flow was tested at:

* 375px
* 768px
* 1024px
* 1440px

Validation, duplicate records, reference generation, API responses, and responsive behaviour were verified.

---

# 4. FSOW Orientation Stage

The second major feature stage introduced the **FinFam Staff Orientation Workshop (FSOW)**.

A dedicated orientation system was implemented without creating a separate candidate/application identity.

### Orientation structure

The orientation contains eight sequential sections:

1. About FinFam
2. Products & Services
3. Your Role
4. Support Package
5. Reward Structure
6. Professional Standards
7. Monitoring & Accountability
8. Fraud & Misrepresentation

### Key functionality

The orientation system supports:

* Sequential section progression
* Server-side section gating
* Resume from the candidate's previous position
* Section completion records
* Explicit "Mark as read & continue"
* Completion acknowledgement
* Orientation completion timestamp
* Stage events

### State transitions

The system introduced controlled transitions including:

**APPLICANT → ORIENTATION_PENDING → ORIENTATION_COMPLETED**

Each important transition is recorded using the existing append-only StageEvent system.

### Important content decision

The supplied business materials contained conflicting information regarding the definition of an **Established Member**, particularly around the savings threshold.

Rather than inventing a value, the issue was documented in:

`docs/CONTENT-QUESTIONS.md`

The reward section therefore uses a pending-confirmation treatment where necessary.

### Verification

The orientation journey was tested for:

* Fresh candidates
* Returning candidates
* Section gating
* Resume functionality
* Completion acknowledgement
* Invalid references
* Invalid sections
* Duplicate completion
* API errors
* Responsive layouts
* Keyboard accessibility
* Console errors
* Development log cleanliness

---

# 5. Automated Assessment Stage

The next feature stage introduced the automated recruitment assessment.

### Assessment structure

The assessment consists of:

* 30 multiple-choice questions
* 4 options per question
* 5 marks per question
* 150 total marks
* 70% pass mark
* 21/30 required to pass

### Assessment functionality

Implemented features include:

* Assessment eligibility gating
* Attempt creation
* Question ordering
* One-question-at-a-time interface
* Previous/Next navigation
* Question progress
* Answer persistence
* Optimistic autosave
* Saved-state indicator
* Retry handling
* Question navigation rail
* Submission confirmation modal
* Automatic scoring
* Persistent result
* Pass/fail status
* Retake support

### Security

A significant security measure was implemented around assessment content.

Correct answers and insights are kept server-side and are not exposed to the client.

The generated application bundles were inspected to verify that:

* `correctIndex`
* answer keys
* assessment insights

were not exposed to client-side code.

### Assessment state transitions

The assessment introduced:

**ORIENTATION_COMPLETED → ASSESSMENT_PENDING**

Then:

**ASSESSMENT_PENDING → ASSESSMENT_PASSED**

or:

**ASSESSMENT_PENDING → ASSESSMENT_FAILED**

### Testing

The following cases were verified:

* Unknown candidate
* Assessment before orientation
* Invalid question
* Invalid answer
* Resume
* Duplicate start
* All-correct result
* Exact 70% pass result
* Failed result
* Unanswered questions
* Duplicate submission
* Retake
* Answers after submission
* Start after passing

A precise **21/30 = 70%** pass case was also verified.

Responsive testing was completed at:

* 375px
* 768px
* 1024px
* 1440px

---

# 6. Architecture Correction — Unified Recruitment Journey

During development, an important architectural issue was identified.

Initially, Application, Orientation, and Assessment could appear to users as separate modules.

This was corrected before continuing to later stages.

The portal was redesigned conceptually as:

> **One recruitment application progressing through controlled stages.**

### Core architectural decisions

The portal now has:

* One Candidate
* One Application
* One recruitment reference
* One status/state machine
* One unified journey
* Server-driven stage resolution

The candidate does not select which stage to enter.

Instead, the system determines the candidate's current stage from persisted recruitment state.

---

# 7. Centralized Recruitment Journey Service

A centralized service was introduced:

`src/server/services/journey.ts`

with:

`getRecruitmentJourney(reference)`

This service derives:

* Current stage
* Completed stages
* Locked stages
* Next action
* Resume information
* Assessment result
* Stage history
* Coming-next information

This prevents the frontend from independently deciding which stage a candidate should access.

The server remains the authoritative source of recruitment progression.

---

# 8. Unified Candidate Access

A dedicated **Continue Application** experience was introduced.

### Returning candidate flow

**Landing page → Continue Application → Reference → Unified Journey → Current Stage**

The candidate no longer needs to enter their reference separately on:

* Orientation
* Assessment
* Future stages

Duplicate reference forms were removed.

### Reference recovery

A recovery flow was also introduced:

`/continue/recover`

The candidate provides:

* Name
* Email
* Phone

All three must match before the recruitment reference is revealed.

Invalid attempts return the same neutral response to reduce account/reference enumeration.

The security limitation of using the reference as a lookup key was documented for future review.

---

# 9. Unified Application Journey Page

A central journey page was introduced:

`/application/[reference]`

It communicates:

* Current recruitment stage
* Completed stages
* Locked stages
* Current next action
* Resume progress
* Stage history
* Coming-next information

The journey uses a single primary CTA based on the candidate's current stage.

For example:

> **Your application is currently at: Assessment**

or, after passing:

> **Your application is currently at: Agreement**

The journey progress indicator is informational and is **not a navigation menu**.

---

# 10. Stage Access and One-Way Progression

Server-side guards were implemented to ensure that candidates cannot bypass the recruitment sequence.

For example:

* A candidate who has not completed orientation cannot directly access assessment.
* A candidate who has not passed assessment cannot access the agreement.
* A completed stage cannot be reopened as an active workflow.
* Direct URLs cannot bypass eligibility.
* Browser back navigation cannot reopen a completed workflow.

The browser may return to a previous page, but the server remains authoritative.

This establishes a proper one-way recruitment progression.

---

# 11. Navigation Simplification

The main navigation was reduced to focus on the actual recruitment experience:

* Open Roles
* How It Works
* Continue Application

Separate navigation items for:

* Application
* Orientation
* Assessment
* Agreement
* Appointment
* Activation
* Onboarding

were intentionally removed.

These are stages of one recruitment journey, not separate products or modules.

---

# 12. Responsive and Accessibility Improvements

Responsive behaviour was treated as a layout-composition requirement rather than simply shrinking the mobile interface.

### Mobile

A single-column layout is used where appropriate.

### Tablet/Desktop

Meaningful two-column compositions are used when the content hierarchy supports them.

The application was tested at:

* 375px
* 768px
* 1024px
* 1440px

Verification included:

* No horizontal overflow
* Appropriate spacing
* Desktop/tablet recomposition
* Footer behaviour
* Keyboard navigation
* Visible focus states
* Accessible controls
* Screen-reader-friendly states
* No console errors

---

# 13. Stage 3 — Responsibility & Reward Agreement Planning

Following completion of the unified journey architecture, Stage 3 planning was carried out.

The planned stage is:

**Assessment Passed → Responsibility & Reward Agreement → Provisional Appointment**

The planning inspection confirmed that the existing database already contains:

* `OFFER_PENDING`
* `OFFER_ACCEPTED`
* `OFFER_DECLINED`
* `OFFER` recruitment stage

Therefore, it was determined that a new `AGREEMENT` enum/state should **not** be introduced.

Instead:

> **Internal `OFFER` stage = candidate-facing Agreement**

This avoids unnecessary database migrations and duplicate architecture.

Planning was approved with one explicit scope adjustment: the implementation would be **accept-only** — no decline column, no decline API, and no decline interface — keeping the database clean until the decline policy is formally confirmed.

---

# 14. Stage 3 Agreement Functionality

The agreement allows candidates who have passed the assessment to review a versioned agreement document containing seven sections:

1. Your Role
2. Responsibilities
3. Support Package
4. Reward Structure
5. Performance & Accountability
6. Professional Conduct
7. Policy Updates

The content was built strictly from the supplied business material. The reward section names the structure with a figures-pending treatment and encodes no amounts; the "Important Conditions" section was omitted until its wording is approved.

The candidate explicitly acknowledges the agreement (checkbox plus a confirmation modal) and selects:

> **Accept Agreement**

Acceptance is recorded against a specific agreement version (version 1.0).

The implemented agreement model includes:

* Candidate (one-to-one)
* Agreement version
* Acceptance timestamp
* Append-only StageEvent audit records

The design supports future agreement versioning.

Viewing the agreement for the first time — on the page or via the API — also performs a lazy, idempotent stage entry: an assessment-passed candidate moves into the agreement-pending state with exactly one ENTERED event, safe against concurrent requests.

---

# 15. Stage 3 Security and State Control

The agreement uses:

* Server-side eligibility checks
* Zod validation
* Transactional state updates
* Append-only StageEvents
* Idempotent acceptance
* Agreement version verification
* The existing API envelope
* The existing AppError conventions

The system ensures that:

**ASSESSMENT_PASSED → OFFER_PENDING → OFFER_ACCEPTED**

and that accepting an agreement cannot be repeated in a way that creates duplicate records or events.

Additional enforced behaviour:

* Acceptance from any other recruitment stage is rejected with a conflict response.
* Unknown references receive the same neutral not-found response as elsewhere in the portal.
* After acceptance, the agreement address redirects back to the unified journey: browser back, direct URLs, and direct API calls cannot re-open or repeat the workflow.
* The journey displays the agreement as completed and shows the appointment stage as an honest, locked placeholder with no fake links.

---

# 16. Important Business Questions Identified

Several business decisions remain intentionally unresolved.

These have been documented rather than assumed.

### Reward structure

The supplied materials contain unresolved information around:

* ₦650 per Established Member
* Target bonus
* Established Member savings threshold
* ₦500 cashback claim

These figures require business confirmation before being presented as final agreement terms.

### Decline policy

It still needs to be confirmed:

* Whether candidates can decline through the portal
* Whether a decline can be reversed
* Whether there is a response deadline

Stage 3 was therefore implemented on an **accept-only** basis. No decline column, endpoint, or interface exists; the schema remains clean until the policy is formally confirmed.

### Candidate identity/security

The existing reference-based access model should be reviewed before consequential actions such as agreement acceptance.

An additional verification mechanism such as OTP may be considered in a later security improvement.

### Agreement wording

The final wording of the agreement and acknowledgement statement requires business approval.

These issues have been documented in:

`docs/CONTENT-QUESTIONS.md`

---

# 17. Current Project Status

| Area                        | Status                         |
| --------------------------- | ------------------------------ |
| Project scaffold            | ✅ Complete                     |
| Database foundation         | ✅ Complete                     |
| Application                 | ✅ Complete                     |
| FSOW Orientation            | ✅ Complete                     |
| Automated Assessment        | ✅ Complete                     |
| Unified Recruitment Journey | ✅ Complete                     |
| Continue Application        | ✅ Complete                     |
| Reference Recovery          | ✅ Complete                     |
| Stage access guards         | ✅ Complete                     |
| Responsive verification     | ✅ Complete                     |
| Accessibility verification  | ✅ Complete                     |
| Stage 3 planning            | ✅ Complete                     |
| Stage 3 implementation      | ✅ Complete (accept-only scope) |
| Provisional Appointment     | ⏳ Not started                  |
| Staff Activation            | ⏳ Not started                  |
| Onboarding                  | ⏳ Not started                  |
| Admin tooling               | ⏳ Not started                  |
| Analytics                   | ⏳ Not started                  |

---

# 18. Technical Quality

Across the completed stages, the following practices have been maintained:

* TypeScript
* Server-side validation
* Zod validation
* Prisma transactions
* PostgreSQL persistence
* Append-only stage events
* Idempotent operations
* Server-side recruitment state enforcement
* Consistent API response envelopes
* Reusable UI components
* Responsive layouts
* Accessibility considerations
* Clean development logs
* Additive-only database migrations
* No unnecessary package upgrades
* No unnecessary database duplication

The project has also been repeatedly browser-verified at mobile, tablet, and desktop breakpoints.

---

# 19. Current Milestone

The project has now reached the point where the foundational recruitment architecture is stable.

The important architectural correction has ensured that the system behaves as:

> **One candidate → One application → One reference → One continuous recruitment journey**

rather than separate Application, Orientation, Assessment, and Agreement applications.

With Stage 3 delivered and verified, the recruitment flow now runs end to end from application through an explicitly accepted agreement.

The next development milestone is:

### Stage 4 — Provisional Appointment

Stage 4 has **not** been started. In line with the stage-gated process used throughout the project, it will be planned separately before any implementation begins.

---

## 20. Overall Assessment

**Overall project status: ON TRACK**

The project has progressed from a basic technical scaffold to a functioning recruitment workflow with:

* Structured candidate applications
* Automated orientation
* Automated assessment and scoring
* Persistent recruitment state
* Controlled stage progression
* Unified candidate access
* Reference recovery
* Audit events
* Explicit, versioned agreement acceptance with one-way progression
* Responsive UI
* Accessibility support
* Clear separation between completed, current, and locked stages

The major architectural foundation is now in place, allowing subsequent recruitment stages to be added without creating separate systems or duplicating candidate access logic.
