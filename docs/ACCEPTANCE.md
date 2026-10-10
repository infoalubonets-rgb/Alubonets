# Alubonets - Acceptance

Testing, sign-off, and role cheat-sheets.

| Section | Contents |
|---------|----------|
| [1. Testing report](#1-testing-report) | Vitest, Playwright, manual checks |
| [2. Sign-off checklist](#2-sign-off-checklist) | Final acceptance |
| [3. Role guides](#3-role-guides) | Admin, Treasurer, Secretary, Organizer, Executive |

Related: [OPERATIONS.md](./OPERATIONS.md) | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)


# 1. Testing report
## Automated coverage (Stage 9)

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest (`npm test`) | Supabase URL normalize, settings validation, loan outstanding math, nav/pagination helpers |
| CI | `.github/workflows/ci.yml` | typecheck, vitest, prisma validate |
| E2E | Playwright (`npm run test:e2e`) | Unauthenticated redirects; member contributions + welfare; admin approvals/settings (needs seeded Auth) |

## Running e2e locally

```bash
# App running on :3001 with seeded Auth users
set E2E_RUN=1
npm run test:e2e
```

Optional overrides: `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `PLAYWRIGHT_BASE_URL`.

CI e2e job runs only when repository variable `E2E_ENABLED=true` and secrets are set.

## Authorization matrix (smoke)

| Route | Unauthenticated | Expected |
|-------|-----------------|----------|
| `/admin` | yes | redirect login |
| `/dashboard/treasurer` | yes | redirect login |

Role boundaries are enforced via `requireActiveRole` / `requireAdmin` in server actions and pages.

## Manual acceptance (a11y / mobile)

- [ ] Keyboard: tab through login, member nav, welfare form submit
- [ ] Mobile width: member home, contributions, documents list
- [ ] Screen reader: pagination links have clear labels

## Restore drill

Record results in `OPERATIONS.md �4` restore template after a non-prod restore.

---

# 2. Sign-off checklist
Project: Alubonets SHG platform  
Date: __________  
Signed by: __________

## Functional
- [ ] Membership register / approve / suspend
- [ ] Contributions + ledger + reconciliation smoke
- [ ] Welfare request → review → pay
- [ ] Documents download (authorized)
- [ ] Meetings / minutes
- [ ] Events RSVP (if used)
- [ ] Announcements email (if Resend configured)
- [ ] Loans module off by default; on only if committee approved

## Quality
- [ ] CI green (typecheck + unit tests)
- [ ] Deployment checklist completed (`OPERATIONS.md` �3)
- [ ] Sentry / health monitoring configured or deferred with owner
- [ ] Backup restore drill recorded (or scheduled with date)

## Docs
- [ ] Role guides reviewed (this document �3)
- [ ] Testing report acknowledged (this document �1)

Sign-off: ______________________  Role: __________

---

# 3. Role guides

## 3.1 Admin
## Where to work
- Overview: `/admin`
- Members / approvals / roles: `/admin/accounts` (with Approvals link), `/admin/approvals`, `/admin/roles` (under Settings)
- Settings & feature flags: `/admin/settings`
- Announcements templates & delivery: `/admin/announcements`
- Loans approve queue (when enabled): `/admin/loans`
- Activity logs: `/admin/audit-logs`

## Daily tasks
1. Review pending memberships.
2. Check contact inbox and gallery queue.
3. Review finance approval threshold items if Treasurer escalated.
4. Toggle optional modules (e.g. loans) only when committee agrees.

## Do not
- Store secrets (API keys) in App Settings.
- Delete audit logs from the UI (retention purge only).

## 3.2 Treasurer
## Where to work
- Overview: `/dashboard/treasurer`
- Contributions: `/dashboard/treasurer/contributions`
- Financial ledger: `/dashboard/treasurer/ledger` — account balances, money in/out, approvals, filterable transaction history with reversals; Record contribution, Record expense and Payment purposes buttons
- Reconciliation: per-row Reconcile in Recent contributions on `/dashboard/treasurer/contributions`
- Welfare: `/dashboard/treasurer/welfare`
- Loans review (when enabled): `/dashboard/treasurer/loans`

## Daily tasks
1. Record contributions via the ledger (not legacy CSV).
2. Match M-Pesa events in reconciliation.
3. Review welfare requests; disburse approved ones with evidence.
4. For loans: review applicant contribution/welfare context, leave a note for Admin.

## Do not
- Bypass evidence requirements for disbursements.
- Approve loans (Admin / Super Admin decides).

## 3.3 Secretary
## Where to work
- Overview: `/dashboard/secretary`
- Meetings: `/dashboard/secretary/meetings`
- Documents (manage): `/documents/manage`
- Governance: `/governance/manage`
- Announcements: `/announcements`

## Daily tasks
1. Prepare meeting notices and minutes; lock when final.
2. Publish official documents to the repository.
3. Keep governance policies current.

## Do not
- Edit locked minutes without a controlled unlock/version flow.

## 3.4 Organizer
## Where to work
- Events: `/dashboard/organizer/events` (manage RSVP/attendance per event)
- Gallery: `/dashboard/organizer/gallery`
- Projects: `/dashboard/organizer/projects`
- Announcements: `/announcements`

## Daily tasks
1. Create events; set audience, capacity, reminders on the manage page.
2. Record attendance after events; publish reports when ready.
3. Moderate gallery uploads as needed.

## Do not
- Expose members-only events as public without changing audience.

## 3.5 Executive
## Where to work
- Overview: `/dashboard/executive`
- Projects: `/dashboard/executive/projects`
- Financial reports: `/financial-reports`
- Loans report (when enabled): `/dashboard/executive/loans` (read-only outstanding)
- Contact inbox (shared): `/dashboard/executive/contact-messages`

## Daily tasks
1. Monitor project progress and budgets.
2. Review high-level contribution trends and reports.
3. Read loan outstanding report when the module is on (no mandatory approval).

## Do not
- Treat Executive loan view as an approval step (Admin approves; Treasurer operates).
