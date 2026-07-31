# Alubonets Self-Help Group — Implementation Report

**Document purpose:** Single record of what the Developer Brief expects, what is already built, and what remains.  
**Sources:** Developer Brief v1.0; staged plan (`docs/Formal/implementation.txt`)  
**Audit date:** July 2026 (Stage 9 close-out)  
**Important:** “Implemented” means present in the **codebase**. Much of Stages 4–9 may still be **local / uncommitted** and not yet deployed to production.

---

## 1. Expected outcomes

What the committee and brief require for a successful delivery — public site, secure portal, role dashboards, finance, governance, and accountability.

### 1.1 Vision and strategic outcomes

| Vision theme | Expected outcome |
|--------------|------------------|
| Unity and identity | Public site and portal reinforce belonging, heritage, and participation |
| Governance and accountability | Clear roles, approvals, reporting, and controlled access |
| Digital transformation | Member DB, finances, documents, minutes, announcements, calendars digitized |
| Welfare and social fund | Transparent contributions, support, disbursements, balances, and rules |
| Economic empowerment | Projects, investments, savings visibility; optional loans |
| Education / capacity | Mentorship, bursary, training communication |
| Health / wellbeing | Announcements and activities for medical support and wellness |
| Conflict resolution / inclusivity | Structured participation across generations, gender, branches |
| Community relations | Public activities, gallery, partnerships, contact |

### 1.2 Project objectives (expected)

| # | Expected outcome |
|---|------------------|
| 1 | Public website: who Alubonets is, what it does, how to contact |
| 2 | Secure member portal: register → Admin approval before access |
| 3 | Members see **only** own contributions and personal portfolio |
| 4 | Admin / committee manage members, contributions, projects, meetings, announcements, reports |
| 5 | Treasurer: financial updates, reconcile, loans (if on), statements |
| 6 | Secretary: meeting reports online; export Word/PDF |
| 7 | Organizer: events and event communication |
| 8 | Executive: dashboards for membership, finances, contributions, projects, activities |
| 9 | Digital repository: constitution, minutes, policies, project docs, historical records |

### 1.3 Target roles (expected behaviour)

| Role | Expected outcome |
|------|------------------|
| Public visitor | Public pages only: home, about, exec profiles, gallery, activities, contact, selected updates |
| Member | Approved user: own profile/contributions/portfolio; announcements; events; projects; comments |
| Organizer | Create/publish events, invitations, reminders, event reports |
| Secretary | Notices, minutes/reports, uploads, Word/PDF export |
| Treasurer | Finance, reconcile, loans if enabled, statements, finance reports |
| Executive Committee | Monitor membership/finances/projects; governance as assigned |
| Admin | Full management: approvals, roles, content, master data, settings, audit |

### 1.4 Public website structure (expected pages)

| Page | Expected content / function |
|------|-----------------------------|
| Home | Welcome, mission/vision, key activities, announcements, register/login CTA, gallery highlights |
| About Us | History, identity, vision, values, objectives, branches, governance, motto |
| Executive Committee | Profiles, roles, bios, photos, term *(may live on About)* |
| What We Do | Welfare, social fund, education, empowerment, health, community *(may live on About)* |
| Projects | Public summary; detailed finance restricted |
| Events | Upcoming meetings/activities; some members-only |
| Gallery | Photos/videos with approval before publication |
| Contact Us | Form to official email; phone; location; social/WhatsApp if approved |
| Login / Register | Secure membership entry |

### 1.5 Member portal modules (expected)

| Module | Expected function |
|--------|-------------------|
| Profile & portfolio | Personal, family, skills, emergency contact, password |
| My Contributions | Own history, balances, receipts, pending, statement only |
| Announcements | Notices from Admin/Exec/Secretary/Organizer |
| Projects & investments | View updates; comment with moderation |
| Events | View, RSVP, venue/time, reminders |
| Meetings & reports | Approved minutes by access level |
| Document repository | Constitution, policies, minutes, reports, resources |
| Welfare requests | Optional: funeral, medical, wedding, etc. |

### 1.6 Admin and committee dashboards (expected)

| Dashboard | Expected capabilities |
|-----------|----------------------|
| Admin | Approve/reject/deactivate; assign roles; CMS; member export; categories; audit; settings/backups |
| Executive | Member summaries; finance summaries (by rights); projects/events; comments |
| Treasurer | Contributions; reconcile; expenses/investments/welfare; loans; statements; attachments |
| Secretary | Notices; minutes editor; documents; Word/PDF; share by role |
| Organizer | Events; posters; RSVP; reminders; post-event gallery submissions |

### 1.7 Functional requirements (expected)

| ID | Expected requirement |
|----|----------------------|
| FR-01 | Secure online registration |
| FR-02 | Registrations inactive until Admin approval |
| FR-03 | Only Admin assigns executive/special roles |
| FR-04 | Members manage own profile/portfolio |
| FR-05 | Members view own contribution history/balances only |
| FR-06 | Treasurer records, updates, reconciles, reports finance |
| FR-07 | Loans if module activated |
| FR-08 | Financial statements for Treasurer / authorized roles |
| FR-09 | Executive dashboards |
| FR-10 | Projects; members comment with ideas |
| FR-11 | Organizer events and reminders |
| FR-12 | Secretary meeting reports + Word/PDF |
| FR-13 | Document repository |
| FR-14 | Gallery management |
| FR-15 | Contact form → official email |
| FR-16 | Notifications (approvals, contributions, events, meetings, projects) |
| FR-17 | Audit trail for sensitive actions |

### 1.8 Permissions matrix (expected)

| Function | Public | Member | Organizer | Secretary | Treasurer | Executive | Admin |
|----------|--------|--------|-----------|-----------|-----------|-----------|-------|
| View public pages | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Register account | Yes | No | No | No | No | No | No |
| Approve member | No | No | No | No | No | Optional | Yes |
| Assign roles | No | No | No | No | No | No | Yes |
| View own contribution | No | Yes | Yes | Yes | Yes | Yes | Yes |
| View all contributions | No | No | No | No | Yes | Yes | Yes |
| Edit financial records | No | No | No | No | Yes | No | Yes |
| Reconcile payments | No | No | No | No | Yes | No | Yes |
| Approve loans | No | No | No | No | Yes | Optional | Yes |
| Create meeting reports | No | No | No | Yes | No | Optional | Yes |
| Export Word/PDF | No | No | No | Yes | Yes | Yes | Yes |
| Create events | No | No | Yes | Optional | No | Optional | Yes |
| Create projects | No | No | No | No | Optional | Yes | Yes |
| Comment on projects | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage gallery | No | No | Optional | Optional | No | Optional | Yes |

### 1.9 Acceptance criteria (expected for sign-off)

| # | Expected criterion |
|---|--------------------|
| 1 | Public visitor views approved pages and submits contact form |
| 2 | New member registers but cannot use portal before Admin approval |
| 3 | Admin can approve members and assign roles |
| 4 | Member updates profile; cannot view others’ contributions |
| 5 | Treasurer records contributions, reconciles, generates finance reports |
| 6 | Secretary creates meeting report and exports Word/PDF |
| 7 | Organizer publishes events and sends updates |
| 8 | Executive views dashboards per permissions |
| 9 | Sensitive actions captured in audit trail |
| 10 | Works on mobile, tablet, desktop |
| 11 | Admin can back up data or confirm automatic backups |

### 1.10 Suggested sitemap (expected areas)

| Area | Expected pages / sections |
|------|---------------------------|
| Public | Home; About; What We Do; Executive Committee; Projects; Events; Gallery; Contact; Register/Login |
| Member | Dashboard; Profile; Contributions; Projects; Events; Announcements; Meetings; Documents; Support |
| Admin | Dashboard; Pending; Members; Roles; Contributions; Projects; Events; Gallery; Documents; Reports; Settings; Audit |
| Treasurer | Finance dashboard; Contributions; Reconciliation; Expenses; Investments; Loans; Statements; Receipts; Reports |
| Secretary | Meetings; Agenda; Minutes; Reports; Attendance; Action points; Documents; Export |
| Organizer | Events; Calendar; RSVPs; Reminders; Posters; Event reports; Gallery submissions |

### 1.11 Phased delivery (expected scope)

| Phase | Expected scope |
|-------|----------------|
| Phase 1 — MVP | Public site, registration + approval, login, profiles, Admin users, basic contributions, announcements, events, projects, gallery |
| Phase 2 — Finance & governance | Treasurer, reconciliation, statements, Executive dashboards, Secretary reports, Word/PDF, document repository |
| Phase 3 — Advanced | Loans, M-Pesa/online payments, welfare workflows, SMS/WhatsApp, analytics, PWA, 2FA |

---

## 2. Implemented

Built in the current codebase (routes/models/actions as examples). Status vs expected is noted where partial.

| Area | Implemented function | Where (examples) | Vs expected |
|------|----------------------|------------------|-------------|
| **Public** | Home, About, Projects, Events, Gallery, Contact, Login/Register | `app/(public)/…` | Met; Exec + What We Do **on About** (separate routes not required) |
| **Public** | Contact form → email + Admin inbox | `ContactSubmission`, `/admin/contact-messages` | Met; destination email configurable |
| **Public** | Gallery with approval before publish | Gallery queue / Organizer gallery | Met |
| **Auth** | Register as MEMBER only; PENDING until Admin approves | Register, middleware → `/pending` | Met (FR-01, FR-02, FR-03) |
| **Auth** | Full registration: personal / family / portfolio / consent | `RegistrationForm`, `MemberProfile`, `ConsentRecord` | Met Appendix B; national ID optional/committee |
| **Auth** | Password reset & change; rate limits; login history; revoke sessions | Forgot/reset, `AccountSecurity`, `LoginEvent` | Met; email OTP only (not TOTP 2FA) |
| **Member** | Profile & portfolio update; avatar upload | `/profile` | Met (FR-04) |
| **Member** | Own contributions, balances, receipts, statement PDF | `/contributions`, PDF APIs | Met (FR-05) |
| **Member** | Announcements feed + email preference | `/announcements` | Met; mandatory notices always email |
| **Member** | Projects list; moderated comments | `/dashboard/member/projects` | Met (FR-10) |
| **Member** | Events list/calendar + RSVP | `/dashboard/member/events`, `/events/[id]` | Met (FR-11) |
| **Member** | Meetings / governance (access-controlled) | `/governance` | Met |
| **Member** | Document repository (authorized; signed download) | `/documents` | Met (FR-13) |
| **Member** | Welfare requests | `/dashboard/member/welfare` | Met (optional module present) |
| **Admin** | Approve/reject/suspend/reactivate; roles; dashboard access | Approvals, members, roles | Met |
| **Admin** | Membership numbers, notes, filters, pagination, CSV export | Admin members | Met Stage 1.4 core |
| **Admin** | Public content CMS (About groups, social, committee) | `/admin/content` | Met Stage 2.2 |
| **Admin** | Settings, feature flags, categories, password/audit policy | `/admin/settings` | Met Stage 8 |
| **Admin** | Announcement templates, targeting, schedule, email retry | `/admin/announcements` | Met Stage 6; no parallel Notification system |
| **Admin** | Audit logs + login events + CSV export | `/admin/audit-logs` | Met (FR-17); append-only + retention |
| **Admin** | Loans approve queue when `loans_enabled` | `/admin/loans` | Met simple FR-07 |
| **Executive** | Membership / finance / projects monitoring | `/dashboard/executive` | Met (FR-09) |
| **Executive** | Loans outstanding report (read-only, when on) | `/dashboard/executive/loans` | Met |
| **Treasurer** | Contributions, ledger, expenses, reconciliation, M-Pesa | Treasurer routes | Met (FR-06) |
| **Treasurer** | Welfare review + pay | `/dashboard/treasurer/welfare` | Met |
| **Treasurer** | Loans review, disburse, repay (when on) | `/dashboard/treasurer/loans` | Met simple |
| **Treasurer** | Financial reports (I&E, balances, arrears, filters) | `/financial-reports` | Met FR-08; some specialized reports thin |
| **Secretary** | Meeting notice → minutes; APs/decisions; Word/PDF | Meetings + export APIs | Met (FR-12) |
| **Secretary** | Document manage | `/documents/manage` | Met |
| **Organizer** | Events CRUD, RSVP, attendance, reminders, report, costs | Organizer events + manage `[id]` | Met |
| **Organizer** | Gallery submissions | Organizer gallery | Met (FR-14) |
| **Finance** | Ledger, reversals with reason, periods, PaymentEvent queue | Prisma Stage 3 + finance actions | Met Stage 3 core |
| **Finance** | M-Pesa STK / callback | M-Pesa routes | Met Phase 3 partial |
| **Docs/Gov** | Versions, categories, EXPIRED sync, download audit | Stage 4 + cron | Met |
| **Projects** | Budget/funding/spend, investments, milestones, updates, responsibles, docs, CSV | Stage 5 | Met |
| **Events/Comms** | Audience, capacity, RSVP, attendance, attachments, costs, reminders | Stage 6 | Met; email + dashboard only |
| **Loans** | Apply, guarantors, review, approve, ledger link, outstanding | Stage 7 | Met simple v1 |
| **Quality** | Vitest, Playwright smoke, CI, hot-list pagination | Stage 9 | Met pragmatic scope |
| **Deliverables** | Role guides, deployment/testing/sign-off, backup restore template | `docs/guides/`, checklists | Met docs pack |
| **Stack** | Next.js + Prisma/Postgres + Supabase Auth/Storage + Resend + Sentry | Repo | Met tech choice |

### 2.1 Acceptance criteria — current status

| Expected criterion | Status |
|--------------------|--------|
| Public pages + contact form | **Met** |
| Register but no portal until approval | **Met** |
| Admin approve + assign roles | **Met** |
| Member profile; no others’ contributions | **Met** |
| Treasurer record / reconcile / reports | **Met** (report pack partly thin) |
| Secretary Word/PDF | **Met** |
| Organizer events + updates | **Met** |
| Executive dashboards | **Met** |
| Audit trail | **Met** |
| Mobile / tablet / desktop | **Met** (responsive; formal a11y CI deferred) |
| Backup confirmable | **Partial** (docs + Supabase; restore drill not recorded) |

### 2.2 Functional requirements — current status

| ID | Status |
|----|--------|
| FR-01 … FR-06 | **Done** |
| FR-07 Loans | **Done** (simple; Admin approve + Treasurer ops) |
| FR-08 Statements | **Done** / **Partial** depth |
| FR-09 … FR-15 | **Done** |
| FR-16 Notifications | **Done** (email + dashboard; no SMS/WhatsApp) |
| FR-17 Audit | **Done** |

### 2.3 Rough completion

| Slice | Estimate |
|-------|----------|
| Brief Phases 1–2 (MVP + finance/governance) | **~85–90%** |
| Brief Phase 3 advanced | **~30–40%** (loans lite + M-Pesa; no SMS/PWA/full 2FA) |
| Overall (weighted to MVP) | **~80–85% implemented**; **~15–20% remaining / deferred** |

---

## 3. Remaining implementation

Not done, partial, deferred, or process/ops only. Do not treat older “Missing…” prose in `Formal/implementation.txt` Stages 1–3 as current without checking this section.

### 3.1 Remaining / unimplemented table

| Area | Remaining item | Priority | Notes |
|------|----------------|----------|-------|
| **Ops** | Commit, migrate, deploy Stages 4–9 | **High** | Large local/uncommitted tree |
| **Ops** | Run `prisma migrate deploy` on staging/prod | **High** | DB must match schema |
| **Ops** | Backup **restore drill** recorded | **High** | Template in `BACKUP_AND_RECOVERY.md`; fill after drill |
| **Ops** | Staging/prod isolation; close committee decisions | **High** | Domain, host owner, contact email, etc. |
| **Ops** | Committee sign-off (`SIGN_OFF.md`) | **High** | Deliverable |
| **Privacy** | Gallery **publication consent** | Medium | Brief §16 / Stage 2.3 |
| **Security** | TOTP / authenticator **2FA** for Admin/Treasurer/Secretary | Medium | Email OTP only today |
| **Security** | Seed/test accounts forced off in production builds | Medium | Flag exists; example env may default on |
| **Admin** | Member **bulk** approve/status operations | Low–Med | Single-row actions exist |
| **Admin** | National ID/passport as required field | Committee | Only if mandated |
| **Finance** | Dedicated daily collection / monthly rollup report views | Medium | Date-range I&E exists |
| **Finance** | Dedicated welfare-disbursement report section | Medium | Ops UI exists |
| **Finance** | Wire `Expense.projectId` on record-expense form | Medium | Column exists; UI incomplete |
| **Finance** | Always create contribution as PENDING first | Low | Often CONFIRMED immediately |
| **Finance** | Legacy CSV contribution import | Deferred | Ledger path preferred |
| **Loans** | Interest, installment products, penalties, defaults, Exec mandatory approve | Deferred | Simple module only |
| **Notify** | SMS / WhatsApp channels | Deferred | Email + dashboard by decision |
| **Notify** | Separate Notification entity family | Deferred | Announcement stack used instead |
| **UX** | Separate `/executive-committee` and `/what-we-do` routes | **Not required** | Content on About by design |
| **Phase 3** | PWA / native mobile app | Deferred | |
| **Phase 3** | Full analytics / BI suite | Deferred | Charts exist; not full BI |
| **A11y** | Automated a11y CI (axe) | Deferred | Manual checklist only |
| **Process** | Design mockups before coding; live training session | Process | Outside repo code |
| **Docs** | Member-specific role guide | Low | Other role guides exist |
| **Pagination** | Document **manage** list pagination | Low | Member docs list already paginated |

### 3.2 Must-do before calling the project “shipped”

| # | Item | Why |
|---|------|-----|
| 1 | Commit & push Stages 4–9 | Code largely local-only |
| 2 | Migrate staging/prod | Schema alignment |
| 3 | Complete restore drill record | Acceptance §21 |
| 4 | Production env hardening (no test accounts; Sentry; contact; domain) | Stage 0 |
| 5 | Sign-off | Formal acceptance |

### 3.3 Explicitly deferred (do not block MVP unless committee insists)

| Item | Reason |
|------|--------|
| SMS / WhatsApp | Confirmed email + dashboard only |
| Parallel Notification tables | Announcement stack |
| Advanced loans | Simple loans v1 |
| PWA / native app | Phase 3 |
| Full a11y CI / load tests / full RLS matrix | Stage 9 pragmatic scope |
| Separate Executive / What We Do routes | About page by design |

### 3.4 Open committee questions (Brief §22)

| Question | Status |
|----------|--------|
| Official domain name | Open |
| Official contact email | Setting exists; value TBD |
| ID / phone / email verification at register | Open |
| Launch contribution categories | Configurable; launch set TBD |
| Manual vs M-Pesa in phase one | Both paths exist; policy TBD |
| Loan constitution rules beyond Admin settings | Open |
| Which finance reports Exec vs Treasurer-only | Partially configurable; policy TBD |
| Notification channels | **Decided:** email + dashboard |
| Gallery consent before publication | **Remaining** to implement |
| Who hosts/maintains/pays after launch | Open |
| Multiple family branches / sub-groups at launch | Branch field exists; depth TBD |

### 3.5 Suggested next implementation order

1. Ship git + migrations + restore drill  
2. Gallery consent + production seed-account lock  
3. Expense ↔ project link + Treasurer report gaps  
4. TOTP 2FA  
5. Optional Phase 3 (SMS, advanced loans, PWA) — only if committee funds/approves  

---

## 4. Document control

| Field | Value |
|-------|-------|
| Title | Alubonets Implementation Report (expected / implemented / remaining) |
| Version | 1.0 |
| Based on | Developer Brief v1.0 + staged implementation plan |
| Replaces | Split `IMPLEMENTATION_STATUS.md` + `IMPLEMENTATION_REMAINING.md` companions |
| Next update | After ship of Stages 4–9 or next product gap close-out |
