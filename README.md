# FinFam Recruitment Portal

A focused recruitment portal that moves a candidate from application to
activation with minimal manual intervention.

**Implemented stages:** application (scaffold) and **Stage 1 — FinFam Staff
Orientation Workshop (FSOW)** (`/orientation`). The later stages
(assessment, offer, appointment, activation, onboarding) are intentionally
**not implemented yet** — each is planned stage-by-stage before it is built
(see [Next phase](#next-phase)).

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

Section *content* lives in `src/config/orientation.ts` and
`src/config/agreement.ts`; the database stores only candidate progress and
decisions. Future models (Appointment, Activation, Onboarding…) are added
when their stage is planned, not before.

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

Stage 1 (FSOW orientation) is complete and browser-verified. **Do not start
implementing the next stage automatically.** The assessment stage (and each
stage after it) is planned individually — user flow, pages, APIs, validation,
business rules, and states — before any implementation.

Business decisions still outstanding (reward figures, Established Member
threshold, official vision/mission wording, support inbox) are tracked in
[docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).
