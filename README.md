# FinFam Recruitment Portal

A focused recruitment portal that moves a candidate from application to
activation with minimal manual intervention.

**Implemented stages (all six, verified):** Application (scaffold), Stage 1 —
FinFam Staff Orientation Workshop (FSOW) (`/orientation`), Stage 2 —
Automated Interview Assessment (`/assessment`), Stage 3 — Responsibility &
Reward Agreement (`/agreement`), Stage 4 — Provisional Appointment
(`/appointment`), Stage 5 — Staff Activation (`/activation`), plus the
staff-side Stage 6 — Staff Onboarding (`/onboarding`). The recruitment +
onboarding MVP is complete — see [Next phase](#next-phase).

---

## Technology stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript                          |
| UI         | HeroUI v3 (`@heroui/react` + `@heroui/styles`, React Aria)     |
| Styling    | Tailwind CSS v4 (CSS-first config, BEM classes from HeroUI)    |
| Font       | Manrope (Google Fonts via `next/font`) — weights 400/500/600/700 |
| Database   | PostgreSQL + Prisma ORM (migrations)                           |
| Validation | Zod schemas shared by client and server (`src/lib/validation`) |
| Icons      | lucide-react (single icon system, used sparingly)              |

## Quick start

```bash
# 1. Install dependencies
bun install

# 2. Start the local PostgreSQL server (no root required — see below)
bun run db:start

# 3. Push the schema and generate the Prisma client
bun run db:push          # or: bun run db:migrate

# 4. Run the dev server on port 3000
bun run dev
```

### Local PostgreSQL

The sandbox provides real PostgreSQL 17 binaries via the
`@embedded-postgres/linux-x64` package (plus a vendored ICU 60 runtime in
`db/pg-libs`). `scripts/postgres.sh` initializes `db/pg-data`, listens on
`127.0.0.1:5432` only, and creates the `finfam` database on first start.

```bash
bun run db:start     # start (idempotent) + ensure database exists
bun run db:status    # is it running?
bun run db:stop      # stop
```

Connection string (from `.env`): `postgresql://postgres@127.0.0.1:5432/finfam?schema=public`

> In production, point `DATABASE_URL` at a managed PostgreSQL instance.
> The embedded server exists so local development matches production exactly.

### Scripts

| Script                | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `bun run dev`         | Next.js dev server on port 3000 (loads `.env`)      |
| `bun run lint`        | ESLint                                              |
| `bun run db:start`    | Start local PostgreSQL + create `finfam` database   |
| `bun run db:stop`     | Stop local PostgreSQL                               |
| `bun run db:push`     | Push schema to database (fast dev iteration)        |
| `bun run db:migrate`  | Create/apply Prisma migrations (canonical workflow) |
| `bun run db:reset`    | Reset the database                                  |

> All `db:*` scripts run through `scripts/prisma.sh` / `scripts/dev.sh`,
> which force `.env` values to win over any inherited shell environment.

---

## Project structure

```
src/
  app/
    page.tsx                     Welcome / open role landing
    apply/page.tsx               Application form (form conventions exemplar)
    status/page.tsx              Candidate status lookup
    orientation/
      page.tsx                   FSOW entry (reference-number lookup)
      [reference]/page.tsx       Orientation overview (list + progress rail)
      [reference]/[section]/     Section content pages (8, sequential)
      loading.tsx, error.tsx     Segment-level loading/error convention
    loading.tsx                  Route-level loading convention
    error.tsx                    Route-level error convention
    not-found.tsx                404 convention
    api/
      applications/route.ts      POST — submit an application
      candidates/[reference]/    GET  — candidate status by reference number
      orientation/
        [reference]/route.ts           GET  — orientation state
        [reference]/sections/route.ts  POST — mark a section as read
        [reference]/complete/route.ts  POST — complete the workshop
      health/route.ts            GET  — liveness + database connectivity
  components/
    layout/                      PageShell, SiteHeader, SiteFooter,
                                 PageContainer, PageHeader
    recruitment/                 RecruitmentProgress, StatusBadge, StatusLookup
    orientation/                 SectionList, ProgressCard, Content,
                                 SectionReadFooter, CompleteOrientationButton,
                                 OrientationEntryForm, NotFoundPanel
    forms/                       ApplyForm (form conventions exemplar)
    ui/                          ButtonLink (button-styled link)
    providers.tsx                Client providers (Toast.Provider)
  config/
    site.ts                      Site name, nav, support contact
    recruitment.ts               Stages, status definitions, status→stage mapping
    content.ts                   Landing-page content (placeholders flagged)
    orientation.ts               FSOW section content (single source of truth)
  lib/
    db.ts                        Server-only Prisma client
    errors.ts                    AppError + factories
    reference.ts                 Reference number generation/validation
    orientation.ts               Pure orientation state helpers (config + state)
    api/response.ts              Server response envelope helpers
    api/client.ts                Client fetch helper (ApiClientError)
    validation/application.ts    Shared zod schema (authoritative on server)
    validation/orientation.ts    Shared zod schemas for orientation actions
    utils.ts                     cn() class merge
  server/services/               Business logic (applications, candidates,
                                 orientation)
  types/                         Shared API + recruitment domain types
prisma/
  schema.prisma                  Candidate, Application, StageEvent,
                                 Orientation, OrientationSection (+ enums)
  migrations/                    Prisma migration history
scripts/
  postgres.sh                    Local PostgreSQL control (start/stop/status)
  dev.sh, prisma.sh              .env-aware process wrappers
docs/
  DESIGN-SYSTEM.md               Tokens, components, UX conventions
  CONTENT-QUESTIONS.md           Business content awaiting confirmation
```

**Data flow rule:** UI → API route handler → service (`src/server/services`)
→ Prisma → PostgreSQL. UI components never import Prisma, and client code
never imports `src/lib/db.ts` or anything under `src/server/`. Server
components read stage state through the service layer directly (the service
is the API for server rendering); every *mutation* goes through an API route
handler and is validated server-side — the client never decides progress.

---

## Database schema

- **Candidate** — person + `referenceNumber` (public lookup key), `status`
  (`CandidateStatus` mirrors the recruitment state machine).
- **Application** — one submitted application for a role.
- **StageEvent** — append-only timeline of stage transitions (powers the
  status page; later, the admin audit trail).
- **Orientation** (Stage 1) — one row per candidate: resume point
  (`currentSectionId`), `acknowledgedAt`, `completedAt`.
- **OrientationSection** — append-only completion records, one per read
  section (unique per candidate + section).
- **Agreement** (Stage 3 — the Responsibility & Reward Agreement, persisted
  as the OFFER stage) — one row per candidate, created only by an explicit
  server-validated acceptance: `version` (pins the accepted content from
  `src/config/agreement.ts`) + `acceptedAt`. Viewing never creates a row.
- **Appointment** (Stage 4) — the issued letter snapshot: unique
  `appointmentReference` (FFL/HR/PLA/NNN), pinned content `version`,
  `printedName`, `roleTitle`, `issuedAt` — immutable after issuance;
  letter TEXT resolves from the versioned registry in
  `src/config/appointment.ts`.
- **Staff** (Stage 5) — the permanent staff identity and activation record:
  unique `staffId` (FF-STF-NNNN), `version`, designation/appointment-
  reference snapshots from the issued Appointment, `activatedAt` — all
  immutable. No personal data is duplicated (the Candidate relation
  carries identity).
- **StaffOnboarding** (Stage 6) — STAFF-SIDE operational onboarding, one
  record per Staff member (created lazily on the first valid onboarding
  visit): pinned content `version`, `currentStepId` resume pointer,
  `startedAt`, `completedAt` (set only by the explicit server-validated
  completion). Deliberately NO CandidateStatus/RecruitmentStage/StageEvent
  involvement — `APPROVED_STAFF` stays the terminal recruitment status.
- **StaffOnboardingStep** — append-only completion rows, one per reviewed
  step (unique per onboarding + step); the final `ready` step is recorded
  by the acknowledgement itself inside the completion transaction.
- **StaffIdSequence / AppointmentSequence** — server-controlled singleton
  sequences behind FF-STF-NNNN and FFL/HR/PLA/NNN allocation (atomic
  `UPDATE … RETURNING` inside the stage transaction).

Section *content* lives in `src/config/orientation.ts`,
`src/config/agreement.ts`, `src/config/appointment.ts`,
`src/config/activation.ts` and `src/config/onboarding.ts`; the database
stores only candidate progress, decisions and issued/activated records.
Future models (Staff Platform…) are added when their roadmap is planned,
not before.

### Staff Onboarding stage rules (server-enforced)

- Onboarding is STAFF-SIDE operational state (stage 6, the FINAL stage):
  it writes NO CandidateStatus value, NO RecruitmentStage value and NO
  StageEvent. Eligibility = `APPROVED_STAFF` + an existing Staff record,
  enforced server-side on every route; every non-approved status gets an
  honest `eligible: false` view and 409 on writes; unknown references get
  the neutral 404.
- Opening the onboarding page (or `GET` API) lazily and idempotently
  creates the one `StaffOnboarding` row (startedAt, pinned version,
  resume step) — race-safe via the unique constraint. Opening NEVER
  completes a step and NEVER completes onboarding.
- The seven steps (`welcome → communication → resources → engagement →
  reporting → standards → ready`) are sequential and server-enforced:
  skip-ahead/unknown steps → 422 (naming the required step); re-completing
  a step is idempotent; completed steps may be re-read read-only
  (`?step=<id>`); future steps are never rendered.
- Completion is explicit and exactly once: all six review steps + the
  literal acknowledgement + the current version. The final `ready` step is
  recorded by the acknowledgement itself in the same transaction as the
  conditional `completedAt` latch — repeated or concurrent completions
  produce ONE timestamp and return the persisted record. No CandidateStatus
  change, no StageEvent.
- One-way: completed onboarding is closed — `/onboarding/[reference]`
  redirects to the unified journey, which shows the terminal staff state
  ("Onboarding completed — You are ready to begin your FinFam
  assignment."). No read-only archive page in this MVP.
- The official WhatsApp onboarding number has NOT been supplied — the
  communication step shows honest pending copy and no fabricated link
  (docs/CONTENT-QUESTIONS.md §33). WhatsApp contact is NOT a completion
  gate and there is no human verification gate (§34); resources are
  list-only (§35); the ID card and daily-report submission are out of
  scope (§35/§36).

### Staff Activation stage rules (server-enforced)

- Opening the activation page (or `GET` API) lazily and idempotently moves
  the candidate `APPOINTMENT_ISSUED → ACTIVATION_PENDING` and records a
  StageEvent (`ENTERED`) exactly once — viewing NEVER activates anything
  and never creates a Staff row.
- Activation is explicit: the request must carry the literal
  acknowledgement and the activation version; the server re-validates
  everything and writes the `APPROVED_STAFF` transition, the `Staff` row
  (with the sequence-allocated Staff ID and appointment-derived
  snapshots) and ONE StageEvent (`COMPLETED`) in ONE transaction — no
  partial activation. Repeated or concurrent requests are idempotent.
- One-way: after activation the stage is closed — the page redirects to
  the unified journey, which shows the read-only staff record (Staff ID,
  activation date, designation). There is no deactivate/revoke workflow
  (docs/CONTENT-QUESTIONS.md §32).
- `APPROVED_STAFF` means: recruitment complete + staff activated. It does
  NOT mean onboarding is complete or that December 2026 confirmation has
  occurred.

### Agreement stage rules (server-enforced)

- Opening the agreement (page or `GET` API) lazily and idempotently moves
  the candidate `ASSESSMENT_PASSED → OFFER_PENDING` and records a
  StageEvent (`ENTERED`) exactly once — viewing NEVER implies acceptance.
- Acceptance is explicit: the request must carry the literal
  acknowledgement and the version the candidate reviewed; the server
  re-validates everything and writes the `OFFER_ACCEPTED` transition, the
  versioned `Agreement` row and a StageEvent (`COMPLETED`) in ONE
  transaction. Repeated requests are idempotent — the persisted decision
  is returned, never duplicated.
- One-way progression: after acceptance the agreement stage is closed —
  direct URLs and API calls can no longer render or accept it.
- Decline is deliberately not implemented — the decline policy is an
  unresolved business decision (docs/CONTENT-QUESTIONS.md §16).

### Orientation stage rules (server-enforced)

- Sections are completed **in order**; each requires an explicit
  “Mark as read & continue” — opening a page is never counted as progress.
- Completing the first section moves the candidate
  `APPLICANT → ORIENTATION_PENDING` and records a StageEvent (`ENTERED`).
- Orientation is complete only via the explicit confirmation
  (“Complete orientation?” modal + integrity acknowledgement) after all
  sections are read: status → `ORIENTATION_COMPLETED`, StageEvent
  (`COMPLETED`), `completedAt`/`acknowledgedAt` persisted. Re-submissions
  are idempotent; mutating a completed orientation returns 409.

## API contract

Every route handler returns the same envelope:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "…human message…", "fields": { "email": "…" } } }
```

- Validation errors: `VALIDATION_ERROR` (422) with per-field messages.
- Unknown reference: `NOT_FOUND` (404) with actionable copy.
- Duplicate application email: `CONFLICT` (409) with field error.
- Orientation endpoints:
  - `GET /api/orientation/[reference]` — orientation state for the candidate.
  - `POST /api/orientation/[reference]/sections` `{ sectionId }` — mark a
    section as read. Out-of-order → 422; already-completed section → 200
    (idempotent); completed orientation → 409.
  - `POST /api/orientation/[reference]/complete` `{ acknowledgement: true }`
    — completes the workshop. Missing sections or acknowledgement → 422.
- Assessment endpoints:
  - `GET /api/assessment/[reference]` — assessment state: eligibility,
    phase, active attempt (safe question data + saved answers) or result.
    Never includes correct answers or insights.
  - `POST /api/assessment/[reference]/start` `{}` — start or resume.
    Ineligible (orientation incomplete), already passed, or past the
    attempt policy → 409; active attempt → 200 (resume, no duplicate).
  - `POST /api/assessment/[reference]/answers`
    `{ questionId, selectedOption }` — autosave one answer on the active
    attempt (idempotent upsert). Question must belong to the attempt's
    persisted set; submitted attempt → 409.
  - `POST /api/assessment/[reference]/submit` `{}` — server-side scoring
    (answer key is server-only). Pass = 70% (21/30). Double submit is
    idempotent — the persisted result is returned, never duplicated.
- Agreement endpoints (the Responsibility & Reward Agreement — persisted
  as the OFFER stage; candidate-facing label "Agreement"):
  - `GET /api/agreement/[reference]` — agreement content + version, the
    candidate's decision state and eligibility. Reading records the stage
    entry (idempotent) — viewing never implies acceptance.
  - `POST /api/agreement/[reference]/accept`
    `{ acknowledgement: true, version }` — record acceptance. Missing
    acknowledgement or a stale version → 422; wrong stage → 409; repeated
    requests return the persisted decision (idempotent). Eligibility,
    transitions, the versioned Agreement row and the StageEvent are all
    enforced/written server-side in one transaction.
- Appointment endpoint (the Provisional Appointment — stage 4):
  - `GET /api/appointment/[reference]` — for an eligible (OFFER_ACCEPTED)
    candidate the FIRST read lazily issues the letter exactly once
    (OFFER_ACCEPTED → APPOINTMENT_ISSUED, one Appointment row, one
    FFL/HR/PLA/NNN reference from a transactional singleton sequence, one
    APPOINTMENT/COMPLETED StageEvent — all in one transaction); every later
    read returns the same issued record unchanged (read-only). Candidates
    not yet at the appointment stage get an honest `issued: false` view —
    reading issues nothing for them; unknown references get the neutral
    404. There is deliberately NO issue API and NO PDF download API
    (printing uses the browser); email delivery is out of scope
    (docs/CONTENT-QUESTIONS.md §26). Rendered by `/appointment/[reference]`.
- Activation endpoints (Staff Activation — stage 5):
  - `GET /api/activation/[reference]` — what activation means, the
    candidate's appointment context and eligibility. Reading records the
    stage entry (`APPOINTMENT_ISSUED → ACTIVATION_PENDING`, one ENTERED
    StageEvent, idempotent) — viewing never activates anything and never
    creates a Staff row. After activation the same GET returns the
    read-only staff record; ineligible candidates get an honest
    `eligible: false` view; unknown references get the neutral 404.
  - `POST /api/activation/[reference]/activate`
    `{ acknowledgement: true, version }` — the explicit end of the
    recruitment journey: `APPOINTMENT_ISSUED`/`ACTIVATION_PENDING` →
    `APPROVED_STAFF`, one `Staff` row with the server-allocated
    `FF-STF-NNNN` Staff ID (transactional singleton sequence, seeded at 0
    → first ID `FF-STF-0001`), appointment-derived snapshots (designation,
    appointment reference) and exactly one COMPLETED StageEvent — all in
    ONE transaction. Missing/false acknowledgement or stale version → 422;
    wrong stage → 409; repeated or concurrent requests return the same
    persisted record (idempotent — one row, one ID, one timestamp, one
    event). Staff ID and status are never accepted from the browser.
    Activation is one-way (no deactivate/revoke workflow,
    docs/CONTENT-QUESTIONS.md §32). Rendered by `/activation/[reference]`.
- Onboarding endpoints (Staff Onboarding — stage 6, STAFF-SIDE):
  - `GET /api/onboarding/[reference]` — staff identity context, onboarding
    state (NOT_STARTED / IN_PROGRESS / COMPLETED), completed steps, resume
    point and the step content (with its version). Reading is the entry
    action for eligible staff: the first open lazily creates the one
    onboarding record (idempotent, race-safe) — viewing never completes
    anything. Ineligible candidates get an honest `eligible: false` view;
    unknown references get the neutral 404.
  - `POST /api/onboarding/[reference]/steps` `{ stepId }` — mark one step
    as reviewed. Sequential order is server-enforced (skip-ahead/unknown →
    422 naming the blocker; after completion → 409); duplicates are
    idempotent; the resume point is derived on write, never accepted from
    the client.
  - `POST /api/onboarding/[reference]/complete`
    `{ acknowledgement: true, version }` — the explicit end of onboarding:
    requires all six review steps, records the final `ready` step and sets
    `completedAt` exactly once (conditional latch in one transaction).
    Missing/false acknowledgement or stale version → 422; incomplete steps
    → 422; wrong stage → 409; repeated or concurrent requests return the
    same persisted record. No CandidateStatus change, no StageEvent.
    Rendered by `/onboarding/[reference]`.
- Unified journey endpoints:
  - `GET /api/journey/[reference]` — the server-derived recruitment journey
    for one application: current stage, completed/locked stages, the ONE
    next action and the append-only event history. The stage is decided by
    the server from persisted state (`CandidateStatus` + stage records) —
    clients never select it. Rendered by `/application/[reference]`.
  - `POST /api/recruitment/recover-reference`
    `{ fullName, email, phone }` — reference recovery. ALL three details
    must match the application; only the reference is revealed. Every
    mismatch returns the same neutral 404 (no application enumeration).
    Verification policy: docs/CONTENT-QUESTIONS.md §11.
- Unexpected failures: logged server-side (`[api] Unhandled error:`),
  returned as a safe generic message (500). Stack traces, SQL and driver
  details never reach the client.

## Environment variables

| Variable        | Required | Purpose                                   |
| --------------- | -------- | ----------------------------------------- |
| `DATABASE_URL`  | yes      | PostgreSQL connection string for Prisma   |

Copy `.env.example` → `.env` and adjust. Rules:

- Only truly public values may use the `NEXT_PUBLIC_` prefix (currently none).
- Never log candidate PII; never put PII in URLs. The reference number is a
  lookup key the candidate already holds — it is the one exception.

## Conventions (summary)

The full UX component rules live in [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).

- **One next action** — every page exposes exactly one primary action.
- **Forms** — visible labels with `*` required markers, description text
  where it helps, zod validation shared client+server (server is
  authoritative), field errors under fields, page-level errors as Alerts.
- **Feedback** — toast = short-lived confirmation of an action; alert =
  information that must stay visible; modal = confirm decisions (added when
  needed, e.g. offer decline in a later stage).
- **States** — every async operation has loading, error, and empty states
  (`app/loading.tsx`, `app/error.tsx`, per-feature skeletons).
- **Server/Client split** — pages are server components; `"use client"` only
  where interactivity is required (forms, lookup flow, orientation actions,
  toast).
- **Responsive recomposition** — desktop/tablet are not mobile stretched
  wider: when content relationships justify it, layouts split into 2+ columns
  (e.g. orientation overview: section list + progress rail from `md` up;
  section pages: content + “In this section” rail from `lg` up).

## Next phase

**The FinFam recruitment + onboarding MVP is complete.** All six recruitment
stages (Application → Orientation → Assessment → Agreement → Appointment →
Activation) plus the staff-side Onboarding stage are implemented, verified
and integrated on the unified journey. There is NO Stage 7 in this journey.

Any further product work — Staff Portal, staff dashboard, daily-report
submission, payroll/commissions, member tracking, ID-card generator, admin
console — belongs to a separate **FinFam Staff Platform / Operations
roadmap** and must go through its own planning phase before implementation.
**Do not start building any of it automatically.**

Business decisions still outstanding (official onboarding WhatsApp number,
canonical role title portal-wide, identity-verification hardening, resource
assets) are tracked in
[docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).
