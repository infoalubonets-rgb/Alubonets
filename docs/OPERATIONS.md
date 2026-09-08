# Alubonets - Operations

Setup, environments, deployment, backups, and monitoring.  
**Prepared by:** SpectreTech Limited

| Section | Contents |
|---------|----------|
| [1. Backend setup](#1-backend-setup) | Env, Supabase, seed, OAuth, RLS, Resend, M-Pesa, hosting |
| [2. Environments](#2-environments) | Local / testing / production strategy |
| [3. Deployment checklist](#3-deployment-checklist) | Pre/post deploy |
| [4. Backup and recovery](#4-backup-and-recovery) | DB, Auth, Storage, restore drill |
| [5. Monitoring and Sentry](#5-monitoring-and-sentry) | Health, Sentry, Resend testing |

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | [ACCEPTANCE.md](./ACCEPTANCE.md)

---

# 1. Backend setup
## 1. Prerequisites

1. Node.js 20+ and npm  
2. A [Supabase](https://supabase.com) project  
3. A [Resend](https://resend.com) account (optional until you send email)  
4. Optional: Safaricom Daraja sandbox (M-Pesa)

```bash
cd c:\PROJECTS\Alubonets
npm install
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3001 (not 3000).

---

## 2. Environment variables

Fill `.env.local` (never commit secrets):

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Project URL (no `/rest/v1/` suffix) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same (publishable / anon) | Browser + SSR |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same (optional legacy) | Fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (service_role) | Server admin only |
| `DATABASE_URL` | Database → pooler / Transaction | Prisma + PgBouncer |
| `DIRECT_URL` | Database → Session / direct | Migrations / `db:push` |
| `RESEND_API_KEY` | Resend dashboard | Email |
| `FROM_EMAIL` | Verified sender | From address |
| `NEXT_PUBLIC_APP_URL` | Your URL | e.g. `http://localhost:3001` |
| `MPESA_*` | Daraja portal | STK Push (when ready) |
| `SUPER_ADMIN_EMAIL` | Ops bootstrap | Real Super Admin email for `db:seed` / `db:bootstrap-auth` |
| `SUPER_ADMIN_PASSWORD` | Ops bootstrap | Auth password for that Super Admin only (never commit) |

Example shapes:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres"
```

Tips:

- Replace `[YOUR-PASSWORD]`; URL-encode special characters (`[`, `]`, `@`, etc.).
- Restart `npm run dev` after env changes.
- If a secret was ever committed: rotate it and keep `.env.local` gitignored.

---

## 3. Supabase project checklist

1. Create a project (region near members).  
2. Copy URL + publishable key + **service role** into `.env.local`.  
3. **Authentication → Providers:** enable Email; enable **Google** when ready (see §5).  
4. **Authentication → URL configuration:**  
   - Site URL: `http://localhost:3001`  
   - Redirects: `http://localhost:3001/**`, `http://localhost:3001/auth/callback` (+ production later)  
5. Optional: enable Email OTP for a future passwordless UI.

Client files already in the repo: `utils/supabase/client.ts`, `server.ts`, `middleware.ts`, `lib/supabase-server.ts`.

---

## 4. Database schema + seed

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:bootstrap-auth
npm run db:test
```

Seed / bootstrap Super Admin (real email only): **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## 5. Google OAuth (manual)

1. Supabase → Authentication → Providers → **Google** → Enable.  
2. Google Cloud Console → OAuth 2.0 Client (Web).  
3. Authorized redirect: `https://<project-ref>.supabase.co/auth/v1/callback`  
4. Paste Client ID / Secret into Supabase.  
5. Confirm Site URL + `http://localhost:3001/auth/callback` in Auth URL config.  

App flow: Auth modal → Google → `/auth/callback` (no Google button on `/admin/login`).

---

## 6. Row Level Security + Storage + Realtime

After `db:push`, in Supabase **SQL Editor**:

1. Run [`supabase/policies.sql`](../supabase/policies.sql)  
2. Run [`supabase/storage.sql`](../supabase/storage.sql)  

Supabase may warn about “destructive operations” because of `DROP POLICY IF EXISTS` — that only replaces policies, not your member data. Confirm **Run** if you intend to apply.

Realtime tables are added in `policies.sql` (`announcements`, `welfare_requests`, `contributions`). Confirm under Database → Publications if needed.

Never put the service role key in browser code.

---

## 7. Resend (email)

1. Create API key → `RESEND_API_KEY`.  
2. Verify domain (or use Resend test domain locally).  
3. Set `FROM_EMAIL`.  

Without a key, the app skips sending and continues.

---

## 8. M-Pesa Daraja (when ready)

1. Fill Daraja credentials in `.env.local` (`MPESA_*` — see `.env.local.example`).  
2. Deploy somewhere with public HTTPS (Vercel).  
3. Set the STK callback URL to your production `/api/mpesa/callback`.  
4. Test sandbox STK from the treasurer dashboard.  

Routes already exist: `app/api/mpesa/stk`, `app/api/mpesa/callback`.

---

## 9. Hosting (Vercel + Supabase)

1. Import repo to Vercel; set all env vars.  
2. `NEXT_PUBLIC_APP_URL` = production domain.  
3. Supabase Auth redirect URLs = production.  
4. Resend DNS for the sending domain.  
5. `npm run db:push` or migrate against production.  
6. Point M-Pesa callback at production when live.

Shared PHP hosting is not suitable for this stack.

---

## 10. Commands

```bash
npm install
npm run dev              # http://localhost:3001
npm run build
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run db:bootstrap-auth
npm run db:test
npm run db:studio
npm run lint
```

---

# 2. Environments
## Current state

- Local development runs at `http://localhost:3001`.
- Netlify is the current testing host.
- Vercel is the intended future production host.
- The currently connected Supabase project contains real production data.

Because Netlify testing currently touches production data, testing must avoid destructive fixtures, bulk deletion, password resets and schema experiments. The recommended next infrastructure step is a separate Supabase project for development/staging.

## Required separation

| Environment | Hosting | Database | Purpose |
|---|---|---|---|
| Local | Developer machine | Separate development Supabase project recommended | Feature development |
| Testing | Netlify | Separate staging Supabase project recommended | Committee acceptance |
| Production | Vercel | Current production Supabase project | Live member use |

Until separate Supabase projects exist, changes must be backward-compatible, additive and reviewed before being run.

## Environment variables

Use `.env.local` locally. It is Git-ignored. Configure equivalent values in Netlify deploy contexts and later in Vercel.

Never place `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, provider secrets or API secrets in browser code.

Run `npm run prebuild` to validate required configuration before deployment.

## Deployment flow

1. Create a feature branch.
2. Run `npm run check`.
3. Review generated Prisma migration SQL.
4. Test on a separate staging Supabase project when available.
5. Merge to `main`.
6. Run `npm run db:migrate:deploy` against the intended database.
7. Deploy the saved commit.
8. Verify `/api/health` and critical login/dashboard paths.
9. Record the deployed commit and migration in the release notes.

---

# 3. Deployment checklist
## Before deploy
- [ ] `npm run typecheck` and `npm test` pass
- [ ] `npx prisma migrate deploy` on target DB
- [ ] Env vars set (see `this document �2`): Database, Supabase, Resend, M-Pesa as needed, `CRON_SECRET`, `SENTRY_DSN`
- [ ] Feature flags reviewed (`loans_enabled` default off)
- [ ] Seed/bootstrap **not** run against production

## After deploy
- [ ] `GET /api/health` returns ok
- [ ] Admin login works
- [ ] Member login works
- [ ] Contribution / ledger smoke
- [ ] Document download smoke
- [ ] Cron endpoints protected (Bearer secret)

## Monitoring
- [ ] Sentry receiving events (see `this document �5`)
- [ ] External uptime check on `/api/health`

---

# 4. Backup and recovery
## Database

Alubonets relies on Supabase-managed PostgreSQL backups. Before live launch, an administrator must verify in the Supabase dashboard:

1. The production plan's backup frequency and retention.
2. Whether point-in-time recovery is enabled.
3. Who is authorized to initiate restoration.
4. How long a restoration normally takes.
5. How restoration affects Auth, database and API availability.

Record a quarterly restore test in a non-production Supabase project. A backup is not considered verified until restoration has been demonstrated.

## Supabase Auth

Auth identities are managed by Supabase. Application profiles remain in `public.users`. After a database restore, verify that `users.authUserId` values still correspond to Supabase Auth users.

## Storage

Database backups do not automatically prove that uploaded files in Supabase Storage can be recovered. Maintain a scheduled export or provider-supported backup for the `gallery` and `documents` buckets before relying on the platform for irreplaceable records.

## Recovery checklist

1. Stop application writes.
2. Record the incident time and last known good time.
3. Export current database/storage state where possible.
4. Restore into a temporary project first.
5. Validate member counts, financial totals, Auth links and file access.
6. Approve the recovery with the designated production owner.
7. Restore production.
8. Run `/api/health`, login, contribution, meeting and document checks.
9. Record the recovery in the audit/incident log.

## Restore drill record (fill after each non-prod exercise)

| Field | Value |
|-------|--------|
| Date | |
| Operator | |
| Source project / backup id | |
| Target scratch project | |
| Duration | |
| Member count check | Pass / Fail |
| Auth `authUserId` link check | Pass / Fail |
| Storage sample file check | Pass / Fail |
| Notes | |
| Sign-off | |


---

# 5. Monitoring and Sentry
## Available now

- Server errors can be written as structured JSON through `lib/logger.ts`.
- Netlify captures application `console` output in function/deploy logs.
- `/api/health` checks required environment configuration and database connectivity.

Configure an external uptime monitor to request `/api/health` every five minutes and alert when it does not return HTTP 200.

## Sentry

The official `@sentry/nextjs` SDK is configured for browser, Node.js and Edge
errors, App Router request errors, global React errors and performance tracing.
Health-check transactions are excluded. Default personal-data collection is
disabled.

The configured Sentry organization is `alubonets` and project is
`javascript-nextjs`.

Add these variables to Netlify now and Vercel when production moves there:

- `NEXT_PUBLIC_SENTRY_DSN`: the project DSN
- `SENTRY_DSN`: the same project DSN
- `NEXT_PUBLIC_APP_ENV`: `testing` on Netlify and `production` on Vercel
- `SENTRY_AUTH_TOKEN`: a secret organization token with source-map upload access

The application reports errors without `SENTRY_AUTH_TOKEN`. The token is needed
only during deployment to upload source maps, which make production stack traces
readable. Never commit it or expose it through a `NEXT_PUBLIC_` variable.

Configure Sentry alerts for:
   - Repeated login failures
   - Database connectivity failure
   - M-Pesa callback failure
   - Contact/notification email failure
   - HTTP 500 spikes

Do not send passwords, service keys, full database URLs, contribution details or private member data to Sentry.

## Resend testing limitation

Until an Alubonets domain is verified in Resend, keep
`FROM_EMAIL=Alubonets <onboarding@resend.dev>` and
`RESEND_TEST_EMAIL=infoalubonets@gmail.com`. The latter redirects outgoing test
messages to the verified account. After domain verification, replace `FROM_EMAIL`
with a sender on that domain and remove the test override.
