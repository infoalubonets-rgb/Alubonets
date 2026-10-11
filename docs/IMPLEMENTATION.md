# Alubonets Website Upgrade — Implementation Status

**Source:** Alubonets Self-Help Group Website Upgrade Structure & Developer Guide, the Simple Software Requirements Specification (sections 1–25) and the 9 September 2026 review meeting<br>
**Status basis:** 11 October 2026 implementation pass<br>
**Confirmed UI decision:** Principal Members use the existing Member dashboard with additional family features. There is no separate Principal dashboard.

Companion documents: [Data model](./DATA_MODEL.md) · [Architecture](./ARCHITECTURE.md) · [Roles](./ROLES.md) · [Operations](./OPERATIONS.md) · [Acceptance](./ACCEPTANCE.md)

## How to read this document

Every status table uses three columns:

1. **System feature** — what the feature does in plain language.
2. **Completed** — estimated implementation progress in the current codebase.
3. **Missing / not yet implemented** — work still required before sign-off.

Percentages are planning estimates and must be confirmed through acceptance testing.

## 1. Public website and secure portal

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Public website:** Home, About (executive committee profiles managed by Admin), public project summaries, approved gallery, contact form, registration and login, without exposing private member information. | 95% | Final public-content review, production domain, privacy check for accidental member-data exposure. |
| **Secure member portal:** Approved members sign in to dashboards, contributions, events, projects, welfare, governance documents and announcements. Pending or inactive accounts are restricted; lapsed members see past events and the gallery only. | 95% | End-to-end access testing for every account state. |
| **Role workspaces:** Admin, Executive, Treasurer, Secretary, Organizing Secretary, Auditor and Member workspaces with server-enforced permissions and a workspace switcher for people with several roles. | 95% | Least-privilege test pass across all APIs. |

## 2. Membership, family branches and privacy

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Registration and approval:** People register as members, stay pending until approved, then reach the portal. Admin controls approval, suspension and roles. Rejected applicants are soft-retained. | 95% | Confirm phone/identity verification for production. |
| **Principal Member and family hierarchy:** Admin assigns Principal status and links or transfers members between branches; every transfer is recorded in branch history and the audit log. Principals manage their attached members from My Family. | 100% | Continued regression and UAT coverage. |
| **Family invitations:** Attached adults can be invited to activate a login; children may remain record-only. Acceptance, expiry and revocation are enforced. | 95% | Confirm whether an adulthood age rule should return. |
| **Profile privacy and member directory:** Member-only directory, field-level visibility, children hidden by default, audited visibility changes. | 95% | Committee confirmation of the visible-field list. |
| **Membership standing:** Automatic Paid-up / Lapsed standing from monthly and annual dues with Admin-editable amounts, grace and renewal windows; manual override with an end date; automatic reactivation on full payment. Each member can be set to a **Monthly** or **Annual** contribution plan so standing checks only the matching dues. | 95% | Set the live fee amounts and assign plans to existing members. |

## 3. Payments, contributions and finance

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Recording payments:** The Treasurer records payments with a required purpose (Monthly Contribution, Annual Contribution, campaigns, projects, Other with an explanation), method, account, date and optional proof. Saving runs in the background so several payments can be entered quickly. CSV import is available. | 95% | UAT with real statements. |
| **Correcting payments:** The Treasurer can change a payment amount with a reason; the ledger posts a reversal and a corrected entry (posted ledger rows are locked by the database) and the change is audited. Confirmed entries can be sent back to pending for re-approval. | 95% | UAT. |
| **Financial overview:** One page (`Finance`) with KPI cards, every finance chart, loan and welfare panels, payments to verify, unmatched M-Pesa payments and a filterable transactions table with an eye pop-up (details, reconcile, receipt PDF, email receipt). | 95% | Visual review on phones. |
| **Financial ledger:** Account balances with a total-funds card, period figures, income vs expenditure, purpose breakdowns, top contributors, arrears with detail pop-ups, a full-screen transaction history and a loans & welfare board. One time filter (last 24 hours, this week, last 7/30 days, custom) drives every figure. | 95% | Visual review on phones. |
| **Member contributions:** Per-member totals with a time filter (only members who paid are listed when a period is chosen), a members × months grid, Monthly/Annual plan switch and audited amount edits. | 95% | — |
| **Financial reports:** Minimal page with three reports — member contributions per month, arrears, all transactions — each with four KPI cards, a collapsible table and PDF, Word and CSV downloads. | 90% | Committee to confirm any further required reports. |
| **Expenses and payouts:** Expenses need amount, purpose, account and date (proof optional). Loan and welfare payouts are recorded from the loans & welfare board; amounts over the approval limit wait for a second approver. | 90% | Confirm approvers and the live limit. |
| **Official payment destination:** Admin-controlled bank/paybill/M-Pesa details with version history and a downloadable payment-details PDF. | 95% | Publish the live approved details. |
| **Data integrity:** All confirmed contributions are in the ledger (a one-off backfill fixed a legacy gap); balances count a reversed entry together with its reversal; all date filters use whole days in Nairobi time. | 100% | — |

## 4. Activities, meetings and communication

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Events and calendar:** Month and week views; audiences for public, all members, roles, selected members and family branch. | 95% | Combined activities + meetings calendar if required. |
| **Today’s Activities:** Private daily feed with role/branch audience. | 95% | Content guidelines. |
| **Meetings and minutes:** Notices, agenda, minutes, Word/PDF export, approval before publishing. Attendance is picked from the member list per section (Present, Absent with apology, Absent) with typed names for guests; a member cannot be in two sections. | 95% | Final UAT. |
| **Notifications:** Role-specific — each workspace shows only its own role's notices (loan applications to the Treasurer, etc.); Admin sees all; personal and general notices show everywhere. | 95% | — |
| **Announcements and email:** Targeted announcements with templates, preferences and retry records. | 85% | Mandatory-notice policy; send from the verified domain. SMS/WhatsApp deferred. |
| **Support chat:** Admins, Super Admins and Executives answer member chats. | 95% | — |

## 5. Resources, welfare, loans and projects

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Documents:** Categories, tags, search, in-app PDF preview, version history; only Admin and Secretary manage uploads. | 90% | Malware scanning if a provider is approved. |
| **Welfare:** Requests need Treasurer **and** Executive approval, self-approval barred, confidential flag; payouts need proof. Shown with overdue flags (open over 14 days) on the loans & welfare board. | 95% | — |
| **Loans (optional module):** Applications with registered or external guarantors; Admin decides; Treasurer disburses; overdue loans flagged. | 90% | Confirm whether the Treasurer should also decide loans. |
| **Projects:** Dates drive status, funding progress from payments, linked expenses, owners, updates and documents. | 90% | Final reporting polish. |
| **Gallery:** Uploads are resized server-side to 480/960/1600 px WebP, rotated upright and stripped of metadata; galleries never crop photos. The Organizing Secretary has a Gallery sidebar entry. | 100% | — |

## 6. Security, quality and launch

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Authentication:** Account lock after repeated failures, idle timeout, rate limits and login history. Privileged MFA was removed by decision. | 90% | Turn the contact-form CAPTCHA (Turnstile) back on; phone verification if required. |
| **Authorization, privacy and audit:** Server-side role checks, private file access, immutable ledger, audit logs for finance, roles, family, About page and settings changes. | 95% | Extended privacy regression suite. |
| **Responsive design:** Mobile-first admin pages (tables become cards on phones); headers fill one row and overflow to a scrolling second row. | 85% | Device UAT, keyboard and screen-reader checks. |
| **Operations:** Environment validation, migrations, health checks, restore-drill template and launch checklist. | 85% | Staging restore drill, monitoring and production approval. |

## 7. September 2026 meeting changes — status

| Phase | Status |
|---|---|
| **1. Membership standing and page access** — automatic standing, notifications, standing in Admin Members, paid-up-only upcoming events and projects, past events and gallery for all logged-in members. | Done |
| **2. Treasurer finance tools** — required purpose, Treasurer-managed purposes and campaigns, campaign progress and waivers, month covered by monthly payments, approval limit only on money out, Kenya-time dates. The planned "Active Months" report was replaced by the members × months grid and the monthly report. | Done |
| **3. Projects** — start/end dates, automatic status, funding progress, project payments and linked expenses. | Done |
| **4. Roles, Principals and lineage** — Organizing Secretary rename, Super Admin-only Admin changes, Make Principal, audited transfers (Admin/Super Admin only), lineage removed from forms, Auditor read-only access, document uploads limited to Admin and Secretary. | Done |
| **5. Public pages, contact and Secretary** — About Us executive profiles, Contact Us multiple recipients, attendance from the member list, Executives in support chat, "disabled" pages for switched-off modules. | Done (members cannot yet edit their own About entry — see decisions) |
| **6. M-Pesa and go-live** — till (Buy Goods) support, purpose on M-Pesa payments, member online payment, new domain, verified sender email, test-account list off on the live site. | Pending go-live |

## 8. Overall progress

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Whole platform** | **About 93%** | Committee decisions, staging restore drill, device/accessibility UAT and production cutover. |

## 9. Decisions still required

| Decision | Notes |
|---|---|
| Production domain and host owner | Needed for go-live. |
| Official bank / paybill / till details | Admin finance setting. |
| Live fee amounts and member plans | Monthly and annual amounts; assign Monthly/Annual to each member. |
| Loan decisions | Admin only today; confirm whether the Treasurer should also approve/reject. |
| Executive self-editing on the About page | Today only Admin/Super Admin edit About content. |
| Attached-adult payment policy | Own statement vs Principal-only. |
| 20% emergency / 80% reserve | Confirm live values. |
| SMS/WhatsApp | Now or later. |

## 10. Explicit non-goals unless separately approved

| System feature | Notes |
|---|---|
| Separate Principal dashboard | No work planned. |
| Visual redesign | Only accessibility and consistency fixes. |
| Website custody of group funds | A payment gateway would need separate approval. |
| Permanent deletion of referenced history | Soft retention is the default; the ledger is immutable. |

## Document control

Update this document after each acceptance-test cycle or significant release.
