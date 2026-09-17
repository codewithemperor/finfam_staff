# FinFam Production Deployment Runbook

> Owner: ________ · Version: 1.0 (production-readiness remediation, 2026-09)
>
> Status of this document: the APPLICATION side of every step below is
> implemented and verified in code/tests. Steps marked **EXTERNAL** require
> real infrastructure, credentials or business access that no code change can
> substitute. Do NOT mark this runbook "executed" until every step has
> genuinely been performed in the target production environment.

## 0. Preconditions

- [ ] Remediation code deployed from a clean checkout: `.env` is
      git-ignored and local-only; production secrets come from the platform
      secret manager (never a commit).
- [ ] `bunx tsc --noEmit` clean, `bun run lint` clean, full test suite green
      (recorded in the remediation report).
- [ ] 13/13 migrations are additive-only (no destructive operations in
      `prisma/migrations/`).

## 1. Infrastructure (EXTERNAL)

1. [ ] **Provision external production PostgreSQL** — the bundled
       local/embedded Postgres is development infrastructure. Record:
       provider, instance class, region.
2. [ ] **TLS** between the application and the database (verify the
       provider's `sslmode` requirements).
3. [ ] **Least-privilege DB role**: the app role owns the `finfam` schema
       but has NO superuser / NO createdb. Record the role name.
4. [ ] **Backup policy** (EXTERNAL — cannot be faked by code):
       provider-managed automated backups, PITR where supported, encrypted
       at rest, defined RPO/RTO, retention period, and a NAMED owner.
5. [ ] **Perform one real backup → restore test** into a scratch instance
       and verify `prisma migrate status` reports the restored database as
       up to date. Record date + result. (No backup/restore test = NOT
       launch-ready, regardless of code state.)
6. [ ] **Edge/WAF throttling** in front of the application: recommended
       baseline — applications 5/min per IP, recovery 5/min per IP, global
       per-IP request floor (~60/min) and burst protection. The application's
       DB-backed limiters (applications 5/10 min, recovery 5/10 min,
       reference-onboarding 30/10 min) are damping controls, not a DDoS
       defence. Configure the proxy to OVERWRITE (not append to) client
       `x-forwarded-for` so the app's rightmost-entry rule sees the trusted
       value.
7. [ ] **Monitoring** (EXTERNAL): uptime probe on `/api/health`, 5xx rate,
       DB connectivity, Mailjet failure alerts, `notification_deliveries`
       FAILED count, auth rate-limit anomaly alerts, process/container
       availability. No monitoring provider is wired inside FinFam by design.

## 2. Configuration

8. [ ] Set production environment via the secret manager:
       - `DATABASE_URL` — production PostgreSQL, TLS, least-privilege role.
       - `APP_BASE_URL` — the canonical **HTTPS** origin (e.g.
         `https://portal.finfam.example`). The app REFUSES TO START without
         it (or with a non-HTTPS value) — `ALLOW_INSECURE_APP_BASE_URL=true`
         exists ONLY for isolated test deployments and must be UNSET.
       - `STAFF_AUTH_DEV_CODE_ECHO=false` and
         `ADMIN_AUTH_DEV_CODE_ECHO=false` — startup fails if either is
         `true` in production.
       - `NOTIFICATIONS_ENABLED`, `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`,
         `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME`.
       - `ONBOARDING_WHATSAPP_NUMBER` (empty until the business supplies
         it), `SUPPORT_CONTACT_EMAIL` (empty until the business supplies
         it), session/report tunables as needed.
9. [ ] **Validate the Mailjet sender/domain** (EXTERNAL): confirm
       `MAILJET_FROM_EMAIL` is an authorized/validated sender in the
       production Mailjet account. Application code cannot do this.

## 3. Migrate + bootstrap

10. [ ] Apply schema with `prisma migrate deploy` (NEVER `db push`).
11. [ ] Verify with `prisma migrate status` → "Database schema is up to
        date". Record the applied migration count (13).
12. [ ] **Bootstrap the first Admin** (EXTERNAL business decision — who):
        `bun run bootstrap:admin -- <email> --yes`
        (`--yes` is required outside development/test; `--dry-run` first is
        recommended). The script is idempotent for ACTIVE accounts and
        REFUSES to reactivate suspended admins. Record who/when/which email
        in the operations log — CLI provisioning runs OUTSIDE an
        authenticated admin session and is therefore NOT written to the
        append-only audit log (the model has no honest system actor;
        remediation §23).

## 4. Start + smoke test

13. [ ] Start the production application (standalone build: `bun run build`
        then `bun run start`). Startup runs `assertProductionConfig()` — a
        misconfigured deployment fails loudly HERE, in the process log.
14. [ ] `GET /api/health` → `{"status":"ok","database":"connected","config":{…}}`.
        Verify the masked config summary: `production: true`,
        `devCodeEchoActive: false`, `appBaseUrlSecure: true`,
        `notificationsEnabled`/`mailjetConfigured` per plan.
15. [ ] **Enable notifications** (`NOTIFICATIONS_ENABLED=true`).
16. [ ] **Deliver a REAL Staff OTP** to a real, business-supplied inbox
        (EXTERNAL — proves sender validation + deliverability).
17. [ ] **Deliver a REAL Admin OTP** the same way.
18. [ ] **Staff smoke test**: apply → orientation section → (business fixture)
        → OTP login → portal home renders; one draft report save.
19. [ ] **Admin smoke test**: OTP login → directory → detail page.
20. [ ] **Suspend/reactivate smoke test** on a throwaway staff fixture:
        suspend (reason recorded) → staff session revoked → reactivate →
        both events visible in `/admin/audit` exactly once each.
21. [ ] Verify `/admin/audit` shows the smoke-test events newest-first with
        actor/reason/transition.

## 5. Handover

22. [ ] Confirm external monitoring receives the `/api/health` probe.
23. [ ] Record: deployment owner, date/time, application version/commit,
        migration count, and the backup/restore test reference.
24. [ ] Hand over RUNBOOK-OPERATIONS.md (daily operations, failure playbooks,
        rollback).

## Non-goals (deliberate)

- No Stage 12 exists. Feature-roadmap expansion is paused; the next action
  after deployment is production operations.
- No new modules (Member Tracking / Earnings / Performance / Supervisor
  RBAC / Resource CMS) — the portal has no authoritative data source for
  them and none is planned by default.
