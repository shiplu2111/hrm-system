# DATABASE_SCHEMA.md — Data Model

Engine: **PostgreSQL**. ORM: **Prisma** (per `ARCHITECTURE.md` — confirm before scaffolding).

## Conventions (per `RULES.md`)
- Primary key: `id UUID DEFAULT gen_random_uuid()`
- Every table: `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- Soft-delete: `deleted_at TIMESTAMPTZ NULL` on tables with audit/compliance relevance (employees, payroll, attendance)
- Money fields: `DECIMAL(12,2)` — never `FLOAT`
- Table names: snake_case, plural (`employees`, `attendance_records`)
- Foreign keys: explicit `ON DELETE` behavior always defined
- Enums: Postgres native enums where the set is truly fixed; lookup tables where HR may need to configure values (e.g., leave types, departments)

---

## 1. Auth & Identity

### `roles`
Dynamic roles — replaces the old fixed enum. Four rows are seeded by default (`super_admin`, `hr`, `manager`, `employee`, matching `ROLES_PERMISSIONS.md` §1's defaults) but `super_admin` can create additional custom roles from the Admin Panel without a code change.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar, unique | e.g. "HR", "Field Technician" |
| slug | varchar, unique | machine-readable, e.g. `hr`, `field_technician` — used in code where a role must be referenced structurally (see `ROLES_PERMISSIONS.md` §7) |
| is_system_role | boolean | true for the 4 seeded defaults — system roles cannot be deleted, only their permission set edited; custom roles can be freely created/deleted |
| description | text, nullable | |
| created_at / updated_at | timestamptz | |

### `permissions`
The full catalog of grantable permissions, seeded at migration time from the matrix in `ROLES_PERMISSIONS.md`.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| key | varchar, unique | dot-notation, e.g. `payroll.approve`, `employee.view_team`, `system.settings.manage` |
| module | varchar | groups permissions for the admin UI, e.g. `payroll`, `attendance`, `system` |
| description | varchar | human-readable, shown in the Roles & Permissions admin UI |

### `role_permissions`
Join table — which permissions a role has.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| role_id | uuid, FK → roles.id, ON DELETE CASCADE | |
| permission_id | uuid, FK → permissions.id, ON DELETE CASCADE | |
| scope | enum, nullable | `all` \| `team` \| `own` — for permissions where scope matters (e.g., `attendance.view` as `team` for Manager, `all` for HR) — mirrors the ✅/👥/🔒 distinction in `ROLES_PERMISSIONS.md` §2 |
| unique constraint | | (role_id, permission_id) |

### `users`
Core login/auth identity — separate from `employees` profile data.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id | unique, nullable until employee profile created |
| email | varchar, unique | |
| password_hash | varchar | bcrypt |
| pin_hash | varchar, nullable | bcrypt, set post-registration |
| is_pin_enabled | boolean | default false |
| is_biometric_enabled | boolean | default false |
| role_id | uuid, FK → roles.id, ON DELETE RESTRICT | replaces the old static `role` enum column |
| status | enum | active, suspended, deactivated |
| last_login_at | timestamptz, nullable | |
| failed_pin_attempts | int | default 0, resets on success |
| pin_locked_until | timestamptz, nullable | |
| created_at / updated_at | timestamptz | |

### `biometric_devices`
One row per enrolled device per user (supports multiple devices, and revocation).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id, ON DELETE CASCADE | |
| device_id | varchar | device-generated unique identifier |
| public_key | text | for signature verification |
| device_name | varchar, nullable | e.g. "John's iPhone 14" |
| is_active | boolean | default true; false = revoked |
| enrolled_at | timestamptz | |
| revoked_at | timestamptz, nullable | |

### `refresh_tokens`
For rotation + revocation tracking (could also live in Redis — table version shown for durability).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id, ON DELETE CASCADE | |
| token_hash | varchar | never store raw token |
| is_revoked | boolean | default false |
| expires_at | timestamptz | |
| created_at | timestamptz | |

### `audit_logs`
Per `SECURITY.md` Section 7 — append-only.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id, ON DELETE SET NULL | who performed the action |
| action | varchar | e.g. "payroll.approved", "employee.bank_details_changed" |
| entity_type | varchar | e.g. "employee", "payroll_run" |
| entity_id | uuid, nullable | |
| metadata | jsonb, nullable | before/after values, IP, etc. |
| ip_address | varchar, nullable | |
| created_at | timestamptz | |

---

## 2. Employee Management

### `employees`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_code | varchar, unique | human-readable ID, e.g. EMP-0001 |
| full_name | varchar | |
| phone | varchar, nullable | |
| gender | enum, nullable | |
| date_of_birth | date, nullable | |
| national_id | varchar, nullable, encrypted | see `SECURITY.md` |
| department_id | uuid, FK → departments.id, ON DELETE RESTRICT | |
| designation_id | uuid, FK → designations.id, ON DELETE RESTRICT | |
| reporting_manager_id | uuid, FK → employees.id, ON DELETE SET NULL, nullable | self-referential |
| office_location_id | uuid, FK → office_locations.id, ON DELETE RESTRICT | for geofence assignment |
| shift_id | uuid, FK → shifts.id, ON DELETE SET NULL, nullable | |
| joining_date | date | |
| employment_status | enum | active, on_leave, suspended, exited |
| deleted_at | timestamptz, nullable | soft-delete on exit (keep for payroll history) |
| created_at / updated_at | timestamptz | |

### `departments`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | |
| parent_department_id | uuid, FK → departments.id, nullable | for org hierarchy |

### `designations`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| title | varchar | e.g. "Software Engineer" |

### `employee_documents`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| document_type | varchar | e.g. "contract", "national_id", "certificate" |
| file_url | varchar | |
| uploaded_at | timestamptz | |

---

## 3. Attendance & Location

### `office_locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | e.g. "Head Office - Dhaka" |
| latitude | decimal(9,6) | |
| longitude | decimal(9,6) | |
| geofence_radius_meters | int | configurable per site |

### `shifts`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | e.g. "General 9-6" |
| start_time | time | |
| end_time | time | |
| grace_minutes | int | late-marking tolerance |

### `attendance_records`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| check_in_at | timestamptz, nullable | |
| check_in_lat | decimal(9,6), nullable | |
| check_in_lng | decimal(9,6), nullable | |
| check_in_within_geofence | boolean, nullable | server-validated |
| check_out_at | timestamptz, nullable | |
| check_out_lat | decimal(9,6), nullable | |
| check_out_lng | decimal(9,6), nullable | |
| check_out_within_geofence | boolean, nullable | |
| status | enum | present, late, early_leave, absent, on_leave, regularized |
| is_offline_synced | boolean | default false; true if originally queued offline |
| source_device_id | varchar, nullable | for audit/debugging |
| created_at / updated_at | timestamptz | |

### `attendance_regularization_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| attendance_record_id | uuid, FK → attendance_records.id, ON DELETE CASCADE, nullable | nullable if requesting a missing record |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| reason | text | |
| requested_check_in_at | timestamptz, nullable | |
| requested_check_out_at | timestamptz, nullable | |
| status | enum | pending, approved, rejected |
| reviewed_by | uuid, FK → users.id, nullable | |
| reviewed_at | timestamptz, nullable | |
| created_at | timestamptz | |

---

## 4. Leave Management

### `leave_types`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | Casual, Sick, Earned, Unpaid |
| default_annual_days | int | |
| is_paid | boolean | |

### `leave_balances`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| leave_type_id | uuid, FK → leave_types.id, ON DELETE RESTRICT | |
| year | int | |
| allocated_days | decimal(5,2) | |
| used_days | decimal(5,2) | default 0 |
| unique constraint | | (employee_id, leave_type_id, year) |

### `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| leave_type_id | uuid, FK → leave_types.id, ON DELETE RESTRICT | |
| start_date | date | |
| end_date | date | |
| total_days | decimal(5,2) | |
| reason | text, nullable | |
| status | enum | pending, approved, rejected, cancelled |
| approved_by | uuid, FK → users.id, nullable | |
| approved_at | timestamptz, nullable | |
| created_at / updated_at | timestamptz | |

---

## 5. Payroll

### `salary_structures`
Current salary configuration per employee (versioned via `effective_from` for history/raises).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| basic_salary | decimal(12,2) | |
| effective_from | date | |
| effective_to | date, nullable | null = currently active |
| created_at | timestamptz | |

### `salary_components`
Allowances/bonuses attached to a salary structure (flexible, HR-configurable).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| salary_structure_id | uuid, FK → salary_structures.id, ON DELETE CASCADE | |
| component_type | enum | allowance, bonus, deduction |
| name | varchar | e.g. "HRA", "Transport", "Provident Fund" |
| amount | decimal(12,2), nullable | fixed amount |
| percentage | decimal(5,2), nullable | % of basic, if percentage-based |
| is_taxable | boolean | |

### `payroll_runs`
One row per payroll cycle (e.g., per month).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| period_month | int | |
| period_year | int | |
| run_type | enum | `regular` (standard monthly cycle), `settlement` (single-employee final settlement, see `PAYROLL_LOGIC.md` §9) — default `regular` |
| status | enum | draft, pending_approval, approved, disbursed, cancelled |
| prepared_by | uuid, FK → users.id | maker |
| approved_by | uuid, FK → users.id, nullable | checker — must differ from prepared_by, enforced in service layer per `SECURITY.md` |
| approved_at | timestamptz, nullable | |
| disbursed_at | timestamptz, nullable | |
| created_at / updated_at | timestamptz | |
| unique constraint | | (period_month, period_year) — applies only where `run_type = 'regular'` (partial unique index); multiple `settlement` runs can share a period since each covers one exiting employee |

### `payslips`
One row per employee per payroll run — the calculated result.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| payroll_run_id | uuid, FK → payroll_runs.id, ON DELETE CASCADE | |
| employee_id | uuid, FK → employees.id, ON DELETE RESTRICT | keep even if employee later exits |
| gross_salary | decimal(12,2) | |
| total_allowances | decimal(12,2) | |
| total_deductions | decimal(12,2) | |
| tax_amount | decimal(12,2) | |
| overtime_amount | decimal(12,2) | default 0 |
| net_salary | decimal(12,2) | |
| pdf_url | varchar, nullable | generated payslip document |
| created_at | timestamptz | |
| unique constraint | | (payroll_run_id, employee_id) |

### `payslip_line_items`
Breakdown detail per payslip (for transparency/audit).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| payslip_id | uuid, FK → payslips.id, ON DELETE CASCADE | |
| label | varchar | e.g. "Basic", "HRA", "Provident Fund", "Income Tax" |
| type | enum | earning, deduction |
| amount | decimal(12,2) | |

### `loan_advances`
Tracks employee loans/salary advances and their recovery through payroll. Closes the schema gap flagged in `PAYROLL_LOGIC.md` §4.4.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| type | enum | `loan`, `advance` |
| principal_amount | decimal(12,2) | total amount disbursed to the employee |
| installment_amount | decimal(12,2) | amount deducted per payroll period |
| remaining_balance | decimal(12,2) | updated after each payroll deduction |
| start_period_month | int | first month the recovery begins |
| start_period_year | int | |
| status | enum | `active`, `completed`, `cancelled` |
| approved_by | uuid, FK → users.id | HR/Super Admin who approved disbursement |
| created_at / updated_at | timestamptz | |

- `remaining_balance` is decremented by `installment_amount` each time a payroll run successfully processes a deduction for this record — this update happens inside the same payroll calculation transaction as the payslip line item, not as a separate step, to avoid drift between the two (`PAYROLL_LOGIC.md` §4.4).
- Status auto-transitions to `completed` when `remaining_balance` reaches 0.
- The final installment in a payroll run should deduct only the remaining balance if it's less than the standard `installment_amount`, to avoid overshooting into a negative balance.

### `bank_accounts`
Encrypted per `SECURITY.md`.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| bank_name | varchar | |
| account_number | varchar, encrypted | column-level encryption |
| routing_or_branch_code | varchar, nullable | |
| is_primary | boolean | default true |
| updated_at | timestamptz | triggers audit log + notification per `SECURITY.md` |

---

## 6. Recruitment & Onboarding

### `job_requisitions`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| title | varchar | |
| department_id | uuid, FK → departments.id | |
| status | enum | open, closed, on_hold |
| created_by | uuid, FK → users.id | |
| created_at | timestamptz | |

### `candidates`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| job_requisition_id | uuid, FK → job_requisitions.id, ON DELETE CASCADE | |
| full_name | varchar | |
| email | varchar | |
| phone | varchar, nullable | |
| resume_url | varchar, nullable | |
| stage | enum | applied, interview, offer, hired, rejected |
| converted_employee_id | uuid, FK → employees.id, nullable | set when hired |
| created_at / updated_at | timestamptz | |

### `onboarding_checklists`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| task_name | varchar | |
| is_completed | boolean | default false |
| completed_at | timestamptz, nullable | |

---

## 7. Performance Management

### `appraisal_cycles`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | e.g. "2026 Q1 Review" |
| start_date | date | |
| end_date | date | |
| status | enum | upcoming, active, closed |

### `employee_goals`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| appraisal_cycle_id | uuid, FK → appraisal_cycles.id, ON DELETE CASCADE | |
| title | varchar | |
| description | text, nullable | |
| status | enum | not_started, in_progress, completed |

### `performance_reviews`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| appraisal_cycle_id | uuid, FK → appraisal_cycles.id, ON DELETE CASCADE | |
| reviewer_id | uuid, FK → users.id | manager or self |
| review_type | enum | self, manager |
| rating | int, nullable | e.g. 1-5 |
| comments | text, nullable | |
| submitted_at | timestamptz, nullable | |

---

## 8. Training & Offboarding

### `training_programs`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| title | varchar | |
| description | text, nullable | |
| start_date | date, nullable | |
| end_date | date, nullable | |

### `training_enrollments`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| training_program_id | uuid, FK → training_programs.id, ON DELETE CASCADE | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| status | enum | enrolled, in_progress, completed |
| completed_at | timestamptz, nullable | |

### `exit_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| employee_id | uuid, FK → employees.id, ON DELETE CASCADE | |
| requested_last_working_day | date | |
| reason | text, nullable | |
| status | enum | pending, approved, completed |
| final_settlement_payslip_id | uuid, FK → payslips.id, nullable | |
| created_at | timestamptz | |

### `asset_return_checklist`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| exit_request_id | uuid, FK → exit_requests.id, ON DELETE CASCADE | |
| asset_name | varchar | |
| is_returned | boolean | default false |

---

## 9. Notifications

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id, ON DELETE CASCADE | |
| type | varchar | e.g. "leave_approved", "payroll_processed" |
| title | varchar | |
| body | text | |
| channel | enum | push, email, sms |
| is_read | boolean | default false |
| sent_at | timestamptz, nullable | |
| created_at | timestamptz | |

---

## 11. System Settings

### `system_settings`
Admin-configurable settings (secrets + business config), per `SYSTEM_SETTINGS.md`. Single flat key-value table — new settings are added by inserting a row, not by a schema migration.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| key | varchar, unique | dot-notation, e.g. `payroll.pf_rate_percent`, `smtp.password` |
| value | text | encrypted (if `is_encrypted`) or plain JSON/string |
| is_encrypted | boolean | true for Tier 1 secrets, encrypted with `MASTER_ENCRYPTION_KEY` (`SYSTEM_SETTINGS.md` §6) |
| category | varchar | `secrets`, `payroll`, `attendance`, `branding`, `leave` |
| value_type | enum | `string`, `number`, `boolean`, `json` |
| updated_by | uuid, FK → users.id, nullable | |
| created_at / updated_at | timestamptz | |

- Only `SettingsService` reads/writes this table directly (`SYSTEM_SETTINGS.md` §5) — no other module queries it inline, to keep cache invalidation and decryption centralized.
- Every write is also logged to `audit_logs` (`SECURITY.md` §7).

---

## 12. Entity Relationship Summary (text form)

```
users 1---1 employees
users N---1 roles N---N permissions (via role_permissions)
employees N---1 departments
employees N---1 designations
employees N---1 office_locations
employees N---1 shifts
employees N---1 employees (reporting_manager, self-ref)

employees 1---N attendance_records
employees 1---N leave_requests
employees 1---N leave_balances
employees 1---N salary_structures 1---N salary_components
employees 1---N loan_advances
payroll_runs 1---N payslips 1---N payslip_line_items
employees 1---N payslips
employees 1---N bank_accounts

job_requisitions 1---N candidates ---> (converted) employees
employees 1---N onboarding_checklists

appraisal_cycles 1---N employee_goals
appraisal_cycles 1---N performance_reviews

training_programs 1---N training_enrollments N---1 employees

employees 1---N exit_requests 1---N asset_return_checklist
```

---

## 13. Indexing Notes

- `attendance_records`: composite index on `(employee_id, check_in_at)` — heavily queried for history/reports
- `payslips`: index on `(employee_id, payroll_run_id)`
- `leave_balances`: unique index on `(employee_id, leave_type_id, year)` already noted above
- `users.email`: unique index (already implied by `unique`)
- `audit_logs`: index on `(entity_type, entity_id)` for lookup by record
- `role_permissions`: index on `role_id` (looked up on every permission check — see `ROLES_PERMISSIONS.md` §6)
- `system_settings.key`: unique index (already implied by `unique`)

## 14. Open Schema Decisions

- [ ] Column-level encryption method for `national_id` and `bank_accounts.account_number` — pick library/approach (e.g., pgcrypto vs application-level) before Phase 1 — note this is now the **same mechanism/key** used for `system_settings` Tier 1 encryption (`SYSTEM_SETTINGS.md` §6), so this decision now covers both
- [ ] Whether `shifts` needs per-day variation (rotating shifts) or fixed shift is sufficient for v1
- [x] ~~Multi-currency support~~ — resolved: single currency (BDT), single jurisdiction (Bangladesh), per `PRD.md` §6 and `PAYROLL_LOGIC.md`
- [x] ~~`loan_advances` table missing~~ — resolved, see §5 above
- [x] ~~Final Settlement schema handling~~ — resolved via `payroll_runs.run_type`, see §5 above
- [x] ~~Roles as a fixed enum~~ — resolved: `roles`/`permissions`/`role_permissions` tables replace the static enum, see §1 above and `ROLES_PERMISSIONS.md`
- [x] ~~Where do admin-configurable secrets/business settings live~~ — resolved: `system_settings` table, see §11 above and `SYSTEM_SETTINGS.md`
