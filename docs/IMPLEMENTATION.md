# Alubonets Website Upgrade — Implementation Status

**Source:** Alubonets Self-Help Group Website Upgrade Structure & Developer Guide<br>
**Target:** on or before 5 September 2026<br>
**Status basis:** August 2026 codebase review; percentages describe code completion, not production deployment<br>
**Confirmed UI decision:** Principal Members use the existing Member dashboard with additional family features. There is no separate Principal dashboard.

Companion documents: [Data model](./DATA_MODEL.md) · [Architecture](./ARCHITECTURE.md) · [Operations](./OPERATIONS.md) · [Acceptance](./ACCEPTANCE.md)

## How to read this document

Every status table uses only three columns:

1. **System feature** — what the feature does in plain language.
2. **Completed** — estimated implementation progress in the current codebase.
3. **Missing / not yet implemented** — work still required before sign-off.

Percentages are planning estimates and must be confirmed through acceptance testing.

## 1. Public website and secure portal

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Public website:** Home, About, public project summaries, approved gallery items, contact form, registration and login are available without exposing private member information. | 95% | Complete final public-content review, confirm the production domain, and run a privacy check for accidental member-data exposure. |
| **Secure member portal:** Approved members sign in to view dashboards, contriVbutions, events, projects, welfare, governance documents and announcements. Pending or inactive accounts are restricted. | 90% | Add the dedicated Today’s Activities experience, finish member navigation changes, and complete end-to-end access testing for every account state. |
| **Role workspaces:** Admin, Treasurer, Secretary, Organizer and Executive users receive role-specific dashboards and server-enforced permissions. | 90% | Confirm the final office-bearer permission matrix, decide whether an Auditor role is required, and test least-privilege rules across all APIs. |

## 2. Membership, family branches and privacy

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Registration and approval:** People register as ordinary members, remain pending until approval, and can then access the portal. Admin controls approval, suspension and role assignment. | 90% | Finish production account-hardening checks and confirm phone/identity verification requirements. |
| **Principal Member and family hierarchy:** Admin alone assigns Principal status. A Principal manages attached spouses, children and dependants from My Family; non-principals cannot create a branch. Relationships, invitations and record-only members are supported. Admin-controlled transfers create permanent branch history, database constraints prevent invalid/self-linked branch shapes, and duplicate attachment rules are enforced. | 100% | Functional scope is implemented and the production schema is up to date. Continue regression and UAT coverage as the surrounding member experience evolves. |
| **Family invitations and child-to-adult transition:** An attached adult can be invited to activate a login without creating a duplicate family record; children may remain record-only. Invitation acceptance, expiry and explicit revocation are enforced; the adulthood threshold is admin-configurable; record-only adults activate the same family record; and every lifecycle change is retained in transition history. | 100% | Implemented and covered by automated lifecycle and eligibility tests; continue production UAT as part of routine family-workflow regression. |
| **Profile privacy and member directory:** Private data is kept out of public pages and sensitive profile fields are protected. | 35% | Build the member-only directory, field-level visibility records, Principal approval/revocation controls, optional review expiry, and child-specific hidden-by-default rules. |
| **Member status and retention:** Member records support lifecycle statuses and should be archived rather than deleted when referenced by finance, welfare, meetings or audit history. | 70% | Align all guide statuses, enforce retention rules in destructive actions, and document the approved retention period. |

## 3. Payments, contributions and finance

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Contribution and payment recording:** Members and authorized finance officers can record KES payments with method, reference, date and category; members can view their own history and statements. | 80% | Align the capture form with the guide’s proof requirements and Pending/Verified/Rejected language, strengthen duplicate-reference checks, and audit all on-behalf entries. |
| **Configurable payment purposes:** Finance categories provide the basis for registration, subscription, welfare, funeral, wedding, dowry, medical, project, education and community purposes. | 60% | Add/confirm the complete seeded purpose list, active/sort controls, optional fixed amounts and due dates, and require an active purpose on every payment. |
| **Verification, reconciliation and reporting:** Treasurer tools cover reconciliation, ledger records, reversals, member statements and finance summaries. | 80% | Complete branch-level reporting, rejected/needs-correction flow, specialized welfare reports, and polished Excel/PDF exports. |
| **Official payment destination:** The site should display the active group bank/paybill details from an Admin-controlled setting with change history. | 20% | Obtain approved account details, add finance-setting history and authorization, and replace any repeated or hard-coded account information. |
| **Fund allocation and disbursement controls:** Incoming funds may be split using a configurable rule; outgoing funds require approved authorization and audit records. | 40% | Implement the configurable 20% emergency / 80% reserve rule with version history, confirm approvers, and harden disbursement approval gates. |
| **Principal branch finance view:** A Principal should see a permitted summary of payments made by the Principal and attached members. | 25% | Add derived branch reporting, privacy rules, filters and the Member-dashboard branch summary. |

## 4. Activities, meetings and communication

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Events and calendar:** Events contain dates, venue, audience, RSVP, attendance, reminders, reports and public/private controls. | 85% | Complete the combined month/week/list experience and validate branch-specific audiences. |
| **Today’s Activities:** Active registered members should receive a private daily feed for family, welfare, training, project and committee activities. | 20% | Build the feed and dashboard widget, enforce active-member access, and support filtering by branch, role or invitation. |
| **Meetings and records:** Secretary tools manage notices, agenda, minutes, attendance, decisions, action points, documents and Word/PDF output. | 90% | Add a stronger explicit event-to-meeting link and complete final workflow/UAT checks. |
| **Announcements and notifications:** Targeted in-app announcements and email delivery are available with templates, preferences and retry records. | 85% | Confirm mandatory-notice policy and delivery monitoring. SMS and WhatsApp remain deferred unless approved. |

## 5. Resources, welfare and projects

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Document and resource repository:** Authorized users can manage governance, meeting, finance and project files with categories, versions, access levels, secure downloads and audit history. | 85% | Expand welfare/education/health/archive categories, add tags and richer search, complete preview support, and record a backup restore drill. |
| **Resource security and retention:** Files use access checks, type/size validation, version history and archive states instead of silent overwrites. | 75% | Add malware scanning if supported, finalize retention rules, and test restore and sensitive-download logging. |
| **Welfare management:** Members can submit welfare requests and authorized officers can review and process them. | 75% | Add confidentiality levels, family-beneficiary links and a configurable multi-approver workflow if the committee requires it. |
| **Project management:** Projects support owners, budgets, milestones, updates, investments, comments and supporting documents. | 85% | Complete education/health/community resource views and final project-reporting polish. |

## 6. Security, quality and launch

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Authentication and account security:** Supabase Auth, session validation, password recovery, rate-limit infrastructure and login history protect account access. | 80% | Complete privileged-role MFA, phone verification if required, production rate-limit coverage, session-policy tests and seed-account shutdown verification. |
| **Authorization, privacy and audit:** Server-side role checks, RLS policies, private file access and audit logs protect sensitive actions and data. | 80% | Extend tests for Principal/family/privacy rules, capture all visibility changes, verify finance approval separation, and complete a public-PII audit. |
| **Responsive design and accessibility:** The existing Blueprint visual system and responsive layouts are in place. | 70% | Run mobile/tablet/desktop UAT, keyboard and screen-reader checks, contrast review and automated accessibility tests. |
| **Operations and production readiness:** Environment validation, migrations, health checks, logging and backup guidance exist. | 65% | Use a separate staging environment, deploy outstanding migrations, configure monitoring, perform and record restore testing, complete UAT, and obtain production approval. |

## 7. Overall progress

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Whole platform:** Public pages and the existing portal modules are mature; the largest remaining work is profile privacy/directory, Today’s Activities, finance configuration/allocation, branch finance reporting and production QA. | **About 71%** | Complete the priority plan below, verify percentages through acceptance testing, and update this estimate after each signed-off phase. |

## 8. Priority implementation plan

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **P1 — Family foundation:** Principal assignment, attached members, invitations, record-only members, My Family, Admin transfers, permanent branch history and database constraints are implemented. | 100% | The core hierarchy is complete. Child-to-adult account activation remains covered by the invitation/account workflow and should receive continued UAT. |
| **P2 — Deliver member privacy experience:** Private portal basics exist. | 35% | Implement profile visibility, safe-field allowlists, child privacy, the member directory and Today’s Activities. |
| **P3 — Complete finance upgrade:** Ledger, contributions, reconciliation and statements exist. | 60% | Finish purposes, official account settings/history, payment proof/verification, branch summaries and configurable fund allocation. |
| **P4 — Polish governance resources:** Documents, meetings, events and announcements are largely implemented. | 85% | Improve categories/search/preview, event-meeting links and resource backup/restore verification. |
| **P5 — Complete welfare and projects:** Both modules are functional. | 80% | Add confidentiality/approvals and finish specialized resource/reporting views. |
| **P6 — QA and launch:** Build and operations foundations exist. | 65% | Complete accessibility, security testing, staging migration, restore drill, UAT, monitoring and approved production deployment. |

## 9. Decisions still required

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Finance policy:** The system can keep values configurable. | 30% | Confirm official account details, payment purposes, fixed amounts/due dates, the 20/80 allocation rule and the required disbursement approvers. |
| **Membership and privacy policy:** Safe defaults are defined in the guide. | 30% | Confirm adult-login age, attached-adult payment rights, visible directory fields, transfer policy and retention periods. |
| **Roles and communications:** Current roles and email/in-app notifications exist. | 70% | Confirm the final permission matrix, whether Auditor is required, welfare approvers, and whether SMS/WhatsApp belongs in this release. |

## 10. Explicit non-goals unless separately approved

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Separate Principal dashboard:** Not required. Principal tools remain inside the Member dashboard. | 100% | No work planned. |
| **Visual redesign:** Not required. The Deep Navy, Orange, off-white and Sora/Inter direction remains. | 100% | No work planned beyond accessibility and consistency fixes. |
| **Website custody of group funds:** Not approved. The platform records and reconciles payments unless a separate gateway project is authorized. | 100% | A future gateway would require its own security, legal and governance approval. |
| **Permanent deletion of referenced history:** Not allowed for member, finance, welfare, governance or audit records. | 100% | Implement any remaining archive/status enforcement instead of hard delete. |

## Document control

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Implementation status document:** Consolidated from many small tables into system-level features with three columns. | 100% | Review and update percentages after each implementation phase and acceptance-test cycle. |
