# Alubonets Backend Setup Guide

**Project:** Alubonets Self-Help Group  
**Prepared by:** SpectreTech Limited  
**Aligned with:** Solution Design Document (v0) — July 2026  
**Dev app URL:** http://localhost:3001

This document is **setup only** — how to connect Supabase, Prisma, Resend, Daraja, and deploy.  
For how the product works, see the root [README](../README.md). For tables and relationships, see [DATA_MODEL.md](./DATA_MODEL.md).

---

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
| `SEED_AUTH_PASSWORD` | Optional | Override seed password for non-super roles |

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

Seed emails/passwords (dev only): **[DATA_MODEL.md — Seeded dev accounts](./DATA_MODEL.md#seeded-dev-accounts)**.

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

## Related docs

| Doc | Contents |
|-----|----------|
| [README.md](../README.md) | Product overview, how auth/payments/receipts work |
| [DATA_MODEL.md](./DATA_MODEL.md) | Tables, columns, ERD, **seeded dev accounts** |
| [DESIGN.md](./DESIGN.md) | UI / design tokens |
| `.env.local.example` | Env placeholders only |
| `prisma/schema.prisma` | Source of truth for the data model |
