# Alubonets - Acceptance

Testing, sign-off, and role cheat-sheets.

| Section | Contents |
|---------|----------|
| [1. Testing report](#1-testing-report) | Vitest, Playwright, manual checks |
| [2. Sign-off checklist](#2-sign-off-checklist) | Final acceptance |
| [3. Role guides](#3-role-guides) | Admin, Treasurer, Secretary, Organizing Secretary, Executive |

Related: [OPERATIONS.md](./OPERATIONS.md) | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)


# 1. Testing report
## Automated coverage (October 2026)

About 300 unit tests in 37 files.

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest (`npm test`) | Membership standing (including Monthly/Annual plans), time ranges and Nairobi day boundaries, report periods, report downloads (CSV/PDF/Word), gallery image processing (resize, rotate, WebP), finance access, money limits, contribution CSV import, navigation/sidebar rules, workspace guards, notifications, settings, loans |
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
- [ ] Mobile width: member home, contributions, documents list, admin tables (cards on phones)
- [ ] Screen reader: pagination links have clear labels
- [ ] Page header: on desktop buttons fill one row and overflow to a scrolling second row; on phones one scrolling row

## Finance acceptance checks

- [ ] Record a payment: the form clears at once and the entry turns "Recorded" when saved
- [ ] Change a payment amount: a reversal and a corrected entry appear in the ledger; balances stay correct; audit entry exists
- [ ] Send a confirmed entry back to pending, then approve it as a different person
- [ ] Time filter: Last 24 hours / 7 / 30 days / custom give the same totals on the ledger, Member contributions and exports
- [ ] Member contributions with a period selected lists only members who paid
- [ ] Financial reports: each report downloads as PDF, Word and CSV with the on-screen figures
- [ ] Notifications: a loan application shows only in the Treasurer (and Admin) workspace
- [ ] Gallery upload: phone photo appears upright and uncropped in the public gallery

## Restore drill

Record results in the `OPERATIONS.md` section 4 restore template after a non-production restore.

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
- Members / approvals / roles: `/directory` (Members), `/admin/approvals`, `/admin/roles` (under Settings)
- About Us page: Communications → **About Us profiles**, or Members → About-page button / an executive's eye
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
- Financial overview: `/dashboard/treasurer/finance` — KPIs, all finance charts, payments to verify, unmatched M-Pesa, M-Pesa payments, transactions table (eye → Reconcile, receipt PDF, email receipt)
- Financial ledger: `/dashboard/treasurer/ledger` — total funds and account balances, time filter, charts, arrears (eye for detail), Transaction history and Loans & welfare pop-ups, Record expense and Payment purposes
- Member contributions: `/contributions?tab=members` — time filter, Monthly grid, Monthly/Annual plan, amount corrections
- Financial reports: `/financial-reports` — monthly, arrears and transactions reports with PDF/Word/CSV
- Welfare and loans: the **Loans & welfare** board (approve/reject/disburse, overdue flags)

## Daily tasks
1. Record contributions with **Add contribution** (purpose is required; Monthly Contribution asks which month it covers).
2. Match unmatched M-Pesa payments and verify pending ones on the Financial overview.
3. Review welfare requests; disburse approved ones with proof from the Loans & welfare board.
4. For loans: review applicant context and guarantors; disburse once Admin approves.
5. Set new members' contribution plan (Monthly or Annual) after their first payment.

## Do not
- Bypass evidence requirements for welfare disbursements.
- Approve loans (Admin / Super Admin decides).
- Try to edit posted ledger entries directly — use the amount correction or a reversal.

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

## 3.4 Organizing Secretary
## Where to work
- Events: `/dashboard/organizer/events` (manage RSVP/attendance per event)
- Gallery: **Gallery** in the sidebar (`/dashboard/organizer/gallery`) — uploads are resized and converted automatically
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
