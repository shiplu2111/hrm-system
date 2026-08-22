# ROLES_PERMISSIONS.md — Role & Permission Matrix

Defines what each role can see and do, per module. **As of this revision, roles and permissions are dynamic** — managed from the Admin Panel by `super_admin`, backed by the `roles` / `permissions` / `role_permissions` tables (`DATABASE_SCHEMA.md` §1), not a hardcoded enum. The matrix below documents the **default seed data** for the four system roles — what gets inserted into `role_permissions` when the database is first migrated — and is also the reference `admin` UI-hiding logic and backend permission guards implement against by default. `super_admin` can edit any role's permissions (including the seeded four) or create entirely new custom roles from the Admin Panel, without a code deploy — see §6.

---

## 1. Roles

| Role (`slug`) | `is_system_role` | Description |
|---|---|---|
| `super_admin` | true | System owner/IT admin — full access, module configuration, only role that can manage other roles |
| `hr` | true | Manages employees, payroll, leave, recruitment org-wide |
| `manager` | true | Manages their own reporting-chain team only |
| `employee` | true | Self-service access to their own data only |
| *(custom roles)* | false | Created ad hoc by `super_admin` — e.g., "Field Technician", "Payroll Officer" — start with zero permissions and are configured entirely through the Roles & Permissions admin UI (§6) |

These four are seeded automatically at first migration (`MIGRATIONS.md` §6) and cannot be deleted (`is_system_role = true` protects them), but their *permission set* can still be edited by `super_admin` — e.g., an org could strip `payroll.view_all` from the seeded `hr` role if they want a narrower default, though this isn't recommended without understanding the downstream impact on §5's matrix.

A user has exactly one `role_id` (`DATABASE_SCHEMA.md` §1) — no multi-role/role-combination in v1. 🔶 If a person needs both Manager and HR-level access, the recommended v1 approach is now straightforward given dynamic roles: `super_admin` creates a custom role (e.g., "Senior Manager") that's a copy of Manager's permission set plus the specific HR permissions needed, rather than waiting for a future multi-role schema change. True multi-role-per-user remains a possible future schema change if this pattern proves insufficient, but is no longer a hard blocker the way it was under the old static-enum design.

**Employee role and web access:** the `employee` role (and any custom role) is not tied to a specific client app — the same `role_id`/permission set applies whether the user logs in via the mobile app or the web app (`ARCHITECTURE.md` §6 — employees can now log in on `apps/admin`'s web app for self-service, not mobile-only). Permission checks are identical across both clients; only the *UI surface area* differs (mobile shows a tab-based self-service view per `NAVIGATION.md`, web shows a role-scoped subset of the same web app per `UI_GUIDELINES.md` §6).

---

## 2. Permission Keys & Scope

Permissions are stored as dot-notation keys (`DATABASE_SCHEMA.md` §1's `permissions.key`, e.g., `payroll.approve`, `employee.view_team`, `system.settings.manage`) grouped by `module`. The ✅/👁/🔒/👥/⚙️/❌ symbols used throughout this document's matrix (§2.1 below) map directly to a permission key **plus** a `scope` value (`all` / `team` / `own`, stored on `role_permissions.scope`) — not to separate keys. For example, "view attendance" is one permission key (`attendance.view`) that can be granted with `scope: all` (HR), `scope: team` (Manager), or `scope: own` (Employee) depending on the role — the matrix cells below are the human-readable rendering of that key+scope combination per role.

### 2.1 Permission Levels (used throughout the matrix)

| Symbol | Meaning | `role_permissions.scope` |
|---|---|---|
| ✅ Full | Create, read, update, delete/cancel as applicable | `all` |
| 👁 View | Read-only | `all` |
| 🔒 Own | Limited to the user's own record | `own` |
| 👥 Team | Limited to employees in the manager's reporting chain | `team` |
| ⚙️ Approve | Can approve/reject, not necessarily create | `all` or `team` (context-dependent, see individual rows) |
| ❌ None | No access | *(no row in `role_permissions` for this key+role)* |



---

## 3. Employee Management

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| View employee list (org-wide) | ✅ | ✅ | 👥 Team only | ❌ |
| View own profile | ✅ | ✅ | ✅ | 🔒 Own |
| Create employee | ✅ | ✅ | ❌ | ❌ |
| Edit employee profile (name, contact) | ✅ | ✅ | ❌ | 🔒 Own (limited fields — contact info only, not employment status/department) |
| Edit employment status/department/designation | ✅ | ✅ | ❌ | ❌ |
| Upload/view employee documents | ✅ | ✅ | 👥 Team (view only) | 🔒 Own |
| Deactivate/exit an employee | ✅ | ✅ | ❌ | ❌ |

---

## 4. Attendance & Location

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Check in / check out | N/A (admin, not mobile self-check-in role) | N/A | N/A | ✅ (self) |
| View attendance records (org-wide) | ✅ | ✅ | 👥 Team only | ❌ |
| View own attendance history | ✅ | ✅ | ✅ | 🔒 Own |
| View raw GPS coordinate history | ✅ | ✅ | ❌ (sees status/validity only, not raw coordinates — per `SECURITY.md` §4) | ❌ |
| Configure office locations / geofence radius | ✅ | ✅ | ❌ | ❌ |
| Configure shifts | ✅ | ✅ | ❌ | ❌ |
| Submit regularization request | N/A | N/A | 🔒 Own | 🔒 Own |
| Approve/reject regularization request | ✅ | ✅ | ⚙️ Team only | ❌ |

---

## 5. Leave Management

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Apply for leave | N/A | N/A | 🔒 Own | 🔒 Own |
| View leave balance | ✅ (all) | ✅ (all) | 👥 Team | 🔒 Own |
| Configure leave types / annual allocation | ✅ | ✅ | ❌ | ❌ |
| Approve/reject leave (first-level) | ✅ | ✅ | ⚙️ Team only | ❌ |
| Approve/reject leave (final, if org uses two-step) | ✅ | ✅ | ❌ | ❌ |
| View leave calendar (org-wide) | ✅ | ✅ | 👥 Team only | 🔒 Own + team calendar view (read-only, names only, no reasons) |

---

## 6. Payroll

The most restricted module — salary visibility is need-to-know only.

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| View own payslip | ✅ | ✅ | ✅ | 🔒 Own (only once `disbursed`, per `PAYROLL_LOGIC.md` §8) |
| View any employee's salary/payslip | ✅ | ✅ | ❌ | ❌ |
| Configure salary structure per employee | ✅ | ✅ | ❌ | ❌ |
| Configure deduction rules (tax/PF/insurance) | ✅ | ✅ | ❌ | ❌ |
| Prepare payroll run (`draft`) | ✅ | ✅ | ❌ | ❌ |
| Approve payroll run | ✅ (different user than preparer — maker-checker, `SECURITY.md` §5) | ✅ (different user than preparer) | ❌ | ❌ |
| Trigger disbursement | ✅ | ✅ (if approved) | ❌ | ❌ |
| View payroll cost reports | ✅ | ✅ | ❌ (managers do not see cost/salary data, per `PRD.md` §3.5 access intent) | ❌ |
| Edit bank account details | ✅ | ✅ | ❌ | 🔒 Own (requires password re-auth per `SECURITY.md` §5, `AUTH_FLOW.md`) |

**Note:** HR and Super Admin are the *only* roles with salary visibility by design — Managers approving leave/attendance for their team do not need to see what their team members earn. If a specific org needs manager-level payroll visibility, that's a configuration change to be scoped explicitly, not a default.

---

## 7. Recruitment & Onboarding

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Create job requisition | ✅ | ✅ | ❌ (can request via HR, not directly create) | ❌ |
| Manage candidate pipeline | ✅ | ✅ | 👁 View only (their own requisitions) | ❌ |
| Convert candidate → employee | ✅ | ✅ | ❌ | ❌ |
| Manage onboarding checklist | ✅ | ✅ | 👁 View only (own team) | 🔒 Own (view/complete own checklist items) |

---

## 8. Performance Management

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Configure appraisal cycles | ✅ | ✅ | ❌ | ❌ |
| Set goals for own team | ✅ | ✅ | ✅ (team) | 🔒 Own (propose, manager finalizes) |
| Submit self-review | N/A | N/A | ✅ (own) | 🔒 Own |
| Submit manager review | ✅ | ✅ | ✅ (team) | ❌ |
| View performance history | ✅ (all) | ✅ (all) | 👥 Team | 🔒 Own |

---

## 9. Training & Development

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Create training program | ✅ | ✅ | ❌ | ❌ |
| Enroll employees | ✅ | ✅ | 👥 Team (nominate) | 🔒 Own (self-enroll if open) |
| Track completion | ✅ (all) | ✅ (all) | 👥 Team | 🔒 Own |

---

## 10. Offboarding

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Initiate exit request | ✅ | ✅ | ⚙️ Team (initiate, HR processes) | 🔒 Own (resignation request) |
| Approve exit / process final settlement | ✅ | ✅ | ❌ | ❌ |
| Manage asset return checklist | ✅ | ✅ | 👁 View (team) | 🔒 Own |

---

## 11. Reports & Analytics

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Attendance reports (org-wide) | ✅ | ✅ | 👥 Team only | ❌ |
| Payroll cost reports | ✅ | ✅ | ❌ | ❌ |
| Leave utilization reports | ✅ | ✅ | 👥 Team only | ❌ |

---

## 12. System Administration

| Action | Super Admin | HR | Manager | Employee |
|---|---|---|---|---|
| Manage user roles/permissions | ✅ | ❌ | ❌ | ❌ |
| Configure system-wide settings (departments, designations, office locations) | ✅ | ✅ (departments/designations only, not geofence/security config) | ❌ | ❌ |
| View audit logs | ✅ | 👁 View (non-security-critical entries only — e.g., not JWT secret rotations) | ❌ | ❌ |
| Revoke any user's biometric device | ✅ | ✅ | ❌ | 🔒 Own devices only |

---

## 13. Implementation Notes

### 13.1 Backend Enforcement
- Every controller route uses `@RequirePermission('module.action')` (a custom decorator + guard) instead of the old `@Roles('hr')` pattern — the guard checks whether the current user's `role_id` has that permission key in `role_permissions`, not whether their role name matches a hardcoded string. This is what makes custom roles (§6) work without touching controller code.
- The guard also reads `role_permissions.scope` for the matched permission and injects the resulting filter requirement (`all` / `team` / `own`) into the request context — the service layer then applies the actual query-level filter (see below). The guard itself only answers "is this action allowed at all," not "which rows" — that's still the service's job.
- "Team" scope is **not** a permission check alone — it requires a query-level filter joining through `employees.reporting_manager_id` (`DATABASE_SCHEMA.md` §2), not just gating by scope value. A scope check without the team filter is a bug, not a simplification.
- "Own" scope similarly requires filtering by `employee_id = current_user.employee_id`, not just the scope value.
- Permission checks should be cached per-request (fetched once per authenticated request, not re-queried per guard invocation within the same request) for performance, but never cached across requests without an invalidation path — a role's permissions changing in the admin UI must take effect on the *next* request, not require the affected users to log out/in. See `SYSTEM_SETTINGS.md` §3's cache-invalidation-on-write pattern for the same principle applied here.

### 13.2 Frontend Behavior
- Per `UI_GUIDELINES.md` §6, the `usePermissions()` hook now fetches the current user's **actual permission key list** (returned as part of login/session response, e.g., `["payroll.approve", "attendance.view:team", ...]`) rather than checking a hardcoded role name — this is what allows a custom role's UI to correctly show/hide elements without a frontend code change either. Every action still calls the real API, which independently enforces the same rule server-side (§13.1) — frontend hiding is UX convenience, not the security boundary.

### 13.3 Multi-Level Approval (Leave)
- Row 5 references a possible two-step leave approval (Manager → HR). 🔶 Open decision: is two-step approval required for all leave types, or configurable per leave type/duration (e.g., HR sign-off only required for leave longer than N days)? Default v1 assumption: single-step (Manager approves, HR notified) unless flagged otherwise in `PRD.md`.

### 13.4 Custom Role Creation Workflow (Admin Panel — referenced as "§6" elsewhere in this document)

From Settings → Roles & Permissions (`SYSTEM_SETTINGS.md` §7):
1. `super_admin` clicks "Create Role" → names it (e.g., "Field Technician"), sets a `slug`
2. New role starts with **zero permissions** — nothing is inherited by default, to avoid accidentally over-granting
3. `super_admin` checks permission keys from the full catalog (grouped by `module`, per `DATABASE_SCHEMA.md` §1's `permissions.module`), optionally setting `scope` (`all`/`team`/`own`) per key where scope is applicable
4. Save → the role is immediately assignable to any `users` row from the Employee/User management screen
5. Editing an existing role's permissions (including the 4 seeded system roles) follows the same UI, with a warning shown before saving if the edit would remove a permission currently relied upon by users of that role (e.g., stripping `attendance.check_in` from `employee` — a genuinely destructive edit that should require explicit confirmation)

- A "Clone Role" action (copy an existing role's full permission set as the starting point for a new custom role) is a recommended addition per §1's multi-role workaround pattern.

---

## 14. Open Decisions

- [x] ~~Multi-role support~~ — resolved via custom roles (§1) as the recommended v1 workaround; true multi-role-per-user remains a possible future schema change if needed
- [ ] Leave approval: single-step vs. configurable two-step (§13.3)
- [ ] Whether managers should ever get scoped payroll cost visibility (e.g., their team's total cost without individual salaries) — currently ❌ by default per §6, but is now trivially achievable as a custom-role variant (§6) if a specific org needs it, without a schema/code change
- [ ] Audit log visibility detail for HR role — which entries are "security-critical" and excluded (§12)
