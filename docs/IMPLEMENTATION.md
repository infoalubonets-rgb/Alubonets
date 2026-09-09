# Alubonets Website Upgrade — Implementation Status

**Source:** Alubonets Self-Help Group Website Upgrade Structure & Developer Guide, plus the later Simple Software Requirements Specification (sections 1–25)<br>
**Target:** on or before 5 September 2026<br>
**Status basis:** 9 September 2026 implementation pass against the SRS audit batches<br>
**Confirmed UI decision:** Principal Members use the existing Member dashboard with additional family features. There is no separate Principal dashboard.

Welfare requests now require Treasurer **and** Executive approval, with self-approval barred and a Confidential flag for officer-only details. MFA enrollment issues one-time recovery codes. Admin Roles can deactivate catalogue roles (except Admin). Allocation percentages are snapshotted onto recorded contributions. Financial exports default to the current calendar year.

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
| **Secure member portal:** Approved members sign in to view dashboards, contributions, events, projects, welfare, governance documents and announcements. Pending or inactive accounts are restricted. Directory and Today’s Activities are available. | 95% | Complete end-to-end access testing for every account state. |
| **Role workspaces:** Admin, Treasurer, Secretary, Organizer and Executive users receive role-specific dashboards and server-enforced permissions. | 95% | Confirm the final office-bearer permission matrix, decide whether an Auditor role is required, and test least-privilege rules across all APIs. |

## 2. Membership, family branches and privacy

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Registration and approval:** People register as ordinary members, remain pending until approval, and can then access the portal. Admin controls approval, suspension and role assignment. Rejected applicants are soft-retained. | 95% | Confirm phone/identity verification requirements for production. |
| **Principal Member and family hierarchy:** Admin alone assigns Principal status. A Principal manages attached spouses, children and dependants from My Family; non-principals cannot create a branch. Relationships, invitations and record-only members are supported. Admin-controlled transfers create permanent branch history. | 100% | Continue regression and UAT coverage. |
| **Family invitations and child-to-adult transition:** Attached adults can be invited to activate a login; children may remain record-only. Invitation acceptance, expiry and revocation are enforced. Age-based auto-transition remains a product decision (admin age setting was intentionally removed). | 95% | Confirm whether an adulthood age rule should return. |
| **Profile privacy and member directory:** Member-only `/directory`, field-level `profile_visibility`, Principal grant/revoke, child hidden-by-default, and audit of visibility changes. | 95% | Committee confirmation of the final visible-field list and review cadence. |
| **Member status and retention:** Statuses include Pending, Active, Inactive, Suspended, Deceased, Resigned and Disqualified. Rejected applicants are retained rather than hard-deleted. | 95% | Document the approved retention period. |

## 3. Payments, contributions and finance

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Contribution and payment recording:** Members and authorized finance officers can record KES payments with method, reference, date and category; members can view history and statements with year/purpose/status filters. | 90% | Strengthen duplicate-reference checks in UAT. |
| **Configurable payment purposes:** Finance categories cover registration, subscription, welfare, funeral, wedding, dowry, medical, project, education and community purposes. | 90% | Confirm fixed amounts/due dates if the committee requires them. |
| **Verification, reconciliation and reporting:** Treasurer tools cover pending verify/reject, reconciliation, ledger records, member statements, CSV and Excel exports. | 90% | Final polished PDF statement branding review. |
| **Official payment destination:** Admin-controlled bank/paybill settings with version history, shown on Payments & Statements. | 95% | Obtain and publish the live approved account details. |
| **Fund allocation and disbursement controls:** Configurable emergency/reserve allocation rule with version history; Admin no longer auto-bypasses disbursement approval thresholds. | 90% | Confirm the live 20/80 values and approvers. |
| **Principal branch finance view:** Branch payment summary on My Family for Principal Members. | 90% | Privacy-rule UAT with attached-member sample data. |

## 4. Activities, meetings and communication

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Events and calendar:** Month and week calendar views; audience includes public, all members, roles, selected members and family branch. | 95% | Combined activities+meetings calendar polish if required. |
| **Today’s Activities:** Private daily feed at `/today` with Member dashboard widget and role/branch audience. | 95% | Committee content guidelines for who may publish. |
| **Meetings and records:** Secretary tools manage notices, agenda, minutes and documents; meetings can link to an event. | 95% | Final workflow/UAT checks. |
| **Announcements and notifications:** Targeted in-app announcements and email delivery with templates, preferences and retry records. | 85% | Confirm mandatory-notice policy. SMS and WhatsApp remain deferred. |

## 5. Resources, welfare and projects

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Document and resource repository:** Categories include Welfare, Education, Health and Archive; tags, tag search and in-app PDF preview are available. | 90% | Malware scanning if a provider is approved. |
| **Resource security and retention:** Access checks, type/size validation, version history and archive states. | 80% | Finalize retention rules and complete restore drill sign-off. |
| **Welfare management:** Members can submit welfare requests and authorized officers can review and process them. | 75% | Confidentiality levels / multi-approver chain only if committee confirms. |
| **Project management:** Projects support owners, budgets, milestones, updates, investments, comments and supporting documents. | 85% | Final project-reporting polish. |

## 6. Security, quality and launch

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Authentication and account security:** Privileged MFA, durable account lock after failures, idle session timeout, production bypass/autofill lockdown, rate limits and login history. | 90% | Phone verification if required; privileged MFA enrollment UAT. |
| **Authorization, privacy and audit:** Server-side role checks, private file access and audit logs including visibility and finance destination changes. | 90% | Extended Principal/privacy regression suite. |
| **Responsive design and accessibility:** Blueprint visual system and responsive layouts are in place. | 70% | Run mobile/tablet/desktop UAT, keyboard and screen-reader checks. |
| **Operations and production readiness:** Environment validation, migrations, health checks, backup restore drill template and launch checklist in Operations. | 85% | Execute staging restore drill, monitoring and production approval. |

## 7. Overall progress

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Whole platform:** Core Upgrade Guide gaps for privacy/directory, Today’s Activities, finance configuration, calendar polish and security hardening are implemented. | **About 90%** | Complete committee decisions, staging restore drill, accessibility UAT and production cutover. |

## 8. Priority implementation plan

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **P1 — Family foundation** | 100% | Continued UAT. |
| **P2 — Member privacy experience** | 95% | Committee field-list confirmation. |
| **P3 — Finance upgrade** | 90% | Live account details and final purpose policy. |
| **P4 — Governance resources** | 95% | Restore drill sign-off. |
| **P5 — Welfare and projects** | 80% | Optional confidentiality/multi-approver. |
| **P6 — QA and launch** | 85% | Staging, a11y UAT, monitoring, production approval. |

## 9. Decisions still required

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Finance policy** | 60% | Confirm official account details, fixed amounts/due dates, live 20/80 values and disbursement approvers. |
| **Membership and privacy policy** | 70% | Confirm visible directory fields, transfer policy and retention periods. |
| **Roles and communications** | 75% | Confirm Auditor role, welfare approvers, and whether SMS/WhatsApp belongs in this release. |

## 10. Explicit non-goals unless separately approved

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Separate Principal dashboard** | 100% | No work planned. |
| **Visual redesign** | 100% | No work planned beyond accessibility and consistency fixes. |
| **Website custody of group funds** | 100% | Gateway would require separate approval. |
| **Permanent deletion of referenced history** | 100% | Soft retention / status enforcement is the default. |

## Document control

| System feature | Completed | Missing / not yet implemented |
|---|---:|---|
| **Implementation status document** | 100% | Update after each acceptance-test cycle. |
