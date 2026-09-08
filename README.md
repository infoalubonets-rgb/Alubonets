# Alubonets SHG

Public website and member platform for **Alubonets Self-Help Group**.

**Prepared by:** SpectreTech Limited  
**Aligned with:** Solution Design Document (v0) — July 2026  
**Stack:** Next.js 15 · TypeScript · Tailwind · Prisma · Supabase Auth  

**Dev URL:** [http://localhost:3001](http://localhost:3001)

| Doc | Purpose |
|-----|---------|
| **This README** | Product overview, how it works, **current platform status** |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Setup, environments, deploy, backups, monitoring |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, design system, decisions, security |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | **Website Upgrade Guide** plan — feature scores & phases |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Testing, sign-off, role guides |

---

## Quick start

```bash
npm install
copy .env.local.example .env.local   # fill secrets — see docs/OPERATIONS.md
npm run db:push
npm run db:seed
npm run db:bootstrap-auth
npm run dev
```

Full setup: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**.  
Super Admin (real email): **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#authentication-production)**.

---

## What is built (platform status)

Baseline from the Stage 0–9 member portal (July 2026). The next upgrade (Principal/family hierarchy, directory, Today’s Activities, payment purposes/account settings) is tracked in **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** (~55% vs Upgrade Guide; family hierarchy ~18%).

### Stack / wiring

| Layer | Status |
|-------|--------|
| Next.js 15 + Tailwind + TypeScript | Done — public site + role dashboards |
| Supabase Auth (`@supabase/ssr`) | Done — login, register, Google, middleware |
| Prisma → Supabase Postgres | Done — dashboards live |
| Roles: Admin, Executive, Treasurer, Secretary, Organizer, Member | Done |
| Register → Admin approve → portal | Done |
| Profile / own contributions / statements | Done |
| Ledger, reconciliation, M-Pesa STK path | Done |
| Documents + versions + governance meetings | Done |
| Events RSVP, announcements (email + dashboard) | Done |
| Projects, welfare, gallery approval | Done |
| Optional loans (`loans_enabled`) | Done |
| Audit logs | Done |
| Vitest + Playwright smoke + CI | Done |

### Acceptance (original brief)

| Criterion | Status |
|-----------|--------|
| Public pages + contact form | Met |
| No portal until Admin approve | Met |
| Admin approve + assign roles | Met |
| Member own contributions only | Met |
| Treasurer finance / reconcile / reports | Met (some reports thin) |
| Secretary Word/PDF minutes | Met |
| Organizer events | Met |
| Executive dashboards | Met |
| Audit trail | Met |
| Mobile usable | Met (formal a11y CI deferred) |
| Backup restore drill recorded | Partial |

### Not in baseline (Upgrade Guide gaps)

| Gap | Notes |
|-----|--------|
| Principal Member / family branch model | Core of next upgrade |
| Member directory + attached-profile visibility | Hidden-by-default privacy |
| Today’s Activities feed | Member-only |
| Official bank account setting + 20/80 fund rule | Configurable settings |
| Child/dependent records without login | Record-only members |
| Auditor role | Optional |

Full expected / implemented / remaining tables for the upgrade live in **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)**.

---

## Project map

```
app/
  (public)/          # Home, about, projects, gallery, contact
  admin/             # Admin overview + members, approvals, roles, gallery-queue
  dashboard/         # executive | treasurer | secretary | organizer | member
  profile/           # Shared profile page (all signed-in users)
  auth/callback/     # Google OAuth code exchange
  api/               # auth, pdf, mpesa, export, …
components/          # layout, auth, dashboard shell, profile
lib/                 # prisma, auth, email, data queries, mpesa
prisma/              # schema + seed
supabase/            # policies.sql, storage.sql
docs/                # OPERATIONS, ARCHITECTURE, IMPLEMENTATION, ACCEPTANCE (+ Formal/)
```

---

## How authentication works

```mermaid
flowchart LR
  Reg[Public Auth modal / Google] --> Pending[User PENDING]
  Pending --> Approve[Admin Approvals]
  Approve -->|approve| Active[ACTIVE + role]
  Approve -->|reject| Inactive[INACTIVE]
  Active --> Dash[Role home dashboard]
  Suspend[Admin suspend] --> Blocked[SUSPENDED — no login]
```

1. **Register** only on the public Auth modal (or Google). Creates Supabase Auth user + Prisma `users` row with `status = PENDING`, `role = MEMBER`.
2. **Admin** opens `/admin/approvals` → approve (`ACTIVE`) or reject (`INACTIVE`). Metadata syncs to JWT.
3. **Login** (`/login` or `/admin/login`) uses `signInWithPassword`. Staff admin login has **no** Google button and **no** register.
4. Middleware reads JWT `app_metadata`: `{ role, status, isSuperAdmin, dashboardAccess }` — no Prisma on the Edge.
5. **PENDING** → `/pending` (can still open `/profile`). **SUSPENDED** → signed out with: *“Your account has been temporarily suspended. Please contact the group administrator.”*
6. **Google:** Auth modal → Supabase OAuth → `/auth/callback` upserts Prisma user and redirects to `/pending` or role home.

### Roles and access

| Actor | Approve members | Set EXEC…MEMBER | Set ADMIN | Super Admin flag | Suspend Admins |
|-------|-----------------|-----------------|-----------|------------------|----------------|
| Super Admin | Yes | Yes | Yes | Yes (keep ≥1) | Yes |
| Admin | Yes | Yes | No | No | Non-admins only |
| Others | No | No | No | No | No |

- **Primary `role`** → home path (`ROLE_HOME`): `/admin`, `/dashboard/executive`, … `/dashboard/member`.
- **`dashboardAccess`** → optional extra workspaces; **Workspace** switcher in the dashboard header.
- **Super Admin** always sees every dashboard.
- Shared **profile:** `/profile` for every signed-in user (members and management).

---

## How contributions and payments work

### Manual / CSV (treasurer)

1. Treasurer records a contribution (member, amount, method, optional M-Pesa ref) or uploads CSV (`email, amount, …`).
2. Prisma creates a `contributions` row.
3. Optional Resend receipt email when configured.
4. Member or treasurer downloads **PDF receipt:** `/api/pdf/receipt/[contributionId]`.
5. Member **statement PDF:** `/api/pdf/statement/[userId]` (own history).

### M-Pesa STK Push

1. Treasurer (or allowed role) submits phone + amount via STK form → `POST /api/mpesa/stk`.
2. Daraja sends prompt to the phone; checkout request id is stored for matching (audit / meta).
3. Safaricom calls `POST /api/mpesa/callback` on success/failure.
4. On success the app creates/links a `Contribution` (amount, `mpesaRef`, method `MPESA`).
5. Receipt PDF uses the same contribution row as cash/bank payments.

Without Daraja env vars, STK stays inactive; the rest of finance still works.

---

## How PDFs and Word exports work

| Output | Route / entry | Built with |
|--------|---------------|------------|
| Contribution receipt | `/api/pdf/receipt/[id]` | pdf-lib — group header, member, amount, date, refs |
| Member statement | `/api/pdf/statement/[userId]` | pdf-lib — contribution list for that member |
| Meeting pack | `/api/export/meetings` | docx — title, date, attendance, agenda, minutes |
| Meeting minutes PDF | `/api/pdf/minutes/[id]` | pdf-lib — letterhead from DB text; publish stores copy in `documents` bucket |

Auth checks ensure members only get their own receipts/statements unless staff.

---

## How dashboards work

Each role has an overview plus section pages (nav in `lib/dashboard/nav.ts`):

| Area | Examples |
|------|----------|
| Admin | KPIs, members directory, approvals, roles & dashboard access, gallery queue, suspend/restore |
| Executive | Projects, announcements, contribution charts |
| Treasurer | Contributions, welfare reviews, CSV, M-Pesa STK |
| Secretary | Announcements, meetings, documents |
| Organizer | Events, gallery, projects |
| Member | Own contributions, welfare requests, live announcements |

Charts are server-aggregated (Prisma) and rendered with Chart.js. Announcements on the member home can update via Supabase Realtime when enabled.

---

## How email works

`lib/email/resend.ts` sends when `RESEND_API_KEY` + `FROM_EMAIL` are set. Typical triggers: membership approved, contribution/welfare notices. Sends are logged in `email_logs` when the app records them. Missing keys → no-op (no crash).

---

## How gallery and storage work

1. Organizer/member adds photo metadata (URL today; Storage bucket `gallery` for uploads when wired).
2. Unpublished photos sit in the admin **gallery queue** (`isPublic = false`).
3. Admin publishes → `isPublic = true` → public gallery.
4. Bucket `documents` is private (secretary/admin upload; members via signed URLs / app links).

SQL for buckets: `supabase/storage.sql`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server → **:3001** |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:generate` | Prisma client |
| `npm run db:push` | Sync schema to Supabase |
| `npm run db:migrate` | Versioned migrations |
| `npm run db:seed` | Seed Prisma data |
| `npm run db:bootstrap-auth` | Create/link Super Admin Supabase Auth user |
| `npm run db:test` | Connection smoke test |
| `npm run db:studio` | Prisma Studio |

---

## Decisions still with the group

1. Official domain / production host owner.  
2. Official Alubonets bank / paybill details (Admin finance setting).  
3. Attached-adult payment policy (own statement vs Principal-only).  
4. Dependent age for independent login.  
5. Whether 20% emergency / 80% reserve is automated.  
6. Auditor role and final office-bearer matrix.  
7. SMS/WhatsApp now or later.  

Open questions also listed in **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md#0-open-questions-confirm-before--during-coding)**.
