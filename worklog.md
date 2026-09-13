---
Task ID: 1
Agent: Z.ai Code (main orchestrator)
Task: FinFam Recruitment Portal MVP — project scaffold, architecture & design system

Work Log:
- Read HeroUI v3 official docs via heroui.com agent API (quick-start, frameworks, colors, theming, 18 component pages). HeroUI v3 = React Aria + Tailwind v4, no provider needed, BEM CSS from @heroui/styles.
- Installed real PostgreSQL 17 locally without root: @embedded-postgres/linux-x64 binaries + vendored ICU 60 libs (db/pg-libs); scripts/postgres.sh initdb/start/stop; DB `finfam` on 127.0.0.1:5432 (localhost only).
- Sandbox exports a global DATABASE_URL=file:... that overrides .env, so all db/dev scripts run through .env-forcing wrappers (scripts/prisma.sh, scripts/dev.sh; package.json scripts updated).
- Prisma switched to provider postgresql; schema: Candidate/Application/StageEvent + enums CandidateStatus (12 states), RecruitmentStage (6), StageEventType, ApplicationStatus. Created migration history via `prisma migrate dev --name init` (prisma/migrations/20260913201513_init).
- Installed @heroui/react@3.2.5 + @heroui/styles@3.2.5; globals.css = tailwindcss → @heroui/styles → FinFam tokens (--accent #0c7a43 single source of green; semantic tokens mapped into Tailwind utilities; Manrope via next/font 400/500/600/700).
- Built foundation: types (api, recruitment), config (site, recruitment stages/statuses with status→stage mapping, content placeholders flagged), lib (db, errors/AppError, reference FF-XXXXXX unambiguous alphabet, api response envelope + client ApiClientError, shared zod application schema).
- Server layer: services/applications (server decides roleTitle; P2002→409 conflict with field error), services/candidates (status view, PII excluded); API routes POST /api/applications, GET /api/candidates/[reference], GET /api/health; consistent {ok,data|error} envelope; internal errors logged server-side only.
- Components: PageShell/SiteHeader/SiteFooter/PageContainer/PageHeader; RecruitmentProgress stepper (aria-current, sr-only states); StatusBadge (Chip soft); StatusLookup (loading skeleton/not-found/error states); ApplyForm (form conventions exemplar: noValidate form, visible labels + *, zod client+server, isPending button, toast on success, inline reference confirmation with copy); ButtonLink (uses @heroui/styles buttonVariants so buttons/links can't drift; HeroUI Button render-prop is function-only, element form rejected).
- Pages: landing / (intro, role, rewards-pending alert per §38, 6-stage process, one-next-action CTAs), /apply, /status (+?ref auto-lookup), loading.tsx, error.tsx, not-found.tsx.
- Verification (agent-browser): landing/apply/status at 375/768/1024/1440; empty-submit validation errors; successful submission → FF-ATEH9J etc.; duplicate email → server field error inline; invalid/unknown reference → not-found panel; API contract via curl (422/409/404/400/200); toast region renders; focus outline 2px on keyboard nav; footer sticks to viewport bottom on short pages and pushes naturally on long pages. Fixed during verification: Button render-prop crash ("render is not a function") → ButtonLink; react-hooks/set-state-in-effect lint error → promise-chain effect with cancellation; noisy handled-P2002 prisma:error logs → prisma log config off (route layer logs unexpected errors).
- Docs: README.md (run instructions, architecture, API contract, env vars, conventions), docs/DESIGN-SYSTEM.md (tokens, component usage rules, anti-slop checklist), docs/CONTENT-QUESTIONS.md (§38 flag: Established Member threshold conflict + pending reward figures).

Stage Summary:
- Working scaffold at / : HeroUI v3 + Tailwind v4 + Manrope + FinFam green token system; PostgreSQL 17 + Prisma with real migration history; clean UI→API→service→Prisma layering; shared zod validation; consistent API envelope; conventions demonstrated end-to-end (forms, feedback, states, stepper).
- Verified in browser at 4 breakpoints; lint clean; dev server healthy.
- Key decisions: HeroUI v3 (not v2) per latest docs; postgres via embedded binaries (documented swap to managed URL); ButtonLink pattern for CTA navigation; rewards deliberately not published pending business confirmation (docs/CONTENT-QUESTIONS.md).
- NEXT PHASE (do not start automatically): RECRUITMENT PORTAL PRODUCT PLANNING — plan each stage (orientation → assessment → offer → appointment → activation → onboarding) individually.
