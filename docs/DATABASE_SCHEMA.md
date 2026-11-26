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
  amount_or_formula, pay_basis (monthly|daily|hourly, default monthly),
  effective_from, effective_to, created_at, updated_at
  -- pay_basis applies to fixed components: monthly = amount per period,
  --   daily = amount × days worked, hourly = amount × net hours worked

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
  calculation_snapshot(json, nullable),
  finalized_at, locked, created_at, updated_at, deleted_at (soft-delete)
  -- calculation_snapshot: earnings/deductions lines captured when the run is
  --   calculated; the payslip is rendered from it so it matches the approved totals.
  --   Null for runs calculated before the column existed (payslip falls back to a live calculation).

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
  id, tenant_id (nullable for system roles), name,
  data_scope (all|team, default all — ROLES_PERMISSIONS.md §5), created_at, updated_at
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

## 12. Employee Engagement & Kudos Moderation (MODULES.md §29)

```
company_announcements
  id, tenant_id, company_id, title, body, status (draft|published|archived),
  is_pinned, published_at, expires_at, created_by_user_id, created_at, updated_at

engagement_surveys / engagement_survey_questions / engagement_survey_responses / engagement_survey_answers
  -- employee_id is null on engagement_survey_responses when is_anonymous = true;
  -- deduplicated via one-way sha256 response_fingerprint

employee_kudos
  id, tenant_id, company_id, from_employee_id, to_employee_id,
  kudos_type (peer|manager), message,
  moderation_status (active|removed, default active),
  removed_at, removed_by_user_id (→ users), removal_reason,
  created_by_user_id, created_at, updated_at
  -- Public employee feeds and monthly counters strictly filter moderation_status = 'active'.
  -- Admin moderation view (engagement:edit) inspects active/removed posts and audit logs.
```

## 13. Health & Safety (MODULES.md §30)

```
workplace_incidents
  id, tenant_id, company_id, incident_number, incident_type, severity, status,
  location, occurred_at, description, reported_by_employee_id, gps_lat, gps_lng,
  regulator_report_required, regulator_report_due_at, regulator_report_submitted_at,
  regulator_report_submitted_by_user_id (→ users), regulator_reference_number,
  regulator_name, country_specific_data(json), resolved_rule_snapshot(json),
  investigation_notes, resolved_at, created_by_user_id, created_at, updated_at
  UNIQUE (company_id, incident_number)
  -- country_specific_data stores field values defined by health_safety rules resolved via
  -- Global → Country → State → Company → Employee Contract (never hard-coded per country).

workplace_incident_parties / injury_log_entries / safety_compliance_records / safety_inspections
  -- Linked parties (involved/witness/injured), injury logs (bodyPart rules from health_safety),
  -- compliance checklists, and safety inspection records scoped by tenant_id & company_id.
```

## 14. Platform Website CMS (Platform-Level, No `tenant_id`)

Public marketing website content lives at platform scope (no `tenant_id`), managed from the Platform Console with explicit bilingual (`en`, `bn`) locale tracking, English fallback, reserved slug protection (`admin`, `api`, `app`, `platform`, `login`, `signup`, `public`, `_next`), lowercase URL-safe slugs, and database-enforced system-page locking & version immutability:

```
cms_pages
  id, kind (system|custom), slug (unique, lowercase URL-safe, reserved slugs rejected),
  status (draft|scheduled|published|unpublished|trashed), locked (true for system pages),
  requires_approval (true for legal pages), approval_status (none|pending_approval|approved|rejected),
  pending_approval_version_id, submitted_for_approval_by_id, submitted_for_approval_at, submission_note,
  approved_by_id, approved_at, approval_note, rejected_by_id, rejected_at, rejection_reason,
  scheduled_at, scheduled_timezone, scheduled_by_id, published_at,
  current_published_version_id (nullable → cms_page_versions), deleted_at, created_at, updated_at
  -- DB trigger blocks DELETE, slug rename, unlock, soft-delete, or unpublish/trash on system/locked pages.

cms_page_locales
  id, page_id (→ cms_pages), locale (en|bn), is_translated,
  translation_status (untranslated|in_review|translated),
  current_draft_version_id, current_published_version_id, created_at, updated_at
  UNIQUE (page_id, locale)
  -- Requested `bn` resolves cleanly to `en` fallback when untranslated/unpublished.

cms_page_versions
  id, page_id (→ cms_pages), version_number, locale (en|bn),
  title, seo_title, seo_description, canonical_path, og_image_url, no_index,
  blocks (jsonb), is_translated, author_id (→ platform_users), author_name,
  change_note, created_at
  UNIQUE (page_id, locale, version_number)
  -- Append-only immutable snapshot (no updated_at; UPDATE and DELETE blocked by DB trigger).

cms_media
  id, filename, original_name, mime_type, size_bytes, storage_key (unique), public_url,
  width, height, alt_en, alt_bn, caption_en, caption_bn, folder, uploaded_by_id, deleted_at,
  created_at, updated_at

cms_menus / cms_menu_items
  cms_menus: id, slug (unique), name, location (header|footer|mobile|legal|custom), is_active, created_at, updated_at
  cms_menu_items: id, menu_id (→ cms_menus), parent_id (self-ref), label_en, label_bn,
    description_en, description_bn, target_page_id (→ cms_pages), href, badge_en, badge_bn,
    sort_order, open_in_new_tab, is_visible, created_at, updated_at

cms_redirects
  id, source_path (unique), destination_url, redirect_type (permanent_308|permanent_301|temporary_302|temporary_307),
  is_active, hit_count, note, created_by_id, created_at, updated_at

cms_post_categories / cms_authors / cms_posts
  cms_post_categories: id, slug (unique), name_en, name_bn, description_en, description_bn, sort_order, created_at, updated_at
  cms_authors: id, slug (unique), display_name, display_name_bn, role_title, role_title_bn, bio_en, bio_bn,
    avatar_media_id (→ cms_media), platform_user_id (unique → platform_users), is_active, created_at, updated_at
  cms_posts: id, slug (unique), status (draft|scheduled|published|unpublished|trashed),
    category_id (→ cms_post_categories), author_id (→ cms_authors), cover_media_id (→ cms_media),
    title_en, title_bn, excerpt_en, excerpt_bn, body_json_en, body_html_en, body_json_bn, body_html_bn,
    is_bn_translated, bn_translation_status, seo_title_en, seo_description_en, seo_title_bn, seo_description_bn,
    tags, reading_time_minutes, scheduled_at, scheduled_timezone, scheduled_by_id, published_at, deleted_at, created_at, updated_at

cms_changelog_entries
  id, slug (unique), version_label, release_date, tag (new|improved|fixed|security), module_refs,
  title_en, summary_en, highlights_en, title_bn, summary_bn, highlights_bn, is_bn_translated,
  is_published, scheduled_at, scheduled_timezone, scheduled_by_id, published_at, deleted_at,
  author_id (→ platform_users), created_at, updated_at

cms_careers
  id, slug (unique), status (draft|open|paused|closed), department, location_type, location_text,
  employment_type, title_en, summary_en, description_html_en, title_bn, summary_bn, description_html_bn,
  is_bn_translated, apply_email, published_at, closes_at, deleted_at, created_at, updated_at

cms_faqs
  id, category, page_slug, question_en, answer_en, question_bn, answer_bn, is_bn_translated,
  sort_order, is_published, created_at, updated_at

cms_site_settings
  id, key (unique), value_json (jsonb), description, is_public, updated_by_id, updated_by_name,
  created_at, updated_at
```

See MIGRATIONS.md for how schema changes are rolled out.
