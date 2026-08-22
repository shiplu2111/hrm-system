# SYSTEM_SETTINGS.md — Dynamic Admin-Configurable Settings

Defines what configuration lives in `.env` (bootstrap-only, minimal) versus what's stored in the database and editable from the Admin Panel by `super_admin`. Cross-references: `ENV_SETUP.md`, `DATABASE_SCHEMA.md` §11, `SECURITY.md`, `PAYROLL_LOGIC.md`.

---

## 1. Why Two Tiers Exist (read this first)

Secrets (SMTP password, SMS API key, storage keys) **can** be moved into the database so they're admin-editable without a redeploy — but they must be **encrypted at rest**, and the encryption key that protects them cannot itself live in the same place it's protecting. So a small "bootstrap" tier stays in `.env`/secrets manager; everything else — including secrets — lives in the database, encrypted with the bootstrap key.

```
.env (Tier 0, bootstrap — never in DB, never admin-editable)
   │  contains: MASTER_ENCRYPTION_KEY, DATABASE_URL, REDIS connection
   ▼
Database: system_settings table
   ├── Tier 1: Secrets (SMTP, SMS, storage keys, push tokens)
   │           — encrypted using MASTER_ENCRYPTION_KEY, admin-editable
   └── Tier 2: Business config (PF rate, overtime rules, branding, toggles)
               — plain (not sensitive), admin-editable
```

If `MASTER_ENCRYPTION_KEY` is ever rotated, every Tier 1 value must be re-encrypted with the new key in the same operation (a migration script, not a manual DB edit) — see §6.

---

## 2. Tier 0 — Bootstrap (`.env`, stays in `.env`, never admin-editable)

This is the **entire** remaining `.env` file for the backend — everything else from the old `ENV_SETUP.md` list moves to Tier 1/2 below.

| Variable | Notes |
|---|---|
| `NODE_ENV` | |
| `PORT` | |
| `DATABASE_URL` | |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | |
| `MASTER_ENCRYPTION_KEY` | Encrypts Tier 1 secrets (§1) and existing sensitive DB fields (`bank_accounts.account_number`, `national_id`, per `SECURITY.md` §5) — one key, one purpose. Never reused for JWT signing. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Session signing — kept separate from `MASTER_ENCRYPTION_KEY` (different failure domains: rotating one shouldn't force rotating the other) |
| `CORS_ALLOWED_ORIGINS` | Infrastructure-level, not a business setting |

Admin/mobile apps keep only their non-secret bootstrap values (`VITE_API_BASE_URL`, `EXPO_PUBLIC_API_BASE_URL`) — nothing sensitive was ever in those per `ENV_SETUP.md` §2–3's existing warning.

---

## 3. Tier 1 — Admin-Configurable Secrets

Stored in `system_settings` (§7) with `is_encrypted = true`. Editable only by `super_admin`, requires password re-auth to change (same pattern as `bank_accounts` edits, `SECURITY.md` §5), and every change is written to `audit_logs`.

| Setting Key | Replaces this old `.env` var | Notes |
|---|---|---|
| `smtp.host`, `smtp.port`, `smtp.user`, `smtp.password`, `smtp.from_email` | `SMTP_*` | |
| `sms.provider`, `sms.api_key`, `sms.sender_id` | `SMS_PROVIDER_*` | |
| `push.expo_access_token` | `EXPO_PUSH_ACCESS_TOKEN` | |
| `storage.provider`, `storage.bucket`, `storage.region`, `storage.access_key_id`, `storage.secret_access_key` | `S3_*` | |

- Backend caches decrypted Tier 1 values in memory (or Redis, encrypted-in-transit within the private network) with a short TTL after first read per process, rather than hitting the DB + decrypting on every single request — invalidate the cache immediately when a value is updated via the admin API (not just on TTL expiry), so a changed SMTP password takes effect right away.
- Nothing in Tier 1 is ever sent to `admin`/`mobile` in a `GET` response — the settings API returns **masked** values for secrets (e.g., `smtp.password: "••••••••"`, `storage.secret_access_key: "••••••••"`) so the UI can show "configured" vs "not configured" without ever re-exposing the plaintext after initial entry.

---

## 4. Tier 2 — Admin-Configurable Business Config

Stored in `system_settings` with `is_encrypted = false`. Editable by `super_admin` (and `hr` for HR-scoped items — see per-row permission note in §7). Not sensitive, but still audit-logged for accountability (payroll-adjacent settings especially).

| Setting Key | Type | Replaces / Relates to | Editable by |
|---|---|---|---|
| `payroll.pf_enabled` | boolean | Resolves `PAYROLL_LOGIC.md` §4.2 open item — is PF offered at all | `super_admin`, `hr` |
| `payroll.pf_rate_percent` | decimal (7.00–8.00) | `PAYROLL_LOGIC.md` §4.2 open item — exact rate in the legal band | `super_admin`, `hr` |
| `payroll.overtime_eligible_roles` | array of `role_id`s | `PAYROLL_LOGIC.md` §3.3 open item — replaces the old idea of a static `overtime_eligible` flag on `shifts`; see §8 for how this interacts with dynamic roles | `super_admin`, `hr` |
| `payroll.insurance_enabled` | boolean | `PAYROLL_LOGIC.md` §4.3 open item | `super_admin`, `hr` |
| `payroll.insurance_deduction_amount` / `_percent` | decimal | `PAYROLL_LOGIC.md` §4.3 | `super_admin`, `hr` |
| `payroll.currency` | string | replaces `DEFAULT_CURRENCY` | `super_admin` |
| `payroll.timezone` | string | replaces `PAYROLL_TIMEZONE` | `super_admin` |
| `attendance.background_location_enabled` | boolean | Resolves `PRD.md` §7 / `MOBILE_PERMISSIONS.md` §8 open item — see §9 below for why this one is special | `super_admin` |
| `attendance.default_geofence_radius_meters` | int | fallback default when creating a new `office_locations` row | `super_admin`, `hr` |
| `branding.company_name` | string | | `super_admin` |
| `branding.logo_url` | string (uploaded via document endpoint, `API_GUIDELINES.md` §12) | | `super_admin` |
| `branding.primary_color` | string (hex) | optional theme override on top of `DESIGN_SYSTEM.md` defaults | `super_admin` |
| `leave.earned_leave_carryover_cap_days` | int | `PAYROLL_LOGIC.md` §9 open item | `super_admin`, `hr` |
| `leave.encashable_leave_type_ids` | array of `leave_type_id`s | `PAYROLL_LOGIC.md` §9 open item | `super_admin`, `hr` |

---

## 5. `system_settings` Table

```sql
system_settings
  id            uuid PK
  key           varchar UNIQUE       -- e.g. 'payroll.pf_rate_percent'
  value         text                 -- encrypted (Tier 1) or plain JSON/string (Tier 2)
  is_encrypted  boolean
  category      varchar              -- 'secrets' | 'payroll' | 'attendance' | 'branding' | 'leave'
  value_type    enum                 -- string, number, boolean, json
  updated_by    uuid FK → users.id
  updated_at    timestamptz
  created_at    timestamptz
```

- Single flat key-value table rather than one column per setting — new settings are added by inserting a row, not by a schema migration, which is the entire point of moving these out of `.env`/hardcoded columns.
- `value_type` lets the backend validate/parse correctly without guessing; the settings API layer (`SettingsService`) is the only place that reads/writes this table — no other service should query `system_settings` directly, to keep validation and cache invalidation (§3) centralized.

See `DATABASE_SCHEMA.md` §11 for the formal table entry.

---

## 6. Encryption & Key Rotation

- Tier 1 values encrypted with `MASTER_ENCRYPTION_KEY` (AES-256, same mechanism as `bank_accounts.account_number` per `SECURITY.md` §5 — one consistent encryption utility used everywhere sensitive DB fields are involved).
- **Key rotation procedure:** generate a new key → run a migration script that decrypts every Tier 1 row + `bank_accounts`/`national_id` field with the old key and re-encrypts with the new key, in a single transaction per table → update `MASTER_ENCRYPTION_KEY` in the secrets manager → restart backend. This must be a documented, tested runbook before go-live, not an improvised procedure during an incident.
- Old key is retained (securely, separately) for a short grace period after rotation in case rollback is needed, then destroyed.

---

## 7. Admin Panel — Settings UI

A dedicated **Settings** section in `apps/admin`, visible only to roles with the `system.settings.manage` permission (see `ROLES_PERMISSIONS.md` §2 for the dynamic permission model this now depends on):

- **Integrations tab:** SMTP, SMS, Storage, Push (Tier 1) — masked values, "Test Connection" action per integration (sends a test email/SMS without persisting extra state) before saving, so a bad credential is caught immediately rather than silently failing the first real notification.
- **Payroll Configuration tab:** PF, overtime, insurance, currency (Tier 2, payroll category)
- **Attendance Configuration tab:** background location toggle, default geofence radius
- **Branding tab:** company name, logo, primary color
- **Leave Configuration tab:** carryover cap, encashable leave types
- **Roles & Permissions tab:** see §8 — this is where dynamic RBAC is managed

Every save in this section triggers an `audit_logs` entry (`SECURITY.md` §7) recording the old/new value (masked for Tier 1) and the admin who made the change.

---

## 8. Interaction with Dynamic Roles (see `ROLES_PERMISSIONS.md`)

`payroll.overtime_eligible_roles` (§4) stores an array of `role_id`s referencing the now-dynamic `roles` table (`DATABASE_SCHEMA.md` §1, `ROLES_PERMISSIONS.md` §2) rather than a hardcoded enum — if HR creates a new custom role (e.g., "Field Technician"), it becomes immediately selectable in this setting without any code change, consistent with the rest of this document's goal of making business rules admin-configurable rather than requiring a deploy.

---

## 9. Special Case: Background Location Toggle

`attendance.background_location_enabled` is listed in Tier 2 (§4) but is **not purely a config flag** — flipping it has real consequences beyond the database:

- Enabling it requires the **mobile app itself** to have been built with background location capability (Expo bare workflow or the relevant background task modules, per `ARCHITECTURE.md` §7, `MOBILE_PERMISSIONS.md` §8) — a v1 build compiled without that capability cannot retroactively gain it just because an admin flips a database flag. This setting should only be exposed as togglable in the admin UI once the mobile app has actually shipped with that support; until then, keep it hidden or disabled with an explanatory tooltip rather than present but non-functional.
- Enabling it also requires updating the iOS/Android permission strings and re-submitting the app for store review (`MOBILE_PERMISSIONS.md` §2.5–2.6) — this is not a live, zero-deploy toggle in practice for the mobile side, even though the backend/admin treat it as a simple setting. Document this constraint directly in the Settings UI's helper text so `super_admin` doesn't expect an instant effect.

---

## 10. Testing Requirements

- Unit tests for `SettingsService`: encrypt/decrypt round-trip for Tier 1, validation per `value_type` for Tier 2, cache invalidation on write (§3).
- Test that Tier 1 `GET` responses never leak plaintext (§3's masking behavior).
- Test the key-rotation script (§6) against a seeded test dataset — decrypt-with-old/re-encrypt-with-new must be verified to succeed with zero data loss before it's ever run against production.

---

## 11. Open Items

- [ ] Confirm which specific SMS/push providers need `sms.provider`-specific extra fields beyond the generic key/sender_id shape in §3 (provider-specific settings may need their own sub-keys)
- [ ] Confirm cache backing store for Tier 1 decrypted values (in-process memory vs. Redis) — affects multi-instance backend deployments where a setting change needs to invalidate cache across all running instances, not just the instance that received the write
