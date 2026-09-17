# FinFam Operations Runbook

> Owner: ________ · Version: 1.0 (production-readiness remediation, 2026-09)
>
> Covers: daily operations, admin account lifecycle, notification/OTP
> failures, database recovery, rollback, and the operational contracts that
> are EXTERNAL to the codebase. Companion to RUNBOOK-DEPLOYMENT.md.

## 1. Daily operations checklist

- `/api/health` green (monitoring probe): `status: "ok"`,
  `database: "connected"`, and the masked `config` block sane
  (`devCodeEchoActive: false`, `appBaseUrlSecure: true` in production).
- Notification backlog: watch the `notification_deliveries` FAILED count.
  A rise means Mailjet failures — see §4.
- Auth anomalies: repeated 429s on `*/auth/request-code` are the OTP
  limiters working; sustained 429 storms on public mutations indicate
  abuse the edge/WAF should handle.
- Log hygiene: server errors emit ONE structured JSON line per failure
  (`level`, `id` (correlation), `scope`, `error`, `message`). Grep by the
  correlation id from an API error `reference` field. Lines never contain
  OTPs, tokens, hashes, credentials or request bodies — report any
  exception as a defect.

## 2. Admin account lifecycle

- **Provisioning** (no public registration exists):
  `bun run bootstrap:admin -- <email> --yes` outside development/test
  (`--dry-run` to inspect first). Idempotent for ACTIVE accounts; REFUSES
  suspended reactivation.
  **Audit limitation (remediation §23):** bootstrap runs outside an
  authenticated admin session and the audit model cannot honestly
  represent a system actor — ALWAYS record who/when/which email in this
  operations log. A future `ADMIN_CREATED` audit design may revisit this.
- **Suspension/reactivation**: use the Admin console ONLY — every action is
  a single transaction (status latch + session revocation + append-only
  audit event). There is no other supported path and no unaudited shortcut.
- **Break-glass / admin lockout**: NO policy is implemented by design. If
  every admin is lost or suspended, recovery is a BUSINESS DECISION
  requiring a documented, auditable procedure. Do not improvise direct DB
  edits; if ever approved, they must be performed with a recorded change
  ticket and a follow-up audit entry decision.
- **Admin sessions**: absolute 12h TTL (`ADMIN_SESSION_TTL_HOURS`), no
  sliding renewal; suspension revokes live sessions immediately.

## 3. Staff account operations

- **Suspension** (admin console): immediately blocks portal access, revokes
  all live staff sessions, records one audit event; historical data is
  untouched. Reactivation restores access only — it never re-runs
  activation, onboarding, training or resurrects revoked sessions.
- **Daily reports**: self-reported only; submitted reports are permanently
  immutable (draft saves are conditional writes — proven by the
  concurrency regression); there is deliberately NO payroll/earnings path
  anywhere (the ₦650 reward wording in the Agreement is business copy,
  never computed by the platform).
- **Backfill of legacy staff accounts** (if ever needed):
  `bun run backfill:staff-accounts -- --dry-run` then without the flag;
  idempotent, same core as live activation.

## 4. Mail / OTP failure playbook

Principles: business state is committed before any send; OTPs are one-shot
(no automatic retry by design — a lost code is dead and the user requests a
fresh one); a Mailjet outage must never be "fixed" by weakening
authentication (never enable dev echo in production; never disable the
attempt budget).

1. **Symptom**: login fails "code not arriving".
   - Check `/api/health` `config.mailjetConfigured` and
     `NOTIFICATIONS_ENABLED`.
   - Check FAILED delivery rows: `lastErrorCode`/`lastErrorMessage` hold
     safe provider codes (HTTP class / TIMEOUT / NETWORK_ERROR).
   - `401`/`403` from Mailjet → credentials/sender problem: verify
     `MAILJET_API_KEY`/`SECRET_KEY` in the secret manager and that
     `MAILJET_FROM_EMAIL` is still a VALIDATED sender (EXTERNAL check in
     the Mailjet account).
   - `429`/`5xx` from Mailjet → provider throttling/outage: wait; queued
     rows stay PENDING.
2. **Retry non-OTP transactional notifications** (NOT automatic — an
   operational action): the guarded batch exists as a service entry point:
   `retryPendingNotifications({ limit })` from
   `src/server/notifications/notification-service.ts`. There is
   deliberately NO cron inside the Next.js app; if the deployment has a
   scheduler, run a small script that imports and awaits it with
   delivery active. One-shot OTP types are EXCLUDED automatically.
3. **OTP specifically**: users request a NEW code (60s cooldown, 5/15 min
   window apply). Old codes are dead the moment a new one is requested.
4. **Recovery**: when Mailjet is healthy, re-run the batch retry; verify
   FAILED → SENT transitions; confirm a real inbox receives a test OTP.

## 5. Database recovery (EXTERNAL contract — the real control)

The application cannot substitute for a backup system. REQUIRED production
contract (all items EXTERNAL ACTION REQUIRED until genuinely in place):

- Provider-managed automated backups + PITR where supported.
- Encrypted at rest; defined retention; defined RPO/RTO.
- NAMED owner; restore procedure documented; **restore test performed**
  (deployment runbook step) and repeated periodically (recommend quarterly).

**Restore procedure** (when needed):

1. Restore the latest backup / PITR point into a NEW instance (never
   in-place).
2. Run `prisma migrate status` against the restored instance — migrations
   must report up to date (the schema is migration-managed; a restore that
   predates a migration must be migrated forward with
   `prisma migrate deploy`).
3. Point the application's `DATABASE_URL` at the restored instance;
   restart; verify `/api/health`.
4. Data written after the backup point is lost (that is the RPO): for
   recruitment records, the candidate journey can be replayed from the
   candidate's reference; staff self-reported drafts after the point are
   gone (reports are re-creatable within the 7-day window).

**Failed migration during deploy**: STOP. Never `db push`. Migrations are
additive-only; investigate and fix forward. Roll back the APPLICATION, not
the schema.

## 6. Rollback playbook

- **Application rollback**: redeploy the previous artifact. All schema
  migrations are additive, so an older app version stays compatible with a
  newer schema. Confirm the previous version's expected migration count
  with `prisma migrate status` before resuming traffic.
- **Database migration failure**: see §5 — stop, fix forward, never
  downgrade or `db push`.
- **Mailjet outage**: business state remains committed; follow §4.
- **Admin lockout**: follow §2 break-glass (a business decision; nothing
  is pre-implemented).
- **Security incident**: suspend the affected staff/admin via the console
  (immediate session revocation + audit); rotate Mailjet credentials in
  the secret manager; preserve logs (structured error lines carry
  correlation ids).

## 7. Environment contract (summary)

| Variable | Production requirement |
| --- | --- |
| `DATABASE_URL` | External managed PostgreSQL, TLS, least-privilege role |
| `APP_BASE_URL` | Canonical HTTPS origin; startup FAILS if missing/non-HTTPS (`ALLOW_INSECURE_APP_BASE_URL` only for isolated test deployments) |
| `STAFF_AUTH_DEV_CODE_ECHO` / `ADMIN_AUTH_DEV_CODE_ECHO` | MUST be `false` (startup FAILS if `true`) |
| `NOTIFICATIONS_ENABLED` + Mailjet triplet | Startup FAILS if enabled without credentials |
| `SUPPORT_CONTACT_EMAIL` | Set when the business supplies the inbox (else safe pending copy) |
| `ONBOARDING_WHATSAPP_NUMBER` | Set when the business supplies the number (else pending copy) |
| Rate-limit overrides | Leave at conservative defaults (5/10 min applications & recovery, 30/10 min reference-onboarding); edge throttles should be tighter |

## 8. Deliberate non-goals (do not "improve" without a business decision)

- No payroll/earnings computation from daily reports (self-reported only).
- No Member Tracking / Earnings / Performance / Supervisor RBAC / Resource
  CMS / new recruitment stages — no Stage 12 exists.
- No automatic OTP retry, no OTP plaintext storage, no generic
  notification cron inside the app.
- No audit deletion/editing path (append-only by design).
