# Super Admin Platform Page Index & Role Access Control Matrix

This document provides the definitive specification of the Super Admin (Platform Operator) control plane in CMSN-HR. It catalogues every platform page, required RBAC permission (`module:action`), expected access for each platform staff role, and verified security controls protecting sensitive, mutating, and destructive operations.

---

## 1. Platform Staff Roles & Responsibilities

The CMSN-HR platform control plane defines seven built-in system roles operating under root scope (`aud: platform`). Multi-tenant isolation is strictly maintained (`@SkipTenantScope()` on platform endpoints with JWT platform session authentication).

| Role Name | Scope & Authority | Primary Responsibilities |
|---|---|---|
| **Platform Owner** | Full Platform Wildcard (`*`) | Executive superuser; full control over all modules, staff invitations, role creation, break-glass recovery, dual-control restore approvals, and deletion schedules. Protected by the *Last Active Owner* invariant. |
| **Platform Admin** | Operational Administrator | Day-to-day operations across all operational domains: tenant lifecycles, job queues, rule approvals, feature flags, API keys, webhook deliveries, backups, and maintenance windows. |
| **Billing Admin** | Invoicing & Revenue Control | Tenant subscriptions, plan tiers, payment gateways, invoice management, MRR/ARR analytics, financial churn tracking, and billing audit logs. |
| **Support Agent** | Tenant Support & Escalations | Cross-tenant support ticket queue management, internal collaboration notes, global knowledge base curation, and time-boxed audited tenant impersonation sessions (`support:impersonate`). |
| **Compliance Admin** | Statutory & Regulatory Governance | Statutory labor baselines, country-level tax bracket versions, compliance calendar, four-eyes rule approval workflows, payroll calculation sandbox simulation, and currency exchange rates. |
| **Sales** | Commercial Pipeline & Leads | Triage website sales leads, demo requests, and contact messages; filter pipeline; assign staff; add notes; transition statuses (`new`, `contacted`, `qualified`, `closed`); export CSV. Restricted from tenant operations, billing, staff roles, and support access. |
| **Read-Only Auditor** | Independent Compliance & Audit | Read-only inspection access across all operational, financial, and compliance domains; immutable platform audit log review; CSV export. All mutating, editing, or destructive actions are strictly blocked. |

---

## 2. Platform Page Directory (32 Pages)

The platform application contains 32 distinct administrative views organised into five logical groups.

| # | Group | Page Title | Navigation Key | Route / View | Required Permission | Description |
|---|---|---|---|---|---|---|
| 1 | Overview | Platform Overview | `dashboard` | `#/dashboard` | `platform:view` | Multi-tenant health metrics, aggregate MRR, tenant activity feed. |
| 2 | Overview | System Health | `system-health` | `#/system-health` | `platform:view` | Cluster health, DB pool utilization, Redis latency, system load. |
| 3 | Overview | Job Queue Inspector | `queue-inspector` | `#/queue-inspector` | `platform:edit` | BullMQ queues, active/waiting/failed jobs, retry and safe clean. |
| 4 | Tenants | Tenants Directory | `tenants` | `#/tenants` | `tenant:view` | Cross-tenant workspace directory, lifecycle status, search, and detail. |
| 5 | Tenants | Usage & Storage | `usage-storage` | `#/usage-storage` | `tenant:view` | Per-tenant employee counts, S3 storage quotas, saturation detection. |
| 6 | Tenants | Sandbox Tenants | `sandbox-tenants` | `#/sandbox-tenants` | `tenant:view` | Demo environments seeded with sample data for sales & staging demos. |
| 7 | Tenants | Provision Tenant | `tenant-provisioning` | `#/tenant-provisioning` | `tenant:create` | Onboard and configure isolated tenant workspaces and root admins. |
| 8 | Tenants | Tenant Isolation | `tenant-isolation` | `#/tenant-isolation` | `tenant:view` | Verification of RLS policies, PostgreSQL schemas, and security boundaries. |
| 9 | Tenants | Branding & Custom Domains | `branding-domains` | `#/branding-domains` | `tenant:view` | Tenant branding inspection, custom domain CNAME/DNS verification, plan gates. |
| 10 | Billing | Subscriptions & Plans | `billing` | `#/billing` | `billing:view` | Tier definitions, seat caps, plan upgrades, and payment gateways. |
| 11 | Billing | Revenue & Financial Reports | `billing-invoices` | `#/billing-invoices` | `billing:view` | MRR, ARR, expansion/churn movements, country revenue breakdown, CSV. |
| 12 | Compliance | Country Configuration | `country-compliance` | `#/country-compliance` | `country:view` | Statutory labor rules, tax brackets, and official holiday calendars. |
| 13 | Compliance | Compliance Calendar | `compliance-calendar` | `#/compliance-calendar` | `country:view` | Month and list calendar views, deadline rules, tenant preview. |
| 14 | Compliance | Rule Approvals Inbox | `rule-approvals` | `#/rule-approvals` | `country:view` | Four-Eyes compliance review queue for draft rule versions across countries. |
| 15 | Compliance | Rule Test Sandbox | `rule-sandbox` | `#/rule-sandbox` | `country:view` | Dry-run Rule Resolver and payroll calculations against sample profiles. |
| 16 | Compliance | Default Templates | `provisioning-templates` | `#/provisioning-templates` | `country:view` | Default document types, leave policies, and onboarding checklists. |
| 17 | Compliance | Exchange Rates | `exchange-rates` | `#/exchange-rates` | `country:view` | Platform baseline multi-currency rates and provider sync feeds. |
| 18 | Compliance | Statutory Baselines | `statutory-rules` | `#/statutory-rules` | `compliance:view` | Cross-jurisdiction labor compliance matrices and overtime ceilings. |
| 19 | Operations | Feature Flags | `feature-flags` | `#/feature-flags` | `platform:view` | Tenant rollout rings, experimental module flags, and kill-switches. |
| 20 | Operations | Announcements | `platform-announcements` | `#/platform-announcements` | `platform:view` | Broadcast notifications to tenants, company owners, and staff with severity. |
| 21 | Operations | Platform Audit Logs | `platform-audit` | `#/platform-audit` | `audit:view` | Append-only audit trail of privileged platform staff actions with diffs. |
| 22 | Operations | Support Tickets | `support-tickets` | `#/support-tickets` | `support:view` | Cross-tenant ticket queue, SLA countdowns, and staff assignment. |
| 23 | Operations | Support Sessions Log | `support-sessions` | `#/support-sessions` | `support:view` | Audited log of staff impersonation sessions and action counters. |
| 24 | Operations | Global Knowledge Base | `global-kb` | `#/global-kb` | `support:view` | Cross-tenant articles, categories, and country/plan visibility controls. |
| 25 | Operations | API Apps & Keys | `api-registry` | `#/api-registry` | `platform:view` | Cross-tenant API keys registry, immediate revocation, rate-limit overrides. |
| 26 | Operations | Webhook Monitor | `webhook-monitor` | `#/webhook-monitor` | `platform:view` | Cross-tenant webhook deliveries, retry schedules, redelivery, auto-disable. |
| 27 | Operations | Backups & Restore Requests | `backups-compliance` | `#/backups-compliance` | `setting:view` | Scheduled backup runs, restore testing, dual approval restores, GDPR requests. |
| 28 | Operations | Maintenance & Toggles | `system-notifications` | `#/system-notifications` | `platform:view` | Scheduled maintenance windows, tenant banners, and global kill switches. |
| 29 | Settings | My Account & Security | `my-account` | `#/my-account` | None (Auth) | Manage password, TOTP 2FA, active sessions, and personal login audit. |
| 30 | Settings | Platform Staff & Roles | `platform-users` | `#/platform-users` | `user:view` | Operator accounts, RBAC permissions, and mandatory 2FA enforcement. |
| 31 | Settings | Language Packs | `language-packs` | `#/language-packs` | `platform:view` | Supported languages, translation completeness, and JSON import/export. |
| 32 | Settings | Platform Settings | `platform-settings` | `#/platform-settings` | `setting:view` | Global fallback SMTP, S3 storage buckets, and security thresholds. |
| 53 | Sales & Growth | Leads | `leads` | `#/leads` | `leads:view` (+ Role Gate) | Commercial sales leads and contact messages with status/country/date/source filters, detail & notes, staff assignment, audit-logged status transitions, and CSV export. |
| 54 | Sales & Growth | Demo Requests | `demo-requests` | `#/demo-requests` | `leads:view` (+ Role Gate) | Public Book a Demo requests with qualification filters, assignee routing, call notes, audit timeline, and CSV export. |

---

## 3. Verified Role x Page Access Matrix

The following matrix represents the verified access configuration across all 7 platform staff roles.

> **Legend**:
> - `✓ Granted`: Authorized page access. Route accessible, navigation item visible, API endpoints accessible.
> - `— Denied`: Restricted page. Navigation item hidden from sidebar, route navigation intercepted, API access returns `403 Forbidden`.

| # | Page Name | Key | Platform Owner | Platform Admin | Billing Admin | Support Agent | Compliance Admin | Sales | Read-Only Auditor |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Platform Overview | `dashboard` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted |
| 2 | System Health | `system-health` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 3 | Job Queue Inspector | `queue-inspector` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | — Denied | — Denied |
| 4 | Tenants Directory | `tenants` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 5 | Usage & Storage | `usage-storage` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 6 | Sandbox Tenants | `sandbox-tenants` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 7 | Provision Tenant | `tenant-provisioning` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | — Denied | — Denied |
| 8 | Tenant Isolation | `tenant-isolation` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 9 | Branding & Custom Domains | `branding-domains` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 10 | Subscriptions & Plans | `billing` | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | ✓ Granted |
| 11 | Revenue & Financial Reports | `billing-invoices` | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | ✓ Granted |
| 12 | Country Configuration | `country-compliance` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 13 | Compliance Calendar | `compliance-calendar` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 14 | Rule Approvals Inbox | `rule-approvals` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 15 | Rule Test Sandbox | `rule-sandbox` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 16 | Default Templates | `provisioning-templates` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 17 | Exchange Rates | `exchange-rates` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 18 | Statutory Baselines | `statutory-rules` | ✓ Granted | ✓ Granted | — Denied | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 19 | Feature Flags | `feature-flags` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 20 | Announcements | `platform-announcements` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 21 | Platform Audit Logs | `platform-audit` | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted | — Denied | ✓ Granted |
| 22 | Support Tickets | `support-tickets` | ✓ Granted | ✓ Granted | — Denied | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 23 | Support Sessions Log | `support-sessions` | ✓ Granted | ✓ Granted | — Denied | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 24 | Global Knowledge Base | `global-kb` | ✓ Granted | ✓ Granted | — Denied | ✓ Granted | — Denied | — Denied | ✓ Granted |
| 25 | API Apps & Keys | `api-registry` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 26 | Webhook Monitor | `webhook-monitor` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 27 | Backups & Restore Requests | `backups-compliance` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | — Denied | — Denied |
| 28 | Maintenance & Toggles | `system-notifications` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 29 | My Account & Security | `my-account` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted |
| 30 | Platform Staff & Roles | `platform-users` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | — Denied | — Denied |
| 31 | Language Packs | `language-packs` | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | ✓ Granted | — Denied | ✓ Granted |
| 32 | Platform Settings | `platform-settings` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | — Denied | — Denied |
| 53 | Leads | `leads` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | ✓ Granted | — Denied |
| 54 | Demo Requests | `demo-requests` | ✓ Granted | ✓ Granted | — Denied | — Denied | — Denied | ✓ Granted | — Denied |
| **Total Accessible Pages** | | | **34 / 34** | **34 / 34** | **17 / 34** | **17 / 34** | **18 / 34** | **4 / 34** | **26 / 34** |

---

## 4. Destructive Action Defense-in-Depth Enforcement

To adhere strictly to zero-trust principles, all destructive and state-mutating actions implement two-tier defense:
1. **Client-Side (UI)**: Mutating buttons, switches, and modals are conditionally removed from the DOM using permission hooks (`usePermissions()`, `can(module, action)`). Read-only badges or clean view states are displayed instead.
2. **Server-Side (API)**: Every controller endpoint is guarded with `@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)` and explicit `@RequirePlatformPermission(module, action)`. Calling endpoints directly using an unauthorized JWT yields an immediate `403 Forbidden` response.

### Verification Matrix of Mutating & Destructive Operations

| Protected Operation | Endpoint | Required Permission | Allowed Roles | Disallowed Roles Tested | API Direct Call Result | UI Button Status |
|---|---|---|---|---|:---:|:---:|
| **Revoke Tenant API Key** | `POST /platform/api-registry/keys/:id/revoke` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden (Shows "Read-only") |
| **Revoke OAuth 2.0 Client** | `POST /platform/api-registry/oauth-clients/:id/revoke` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden (Shows "Read-only") |
| **Set Rate-Limit Override** | `POST /platform/api-registry/rate-limits/:tenantId` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden (Shows "Read-only") |
| **Auto-Disable Webhooks** | `POST /platform/webhook-monitor/auto-disable` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden (Modal trigger removed) |
| **Redeliver Outbound Webhook** | `POST /platform/webhook-monitor/deliveries/:id/redeliver` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Toggle Webhook Endpoint** | `PATCH /platform/webhook-monitor/endpoints/:id/status` | `platform:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden (Shows "Read-only") |
| **Suspend Tenant** | `POST /platform/tenants/:id/suspend` | `tenant:edit` + Role Gate | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Schedule Tenant Deletion** | `POST /platform/tenants/:id/schedule-deletion` | `tenant:delete` + Role Gate | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Create KB Category** | `POST /platform/knowledge-base/categories` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Delete KB Category** | `DELETE /platform/knowledge-base/categories/:id` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Publish/Edit KB Article** | `PATCH /platform/knowledge-base/articles/:id` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Issue Impersonation Token** | `POST /platform/support-access/sessions/:id/token` | `support:impersonate` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Revoke Support Session** | `POST /platform/support-access/sessions/:id/revoke` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Hidden |
| **Update Support Ticket** | `PATCH /platform/support-tickets/:id` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Read-only static badges |
| **Reply to Support Ticket** | `POST /platform/support-tickets/:id/messages` | `support:manage` | Platform Owner, Platform Admin, Support Agent | Billing Admin, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Composer form hidden |
| **Trigger Platform Backup** | `POST /platform/backups/runs` | `setting:edit` | Platform Owner, Platform Admin | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Entire page hidden |
| **Approve Tenant Restore** | `POST /platform/backups/restore-requests/:id/approve` | `setting:edit` + Dual Control | Platform Owner, Platform Admin (Dual) | Submitter, Billing Admin, Support Agent, Compliance Admin, Auditor | **403 Forbidden** | Dual control prompt |
| **Approve Rule Version** | `POST /platform/countries/rule-versions/:id/approve` | Four-Eyes Review Gate | Platform Owner, Platform Admin | Rule Submitter, Compliance Admin, Billing Admin, Support Agent, Auditor | **403 Forbidden** | Approve button hidden |
| **Update / Assign Lead or Demo Request** | `PATCH /platform/leads/:kind/:id` | `leads:edit` + Role Gate | Platform Owner, Platform Admin, Sales | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Entire page hidden (Access Restricted) |
| **Export Leads / Demo CSV** | `GET /platform/leads/export` | `leads:view` + Role Gate | Platform Owner, Platform Admin, Sales | Billing Admin, Support Agent, Compliance Admin, Read-Only Auditor | **403 Forbidden** | Entire page hidden |

---

## 5. Security & Governance Invariants

1. **Last Active Platform Owner Protection**:
   The system prevents deleting, modifying permissions of, or deactivating the last active Platform Owner.
2. **Dual-Authorization on Destructive Restores (SYSTEM_SETTINGS.md §3)**:
   A platform restore request (full database or single tenant) initiated by a staff member cannot be approved by that same staff member. A second distinct Platform Owner or Platform Admin must review and approve before job dispatch.
3. **Four-Eyes Principle on Statutory Rules (ROLES_PERMISSIONS.md)**:
   Compliance Admins can author and draft statutory rule versions, but only a distinct Platform Owner or Platform Admin can review the diff and publish the version. The submitter cannot approve their own rule changes.
4. **Time-Boxed Support Sessions with Cryptographic Signatures (Stage D)**:
   All tenant impersonation sessions have a strict 4-hour hard ceiling, require explicit purpose logging, and generate signed audit tokens with automatic revocation upon expiration.
