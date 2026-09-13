# FinFam Recruitment Portal

A focused recruitment portal that moves a candidate from application to
activation with minimal manual intervention. This repository currently
contains the **project scaffold**: architecture, design system, database and
API foundations, and the engineering conventions every future stage builds on.

The recruitment workflow itself (orientation, assessment, offers,
appointments, activation) is intentionally **not implemented yet** — it is
planned stage-by-stage in the next phase (see [Next phase](#next-phase)).

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
    loading.tsx                  Route-level loading convention
    error.tsx                    Route-level error convention
    not-found.tsx                404 convention
    api/
      applications/route.ts      POST — submit an application
      candidates/[reference]/    GET  — candidate status by reference number
      health/route.ts            GET  — liveness + database connectivity
  components/
    layout/                      PageShell, SiteHeader, SiteFooter,
                                 PageContainer, PageHeader
    recruitment/                 RecruitmentProgress, StatusBadge, StatusLookup
    forms/                       ApplyForm (form conventions exemplar)
    ui/                          ButtonLink (button-styled link)
    providers.tsx                Client providers (Toast.Provider)
  config/
    site.ts                      Site name, nav, support contact
    recruitment.ts               Stages, status definitions, status→stage mapping
    content.ts                   Landing-page content (placeholders flagged)
  lib/
    db.ts                        Server-only Prisma client
    errors.ts                    AppError + factories
    reference.ts                 Reference number generation/validation
    api/response.ts              Server response envelope helpers
    api/client.ts                Client fetch helper (ApiClientError)
    validation/application.ts    Shared zod schema (authoritative on server)
    utils.ts                     cn() class merge
  server/services/               Business logic (applications, candidates)
  types/                         Shared API + recruitment domain types
prisma/
  schema.prisma                  Candidate, Application, StageEvent (+ enums)
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
never imports `src/lib/db.ts` or anything under `src/server/`.

---

## Database schema (scaffold scope)

Deliberately lean — extended only as each stage is planned:

- **Candidate** — person + `referenceNumber` (public lookup key), `status`
  (`CandidateStatus` mirrors the draft state machine from the brief).
- **Application** — one submitted application for a role.
- **StageEvent** — append-only timeline of stage transitions (powers the
  status page; later, the admin audit trail).

Future models (Assessment, Offer, Appointment, Staff, Onboarding…) are noted
in `prisma/schema.prisma` and added during the planning phase, not before.

## API contract

Every route handler returns the same envelope:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "…human message…", "fields": { "email": "…" } } }
```

- Validation errors: `VALIDATION_ERROR` (422) with per-field messages.
- Unknown reference: `NOT_FOUND` (404) with actionable copy.
- Duplicate application email: `CONFLICT` (409) with field error.
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
  where interactivity is required (forms, lookup flow, toast).

## Next phase

**Do not start implementing the recruitment workflow automatically.** The
next phase plans each stage individually (orientation → assessment → offer →
appointment → activation → onboarding), defining user flow, pages, APIs,
validation, business rules, and states per stage.

Two business decisions are already blocking content implementation — see
[docs/CONTENT-QUESTIONS.md](docs/CONTENT-QUESTIONS.md).
