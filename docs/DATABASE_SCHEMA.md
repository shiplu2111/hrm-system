# DATABASE_SCHEMA.md

This file tracks the core entity relationships. Keep it updated as schema evolves — treat it as the ERD narrative companion to the actual migration files (see MIGRATIONS.md).

## 1. Core Multi-Tenancy & Country Framework

```
tenants
  id, name, subdomain, plan_id, status, storage_driver, created_at

countries
  id, name, iso_code, currency, timezone, date_format

country_rules
  id, country_id, rule_type (tax|leave|ot|social_security|public_holiday), payload(json),
  effective_from, effective_to

global_rules
  id, rule_type, payload(json), effective_from, effective_to

state_province_rules
  id, country_id, state_code, rule_type, payload(json),
  effective_from, effective_to

company_rules
  id, tenant_id, company_id, rule_type, payload(json),
  effective_from, effective_to

employee_contract_rules
  id, tenant_id, employee_id, rule_type, payload(json),
  effective_from, effective_to

companies (belongs to tenant)
  id, tenant_id, name, country_id, financial_year_start

branches / locations  → table: `locations`
  id, company_id, name, address, lat, lng, geofence_radius_m
```

## 2. Organization

```
departments
  id, company_id, parent_department_id (nullable, self-referencing), name

designations
  id, company_id, department_id, job_level_id, name, salary_grade

job_levels
  id, company_id, code, name, rank

employment_types
  id, company_id, name (Full Time/Part Time/Casual/Contractor/custom)

teams
  id, company_id, name

cost_centres
  id, company_id, name, code
```

## 3. Employee

```
employees
  id, tenant_id, company_id, employee_number, first_name, last_name,
  personal_info(json), employment_status, department_id, designation_id,
  employment_type_id, manager_id (self-ref), hire_date, probation_end_date,
  confirmation_date, work_location_id, cost_centre_id, created_at, updated_at,
  deleted_at (soft-delete — see §10)

employee_documents
  id, employee_id, document_type_id, fields(json), file_key, expiry_date,
  verified_at, created_at, updated_at

employee_lifecycle_events
  id, employee_id, event_type (promotion|transfer|salary_revision|suspension|
  resignation|termination|rehire), effective_date, details(json), created_by,
  created_at, updated_at
```

## 4. Attendance & Offline Sync

```
attendance_records
  id, employee_id, date, clock_in_at, clock_out_at, source (manual|mobile|
  biometric|qr|gps), status, gps_lat, gps_lng, device_id,
  local_id (client-generated UUID, nullable for server-created rows),
  synced_at, sync_status, created_at, updated_at

breaks
  id, attendance_record_id, start_at, end_at, created_at, updated_at
```
**Offline sync idempotency (critical):** `UNIQUE (employee_id, local_id)` on `attendance_records` — replaying the same sync payload must never create a duplicate (see OFFLINE_SYNC.md §2). PostgreSQL treats NULL `local_id` as distinct, so multiple server-created rows without a `local_id` remain valid.

## 5. Roster / Shift

```
shifts
  id, company_id, name, start_time, end_time, break_minutes, grace_minutes,
  ot_rule_id (→ payroll_rules), created_at, updated_at

rosters
  id, employee_id, shift_id, date, location_id, created_at, updated_at
  UNIQUE (employee_id, date)
```

## 6. Leave

```
leave_types
  id, company_id, name, is_paid, created_at, updated_at

leave_policies
  id, company_id, leave_type_id, entitlement_days, accrual_type,
  carry_forward_max, expiry_months, effective_from, effective_to,
  created_at, updated_at

leave_balances
  id, employee_id, leave_type_id, balance_days, as_of_year,
  created_at, updated_at
  UNIQUE (employee_id, leave_type_id, as_of_year)

leave_requests
  id, employee_id, leave_type_id, start_date, end_date, status,
  approval_chain(json), local_id, created_at, updated_at
```
**Offline sync idempotency:** `UNIQUE (employee_id, local_id)` on `leave_requests` (same pattern as attendance_records).

## 7. Payroll

```
salary_structures
  id, employee_id, component_type (earning|deduction), component_id,
  amount_or_formula, effective_from, effective_to, created_at, updated_at

pay_components
  id, company_id, name, type (earning|deduction), calculation_type
  (fixed|formula|percentage), formula(json), created_at, updated_at

payroll_rules
  id, country_id (nullable), company_id (nullable), rule_json,
  effective_from, effective_to, created_at, updated_at

payroll_periods
  id, company_id, start_date, end_date, payment_date, status,
  created_at, updated_at

payroll_runs
  id, payroll_period_id, employee_id, gross_pay, total_deductions, net_pay,
  status (draft|calculated|under_review|approved|finalized|paid|cancelled),
  finalized_at, locked, created_at, updated_at, deleted_at (soft-delete)

payslips
  id, payroll_run_id, file_key, generated_at, created_at, updated_at
```

## 8. Tax & Superannuation

```
tax_brackets
  id, country_id, tax_year, bracket_json, effective_from, effective_to,
  created_at, updated_at

employee_tax_profiles
  id, employee_id, tax_id_number, tax_settings(json), created_at, updated_at

superannuation_contributions
  id, payroll_run_id, employee_contribution, employer_contribution,
  created_at, updated_at
```
Monetary columns use `numeric(14,2)` minimum (see §10). Rule-versioned tables (`leave_policies`, `salary_structures`, `payroll_rules`, `tax_brackets`) include `effective_from`/`effective_to` per RULES.md §4.

## 9. Audit & Security

```
audit_logs
  id, tenant_id (nullable for platform-level events), user_id, action, module,
  record_id, old_value(json), new_value(json), ip_address, device, created_at
  -- append-only: no updated_at; UPDATE/DELETE blocked by DB trigger + REVOKE

roles
  id, tenant_id (nullable for system roles), name, created_at, updated_at
  UNIQUE (tenant_id, name) WHERE tenant_id IS NOT NULL
  UNIQUE (name) WHERE tenant_id IS NULL

permissions
  id, role_id, module, action (view|create|edit|delete|approve|finalize),
  created_at, updated_at
  UNIQUE (role_id, module, action)

users
  id, tenant_id (nullable for platform users), employee_id (nullable),
  role_id, email, password_hash, is_active, failed_login_attempts,
  locked_until, last_login_at, created_at, updated_at
  UNIQUE (tenant_id, email) WHERE tenant_id IS NOT NULL
  UNIQUE (email) WHERE tenant_id IS NULL

  refresh_tokens
  id, user_id, token_hash, family_id, expires_at, revoked_at,
  user_agent, ip_address, created_at
  -- rotation: each refresh revokes the previous token in the family
```

**Local seed reference:** tenant subdomain `demo`, company **Demo Corp Pty Ltd**, country **Australia (AUS)**. Login emails: `admin@cmsnbd.com`, `hr@cmsnbd.com`, `payroll@cmsnbd.com`, `manager@cmsnbd.com`, `employee@cmsnbd.com` — see ENV_SETUP.md §5.

## 10. Conventions

- All primary keys: UUID.
- All monetary columns: `numeric(14,2)` minimum, or integer minor-units — never `float`/`double`.
- All tables: `created_at`, `updated_at`; soft-delete via `deleted_at` where records must be recoverable (employees, payroll runs — never hard-delete these).
- Foreign keys always indexed.

## 11. Runtime Settings (Admin-Panel-Managed)

These tables back the runtime-configurable settings described in ARCHITECTURE.md §7a and SYSTEM_SETTINGS.md §2a — deliberately kept out of `.env` so they're editable live from the Admin Panel.

```
tenant_settings
  id, tenant_id, category (smtp|notification|integration|branding|feature_flag),
  key, value(json, encrypted for secret categories), updated_by, created_at,
  updated_at
  UNIQUE (tenant_id, category, key)

platform_settings
  id, category (smtp_default|notification_default|country_config|maintenance),
  key, value(json, encrypted for secret categories), updated_by, created_at,
  updated_at
  UNIQUE (category, key)
```

- `smtp` category example `value`: `{ host, port, username, password (encrypted), from_address, from_name, use_tls }`.
- `notification` category holds per-event channel toggles and the real-time (WebSocket) broadcast toggle (see NOTIFICATION_LOGIC.md §4, §10).
- Every write to these tables is audit-logged (see AUDIT_LOG.md) — settings changes are security/compliance-relevant, not routine data edits.
- Encrypted `value` fields (SMTP password, integration API keys) follow the field-level encryption rule in SECURITY.md §1 and are never returned in plaintext by the settings-read API — only a masked placeholder, with a separate "reveal"/"test connection" action gated by permission.

See MIGRATIONS.md for how schema changes are rolled out.
