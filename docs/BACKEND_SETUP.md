# Alubonets Backend Setup Guide

**Project:** Alubonets Self-Help Group  
**Prepared by:** SpectreTech Limited  
**Aligned with:** Solution Design Document (v0) — July 2026  
**Dev app URL:** http://localhost:3001

This guide walks through setting up the full stack from the Solution Design Document (SDD), step by step. Use the status table first so you know what is already installed vs still to wire.

---

## 0. Current status (honest checklist)

| Layer / package | Installed in `package.json`? | Wired & used end-to-end? |
|-----------------|-----------------------------|---------------------------|
| Next.js 15 + Tailwind + TypeScript | Yes | Yes — public site + role dashboards |
| `@supabase/supabase-js` + `@supabase/ssr` | Yes | Yes — Auth login/register, middleware session, service role admin |
| Prisma + schema | Yes | Yes — live DB queries on all dashboards; seed + RLS SQL |
| Zod | Yes | Yes — auth + server actions |
| React Hook Form | Yes | Partial — forms use native + Zod server actions (RHF available) |
| Chart.js / `react-chartjs-2` | Yes | Yes — fed by Prisma aggregates |
| Resend | Yes | Yes — approval/receipt/welfare emails (skipped if key missing) |
| PapaParse | Yes | Yes — treasurer CSV import |
| pdf-lib | Yes | Yes — receipt + statement PDF routes |
| docx | Yes | Yes — meetings export |
| M-Pesa Daraja | Yes | Yes — STK + callback routes (needs Daraja env) |
| JWT (`jose`) test auth | Removed | Replaced by Supabase Auth + app_metadata roles |

**Goal of this doc:** finish connecting Supabase + Prisma + Resend + validation + charts + PDFs/Word + CSV + Daraja so the platform matches the SDD.

---

## 1. Prerequisites

1. Node.js 20+ and npm
2. A [Supabase](https://supabase.com) project
3. A [Resend](https://resend.com) account (for transactional email)
4. GitHub repo access
5. Optional later: Safaricom Daraja sandbox credentials

Clone and install:

```bash
cd c:\PROJECTS\Alubonets
npm install
```

Start the app (port **3001**):

```bash
npm run dev
```

Open http://localhost:3001

---

## 2. Environment variables

### 2.1 Create local secrets

Copy the example file (never commit real secrets):

```bash
copy .env.local.example .env.local
```

Also keep password / DB strings in `.env` or `.env.local` only. Both are gitignored (`.env`, `.env*.local`). Only `.env.local.example` may be committed — placeholders only.

### 2.2 Fill these values

| Variable | Where to get it | Purpose |
|----------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API (publishable / anon) | Browser + SSR client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as anon key (legacy name) | Optional fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service_role) | Server-only admin ops — **never** expose to the client |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (pooler / Transaction) | Prisma via PgBouncer |
| `DIRECT_URL` | Same → Session / direct connection | Prisma migrations |
| `JWT_SECRET` | Long random string | Current cookie JWT for role dashboards |
| `RESEND_API_KEY` | Resend dashboard | Transactional email |
| `FROM_EMAIL` | Verified domain sender | e.g. `noreply@yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Local or production URL | e.g. `http://localhost:3001` |
| `MPESA_*` | Daraja portal | Later — STK Push |

**Supabase connection tip:** replace `[YOUR-PASSWORD]` in both URLs with the database password from Supabase. URL-encode special characters.

Example shapes (placeholders):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres"
```

Restart `npm run dev` after any env change.

### 2.3 Security reminder

If a real password or key ever landed in `.env.local.example` or was pushed to GitHub:

1. Remove it from the example file (replace with placeholders).
2. **Rotate** that password / key in Supabase / Resend immediately.
3. Confirm `.env` and `.env.local` stay out of git (`git check-ignore -v .env.local`).

---

## 3. Supabase (database + Auth + RLS)

### 3.1 Already in the repo

| File | Role |
|------|------|
| `utils/supabase/client.ts` | Browser client (`createBrowserClient`) |
| `utils/supabase/server.ts` | Server Components / Route Handlers |
| `utils/supabase/middleware.ts` | Refreshes Auth session cookies |
| `middleware.ts` | Calls `updateSession` + JWT role guards |
| `lib/supabase.ts` | Simple non-SSR client |
| `lib/supabase-server.ts` | Service-role client for privileged server jobs |

### 3.2 Dashboard checklist

1. Create project (region close to members, e.g. Frankfurt / Cape Town if available).
2. Copy URL + publishable/anon key into `.env.local`.
3. Copy **service role** key into `.env.local` only.
4. Under **Authentication → Providers**, enable Email (and later OTP / phone if you add 2FA).
5. Under **Authentication → URL configuration**, set Site URL to `http://localhost:3001` (and production URL when ready).
6. Add redirect URLs: `http://localhost:3001/**`

### 3.3 Use the clients in code

**Server Component / Route Handler:**

```ts
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

const cookieStore = await cookies()
const supabase = createClient(cookieStore)
const { data, error } = await supabase.from('users').select('*').limit(10)
```

**Client Component:**

```ts
'use client'
import { createClient } from '@/utils/supabase/client'

const supabase = createClient()
```

### 3.4 Migrate auth off test JWT users (Phase 1 target)

Today login uses hardcoded test accounts + `jose` JWTs (`lib/auth/*`). Target flow from the SDD:

1. Visitor registers → row in `users` with `status = PENDING`.
2. Admin approves → `ACTIVE` + optional Resend email.
3. Login via **Supabase Auth** (`signInWithPassword` / OTP for 2FA).
4. App maps Supabase user → Prisma `User` (role, membership).
5. Middleware trusts verified Supabase session (and/or synced app JWT) instead of only test cookies.

Keep `/admin` and `/dashboard/*` protected until Auth is live.

### 3.5 Row Level Security (RLS)

After tables exist in Supabase:

1. Enable RLS on every member/finance table.
2. Policies (examples to implement):
   - Members: `SELECT` own contributions only (`auth.uid()` → user map).
   - Treasurer/Admin: read/write contributions.
   - Gallery public: `SELECT` approved photos only; inserts by admin roles.
3. Never use the service role key in the browser.

Test policies in the Supabase SQL editor before shipping.

---

Apply RLS after schema push:

1. Open Supabase → SQL Editor
2. Paste and run [`supabase/policies.sql`](../supabase/policies.sql)

Seed + Auth bootstrap:

```bash
npm run db:seed
npm run db:bootstrap-auth
```

Default seeded Auth password: `ChangeMe123!` (override with `SEED_AUTH_PASSWORD`).

---

## 4. Prisma (ORM → Supabase Postgres)

### 4.1 Already in the repo

- `prisma/schema.prisma` — User, Contribution, WelfareRequest, Project, GalleryPhoto, Announcement, Event, Document, AuditLog + roles
- `lib/prisma.ts` — Prisma client singleton
- Scripts: `npm run db:generate` | `db:push` | `db:migrate` | `db:studio` | `db:pull`

### 4.2 Connect and sync schema

1. Put `DATABASE_URL` and `DIRECT_URL` in `.env.local`.
2. Generate client:

```bash
npm run db:generate
```

3. Push schema to Supabase (good for early MVP):

```bash
npm run db:push
```

Or create a versioned migration:

```bash
npm run db:migrate
```

4. Inspect data:

```bash
npm run db:studio
```

### 4.3 Usage pattern

```ts
import { prisma } from '@/lib/prisma'

const members = await prisma.user.findMany({
  where: { status: 'ACTIVE' },
  orderBy: { createdAt: 'desc' },
})
```

Prefer Prisma in Server Actions / Route Handlers. Use Supabase client when you need Auth session + RLS; use Prisma for typed app queries and migrations.

### 4.4 Extend the schema next (SDD alignment)

Add as you implement phases:

- Contribution **categories**, payment method, receivedBy, statement refs
- Meeting minutes / agenda fields on `Document` or a `Meeting` model
- Gallery **approval** flag (`isPublic` / `approvedAt`)
- Notification / email log table
- Optional later: Loans (Phase 3)

After each schema change: `db:push` or `db:migrate`, then `db:generate`.

---

## 5. Zod + React Hook Form (validation)

### 5.1 Status

- Zod is used in `app/api/auth/login/route.ts`.
- React Hook Form is installed but not wired to forms yet.

### 5.2 Standard pattern

1. Define a schema in `lib/validators/` (e.g. `member.ts`, `contribution.ts`, `contact.ts`).
2. Infer the TypeScript type from Zod.
3. Wire RHF with `@hookform/resolvers/zod` (install if missing):

```bash
npm install @hookform/resolvers
```

```ts
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const contributionSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  paidAt: z.coerce.date(),
})

type ContributionInput = z.infer<typeof contributionSchema>

const form = useForm<ContributionInput>({
  resolver: zodResolver(contributionSchema),
})
```

4. Re-validate the same schema on the server (API / Server Action) — never trust the client alone.

### 5.3 Forms to cover (SDD)

- Registration (member, always role `MEMBER`)
- Login + 2FA OTP
- Contact Us
- Contribution entry (treasurer)
- Welfare request
- Announcement / event / project create
- CSV upload metadata

---

## 6. Resend (email notifications)

### 6.1 Setup

1. Create a Resend account and API key → `RESEND_API_KEY`.
2. Verify the group domain (DNS records Resend shows) **or** use Resend’s onboarding domain for local tests only.
3. Set `FROM_EMAIL` to a verified sender.

### 6.2 Add a mail helper

Create `lib/email/resend.ts` (when implementing):

```ts
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMail(opts: {
  to: string | string[]
  subject: string
  html: string
}) {
  return resend.emails.send({
    from: process.env.FROM_EMAIL!,
    ...opts,
  })
}
```

### 6.3 Emails required by SDD

| Trigger | Recipient |
|---------|-----------|
| Registration received | Admin |
| Account approved / rejected | Member |
| 2FA OTP code | Member |
| Contribution receipt | Member |
| Announcement / event | Targeted members |
| Meeting report published | Members (optional) |
| Contact form | Official group inbox |

Keep HTML templates in `lib/email/templates/`.

---

## 7. Chart.js on dashboards

### 7.1 Status

Already used via `components/dashboard/Charts.tsx` and `AdminExtras` on role dashboards.

### 7.2 How to extend

1. Prefer **server-fetched** aggregates (Prisma `groupBy` / raw SQL) → pass plain data into chart components.
2. Register only the Chart.js pieces you need (already done in `Charts.tsx`).
3. Suggested charts by role (SDD):

| Role | Charts |
|------|--------|
| Admin / Executive | Members by status, contributions over months, pending approvals |
| Treasurer | Collections vs target, payment methods, arrears |
| Secretary | Meetings / docs volume (optional) |
| Organizer | Events RSVP / attendance (when data exists) |
| Member | Own contribution history sparkline |

4. Keep charts out of the public marketing hero; dashboards only.

---

## 8. PDF receipts & Word exports (pdf-lib + docx)

### 8.1 Status

Packages installed; **no generators implemented yet**.

### 8.2 PDF contribution receipt (target API)

Suggested route: `app/api/receipts/[contributionId]/route.ts`

Outline:

1. Auth check (member owns contribution **or** treasurer/admin).
2. Load contribution + member via Prisma.
3. Build PDF with `pdf-lib` (group name, amount, date, M-Pesa ref, receipt no.).
4. Return `application/pdf` with `Content-Disposition: attachment`.

Sketch:

```ts
import { PDFDocument, StandardFonts } from 'pdf-lib'

const pdf = await PDFDocument.create()
const page = pdf.addPage([595, 842]) // A4
const font = await pdf.embedFont(StandardFonts.Helvetica)
page.drawText('Alubonets Self-Help Group — Contribution Receipt', {
  x: 50,
  y: 780,
  size: 14,
  font,
})
// ... amount, member name, date, reference
const bytes = await pdf.save()
return new Response(Buffer.from(bytes), {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="receipt.pdf"',
  },
})
```

Also email the PDF via Resend when a contribution is recorded.

### 8.3 Word meeting reports (docx)

Suggested helper: `lib/exports/meetingReport.ts`

1. Secretary drafts minutes in the UI.
2. API builds a `.docx` with title, date, attendance, agenda, resolutions.
3. Stream download; optionally store URL on `Document`.

### 8.4 Member statements

Treasurer / member: PDF (or CSV) of contribution history for a date range — reuse pdf-lib layout from receipts.

---

## 9. PapaParse (bulk CSV import)

### 9.1 Status

Installed; not wired.

### 9.2 Target flow (Phase 1 onboarding)

1. Admin uploads CSV on Admin dashboard.
2. Client or API parses with PapaParse.
3. Zod validates each row.
4. Prisma `createMany` / upsert members and optional historical contributions.
5. Return row-level errors for bad lines.
6. Write `AuditLog` entries.

Suggested columns:

```text
fullName,email,phone,membershipNumber,role,status,joinedAt
```

Contributions CSV:

```text
email,amount,paidAt,mpesaRef,description
```

Put parsing in `lib/import/csv.ts` and an API at `app/api/admin/import/route.ts` (admin-only).

---

## 10. M-Pesa Daraja STK Push (Phase 2)

Not started. When the group provides Paybill/Till:

1. Fill `MPESA_*` in `.env.local`.
2. Implement:
   - `lib/mpesa/daraja.ts` — OAuth token + STK Push
   - `app/api/mpesa/stk/route.ts` — initiate payment
   - `app/api/mpesa/callback/route.ts` — confirm → create `Contribution`
3. Callback URL must be **public HTTPS** (Vercel / Option A hosting).
4. Platform can stay “integration ready” until the group activates collections.

---

## 11. Role dashboards & middleware (security)

### 11.1 Routes

| Path | Role |
|------|------|
| `/admin` | ADMIN only |
| `/dashboard/executive` | EXECUTIVE (admin may view) |
| `/dashboard/treasurer` | TREASURER |
| `/dashboard/secretary` | SECRETARY |
| `/dashboard/organizer` | ORGANIZER |
| `/dashboard/member` | MEMBER |
| `/login` | Public |

### 11.2 Middleware

`middleware.ts` already:

1. Refreshes Supabase session cookies.
2. Requires app JWT for `/admin` and `/dashboard/*`.
3. Redirects wrong roles to their home.

When moving to Supabase Auth, update the same file to verify the Supabase user and load role from Prisma / claims.

---

## 12. Hosting (SDD Option A recommended)

| Option | Fit |
|--------|-----|
| **A — Vercel + Supabase** | Recommended — Next.js, HTTPS callbacks, Prisma + RLS |
| **B — Shared hosting** | Not suitable for this stack (Node limits, MySQL, unreliable callbacks) |

Deploy checklist:

1. Set all env vars in Vercel (never commit secrets).
2. `NEXT_PUBLIC_APP_URL` = production domain.
3. Supabase Auth redirect URLs = production.
4. Resend domain DNS.
5. Run Prisma migrate against production DB.
6. Confirm M-Pesa callback URL when ready.

---

## 13. Suggested implementation order

Follow SDD phases; within Phase 1 do this order:

1. **Env + Supabase project + Prisma `db:push`** (Sections 2–4)  
2. **Supabase Auth + registration approval** (replace test JWT users)  
3. **Zod + RHF on all forms**  
4. **Resend** — approval + receipts  
5. **Contributions CRUD** + Chart.js fed by real data  
6. **pdf-lib receipts** + member statements  
7. **PapaParse CSV import**  
8. **Secretary docx / PDF reports** + document repository  
9. **Welfare + announcements/events** polish  
10. **Daraja STK Push** (Phase 2)  
11. Security review, RLS audit, training, handover  

Phase 3 (out of current budget): loans, SMS/WhatsApp, PWA, multi-branch.

---

## 14. Quick command reference

```bash
npm install
npm run dev              # http://localhost:3001
npm run build
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run lint
```

---

## 15. Decisions still required from the group (SDD §11)

1. Hosting: Option A or B (recommend A).  
2. Official domain name.  
3. M-Pesa Paybill/Till details (or confirm registration).  
4. Commercial terms already in the Solution Design Document.

---

## 16. Related docs

- `docs/DESIGN.md` — UI / design system notes  
- `.env.local.example` — env template (placeholders only)  
- `prisma/schema.prisma` — current data model  

When a stack item in Section 0 flips from “Partial/No” to “Yes”, update that table so this file stays the single source of truth for backend readiness.
