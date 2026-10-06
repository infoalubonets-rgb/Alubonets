# Roles and permissions

This is the single reference for every role in Alubonets: what each role can see, what it can do, and the rules that sit around roles. When you change a permission in code, update this file in the same change.

Where the rule lives in code is noted in brackets so it can be checked.

---

## 1. The roles

| Role (code) | Shown as | Home page |
| --- | --- | --- |
| `ADMIN` | Administrator | `/admin` |
| `EXECUTIVE` | Executive Committee | `/dashboard/executive` |
| `TREASURER` | Treasurer | `/dashboard/treasurer` |
| `SECRETARY` | Secretary | `/dashboard/secretary` |
| `ORGANIZER` | Organizing Secretary | `/dashboard/organizer` |
| `MEMBER` | Member | `/dashboard/member` |
| `AUDITOR` | Auditor (read-only) | `/financial-reports` |

Two account flags sit on top of the role:

- **Super Admin** (`isSuperAdmin`) — the highest authority.
- **Principal Member** (`isPrincipal`) — head of a family branch.

[`lib/auth/types.ts`]

---

## 2. General role rules

### Joining
- Everyone signs up as a **Member**. Nobody chooses their own role.
- When an Admin approves an application they pick the role to approve them as ("Approve as"). Only active roles can be chosen.
- Only a **Super Admin** can approve someone straight in as Admin. Super Admin accounts cannot be approved or rejected by anyone. [`setMemberApproval` in `app/actions/members.ts`]

### Main role and second roles
- Every account has one **main role** plus optional **second roles** (extra dashboards, stored in `dashboardAccess`).
- A second role gives the full abilities of that role. For example, a Secretary with Treasurer as a second role can record payments. [`requireActiveRole` in `lib/auth/session.ts`]
- Anyone with more than one dashboard gets a **workspace switcher** in the header to move between them. [`components/dashboard/WorkspaceSwitcher.tsx`]
- Admin and Super Admin automatically have every dashboard. [`allowedDashboards`]

### Executive as a second role
- **Anyone who has the Executive dashboard is an executive**, whether it is their main role or a second role (e.g. Secretary + Executive).
- On the Roles page this is the **"Also an Executive (second role)"** switch.
- Executives (main or second role) can open the full Members page, show in the Executive filter, and can be published on the public About page. [`isExecutive` in `lib/directory.ts`]

### Changing roles
- Roles, second roles, Super Admin and Principal status are all changed on **Admin → Settings → Roles & access**. Only Admins can do this.
- The switches and bubbles on that page only change what you see. **Nothing is saved until you press "Save changes".** An "unsaved changes" note shows until you do.
- Only a Super Admin can give or take away the Admin role or Admin access.
- Only a Super Admin can make someone Super Admin. The app records who granted it (`superAdminGrantedById`).
- Super Admin can be removed, following a chain of command: the Super Admin who granted it, or anyone above them in the chain, can remove it. The person promoted can never remove the one who promoted them, nobody can remove their own Super Admin, and founding Super Admins (no granter recorded) cannot be removed. [`canRemoveSuperAdmin` in `lib/super-admin.ts`, `setSuperAdminFlag`]
- Removing Super Admin leaves the account as a plain Admin. The Super Admin can then change their role in the same save; while an account is still Super Admin, its role and access cannot be edited.
- Roles can be switched off in the **role catalogue** ("Turn roles on/off" on the Roles page). A switched-off role cannot be assigned and its dashboard shows as deactivated. Admin can never be switched off. [`setRoleActive` in `app/actions/settings.ts`]

### Account status
- Only **Active** accounts can use dashboards. Pending, suspended, resigned, deceased, disqualified and inactive accounts are blocked.
- Admins suspend, restore or close accounts from the eye pop-up on the Members page. Super Admin accounts cannot be suspended. [`setMemberStatus`]

### Two-factor sign-in (MFA)
- Admin, Treasurer, Secretary and Executive (and Super Admin) can switch on authenticator-app sign-in from their profile. [`PRIVILEGED_MFA_ROLES` in `lib/mfa-totp.ts`]

---

## 3. Who can see member details

| Who | What they see | Where |
| --- | --- | --- |
| Admin, Super Admin | Everything, and can manage accounts | Members page |
| Auditor | Everything, read-only (no account controls) | Members page |
| Executive (main or second role) | Everything, read-only (no account controls) | Members page |
| Treasurer | Name, membership number, email, phone — only alongside contributions | Contributions pages |
| Secretary | Name, email, phone — only when adding people to minutes attendance | Minutes editor |
| Organizing Secretary (and others who send messages) | Name, email, phone — only when choosing message recipients | Communications composer |
| Principal Member | Full details of members attached to them | My Family / Branch |
| Attached members | Basic details (name, email, phone, status) of their own family branch | My Family / Branch |
| Everyone else | No member list | — |

Rules:
- The Members page (`/directory`) is only in the sidebar for Admin, Auditor and Executive. Anyone else who types the address is sent back to their home page. [`canViewMemberDirectory` in `lib/directory.ts`]
- The members export (CSV) is Admin only.
- Children and dependants are never shown on the public site.

---

## 4. What each role can do

### Super Admin
Everything an Admin can do, plus:
- Approve someone directly as Admin; give or remove the Admin role and Admin access.
- Make another member Super Admin, and remove it again from anyone they promoted (or anyone those people promoted).
- Cannot be suspended or edited while Super Admin. Can only lose Super Admin to the person above them in the chain of grants.

### Administrator (`ADMIN`)
Runs the organisation. Opens every dashboard.
- **Members:** approve or reject applications (choosing their role), suspend/restore/close accounts, set standing (paid-up / lapsed / automatic), set contribution rights, export members.
- **Roles:** change main roles and second roles, Principal status, the role catalogue.
- **About page:** choose which executives appear on the public About page, their title, order and which details show (photo, profession, location, email, phone). Hidden by default.
- **Finance (oversight):** see all finances; approve ledger entries and reversals made by someone else; verify and reconcile contributions; manage campaigns and categories; open and close accounting periods; set approval thresholds, standing rules, fund allocation rules and the payment destination.
  - Admins **cannot record payments, expenses or reversals** — only the Treasurer can. [`canRecordPayments` in `lib/finance-access.ts`]
- **Loans:** final decision on loan applications (when loans are switched on).
- **Governance:** decide resolutions, set their visibility and publish results; create resolutions, notices, agendas and action points.
- **Meetings:** create, edit, delete and submit minutes; approve and publish minutes.
- **Documents:** manage the document repository and categories.
- **Projects & events:** manage projects, events and the gallery queue; moderate project comments.
- **Communications:** send announcements and emails to everyone, a role group or chosen members; manage templates; retry failed emails.
- **Support chat:** answers member chats.
- **Settings & logs:** all site settings, feature flags, contact destinations, activity (audit) logs.

### Executive Committee (`EXECUTIVE`)
Leaders of the organisation.
- **Members:** open the full Members page (read-only).
- **Meetings:** approve and publish minutes submitted by the Secretary.
- **Projects:** create and manage projects; moderate project comments; see full project finances.
- **Welfare:** approve welfare requests after the Treasurer has reviewed them (when welfare is switched on).
- **Communications:** send announcements to members.
- **Daily activities:** post to the Activities feed.
- **Support chat:** answers member chats.
- **About page:** can be shown on the public About page once an Admin switches them on.
- Plus everything a Member can do.

### Treasurer (`TREASURER`)
The only role that moves money in the books.
- **Records** payments, expenses and disbursements, and **proposes reversals**, through the ledger. [`requireTreasurer`]
- **Verifies** member-submitted payments — but never one they recorded themselves (maker-checker).
- **Approves** ledger entries and reversals made by someone else.
- **Reconciles** confirmed payments (Reconcile button on each contribution row) and matches unmatched M-Pesa payments to members.
- Manages campaigns, contribution categories and campaign obligations (waive/restore).
- Emails receipts; sees M-Pesa payment notifications.
- **Loans:** first review of loan applications; can publish a funding request to governance.
- **Welfare:** first review of welfare requests.
- Sees every member's contributions, with limited member details (see section 3).
- Plus everything a Member can do.

### Secretary (`SECRETARY`)
- **Meetings:** create, edit, delete and submit minutes for approval. Attendance can be picked from members in the system (name, email, phone) **or** typed in for guests.
- **Governance:** circulate meeting notices, add agenda items and action points, submit minutes for approval, create minutes revisions, create resolutions.
- **Proposals (Admin, Super Admin, Treasurer and Secretary):** edit or delete an existing proposal on Governance management. Both need a reason and are written to the activity log (`RESOLUTION_UPDATE`, `RESOLUTION_DELETE`), with the old wording kept there. [`updateResolution`, `deleteResolution` in `app/actions/governance.ts`]
- **Documents:** upload, replace, archive, delete and restore repository documents and reports.
- **Events:** create and manage events.
- **Communications:** send announcements to members.
- **Daily activities:** post to the Activities feed.
- Plus everything a Member can do.

### Organizing Secretary (`ORGANIZER`)
- **Events:** create and manage events and invitations.
- **Projects:** create and manage projects.
- **Gallery:** manage the gallery and its queue.
- **Communications:** send messages and announcements, choosing recipients with limited member details (name, email, phone).
- **Daily activities:** post to the Activities feed.
- Plus everything a Member can do.

### Member (`MEMBER`)
- See their own contributions and statements, and pay via M-Pesa.
- Read announcements, governance, documents they are allowed to see, meetings & reports, projects and events.
- Vote on resolutions, RSVP to events, update action points assigned to them.
- Apply for welfare and loans, and respond to guarantor requests (when switched on).
- Manage their own profile and family branch; chat with support.

### Auditor (`AUDITOR`) — read-only
- Financial reports, activity logs, meetings & reports, governance, documents, announcements.
- Full Members page, read-only.
- Sees every member's contributions.
- **Cannot create, edit, approve or delete anything.**

---

## 5. Principal Member rules

- A Principal heads a family branch; other members can be **attached** to them.
- Only **active** members can be made Principal. Admins do this from **Family → Principals** (or the Roles page). Making an attached member a Principal takes them out of their current branch.
- **Demoting** a Principal leaves everyone attached to them with no Principal (each one is logged as removed from the branch).
- **Family → Link members** links one or many members to a Principal at once; members already in another branch are transferred.
- A Principal can invite or add attached members, transfer them to another Principal (with a reason), and see their branch's payments.
- A Principal sees the **full details** of members attached to them (membership number, date of birth, gender, location, profession, education, branch, standing, contribution rights, join date, emergency contact).
- **Standing:** dependants follow their Principal's standing — anyone under 18, or anyone whose contribution rights an Admin has removed. Attached adults with contribution rights pay their own dues and keep their own standing.

---

## 6. Finance safeguards

- **Maker-checker:** the person who records a payment or ledger entry cannot verify or approve it.
- **Closed periods:** payments in a closed accounting period cannot be reconciled or changed; edits after close are flagged.
- **Recording money:** Treasurer only (main or second role). Admin and Super Admin see everything but cannot record.
- **Seeing all finances:** Admin, Super Admin, Treasurer (main or second role) and Auditor. Everyone else sees only their own (and a Principal sees their branch). [`canViewAllFinances`]

---

## 7. Notifications per role

The Notifications page lists **to-dos** (things to act on) and **notifications** (things to know about) for every role the person holds.

| Role | To-dos |
| --- | --- |
| Admin | Membership applications, gallery queue, resolutions awaiting decision, loan final decisions |
| Treasurer | Payments to verify, unmatched M-Pesa payments, ledger entries to approve, loan applications, welfare requests |
| Executive | Minutes to approve, welfare approvals |
| Secretary | Draft minutes not yet submitted |
| Organizing Secretary | Gallery queue, project comments to moderate |
| Member | Guarantor requests |

Notifications: unread announcements (everyone), M-Pesa payments received (Admin, Super Admin, Treasurer), and personal messages. [`lib/role-alerts.ts`]

---

## 8. Sidebar per role

Every role has the same sidebar as the Administrator: the same section names in the same order. A section the role can't use is hidden, and each section opens that role's own page. Related pages show as buttons in the page header, not in the sidebar. [`lib/dashboard/nav.ts`, checked by `tests/nav-pagination.test.ts`]

Order: Overview · Notifications · Members · Finance · Projects & events · Meetings & reports · Communications · Documents · Governance · My Family · Settings

| Role | Sections shown (header buttons in brackets) |
| --- | --- |
| Admin | Overview (Activities), Notifications, Members (Approvals), Finance (Contributions, Loans), Projects & events (Events, Gallery queue), Meetings & reports, Communications, Documents (Document repository), Governance, My Family, Settings (Roles & access, Activity logs) |
| Executive | Overview, Notifications, Members, Finance (Payments & statements, Loans, Welfare approvals), Projects & events (Events), Meetings & reports, Communications, Documents, Governance, My Family |
| Treasurer | Overview, Notifications, Finance (Financial ledger, Campaigns, Financial reports, My contributions, Loans, Welfare), Projects & events (Events), Meetings & reports, Documents, Governance, My Family |
| Secretary | Overview, Notifications, Finance, Projects & events (Manage events, Events), Meetings & reports, Communications, Documents (Document repository), Governance, My Family |
| Organizing Secretary | Overview, Notifications, Finance, Projects & events (Manage events, Gallery), Meetings & reports, Communications, Documents, Governance, My Family |
| Member | Overview, Notifications, Finance (Loans, Welfare), Projects & events (Events), Meetings & reports, Documents, Governance, My Family |
| Auditor | Notifications, Members, Finance, Meetings & reports, Documents, Governance, Activity logs (in the Settings position) |

Everyone reads group notices on **Notifications**. Communications is only for the roles that send them. [`app/notifications/page.tsx`]

Loans and Welfare appear for the relevant roles when those modules are switched on. [`lib/dashboard/nav.ts`]
