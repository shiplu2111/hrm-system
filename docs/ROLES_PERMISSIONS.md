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

## 4. Enforcement

- Every API endpoint declares its required module + action explicitly (see RULES.md §7 — no endpoint is open by default).
- Permission checks happen server-side on every request; UI-level hiding of buttons is a UX convenience only, never the actual access control.
- Approval/finalize actions re-verify permission at execution time, not just at UI-render time, to prevent stale-token abuse (see AUTH_FLOW.md §10).

## 5. Scoping

Beyond module/action, some roles are further scoped:
- **Manager**: scoped to their reporting hierarchy (direct + indirect reports) — derived from `employees.manager_id` tree, not a static list.
- **Employee**: scoped to their own records only.
- Scoping rules must be enforced at the query layer alongside tenant_id scoping (see RULES.md §1).

## 6. Approval Workflow Integration

Roles feed into the configurable Approval Workflow Engine (see MODULES.md §35): a workflow step references a role or a specific person (e.g. "direct manager"), not a hard-coded user.

## 7. Role Assignment

- An employee can hold exactly one primary role for permission purposes (MVP); multi-role support can be considered post-MVP if a client requires it.
- Role changes are audit-logged (see AUDIT_LOG.md).
