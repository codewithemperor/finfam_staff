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
- **NotificationDelivery** — cross-cutting transactional email record
  (outbox pattern): one row per lifecycle notification intent, queued in
  the SAME database transaction as the state change it belongs to. Unique
  `dedupeKey` (`<TYPE>:<immutable entity id>`) makes queueing exactly-once
  under double-clicks, retries and concurrent requests. Carries the
  recipient email snapshot, template version, provider, provider message
  id, bounded `attemptCount` and safe last-error fields. No credentials and
  no rendered bodies are ever stored.

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

## Transactional notifications (Mailjet)

A cross-cutting platform service (NOT a recruitment stage) keeps
applicants/staff informed at meaningful lifecycle events. Architecture:

```text
domain services (orientation, assessment, agreement, …)
        ↓  enqueueNotification(tx, …)   ← inside the business transaction
NotificationDelivery row (outbox)       ← commits WITH the state change
        ↓  dispatchNotification(id)     ← AFTER the commit, fire-and-forget
notification-service → providers/mailjet.ts
        ↓  POST https://api.mailjet.com/v3.1/send (HTTP Basic, server-only)
Mailjet
```

Files: `src/server/notifications/` — `notification-types.ts` (stable keys,
typed payloads, dedupe keys, runtime config), `notification-templates.ts`
(code-owned subject/text/HTML per type, FinFam design, HTML-escaped),
`notification-service.ts` (outbox core: idempotent queueing, optimistic
send claim, bounded retries, payload re-derivation from immutable
snapshots), `providers/mailjet.ts` (the ONLY file that knows the Mailjet
wire format; no SDK dependency).

Lifecycle keys: `APPLICATION_RECEIVED`, `ORIENTATION_COMPLETED`,
`ASSESSMENT_PASSED`, `ASSESSMENT_FAILED` (attempt-keyed),
`AGREEMENT_ACCEPTED`, `APPOINTMENT_ISSUED`, `STAFF_ACTIVATED`,
`ONBOARDING_STARTED` (once, at lazy entry), `ONBOARDING_COMPLETED`.
`STAFF_ACCOUNT_CREATED` is RESERVED for Stage 7 — the type and template
exist, nothing triggers it, and no Staff Portal is advertised in any email.
No email is sent for page views, orientation sections or onboarding steps.

Delivery semantics — `SENT` means **Mailjet accepted the send request**;
actual inbox delivery/bounces require provider webhooks and are NOT claimed.
`FAILED` rows carry a safe error code (HTTP class / `TIMEOUT` /
`NETWORK_ERROR` — never credentials or provider bodies). An email outage can
never roll back or fail a recruitment action, and a user never repeats a
stage because email failed.

Retries are bounded (`NOTIFICATIONS_MAX_ATTEMPTS`, default 3) via
`retryNotification(id)` / `retryPendingNotifications({ limit })`. There is
NO cron in this project — recurring scheduling is a deployment concern for
a protected future worker.

Development safety: with `NOTIFICATIONS_ENABLED=false` (the default) rows
are still queued — so the full lifecycle is testable — but NO network
request ever leaves the server and suppressed sends are logged
(`[notifications] suppressed …`). Fixtures and E2E suites can never email a
real candidate.

## Staff Portal (Stage 7)

The Staff Portal is the operational home for **activated** FinFam Staff
(`APPROVED_STAFF`). It is a fully authenticated experience on top of the
recruitment data — recruitment pages and reference URLs remain available as
historical records, but all ongoing staff operations live in the portal.

### Architecture

```text
Staff Activation (one transaction)
  → Staff row + StaffAccount row + StageEvent
  → STAFF_ACTIVATED + STAFF_ACCOUNT_CREATED notification intents
        ↓ (after commit: Mailjet)
"Your FinFam Staff Portal is ready" email  →  /staff/login
        ↓
Email OTP (6 digits, 10 min, single use, hashed at rest)
        ↓
DB-backed session (HttpOnly cookie ff_staff_session, 7-day MVP default)
        ↓
/staff  → onboarding incomplete? YES → /staff/onboarding (onboarding-first)
                              NO  → Staff Portal home
```

Key invariants:

- **Identity is session-only**: every Staff API resolves
  `Session → StaffAccount → Staff → Candidate` from the HttpOnly cookie. No
  staff ID / reference / appointment reference is ever accepted as
  identity — Staff A cannot reach Staff B's data by any URL, query or body
  manipulation.
- **One onboarding state, two doors**: `/onboarding/[reference]` (legacy,
  kept working) and `/staff/onboarding` (authenticated) operate on the SAME
  `StaffOnboarding`/`StaffOnboardingStep` rows through one shared service
  core. Progress is visible through both instantly.
- **OTP security**: codes are generated with `crypto.randomInt`, stored only
  as sha256 hashes, expire in 10 minutes, tolerate max 5 failed attempts,
  are single-use (consumed exactly once by one verification transaction),
  superseded by newer requests, and protected by a 60s resend cooldown and
  a 5-per-15-minutes request limit. The OTP email is ONE-SHOT (no automatic
  retry — request a fresh code instead). Unknown/suspended emails receive
  the same neutral response and create no rows (anti-enumeration).
- **Suspension**: a `SUSPENDED` StaffAccount cannot receive usable codes,
  verify, or hold a resolving session (no admin UI in this stage).
- **Onboarding content v2.0** (`src/config/onboarding.ts`): the approved
  "Section 7 — Immediate Onboarding & Resumption Instructions" mapped to
  eight steps (intro → communication → verification → resources →
  orientation → assignment → accountability → ready), ending in one
  explicit acknowledgement. WhatsApp contact is honest pending copy until
  `ONBOARDING_WHATSAPP_NUMBER` is configured (then a plain `wa.me` link
  with the pre-filled first message — no API integration). Verification
  distinguishes system-verified facts (derived from persisted records) from
  external onboarding actions (never auto-ticked).

### Routes

| Route | Purpose |
| --- | --- |
| `/staff/login` | Email-OTP sign-in (two steps) |
| `/staff` | Portal home — redirects to onboarding until it is completed |
| `/staff/onboarding` | Onboarding & resumption experience (read-only summary once completed) |
| `/staff/appointment` | Session-owned view of the issued provisional letter |
| `/staff/resources` | Honest resource availability (list-only until real assets exist) |
| `/staff/profile` | Read-only staff identity |

APIs: `POST /api/staff/auth/{request-code,verify,logout}`, `GET
/api/staff/me`, `GET /api/staff/onboarding`, `POST
/api/staff/onboarding/steps`, `POST /api/staff/onboarding/complete`.

### Backfill (existing Staff)

Staff records created before Stage 7 receive their account idempotently:

```bash
bun run backfill:staff-accounts -- --dry-run   # inspect
bun run backfill:staff-accounts                # provision + queue emails
```

The script uses the SAME `provisionStaffAccount()` core as live activation;
reruns are no-ops (unique FK + exactly-once notification dedupeKey). The
production run is a deployment step.

## Daily Reporting & Accountability (Stage 8)

The one ongoing operational module of the Staff Platform: each Staff member
self-reports the day's activity — **one report per Staff member per
Africa/Lagos calendar date** — across the four categories taught by the
onboarding "accountability" step (Prospects / Member Growth / Savings
Activities / Community Activities; nine integer counts + an optional
plain-text summary).

### Rules (all server-enforced in `src/server/services/daily-reports.ts`)

- **Eligibility** — ACTIVE session + APPROVED_STAFF + onboarding COMPLETED.
  Anyone else gets `403 FORBIDDEN` (a new API error code, distinct from
  401, so an onboarding gate is never misrouted to the login screen).
- **Dates** — `reportDate` is the Africa/Lagos calendar date the work
  occurred (`src/lib/dates/lagos.ts` is the single fixed-offset +01:00
  conversion point — Lagos has no DST, so there is zero timezone
  dependency). `submittedAt` is the server instant of finalisation.
  Future dates are rejected; backdating is bounded by
  `DAILY_REPORT_BACKDATE_LIMIT_DAYS` (default 7). There is deliberately
  **no clock deadline** and no reminder notification.
- **Lifecycle** — `DRAFT → SUBMITTED`, one way. Creation is race-safe
  create-or-get (`@@unique([staffId, reportDate])`; the P2002 loser
  re-reads the winner), so two tabs can never produce two reports for a
  date. Submission is a conditional `updateMany` latch — exactly one
  `submittedAt` under concurrency; every repeat returns the same final
  state. Submitted reports are **permanently read-only** (`409` on edit);
  drafts are never deleted in the MVP (revise instead).
- **Validation** — counts are integers 0–999, **never silently clamped**;
  the summary is optional trimmed plain text ≤ 1000 chars; an all-zero
  report is valid. Every report row pins `version = "1.0"`
  (`DAILY_REPORT_META`) so later field evolution can't re-mean history.
- **Receipt** — submitting queues ONE `DAILY_REPORT_SUBMITTED` email
  inside the winning transaction (dedupeKey
  `DAILY_REPORT_SUBMITTED:<reportId>` — exactly once) and dispatches it
  only after commit; a Mailjet failure can never disturb the submission.
  The receipt contains the report date + received time + portal link —
  **no metrics digest**.
- **Boundary** — the data is STAFF SELF-REPORTED activity (the UI labels
  it "Reported…", never "verified"). It never touches payroll (no ₦650
  path exists anywhere) and stores **no person-level member/prospect
  records** — only aggregate daily counts.

### Routes

| Route | Purpose |
| --- | --- |
| `/staff/reports` | History (20/page, month filter) + today's state header |
| `/staff/reports/new` | Start action: create-or-get today's report, then redirect |
| `/staff/reports/[reportId]` | Draft = editor; submitted = read-only detail |

APIs: `GET/POST /api/staff/reports`, `GET/PATCH
/api/staff/reports/[id]`, `POST /api/staff/reports/[id]/submit`. Identity
is always the session chain — no staffId/reference/email is accepted from
the browser; foreign report ids answer the same `404` as unknown ones.

The portal home shows one **Daily Reporting** card with today's three
states (Not started → Start / Draft → Continue / Submitted → View, with
the Africa/Lagos submission time).

## Staff Training (Stage 9)

The Staff Platform's ongoing learning module: **FinFam Staff Foundations**
(`staff-foundations@1.0`) — six lessons that help activated and onboarded
Staff perform their role correctly, professionally, consistently and
safely. Course **content is source-controlled**
(`src/config/training/`); the database stores **progress only**. There is
no course CMS and no database-authored content.

### Rules (all server-enforced in `src/server/services/staff-training.ts`)

- **Content authority** — every statement derives from already-approved
  material (onboarding Section 7, FSOW orientation, the Responsibility &
  Reward Agreement's principles, the implemented Daily Reporting
  definitions). Lesson 5 imports `DAILY_REPORT_CATEGORIES` and the
  self-reported notice **by reference**, so Training can never drift from
  the real reporting form. No ₦650, no commission/payroll/bonus/earnings
  arithmetic, no prospect scripts, no escalation contacts, no quiz, no
  certificate — pinned by tests.
- **Eligibility** — ACTIVE session + APPROVED_STAFF + onboarding
  COMPLETED → else `403 FORBIDDEN` (the existing Stage 8 code, never a
  new error type). Daily Report history is deliberately NOT a
  requirement: Training and reporting are fully decoupled.
- **Non-blocking** — "Required Training" is an organisational label with
  the visible notice *"Training does not block your other Staff Portal
  tools in this release."* Nothing in Training ever gates Daily
  Reporting, Appointment, Resources, Profile or the portal home.
- **Enrollment** — LAZY and race-safe. The overview page/API is strictly
  read-only ("Not started" comes from the absence of progress); opening
  `/staff/training/[courseId]` create-or-gets the enrollment (the ONE
  approved GET side effect) with the P2002 → re-read-winner pattern, so
  concurrent first opens produce exactly ONE row. `courseVersion` is
  **pinned** at first open; a future 2.0 can only coexist as a separate
  enrollment — 1.0 completion is never silently rewritten, and no
  automatic retraining exists.
- **Progression** — sequential first completion, enforced server-side
  against the pinned content: Lesson 1 current, 2–6 locked; skip-ahead
  and unknown lessons are `422`. Progress rows are append-only (no
  "uncomplete"). Completing the final lesson latches `completedAt`
  **exactly once** (conditional `completedAt = null` → set); every
  concurrent/retry call converges on the same final state.
- **Review** — the course stays open after completion: every lesson
  remains readable and review performs **zero writes**. Completion
  changes NO employment state (no CandidateStatus, no Staff/Account
  change, no StageEvent) and queues **zero notifications** (§45 — no
  `TRAINING_*` email types exist).
- **Identity** — session-only (Session → StaffAccount → Staff). No
  staffId/email/reference/accountId/enrollmentId is accepted from the
  browser; unknown course ids (including recruitment references) are
  plain `404`s; there is no `/training/[reference]` route.
- **Boundaries** — Lesson 5 links to `/staff/reports` and Lesson 4 to
  `/staff/resources` where appropriate; Training never embeds or
  duplicates another module, hosts no assets, and teaches no
  report→earnings path (Stage 10 owns that domain).

### Routes

| Route | Purpose |
| --- | --- |
| `/staff/training` | Course overview (read-only; three states per §37) |
| `/staff/training/[courseId]` | Course/lesson reader; `?lesson=<id>` reviews completed lessons |

APIs: `GET /api/staff/training` (read-only overview), `GET
/api/staff/training/[courseId]` (course detail; lazily enrolls), `POST
/api/staff/training/[courseId]/lessons` (body `{ lessonId }` — exactly
one field; the server derives everything else). The portal nav gains
**Training** (after Daily Reports) and the portal home gains a
**Staff Training** card with the three approved states.

## Staff Resources & Identity Card (Stage 10)

Two derived, presentation-only capabilities — **ZERO Prisma changes, ZERO
APIs, ZERO notifications, ZERO nav items, ZERO new dependencies**. The
database stores nothing for this module.

### Staff Resources (`/staff/resources`)

- **Source-controlled registry** (`src/config/staff-resources.ts`) — the
  single source of truth for categories, entries and availability. No
  Resource tables; no admin CMS (Stage 11+ owns that decision).
- **Availability model** — `available` (a real file exists; **currently
  ZERO entries**), `in_portal` (real portal destination), `channel`
  (provided through the approved staff communication channel), `pending`
  (FinFam has not yet supplied it).
- **No fake downloads (hard rule)** — with zero file-backed entries the
  page can never render a download action; availability is honest text.
  Approved mapping: Reporting Instructions → `/staff/reports` ("Open
  Daily Reports"), Training Resources → `/staff/training` ("Open Staff
  Training"); Marketing Resources, Customer Education Materials and
  Approved Marketing Guidelines are honestly pending; the FinFam Staff
  Communication Group is a channel reference, never a fabricated link.
- **Secure-file contract (documented, NOT built)** — when the first real
  Staff-only file arrives it stays OUTSIDE `/public` and streams through
  an authenticated, registry-keyed route; until then no such route exists.
  The Onboarding "not downloadable" copy stays truthful and unchanged.
- **Home integration** — the portal-home Staff Resources card is derived
  from the registry (`getStaffResourcesHomeSummary()`); no fake counts.

### Staff Identity Card (`/staff/id-card`)

- **Fully derived** from Session → StaffAccount → Staff → Candidate — no
  `StaffIdentityCard` row, no serial, no expiry, no revocation state
  (suspension already nullifies sessions, so the card is inaccessible
  immediately). Query parameters (`?staffId=`) are never read; the page
  self-gates with `redirect("/staff/login")` so it never emits content
  without a verified session.
- **Fields** — full name, Staff ID (`FF-STF-NNNN`), appointment
  designation ("Remote Staff") and operational role ("FinFam Growth
  Ambassador") as separate facts, Activated date, card label, template
  version (`STAFF_ID_CARD_TEMPLATE_VERSION = "1.0"`, presentation-only).
  NO photo (the platform stores none), NO QR, NO signature, and never
  NIN/BVN/bank/address/next-of-kin/candidate/appointment reference,
  email, phone or account/session identifiers — pinned by tests.
- **Branding** — the established in-product treatment only (green brand
  tile + wordmark, Manrope, flat surfaces). `public/logo.svg` is
  unconfirmed and is not used on the card until FinFam supplies an
  official print-safe logo.
- **Print / Save as PDF** — reuses the appointment print architecture
  (`window.print()`, `print:hidden` chrome): the printed page contains
  THE ID CARD ONLY at true ID-card proportions (85.6mm × 54mm screen/print
  proportions; NOT a manufacturing specification). No PDF package, no
  canvas, no new dependency.
- **Entry points** — Profile ("Staff ID Card" section) and the portal-home
  Staff Identity card ("View Staff ID Card"). The top nav is deliberately
  unchanged (7 items).

Tests: `tests/staff-resources.test.ts` + `tests/staff-id-card.test.ts`
(registry pins, honest-availability rendering, no-fake-downloads, absent
APIs, session/suspension gating, card fields, sensitive-field exclusions,
query-manipulation immunity, cross-staff isolation, Home/Profile
integration, ZERO-database-write integrity).

## Environment variables

| Variable                    | Required | Purpose                                        |
| --------------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`              | yes      | PostgreSQL connection string for Prisma        |
| `NOTIFICATIONS_ENABLED`     | no       | Master switch for transactional email (default `false` — rows queue, nothing sends) |
| `MAILJET_API_KEY`           | for send | Mailjet transactional Send API key (server-only secret) |
| `MAILJET_SECRET_KEY`        | for send | Mailjet Send API secret (server-only secret)   |
| `MAILJET_FROM_EMAIL`        | for send | Mailjet-validated sender address               |
| `MAILJET_FROM_NAME`         | no       | Sender display name (default `FinFam Recruitment`) |
| `APP_BASE_URL`              | no       | Server-authoritative base URL for safe email links (default `http://127.0.0.1:3000`) |
| `MAILJET_API_URL`           | no       | Override the Send API endpoint (test seam)     |
| `NOTIFICATIONS_MAX_ATTEMPTS`| no       | Bounded retry budget (default `3`)             |
| `NOTIFICATIONS_SEND_TIMEOUT_MS` | no   | Per-send timeout (default `10000`)             |
| `STAFF_AUTH_DEV_CODE_ECHO`  | no       | **DEV/TEST ONLY** — echoes the OTP in the API response when `true`. **MUST be `false` in production.** Default `false` |
| `ONBOARDING_WHATSAPP_NUMBER`| no       | Official onboarding WhatsApp number (digits, international format). Empty = honest pending copy in onboarding |
| `STAFF_SESSION_TTL_DAYS`    | no       | Staff Portal session duration in days (default `7`) |
| `DAILY_REPORT_BACKDATE_LIMIT_DAYS` | no | How many past Africa/Lagos days a report may cover (default `7`; `0` = today only) |

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

**Stages 1–9 plus Stage 10 are complete.** All six recruitment stages
(Application → Orientation → Assessment → Agreement → Appointment →
Activation), the staff-side Onboarding state, the Mailjet transactional
notification service, **Stage 7 — Staff Portal Foundation, Onboarding &
Resumption** (secure accounts, email-OTP login, DB-backed sessions,
onboarding-first portal — see above), **Stage 8 — Daily Reporting &
Accountability** (one self-reported report per Staff member per
Africa/Lagos day, DRAFT → SUBMITTED, exactly-once receipt email — see
above), **Stage 9 — Staff Training** (FinFam Staff Foundations `1.0`, six
source-controlled lessons, lazy version-pinned enrollments, sequential
completion with an exactly-once course latch — see above) and **Stage
10 — Staff Resources & Identity Card** (source-controlled resource
registry with honest availability; fully derived, printable Staff ID
card — see above) are implemented and verified.

The Member Growth / Earnings and Performance / Targets modules were
**removed from the current project**: the portal has no authoritative
FinFam member/account database or API from which financial or performance
facts could be safely verified. They are not planned and must not be
restored by default.

The next planned module is **Stage 11 — Admin / Supervisor Operations**.
It must go through its own planning phase before implementation. **Do
not start building it (or any other module) automatically.**

Business decisions still outstanding (official onboarding WhatsApp number,
canonical role title portal-wide, identity-verification hardening,
approved resource files, official logo, staff photo policy, physical card
specification, training knowledge-check policy, future course-version
policy) are tracked in
[docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).
