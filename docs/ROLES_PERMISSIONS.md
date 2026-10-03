# ROLES_PERMISSIONS.md

## 1. Default System Roles

```
Super Admin      -- platform-level, manages tenants/billing, not company data
Company Owner    -- full access within their tenant
HR Admin
Payroll Admin
Manager          -- scoped to their direct/indirect reports
Employee         -- scoped to self (ESS)
Accountant
Recruiter
```

## 2. Custom Roles

Companies can define additional roles (e.g. "Branch Manager", "Payroll Officer", "HR Executive") composed from the same permission primitives — role creation is data-driven, not code-driven.

## 3. Permission Model

```
Role → Module → Action
```

Actions: `view, create, edit, delete, approve, finalize` (not every module uses every action — e.g. only Payroll uses `finalize`).

Example matrix:

| Role | Employee | Leave | Payroll |
|---|---|---|---|
| HR Manager | view, create, edit | view, approve | view |
| Payroll Manager | view | — | view, calculate, edit, approve, finalize |
| Manager | view (own team) | approve (own team) | — |
| Employee | view (self), edit (self, limited fields) | create (self) | view (own payslip) |

The seeded HR Admin role additionally holds `employee:approve` so it can decide contract renewals and promotions (§4).

## 4. Enforcement

- Every API endpoint declares its required module + action explicitly (see RULES.md §7 — no endpoint is open by default).
- Permission checks happen server-side on every request; UI-level hiding of buttons is a UX convenience only, never the actual access control.
- Approval/finalize actions re-verify permission at execution time, not just at UI-render time, to prevent stale-token abuse (see AUTH_FLOW.md §10).
- Read-only reference lookups shared across modules may declare non-sensitive alternatives (`orAnyOf`). Companies, departments, designations, job levels, employment types, teams and cost centres are readable with `settings:view` or `view` on employee, payroll, recruitment, performance, attendance, leave or contractors. Document types accept `employee:view`/`recruitment:view`; holidays accept `attendance:view`/`leave:view`; OT rules accept `attendance:view`. Every mutation on these stays on `settings:create/edit/delete`.
- Approving or rejecting an employee loan (including granting one pre-approved) requires `payroll:approve`, not `payroll:edit`.
- Hiring a candidate (converting an accepted application into an employee) requires `employee:create` in addition to `recruitment:approve`.
- Promotion recommendations: HR approval/rejection requires `employee:approve` and executing an approved promotion requires `employee:edit`, each on top of the performance permission and limited to employees in the actor's data scope (never their own record). The "HR override" on review and 360 steps (editing on behalf of the subject, manager or reviewer) is `performance:edit` held by a company-wide role — not a role-name check.
- Contract renewal approve/reject: company-wide roles need `employee:approve` (default: Company Owner, HR Admin); team-scoped roles (Manager) act through their workflow step and only for employees in their reporting line.
- The admin panel mirrors these rules: each page has a minimum view permission (`apps/admin/src/config/page-permissions.ts`) that drives the sidebar and blocks direct URL access, and every mutating control is gated by the same module + action as the endpoint it calls.

## 5. Scoping

Beyond module/action, some roles are further scoped:
- **Manager**: scoped to their reporting hierarchy (direct + indirect reports) — derived from `employees.manager_id` tree, not a static list.
- **Employee**: scoped to their own records only.
- Scoping rules must be enforced at the query layer alongside tenant_id scoping (see RULES.md §1).

Implementation:
- Each role carries `roles.data_scope` — `all` (company-wide, the default) or `team` (own reporting line). The seeded Manager role is `team`; every other default role is `all`. Custom roles choose it in the role editor ("Data access"). A team-scoped editor can only create or keep roles at `team` — granting company-wide access requires holding it (`DATA_SCOPE_NOT_HELD`).
- The scope travels in the access token (`data_scope`) for the UI; the API resolves it from the database per request (`DataScopeService`) so a change takes effect immediately.
- Team scope = the holder's own employee record plus every active employee below them in the `employees.manager_id` tree. Lists of employee-linked records (employees, leave, attendance, timesheets, rosters, performance, training, documents, contracts, onboarding/offboarding, assets, lifecycle events, H&S incidents, dashboard counts, reports) are filtered to that set; detail and mutating endpoints return `403 OUT_OF_SCOPE` for anyone outside it.
- Approvals exclude the holder's own record — a Manager never approves their own leave, timesheet, promotion or renewal. Workflow steps assigned by role (e.g. "Manager") only accept a team-scoped approver when the requester is in their reporting line; `direct_manager`/`skip_level_manager` steps resolve the specific person.

## 6. Approval Workflow Integration

Roles feed into the configurable Approval Workflow Engine (see MODULES.md §35): a workflow step references a role or a specific person (e.g. "direct manager"), not a hard-coded user.

## 7. Role Assignment

- An employee can hold exactly one primary role for permission purposes (MVP); multi-role support can be considered post-MVP if a client requires it.
- Role changes are audit-logged (see AUDIT_LOG.md).
- Reading the audit log requires `audit:view`, granted by default only to Company Owner, HR Admin and Payroll Admin (see AUDIT_LOG.md §5a).
