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
- A second role gives the abilities of that role **only after selecting its workspace**. For example, a Secretary must switch to Treasurer to record payments. [`requireActiveRole` in `lib/auth/session.ts`]
- Anyone with more than one dashboard gets a **workspace switcher** in the header to move between them. [`components/dashboard/WorkspaceSwitcher.tsx`]
- Admin and Super Admin can select every dashboard. Switching to Member, Secretary or another role removes Admin permissions for that workspace. Server actions and APIs enforce the selected role; opening an Admin URL does not restore Admin authority. Administrator mode also removes Super Admin privileges; select Super Administrator to use those privileges. [`allowedDashboards`]

### Executive as a second role
- **Anyone who has the Executive dashboard is an executive**, whether it is their main role or a second role (e.g. Secretary + Executive).
- On the Roles page this is the **"Also an Executive (second role)"** switch.
- Executive assignments (main or second role) determine the Executive filter and public About eligibility. Full Members-page access requires selecting Executive, Admin or Auditor workspace. [`isExecutive` in `lib/directory.ts`]

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

---

## 3. Who can see member details

| Who | What they see | Where |
| --- | --- | --- |
| Admin, Super Admin | Everything, and can manage accounts | Members page |
| Auditor | Everything, read-only (no account controls) | Members page |
| Executive workspace (main or assigned second role) | Everything, read-only (no account controls) | Members page |
| Treasurer | Name, membership number, email, phone — only alongside contributions | Contributions pages |
| Secretary | Name, email, phone — only when adding people to minutes attendance | Minutes editor |
| Organizing Secretary (and others who send messages) | Name, email, phone — only when choosing message recipients | Communications composer |
| Principal Member | Full details of members attached to them | My Family / Branch |
| Attached members | Their Principal’s name, location, phone and relationship, read-only | My Family / Branch |
| Everyone else | No member list | — |

Rules:
- The Members page (`/directory`) is only in the sidebar for Admin, Auditor and Executive. Anyone else who types the address is sent back to their home page. [`canViewMemberDirectory` in `lib/directory.ts`]
- The members export (CSV) is Admin only.
- Children and dependants are never shown on the public site.

---

## 4. What each role can do

Each table describes the **selected workspace**. Other roles assigned to the same account do not add permissions to it. See sections 2 and 6 for shared safeguards.

### Super Administrator

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Super Admin | Administration | All Administrator permissions | Select Super Administrator mode to use Super Admin authority. |
| Super Admin | Admin appointments | Approve applicants as Admin; grant or remove Admin role/access | Ordinary Administrator cannot grant Admin access. |
| Super Admin | Super Admin appointments | Grant Super Admin; remove eligible grants down their grant chain | Cannot remove self, the person above them, or a founding Super Admin. |
| Super Admin | Account protection | Protected from ordinary suspension and role editing | Grant-chain rules still apply; see section 2. |

### Administrator (`ADMIN`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Administrator | Members | Approve/reject applicants; suspend, restore or close accounts; set standing and contribution rights; export members | Cannot grant Admin authority or suspend a Super Admin. |
| Administrator | Roles and family | Assign main/second roles; manage Principal status, family links and role catalogue | Admin grants need Super Admin mode; Admin role cannot be disabled. |
| Administrator | Public About page | Communications → About Us profiles: link executives to member records; set display name, title, responsibilities, biography, photo URL and display order; publish or keep as draft. Members → "Show on About page" is the fallback when nothing is published. | Only published profiles appear publicly. Linked members choose which extra details (photo, profession, location, contacts) are shown. |
| Administrator | Finance oversight | Read all finances; verify/reconcile payments; approve ledger entries/reversals; manage campaigns/categories; set each member's Monthly/Annual contribution plan | Cannot approve their own entries. Recording money requires switching to Treasurer. |
| Administrator | Finance settings | Manage periods, thresholds, standing, allocations and payment destination | Closed-period and maker-checker safeguards apply. |
| Administrator | Loans | Review applications and make final decisions | Loans must be enabled. Disbursement/repayment recording requires Treasurer mode. |
| Administrator | Governance | Create/edit/delete proposals; decide resolutions; set visibility; publish results; manage notices, agendas and action points | Reasons and audit records apply to changes. |
| Administrator | Meetings and documents | Create/edit/delete/submit minutes; approve/publish minutes; manage repository documents, reports and categories | Submitted content and document workflow checks apply. |
| Administrator | Projects, events and gallery | Manage projects, events, gallery queue and project-comment moderation | Deletion/moderation safeguards apply. |
| Administrator | Communications and support | Send announcements/emails; manage templates; retry failed emails; answer support chats | Recipient and delivery rules apply. |
| Administrator | Settings and logs | Manage site settings, flags and contact destinations; read/export activity logs | Audit records are not editable from the app. |
| Administrator | Personal features | Use shared Member features | Personal data and ownership restrictions still apply. |

### Executive Committee (`EXECUTIVE`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Executive Committee | Members | Read the full member directory | No membership approval, role editing, export or administrative family linking. |
| Executive Committee | Minutes approval | Approve and publish submitted minutes | Shared with Admin; Secretary prepares and submits minutes. |
| Executive Committee | Projects | Create/edit/delete projects; manage milestones, responsible people and schedules; view full project finances | Shared with Admin and Organizing Secretary. |
| Executive Committee | Project comments | Moderate comments | Shared with Admin; a reason is required. |
| Executive Committee | Welfare | Give Executive approval or reject a pending request | Both Treasurer and Executive office approvals are needed; either can review first. No ordinary self-approval. The code permits one account with both workspaces to perform both reviews. |
| Executive Committee | Communications and activities | Send announcements; post activities; delete their own activity posts | Admin can delete any activity post. |
| Executive Committee | Support | Answer member support chats | Shared with Admin. |
| Executive Committee | Public About page | Be listed as an executive | Admin controls publication and visible details. |
| Executive Committee | Personal features | Use shared Member features | Module, record, audience and ownership restrictions apply. |
| Executive Committee | Excluded powers | Cannot manage roles/settings, record money, decide loans, manage repository documents/events or create/decide governance proposals | Must select another assigned workspace for those office functions. |

### Treasurer (`TREASURER`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Treasurer | Money recording | Record payments (saved in the background), expenses (proof optional), loan and welfare payouts and repayments; propose reversals | Requires active Treasurer workspace; accounting-period rules apply. |
| Treasurer | Corrections | Change a payment amount with a reason (posted as a reversal plus a corrected entry); send a confirmed entry back to pending | Treasurer only; audited. Reconciled entries, reversals and loan/welfare payouts cannot be sent back to pending. |
| Treasurer | Contribution plans | Set each member to Monthly or Annual so standing checks only the matching dues | Shared with Admin; audited. |
| Treasurer | Verification and approval | Verify payments; approve others’ ledger entries and reversals | Cannot verify/approve an entry they recorded; role switching does not bypass account-ID checks. |
| Treasurer | Reconciliation | Reconcile confirmed payments; match unmatched M-Pesa payments | Closed-period restrictions apply. |
| Treasurer | Campaigns and receipts | Manage campaigns, contribution categories and obligations; email receipts; see M-Pesa notifications | Waiver/restoration and audit rules apply. |
| Treasurer | Financial visibility | See every member’s contributions; members × months grid; Financial overview, ledger and reports with time filters and PDF/Word/CSV downloads | Member contact details are limited to the financial context. Downloads are audited. |
| Treasurer | Loans | First review; publish funding requests to governance; record disbursements/repayments from the loans & welfare board | Admin can also review; final approve/reject belongs to Admin. |
| Treasurer | Welfare | Give Treasurer review/approval or reject a pending request | Executive approval is also required; welfare must be enabled. |
| Treasurer | Governance | Create proposals with attachments; edit/delete proposals with a reason | Admin decides resolutions and publishes results. |
| Treasurer | Communications | Announcement sending action permits Treasurer | Default Treasurer sidebar does not expose the composer. |
| Treasurer | Personal features | Use shared Member features | No general membership administration or site settings access. |

### Secretary (`SECRETARY`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Secretary | Meeting preparation | Create/edit/delete minutes; record attendance; submit for approval | Attendance supports system members and typed guests; Admin/Executive publishes submitted minutes. |
| Secretary | Governance preparation | Circulate notices; add agenda/action points; create minutes revisions and proposals | Cannot decide resolutions or publish results. |
| Secretary | Proposal changes | Edit/delete proposals | Reason required; changes are audited. |
| Secretary | Documents and reports | Upload, replace, archive, delete individually/in bulk and restore | Document-category creation is Admin-only. |
| Secretary | Events | Create/manage events | Event workflow restrictions apply. |
| Secretary | Communications and activities | Send announcements; post activities; delete own activity posts | Cannot delete other people’s activity posts. |
| Secretary | Personal features | Use shared Member features | No full member directory; attendance selection exposes limited contact details. |

### Organizing Secretary (`ORGANIZER`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Organizing Secretary | Events | Create/manage events and invitations | Includes event-management pages. |
| Organizing Secretary | Projects | Create/edit/delete projects; manage milestones, responsible people and schedules | Project-comment moderation belongs to Admin/Executive. |
| Organizing Secretary | Project finance | See full project financial information | Does not permit recording money. |
| Organizing Secretary | Gallery | Add photos (auto-resized to WebP for every screen) and manage the approval queue from the Gallery sidebar entry | Gallery workflow and audit rules apply. |
| Organizing Secretary | Communications and activities | Send announcements/messages; post activities; delete own activity posts | Recipient selection exposes limited member contact details. |
| Organizing Secretary | Personal features | Use shared Member features | No membership administration, site settings, minutes approval or governance proposal management. |

### Member (`MEMBER`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Member | Personal contributions | See own contributions/statements; pay via M-Pesa | Cannot see all members’ finances or verify/record ledger payments. |
| Member | Group information | Read permitted announcements, governance, documents, meetings/reports, projects and events | Audience, publication and document access rules apply. |
| Member | Participation | Vote on eligible resolutions; RSVP; update assigned action points | Only eligible records and own/assigned actions. |
| Member | Applications | Apply for loans/welfare; respond to guarantor requests | Modules must be enabled; cannot approve own applications. |
| Member | Profile and family | Manage own profile; see own Principal/attached members; use permitted Principal branch functions | Principal status is separate from role. No all-member list or Admin linking controls. |
| Member | Support | Chat with support | Cannot answer other members’ support chats. |
| Member | Excluded powers | No administrative membership/role/settings controls or staff approvals | An Admin in Member mode has these same restrictions. |

### Auditor (`AUDITOR`)

| Role | Area / permission | What it can do | Notes / restrictions |
| --- | --- | --- | --- |
| Auditor | Financial oversight | Read financial reports and every member’s contributions | Read-only; cannot record, reconcile or approve money. |
| Auditor | Member directory | Read full member details | No account management controls or member CSV export. |
| Auditor | Group records | Read permitted meetings/reports, governance, documents and announcements | Publication and audience restrictions apply. |
| Auditor | Audit trail | Read activity logs | Cannot edit or delete audit records. |
| Auditor | Excluded powers | Cannot create/edit/delete operational records, vote or approve decisions | Auditor workspace is oversight only. |
---

## 5. Principal Member rules

- A Principal heads a family branch; other members can be **attached** to them.
- Only **active** members can be made Principal. Admins do this from **Family → Principals** (or the Roles page). Making an attached member a Principal takes them out of their current branch.
- **Demoting** a Principal leaves everyone attached to them with no Principal (each one is logged as removed from the branch).
- **Family → Link members** links one or many members to a Principal at once; members already in another branch are transferred.
- A Principal can invite or add attached members and see their branch's payments.
- Only an **Admin or Super Admin** can transfer a member from one Principal to another (with a reason). Each transfer is recorded in branch history and the audit log.
- A Principal sees the **full details** of members attached to them (membership number, date of birth, gender, location, profession, education, branch, standing, contribution rights, join date, emergency contact).
- **Standing:** dependants follow their Principal's standing — anyone under 18, or anyone whose contribution rights an Admin has removed. Attached adults with contribution rights pay their own dues and keep their own standing.

---

## 6. Finance safeguards

- **Maker-checker:** the person who records a payment or ledger entry cannot verify or approve it.
- **Closed periods:** payments in a closed accounting period cannot be reconciled or changed; edits after close are flagged.
- **Recording money:** active Treasurer workspace only. Admin and Super Admin must explicitly switch to Treasurer to record; the maker-checker rule still uses their account ID, so switching roles cannot approve their own entry.
- **Seeing all finances:** Admin, Super Admin, active Treasurer workspace and Auditor. Everyone else sees only their own (and a Principal sees their branch). [`canViewAllFinances`]
- **Immutable ledger:** the database blocks changes to posted ledger entries. Corrections are new entries: a reversal plus, for amount changes, a corrected entry. Account balances count a reversed entry and its reversal together, so they cancel out.
- **Dates:** every finance date filter uses whole days in Nairobi time; "Last 24 hours" is exact to the hour.

---

## 7. Notifications per role

The Notifications page lists **to-dos** (things to act on) and **notifications** (things to know about) for the selected workspace. Other assigned roles do not add their permissions to that workspace.

Notifications are **role-specific**: each notice records the workspace(s) it belongs to (for example, loan applications belong to Treasurer). A workspace shows only its own role's notices plus personal and general ones (your payment confirmed, a new event). The Admin / Super Admin workspace shows everything. The bell count, "Mark all as read" and "Clear read" follow the same rule. [`lib/notification-audience.ts`]

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

Every role has the same sidebar as the Administrator: the same section names in the same order. A section the role can't use is hidden, and each section opens that role's own page. Related pages show as buttons in the page header, not in the sidebar. On desktop the header buttons fill the title row and any that do not fit move to a second row that scrolls sideways; on phones they sit in one scrolling row under the title. The Organizing Secretary's Gallery is the one shortcut shown in the sidebar itself. [`lib/dashboard/nav.ts`, checked by `tests/nav-pagination.test.ts`]

Order: Overview · Notifications · Members · Finance · Projects & events · Meetings & reports · Communications · Documents · Governance · My Family · Settings

| Role | Sections shown (header buttons in brackets) |
| --- | --- |
| Admin | Overview (Activities), Notifications, Members (Approvals), Finance (Contributions, Loans), Projects & events (Events, Gallery queue), Meetings & reports, Communications, Documents (Document repository), Governance, My Family, Settings (Roles & access, Activity logs) |
| Executive | Overview (Activities), Notifications, Members, Finance (Payments & statements, Loans, Welfare approvals), Projects & events (Events), Meetings & reports, Communications, Documents, Governance, My Family |
| Treasurer | Overview (Activities), Notifications, Finance → Financial overview (Financial ledger, Settings, Campaigns, Financial reports, My contributions, Member contributions, Loans, Welfare), Projects & events (Events), Meetings & reports, Documents, Governance, My Family |
| Secretary | Overview (Activities), Notifications, Finance, Projects & events (Manage events, Events), Meetings & reports, Communications, Documents (Document repository), Governance, My Family |
| Organizing Secretary | Overview (Activities), Notifications, Finance, Projects & events (Manage events), Gallery, Meetings & reports, Communications, Documents, Governance, My Family |
| Member | Overview (Activities), Notifications, Finance (Loans, Welfare), Projects & events (Events), Meetings & reports, Documents, Governance, My Family |
| Auditor | Notifications, Members, Finance, Meetings & reports, Documents, Governance, Activity logs (in the Settings position) |

Everyone reads group notices on **Notifications**. Communications is only for the roles that send them. [`app/notifications/page.tsx`]

Loans and Welfare appear for the relevant roles when those modules are switched on. [`lib/dashboard/nav.ts`]


## 9. Executive Committee compared with other roles

These are the implemented permissions, not additional permissions automatically granted by a committee title. An account assigned Executive as a second role must select the Executive workspace to use them.

| Capability | Executive | Other roles with the capability | Limits |
| --- | --- | --- | --- |
| Approve and publish submitted meeting minutes | Yes | Admin | Minutes must be pending approval and contain content. Secretary prepares/submits them; Secretary cannot publish them in Secretary mode. |
| Give Executive welfare approval | Yes | Admin can act for the Executive office | Treasurer gives a separate approval. Both office approvals are needed; the code currently permits one account with both authorized workspaces to complete both. Executive cannot replace the Treasurer review in Executive mode. |
| View the full member directory | Read-only | Admin manages it; Auditor reads it | No approval, suspension, role editing, export or family-linking controls. |
| Create, edit and delete projects; manage milestones, responsible people and schedules | Yes | Admin, Organizing Secretary | Project management access is shared, not exclusive to Executive. |
| Moderate project comments | Yes | Admin | Organizing Secretary cannot moderate through this action. A reason is required. |
| View project financial information | Yes | Admin and Organizing Secretary | Viewing does not allow recording money. |
| Send announcements and post activities | Yes | Admin, Secretary, Organizing Secretary; Treasurer announcement action | Audience, ownership and record checks still apply. Non-Admin activity creators delete only their own posts. |
| Answer support chats | Yes | Admin | Access follows the support-chat rules, not general membership administration. |

Executive **cannot** assign roles, approve memberships, manage family links for the whole group, change site settings, record ledger payments/expenses/disbursements, give final loan decisions, create/edit governance proposals, decide resolutions, manage repository documents, or create/manage events in Executive mode. Those tasks belong to the appropriate office. Executive can still vote on eligible resolutions and use personal Member features.

There is no Executive power that excludes Super Administrator or Administrator across the entire app. Its distinction is the committee approval and oversight office, especially minutes publication and the Executive half of welfare approval. It is separate from the Treasurer’s financial recording office and the Secretary’s preparation/document office.

## 10. Family and audit visibility

- Admin/Super Administrator workspace: full family management, all members, Assign/Transfer/Link controls and administrative navigation.
- Member and other personal workspaces: own Principal and own attached members only; no all-member list or Admin linking controls. A person without a Principal or attached members sees the empty state, not their own details as an attached member.
- Principal status is an account/branch relationship, not a workspace role. Principals see attached members’ full details read-only; attached members see limited Principal details.
- Audit details show actor name/email, the primary role when used, or primary plus the secondary role actually used. They give a short explanation of the change. The UI omits raw JSON and unrelated role lists; the stored audit record remains intact.

Implementation references: `lib/auth/workspace.ts`, `lib/auth/session.ts`, `app/api/auth/workspace/route.ts`, `app/actions/meetings.ts`, `app/actions/welfare.ts`, `app/actions/projects.ts`, `app/actions/domain.ts`, `app/actions/governance.ts`, `app/actions/documents.ts`, `lib/audit.ts`.
