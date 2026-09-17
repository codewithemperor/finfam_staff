# FinFam Recruitment Portal

A focused recruitment portal that moves a candidate from application to
activation with minimal manual intervention.

**Implemented stages (all six, verified):** Application (scaffold), Stage 1 —
FinFam Staff Orientation Workshop (FSOW) (`/orientation`), Stage 2 —
Automated Interview Assessment (`/assessment`), Stage 3 — Responsibility &
Reward Agreement (`/agreement`), Stage 4 — Provisional Appointment
(`/appointment`), Stage 5 — Staff Activation (`/activation`), plus the
staff-side Stage 6 — Staff Onboarding (`/onboarding`). The recruitment +
onboarding MVP is complete, the platform has been through a full
production-readiness review, and the resulting hardening/remediation task
is complete — see [Production readiness](#production-readiness-post-stage-11).

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

# 2. Create the local database in your installed PostgreSQL
bun run db:create

# 3. Push the schema and generate the Prisma client
bun run db:push          # or: bun run db:migrate

# 4. Run the dev server on port 3000
bun run dev
```

### Local PostgreSQL

Use your locally installed PostgreSQL. The default `.env` points Prisma at
`postgresql://postgres@127.0.0.1:5432/finfam`; add your local password to
`DATABASE_URL`, `FINFAM_DB_PASSWORD`, or `PGPASSWORD` if Postgres requires
password authentication.

```bash
bun run db:create    # create finfam if it does not exist
bun run db:push      # push schema to the database
```

Connection string (from `.env`): `postgresql://postgres@127.0.0.1:5432/finfam`

> In production, point `DATABASE_URL` at a managed PostgreSQL instance.

### Scripts

| Script                | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `bun run dev`         | Next.js dev server on port 3000 (loads `.env`)      |
| `bun run lint`        | ESLint                                              |
| `bun run db:create`   | Create `finfam` in local PostgreSQL if missing      |
| `bun run db:push`     | Push schema to database (fast dev iteration)        |
| `bun run db:migrate`  | Create/apply Prisma migrations (canonical workflow) |
| `bun run db:reset`    | Reset the database                                  |

---

## Testing

The automated suite drives the REAL dev server over HTTP (`bun test` with
`--conditions react-server`; every suite is end-to-end — no HTTP mocking):

```bash
bun run dev        # terminal 1 (or the keep-alive watchdog)
bun run test       # terminal 2 — full suite (~2.5–3 min)
bun run lint       # ESLint (must be clean)
bunx tsc --noEmit  # TypeScript (must be clean; builds fail on errors too —
                   # the former typescript.ignoreBuildErrors override is gone)
```

Current baseline after the production-readiness remediation: **301 tests /
0 failures across 14 files**, ~1968 assertions, lint clean, typecheck clean,
13/13 fresh-database migrations, zero schema drift. Suites: recruitment
journey (`flow`, `outcomes`, `validation`), notifications, staff auth/accounts,
portal, daily reports, training, resources, ID card, admin auth, admin
operations, and `security-hardening` (CSRF/origin matrix, public-route rate
limits, journey payload leak protection, dev-OTP-echo-off, one-shot type
partition, and the Daily Report draft-vs-submit concurrency race).

---

## Project structure

```text
src/
  app/
    page.tsx, apply/, continue/, continue/recover/,   Recruitment portal
    application/[reference]/, status/                 (one continuous journey)
    orientation/, assessment/, agreement/,            Recruitment stages
    appointment/, activation/, onboarding/
    staff/login/, staff/(portal)/{onboarding,reports,training,resources,
      profile,appointment,id-card}                    Staff Portal (cookie-gated)
    admin/login/, admin/(dashboard)/{staff,reports,audit}   Admin console (separate identity)
    api/
      applications/                                  POST applications (+ rate limit)
      recruitment/recover-reference/                 POST reference recovery (+ rate limit)
      journey/, candidates/, orientation/, assessment/, agreement/,
      appointment/, activation/, onboarding/         Reference-gated reads/writes
      staff/auth/*, staff/{me,onboarding,reports,training}   Session-gated Staff APIs
      admin/auth/*, admin/staff/*, admin/reports/, admin/audit/   Admin APIs (guard + origin)
      health/                                        Liveness + masked config summary
  components/
    layout/            PageShell, SiteHeader(+SiteNavLinks), SkipLink, SiteFooter
    recruitment/       RecruitmentProgress, StatusBadge, forms
    orientation/ assessment/ agreement/ appointment/ activation/ onboarding/
    staff/ admin/      Portal + console shells, navs, forms, actions
    id-card/ reports/ training/
    ui/                shadcn/ui primitives + ButtonLink
  config/              Site, recruitment, orientation, assessment, agreement,
                       appointment, activation, onboarding, staff-portal,
                       staff-resources, staff-id-card, training, daily-report,
                       admin content (single source of truth)
  lib/
    db.ts errors.ts reference.ts log.ts rate-limit.ts utils.ts
    auth/{session,admin-session,hash}.ts
    api/{response,client}.ts
    validation/        Shared zod schemas (application, orientation, assessment,
                       agreement, activation, onboarding, staff-auth, admin,
                       daily-report, staff-training, recovery)
    dates/lagos.ts     Africa/Lagos calendar helpers
  server/
    config/production.ts   Fail-fast production config validation (server-only)
    services/          Business logic for every module (the only Prisma callers)
    notifications/     notification-types/-templates/-service, providers/mailjet
    assessment-content.ts   Server-only answer key + scoring policy
  instrumentation.ts   Startup hook: assertProductionConfig() (fail-fast)
  types/               Shared API + domain types
prisma/
  schema.prisma        26 models / 10 enums (candidates, staff platform, admin)
  migrations/          Additive-only migration history (13 migrations)
scripts/
  ensure-db.ts bootstrap-admin.ts backfill-staff-accounts.ts   Ops CLIs
tests/
  bun.test flow suites driving the REAL dev server over HTTP + helpers/
docs/
  DESIGN-SYSTEM.md CONTENT-QUESTIONS.md RUNBOOK-DEPLOYMENT.md
  RUNBOOK-OPERATIONS.md
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
- The eight steps (`intro → communication → verification → resources →
  orientation → assignment → accountability → ready`, content v2.1) are
  sequential and server-enforced:
  skip-ahead/unknown steps → 422 (naming the required step); re-completing
  a step is idempotent; completed steps may be re-read read-only
  (`?step=<id>`); future steps are never rendered.
- Completion is explicit and exactly once: all seven review steps + the
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
`STAFF_ACCOUNT_CREATED` (queued exactly once by Staff Account provisioning —
live activation and the idempotent backfill share the same core),
`ONBOARDING_STARTED` (once, at lazy entry), `ONBOARDING_COMPLETED`,
`DAILY_REPORT_SUBMITTED` (one receipt per submitted report), and the
one-shot OTP types `STAFF_LOGIN_CODE` / `ADMIN_LOGIN_CODE` (payload
memory-only, never stored, never re-derived — one attempt, no retry).
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

## Admin Operations (Stage 11)

A secure, structurally separate management console (`/admin`) for the
Staff Platform that already exists. **One effective privilege level
(ADMIN) — no Supervisor role, no RBAC, no scopes** (approved MVP). It is
NOT an HRIS/CRM/payroll/earnings/performance/members system and contains
no content management.

### Admin identity — structurally separate from Staff

```text
Staff:  StaffSession → StaffAccount → Staff → Candidate   (ff_staff_session)
Admin:  AdminSession → AdminAccount                        (ff_admin_session)
```

- **`AdminAccount` is NOT connected to Candidate or Staff** — even when
  the same person holds both identities they are separate domains, and
  neither session can ever satisfy the other domain's guard
  (`requireAdminSession()` vs `requireStaffSession()`; pinned by tests in
  both directions).
- **Provisioning is operational only** — `bun run bootstrap:admin --
  <email> [--dry-run]`. There is NO public registration, no invite flow,
  no password anywhere. The script creates an ACTIVE account, is
  idempotent for existing ACTIVE accounts, and **REFUSES to reactivate a
  suspended admin** (recovery is an explicit future break-glass policy,
  never a script side effect).
- **Sign-in is email OTP** (`/admin/login`) mirroring the proven Staff
  security properties: 6-digit CSPRNG code hashed at rest (sha256),
  10-minute expiry, single-use latch, 5-attempt budget, latest-code-only,
  60s resend cooldown, 5-codes/15-min window, neutral anti-enumeration
  responses. The OTP is delivered by the one-shot `ADMIN_LOGIN_CODE`
  notification — the recipient is the real AdminAccount email; **no
  Candidate row is created or borrowed** (`NotificationDelivery.candidateId`
  stays null).
- **Sessions** — DB rows (unique hashed token, hard expiry, `revokedAt`),
  absolute TTL of **12 hours** (`ADMIN_SESSION_TTL_HOURS`), no sliding
  renewal, logout revokes the row. Cookie: HttpOnly, SameSite=Lax,
  Path=/, Secure in production.
- **Dev OTP echo** — `ADMIN_AUTH_DEV_CODE_ECHO` (separate from the Staff
  switch; **MUST be `false` in production**).

### Console surfaces (all server-guarded; layout AND per-page self-gating)

| Route | Purpose |
| --- | --- |
| `/admin` | Overview: real active/suspended counts, recent audit actions, links — no KPIs, no analytics |
| `/admin/staff` | Staff directory: server-paginated (20/page), whitelisted search (`q` across Staff ID/name/email) + account-status filter |
| `/admin/staff/[id]` | Read-only detail: identity, appointment snapshot, onboarding, training, recent reports, account access. Opaque internal row id in URLs; `FF-STF-NNNN` is display/search only |
| `/admin/reports` | **SUBMITTED** daily reports only (drafts hidden, hard policy); month + staff filters; self-reported notice verbatim |
| `/admin/reports/[reportId]` | Read-only report detail (nine metrics + summary); drafts and unknown ids answer the same 404 |
| `/admin/audit` | Append-only privileged-action log, paginated, read-only |

Admin APIs: `POST /api/admin/auth/{request-code,verify,logout}`,
`GET /api/admin/staff`, `GET /api/admin/staff/[id]`,
`POST /api/admin/staff/[id]/suspend`,
`POST /api/admin/staff/[id]/reactivate`, `GET /api/admin/reports`,
`GET /api/admin/reports/[reportId]`, `GET /api/admin/audit` — all use the
shared envelope; every route calls `requireAdminSession()`; no generic
status PATCH exists.

### Suspension / reactivation (the only privileged writes)

- **Intent-specific endpoints** — the browser never sends a status value.
- **Hard atomicity**: one transaction = conditional ACTIVE → SUSPENDED
  StaffAccount transition + revocation of EVERY live StaffSession for
  that account (`revokedAt`) + append-only `AdminAuditEvent`. Global
  access denial was already behavioural (every auth path re-checks
  status); explicit revocation adds durable cutoff semantics.
- **Reason required** on suspension (trimmed plain text, 1–500 chars; no
  invented categories); optional note on reactivation.
- **Idempotent**: conditional updates mean double-clicks/retries cannot
  duplicate transitions or audit events; harmless no-ops return the
  current state and write nothing.
- **Scope guard**: suspension touches ONLY the account status, its live
  sessions and the audit log — never Staff rows, Staff IDs, Appointments,
  Onboarding, Training, Reports, Candidates or StageEvents. Suspension is
  access disabled, not a record deleted. Reactivation restores ONLY
  access (no resets, no new sessions resurrected).
- **Same-origin hardening** on both privileged writes (Origin/Referer
  validated against `APP_BASE_URL`/request host; fail closed). Existing
  Staff APIs are untouched.

### Audit log

`AdminAuditEvent` (append-only): actor AdminAccount (session-resolved,
never client-supplied; `onDelete: Restrict` — the log outlives
everything), action (`STAFF_SUSPENDED` / `STAFF_REACTIVATED`), target,
reason, conservative metadata (`staffId`, `previousStatus`,
`newStatus` — never whole-record dumps). No edit/delete/clear path or
retention job exists; retention period is an open business/legal
question.

### Deliberately absent from Stage 11

Supervisor role / RBAC · Admin resource CMS or uploads · Staff profile
editing (name/email/phone/Staff ID/designation/role) · report
corrections/approval/deletion · suspension/reactivation emails ·
termination/resignation states · onboarding/training overrides. Each is
tracked in [docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).

Tests: `tests/admin-auth.test.ts` + `tests/admin-operations.test.ts`
(bootstrap contract, OTP security matrix, cookie flags, cross-domain
isolation both ways, directory search/filters + secret-exclusion
assertions, submitted-only report visibility, full
suspend→lockout→reactivate→restore lifecycle over real HTTP, one-event
audit semantics, same-origin enforcement at the HTTP boundary).

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
| `ADMIN_SESSION_TTL_HOURS` | no      | Admin console session duration in hours (default `12`; absolute, no sliding renewal) |
| `ADMIN_AUTH_DEV_CODE_ECHO` | no      | **DEV/TEST ONLY** — echoes the ADMIN OTP in the API response when `true`. **MUST be `false` in production.** Default `false` |
| `ALLOW_INSECURE_APP_BASE_URL` | no | Production escape hatch for isolated test deployments without TLS: allows a missing/non-HTTPS `APP_BASE_URL` with a loud warning. Never set in real production |
| `APPLICATION_RATE_LIMIT_MAX` / `_WINDOW_MS` | no | Public applications endpoint limiter (default `5` / 10 min) |
| `RECOVERY_RATE_LIMIT_MAX` / `_WINDOW_MS` | no | Reference-recovery limiter (default `5` / 10 min) |
| `ONBOARDING_REFERENCE_RATE_LIMIT_MAX` / `_WINDOW_MS` | no | Legacy reference-onboarding write limiter (default `30` / 10 min) |
| `SUPPORT_CONTACT_EMAIL` | no | Real support inbox for the site footer. Unset = safe pending copy (the `.example` placeholder never ships) |

Copy `.env.example` → `.env` and adjust. Rules:

- **`.env` is git-ignored and local-only** (an earlier decision to track it
  was reversed during the production-readiness remediation). Production
  secrets are injected via the platform secret manager / environment — never
  committed. `.env.example` is the only tracked template.
- Production fail-fast (`src/instrumentation.ts` → `assertProductionConfig`):
  in production the app REFUSES TO START when dev OTP echo is on,
  `APP_BASE_URL` is missing/non-HTTPS, `DATABASE_URL` is missing, or
  notifications are enabled without Mailjet credentials.
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

## Production readiness (post-Stage 11)

**Stages 1–11 are complete, the full platform review is complete, and the
resulting production-readiness remediation is complete.** All six recruitment
stages (Application → Orientation → Assessment → Agreement → Appointment →
Activation), the staff-side Onboarding state, the Mailjet transactional
notification service, Stage 7 — Staff Portal, Stage 8 — Daily Reporting,
Stage 9 — Staff Training, Stage 10 — Staff Resources & Identity Card and
**Stage 11 — Admin Operations** are implemented and verified. There is
**NO Stage 12** — feature-roadmap expansion is paused; the next phase of this
project is production operations/deployment, not another feature stage.

What the remediation hardened (all verified by tests and/or live probes):

- **Production config fail-fast** — `src/server/config/production.ts` +
  `src/instrumentation.ts`: production refuses to start with dev OTP echo
  on, a missing/non-HTTPS `APP_BASE_URL`, a missing `DATABASE_URL`, or
  notifications enabled without Mailjet credentials. `/api/health` reports
  a masked config summary. Notification links fail safely instead of ever
  emitting `http://127.0.0.1:3000` in production.
- **`.env` is local-only again** — untracked and re-ignored; `.env.example`
  is the tracked template; production secrets live in the secret manager.
- **Daily Report immutability is race-proof** — draft saves are a single
  conditional write (`status = DRAFT` in the WHERE), proven by a six-round
  concurrent PATCH-vs-submit regression.
- **Canonical-origin CSRF checks** — admin suspend/reactivate validate
  Origin/Referer against the configured `APP_BASE_URL` in production (the
  forwarded request Host is no longer trusted); regression tests pin the
  full matrix including "a Staff cookie can never authorize an Admin
  mutation".
- **Public-route rate limiting** — DB-backed sliding-window limiters
  (mirroring the OTP limiter) on `POST /api/applications`,
  `POST /api/recruitment/recover-reference` and the legacy reference-onboarding
  writes; client IPs are only ever stored as sha256 hashes. Edge/WAF
  throttling remains an EXTERNAL deployment requirement (see the runbook).
- **Concurrency latches** — assessment submit and orientation completion
  use conditional writes so concurrent callers can never produce duplicate
  StageEvents; orientation section completion handles the unique-constraint
  race idempotently.
- **TypeScript is a real gate again** — the `ignoreBuildErrors` override is
  removed; `tsc --noEmit` and production builds are clean.
- **One-shot notification types are type-level** — `STAFF_LOGIN_CODE` /
  `ADMIN_LOGIN_CODE` are excluded from payload derivation at compile time;
  no plaintext OTP is ever persisted or re-derived.
- **Safe logging** — unexpected server errors log a structured line
  (correlation id, error class, sanitized one-line message); no raw Error
  objects, stacks, or bodies.
- **Bootstrap hardening** — the admin bootstrap reuses the console's email
  schema, keeps `--dry-run`, refuses suspended reactivation, and requires
  `--yes` outside development/test. CLI provisioning is documented in the
  operations runbook (the audit model honestly cannot represent a system
  actor).
- **Accessibility quick wins** — skip links on all three shells,
  `aria-current` on candidate navigation, 44px mobile touch targets for
  nav/sign-out, and `aria-live` login step/status announcements.
- **Honest support contact** — the footer renders a real address only when
  `SUPPORT_CONTACT_EMAIL` is configured; the `.example` placeholder can
  never ship to production users.

**Still EXTERNAL to the codebase (must be in place before real launch; see
[docs/RUNBOOK-DEPLOYMENT.md](docs/RUNBOOK-DEPLOYMENT.md)):** provisioned
production PostgreSQL with TLS + least-privilege role, real
backup/PITR + a performed restore test, a validated Mailjet sender with real
delivered Staff and Admin OTPs, edge/WAF request throttling, external
monitoring/observability, and named operational owners. Until those exist
the truthful verdict is **READY WITH EXTERNAL ACTIONS**.

The Member Growth / Earnings and Performance / Targets modules were
**removed from the current project**: the portal has no authoritative
FinFam member/account database or API from which financial or performance
facts could be safely verified. They are not planned and must not be
restored by default.

Business decisions still outstanding (official onboarding WhatsApp
number, canonical role title portal-wide, identity-verification
hardening, approved resource files, official logo, staff photo policy,
physical card specification, training knowledge-check policy, future
course-version policy, admin access list, Supervisor role/scoping,
draft-report visibility for management, report correction authority,
access-change email policy, audit retention, admin break-glass recovery,
the support inbox, Agreement v1.1 legal sign-off) are tracked — grouped
into LAUNCH BLOCKERS / OPERATIONAL DECISIONS / FUTURE ENHANCEMENTS — in
[docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).
