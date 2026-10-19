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
| `CRON_SECRET` | Local + Vercel/GitHub | Bearer token for `/api/cron/*` (never commit) |
| `CRON_BASE_URL` | Optional | Override site URL for local cron commands (defaults to `http://localhost:3001`) |
| `SESSION_IDLE_MINUTES` | Auth | Idle session timeout in minutes (default `720` = 12 hours) |
| `BYPASS_LOGIN_VERIFICATION` | Local only | Must be unset/`false` in production (ignored when `NODE_ENV=production`) |
| `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS` | Local only | Login autofill; forced off in production builds |

### Cron (scheduled maintenance)

Routes (require `Authorization: Bearer $CRON_SECRET`):

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/stage4-maintenance` | Hourly | Expire documents, overdue actions, event reminders, scheduled announcements, email retries |
| `/api/cron/purge-audit` | Daily 03:15 UTC | Audit log retention + contact submission cleanup |

**Local (dev server must be running):**

```bash
npm run cron:maintenance
npm run cron:purge-audit
```

**Vercel:** production runs at `https://alubonets.vercel.app`. Set `NEXT_PUBLIC_APP_URL` to that origin and `CRON_SECRET` in Vercel Production environment variables, then redeploy. GitHub Actions is the single scheduler; no native Vercel cron is needed (Hobby native cron only supports daily runs).

**GitHub Actions:** `.github/workflows/cron.yml` calls the Vercel production domain hourly for maintenance and daily at 03:15 UTC for audit retention. Set repository secret `CRON_SECRET` to exactly the same value as Vercel. The URL defaults to `https://www.alubonets.com` (the bare `alubonets.vercel.app` is not this project and returns 404); optionally override it using repository variable `CRON_APP_URL` (not a secret). The old `CRON_APP_URL` secret is no longer used. Manual verification: Actions → Cron → Run workflow, once for each job. A successful run returns HTTP 200; HTTP 401 means the secrets differ, and HTTP 503 means Vercel is missing configuration.

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
npm run db:migrate:deploy   # apply versioned migrations (preferred over db:push)
npm run db:migrate:status   # check which migrations are applied
npm run db:seed
npm run db:bootstrap-auth
npm run db:test
```

Seed / bootstrap Super Admin (real email only): **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

**Migrations that also change data** (safe to re-run; they only insert or fill gaps):

| Migration | What it does |
|---|---|
| `20261010233000_notification_audience_roles` | Adds role audiences to notifications and tags existing loan/welfare/admin notices |
| `20261011090000_member_and_monthly_contribution_purposes` | Adds the Monthly Contribution purpose (billed monthly) |
| `20261011120000_contribution_plan_and_annual_purpose` | Adds Monthly/Annual contribution plans; the second purpose becomes **Annual Contribution** |
| `20261011160000_backfill_unledgered_contributions` | Gives any confirmed contribution without a ledger entry its entry |

**Ledger protection:** the database has triggers that block updates and deletes on posted ledger entries and on key fields of confirmed transactions. Do not remove them; the app corrects money with reversals and new entries.

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

### PayBill vs Buy Goods (till)

| Variable | PayBill | Buy Goods (till) |
|---|---|---|
| `MPESA_ENV` | `sandbox` while testing, `production` when live | same |
| `MPESA_TRANSACTION_TYPE` | `CustomerPayBillOnline` (default) | `CustomerBuyGoodsOnline` |
| `MPESA_SHORTCODE` | PayBill number | Store (head office) number from Safaricom |
| `MPESA_TILL_NUMBER` | not used | Till number that receives the money |
| `MPESA_PASSKEY` | Lipa Na M-Pesa Online passkey for the shortcode | same |
| `MPESA_CALLBACK_URL` | optional, defaults to `NEXT_PUBLIC_APP_URL/api/mpesa/callback` | same |

STK requests may include `categoryId`, `campaignId`, `projectId` and `contributionPeriod` (YYYY-MM). They are saved on the `MPESA_STK_INIT` audit row and applied to the contribution when the callback confirms payment. Without a purpose the payment lands in **Other income** for the Treasurer to reclassify.

STK stays Treasurer/Admin-only (`/api/mpesa/stk` and `actionInitiateStkPush` both enforce the role) until the till credentials arrive and the committee agrees to open it to members.

---

## 9. Hosting (Vercel + Supabase)

GitHub repo: `https://github.com/vouh/Alubonets`.

1. In [Vercel](https://vercel.com/new), import that GitHub repo (Framework Preset: Next.js, Root Directory: `.`).
2. **Before the first deploy**, add Environment Variables for Production and Preview. Vercel does not read `.env.local`. A new project with empty env will fail `prebuild` with `Missing required environment variables`.
3. Required names (copy from local `.env.local`, not the example placeholders):

   | Name | Notes |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://….supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | or `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `SUPABASE_SERVICE_ROLE_KEY` | server only |
   | `DATABASE_URL` | pooler / transaction mode |
   | `DIRECT_URL` | session / direct |
   | `NEXT_PUBLIC_APP_URL` | production origin, e.g. `https://alubonets.vercel.app` then the custom domain |

4. Also set `NEXT_PUBLIC_APP_ENV=production`, `CRON_SECRET`, and email/Sentry keys as needed. `APP_TIMEZONE` defaults to `Africa/Nairobi`; every finance date filter and report uses it.
   The functions run in the `dub1` (Dublin) region (`vercel.json`), close to the database in `eu-west-1`.
5. Do **not** set `BYPASS_LOGIN_VERIFICATION` or `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS` on Vercel.
6. Redeploy after saving env (Deployments → … → Redeploy). Env added after a failed build is not applied until you redeploy.
7. In Supabase Auth, add the Vercel URL to Redirect URLs and Site URL.
8. Run `npm run db:migrate:deploy` against production (already applied from this workspace if you used the same database).
9. Point M-Pesa callback at production when live.

Shared PHP hosting is not suitable for this stack.

---

## 10. Commands

```bash
npm install
npm run dev                 # http://localhost:3001
npm run build
npm test                    # unit tests
npm run test:e2e            # Playwright smoke tests
npm run db:generate
npm run db:migrate:deploy   # apply migrations
npm run db:migrate:status
npm run db:seed
npm run db:bootstrap-auth
npm run db:test
npm run db:studio
npm run db:purge-audit      # audit-log retention purge
npm run lint
```

**Gallery images** are processed on the server with `sharp` (bundled with Next.js): resized to 480/960/1600 px WebP, rotated upright and stripped of metadata. On Windows machines where application control blocks native modules, check that `sharp` loads before testing uploads.

---

# 2. Environments
## Current state

- Local development runs at `http://localhost:3001`.
- Vercel hosts production at `https://alubonets.vercel.app`.
- The currently connected Supabase project contains real production data.

Because local and deployment testing currently touch production data, testing must avoid destructive fixtures, bulk deletion, password resets and schema experiments. The recommended next infrastructure step is a separate Supabase project for development/staging.

## Required separation

| Environment | Hosting | Database | Purpose |
|---|---|---|---|
| Local | Developer machine | Separate development Supabase project recommended | Feature development |
| Testing | Vercel preview deployments | Separate staging Supabase project recommended | Committee acceptance |
| Production | Vercel | Current production Supabase project | Live member use |

Until separate Supabase projects exist, changes must be backward-compatible, additive and reviewed before being run.

## Environment variables

Use `.env.local` locally. It is Git-ignored. Configure production values in Vercel; use separate development/staging values for preview deployments.

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

### Production launch security checklist

- [ ] `NODE_ENV=production` on the host
- [ ] `BYPASS_LOGIN_VERIFICATION` unset or `false` (middleware and login API ignore it in production anyway)
- [ ] `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=false` (autofill is also disabled when `NODE_ENV=production`)
- [ ] Seed / demo passwords rotated or demo accounts disabled (`SEED_DEMO_ACCOUNTS=false`)
- [ ] `SESSION_IDLE_MINUTES` set to the approved idle policy
- [ ] Staging restore drill completed and recorded above
- [ ] Accessibility / responsive UAT signed on mobile, tablet and desktop

### Go-live checklist (new domain, email, M-Pesa)

- [ ] `NEXT_PUBLIC_APP_URL` set to the final custom domain (used in emails, callbacks and cron)
- [ ] Custom domain added in Vercel and in Supabase Auth → URL configuration (site URL + redirect URLs)
- [ ] Resend sending domain verified; `FROM_EMAIL` uses that domain (not `onboarding@resend.dev`)
- [ ] `RESEND_TEST_EMAIL` removed so emails reach real recipients instead of the test inbox
- [ ] Email verification turned back on: set `NEXT_PUBLIC_EMAIL_VERIFICATION=on` and redeploy (sign-in codes and application email codes are off until then; see `lib/auth/email-verification-switch.ts`)
- [ ] `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS` removed / `false` and test-account passwords rotated
- [ ] Admin → Settings → Contact & finance: enquiry forwarding email and "Also send to" recipients confirmed
- [ ] Admin → Finance: monthly fee, grace days, annual fee and renewal days confirmed with the Treasurer
- [ ] `prisma migrate deploy` run against production (includes the October 2026 migrations listed in section 1.4)
- [ ] Live fee amounts set and every member assigned a Monthly or Annual contribution plan
- [ ] M-Pesa: `MPESA_ENV=production`, live consumer key/secret, passkey, shortcode and (for a till) `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` + `MPESA_TILL_NUMBER`
- [ ] One live KES 1 STK test recorded, callback received and the contribution shows under the right purpose


---

# 5. Monitoring and Sentry
## Available now

- Server errors can be written as structured JSON through `lib/logger.ts`.
- Vercel captures application `console` output in function/deploy logs.
- `/api/health` checks required environment configuration and database connectivity.

Configure an external uptime monitor to request `/api/health` every five minutes and alert when it does not return HTTP 200.

## Sentry

The official `@sentry/nextjs` SDK is configured for browser, Node.js and Edge
errors, App Router request errors, global React errors and performance tracing.
Health-check transactions are excluded. Default personal-data collection is
disabled.

The configured Sentry organization is `alubonets` and project is
`javascript-nextjs`.

Add these variables to Vercel:

- `NEXT_PUBLIC_SENTRY_DSN`: the project DSN
- `SENTRY_DSN`: the same project DSN
- `NEXT_PUBLIC_APP_ENV`: `production` for production and `preview` for preview deployments
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

## Resend sending domain

The sending domain is `info.alubonets.com` (DNS at Spaceship). The default sender is
`Alubonets <support@info.alubonets.com>` (`DEFAULT_FROM_EMAIL` in `lib/constants.ts`),
and `FROM_EMAIL` overrides it. Emails go to their real recipients unless
`RESEND_TEST_EMAIL` is set or `FROM_EMAIL` uses `onboarding@resend.dev`. If either is
true, every email (including sign-in codes) goes to the test inbox instead.
Never set `RESEND_TEST_EMAIL` in Vercel Production.


### Password-reset delivery

Production password-reset emails always go to the account owner. They ignore
`RESEND_TEST_EMAIL` and replace the Resend onboarding sender with
`DEFAULT_FROM_EMAIL` if a test sender is left in `FROM_EMAIL`. The sending domain
`info.alubonets.com` must be verified in Resend. Development retains test inbox
redirection. Email-log failures are recorded separately and do not invalidate
a reset link already accepted by the provider.


### Contact enquiry forwarding

Configure the primary inbox under Admin > Settings > Enquiry forwarding
(`contact_destination_email`). The default is `infoalubonets@gmail.com`.
Each enquiry is saved in Communications and creates an Admin notification for
the assigned administrator. The primary inbox is emailed separately from
additional recipients, so copy failures cannot block or change its delivery
status. Production ignores `RESEND_TEST_EMAIL` for enquiry forwarding and uses
the real default sender if an onboarding sender remains configured. Provider
rejections are logged as `contact.email.rejected`; saved enquiries remain
available even if email delivery fails.
