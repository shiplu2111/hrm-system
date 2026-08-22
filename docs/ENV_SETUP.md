# ENV_SETUP.md — Environment Variables (Tier 0 — Bootstrap Only)

⚠️ **This file's scope shrank significantly.** As of `SYSTEM_SETTINGS.md`, only the minimal "bootstrap" variables a running instance needs *before it can even reach the database* live in `.env`/the secrets manager. SMTP, SMS, storage keys, PF rate, overtime rules, branding, currency, timezone, and everything else business-configurable now live in the `system_settings` DB table, editable from the Admin Panel without a redeploy — see `SYSTEM_SETTINGS.md` for that full list. **Do not add a new setting here unless it's genuinely required to boot the app before the database is reachable** (per §1 below) — if in doubt, it belongs in `system_settings`, not `.env`.

Config must be validated at boot (`@nestjs/config` + Joi/Zod schema per `ARCHITECTURE.md`) — the backend should fail to start if a required Tier 0 variable is missing, not fail silently at runtime.

---

## 1. Why So Little Lives Here Now

A variable belongs in `.env` (Tier 0) only if it's needed to establish the DB/Redis connection itself, or if storing it in the DB would be circular (e.g., the key used to *encrypt* DB-stored secrets can't itself be a DB-stored secret — `SYSTEM_SETTINGS.md` §1). Everything else — even things that feel "infrastructure-ish" like SMTP — is admin-configurable business config now, because:
- Changing an SMTP password or PF rate shouldn't require a code deploy
- `super_admin` should be able to self-serve these changes from the Admin Panel, not file a ticket to an engineer
- Secrets stored this way are still encrypted at rest (`SYSTEM_SETTINGS.md` §6) — moving out of `.env` doesn't weaken security, it centralizes rotation/audit logging instead of scattering it across deploy pipelines

---

## 2. Backend (`apps/backend/.env`) — Complete List

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `staging` \| `production` |
| `PORT` | `3000` | |
| `API_PREFIX` | `api/v1` | matches `API_GUIDELINES.md` versioning |
| `APP_URL` | `http://localhost:3000` | used in generated links (e.g. payslip PDF links) |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/hrm_dev` | Prisma connection string |
| `REDIS_HOST` | `localhost` | |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | *(empty locally)* | required in staging/production |
| `MASTER_ENCRYPTION_KEY` | *(random 32-byte key)* | Encrypts Tier 1 `system_settings` secrets and existing sensitive DB fields (`bank_accounts.account_number`, `national_id`) — see `SYSTEM_SETTINGS.md` §1, §6, `SECURITY.md` §5 |
| `JWT_ACCESS_SECRET` | *(random 64-char string)* | never reuse across environments; kept separate from `MASTER_ENCRYPTION_KEY` (different failure domains) |
| `JWT_ACCESS_EXPIRY` | `15m` | |
| `JWT_REFRESH_SECRET` | *(random 64-char string, different from access)* | |
| `JWT_REFRESH_EXPIRY` | `30d` | |
| `PIN_MAX_FAILED_ATTEMPTS` | `5` | before lockout, per `SECURITY.md` — kept in `.env` rather than `system_settings` since it governs auth *before* a settings lookup would be safe to trust; could be reconsidered for Tier 2 later if that's not a real constraint |
| `PIN_LOCKOUT_MINUTES` | `15` | same reasoning as above |
| `BCRYPT_SALT_ROUNDS` | `12` | applies to password + PIN hashing |
| `BIOMETRIC_CHALLENGE_EXPIRY_SECONDS` | `60` | server-issued challenge validity window |
| `RATE_LIMIT_TTL_SECONDS` | `60` | |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | general endpoints |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `10` | stricter, per `SECURITY.md` §6 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | comma-separated; no wildcard in production — infrastructure-level, not a business setting |

**Moved to `system_settings` (see `SYSTEM_SETTINGS.md` §3–4 for the full mapping):** `SMTP_*` → `smtp.*`, `SMS_PROVIDER_*` → `sms.*`, `EXPO_PUSH_ACCESS_TOKEN` → `push.expo_access_token`, `S3_*`/`STORAGE_PROVIDER` → `storage.*`, `DEFAULT_CURRENCY` → `payroll.currency`, `PAYROLL_TIMEZONE` → `payroll.timezone`, and all PF/overtime/insurance/branding/leave settings that previously had no home at all.

**Removed entirely:** `FIELD_ENCRYPTION_KEY` — merged into `MASTER_ENCRYPTION_KEY` above, since both protect sensitive DB fields with the same mechanism (`SYSTEM_SETTINGS.md` §6); no reason to maintain two separate encryption keys for the same purpose.

---

## 3. Web App (`apps/admin/.env`)

Vite requires the `VITE_` prefix for any variable exposed to client code.

| Variable | Example | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | |
| `VITE_APP_NAME` | `HRM` | Generic default; the actual display name shown in-app comes from `branding.company_name` (`system_settings`, `SYSTEM_SETTINGS.md` §4) once the backend is reachable — this var is only a build-time fallback for the loading screen before that setting loads |
| `VITE_ENVIRONMENT` | `development` | for error-tracking tagging |
| `VITE_SENTRY_DSN` | *(optional)* | if error tracking is added |
| `VITE_WEBSOCKET_URL` | `ws://localhost:3000` | for real-time attendance updates |

> ⚠️ Never put secrets (API keys, JWT secrets) in `apps/admin/.env` — anything with `VITE_` prefix is bundled into client-side JS and publicly visible. This was already true before `SYSTEM_SETTINGS.md`, and remains true now — no Tier 1 secret ever belongs here regardless.

---

## 4. Mobile App (`apps/mobile/.env`)

Expo uses `EXPO_PUBLIC_` prefix for variables accessible in app code (also publicly visible in the built app — same rule as above applies).

| Variable | Example | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:3000/api/v1` | use LAN IP, not `localhost`, when testing on physical device |
| `EXPO_PUBLIC_APP_ENV` | `development` | |
| `EXPO_PUBLIC_GEOFENCE_DEFAULT_RADIUS_METERS` | `100` | fallback only; actual radius comes from `office_locations` per office, and the org-wide default now comes from `attendance.default_geofence_radius_meters` (`system_settings`) rather than being mobile-hardcoded |
| `EASBUILD_PROJECT_ID` | *(from Expo dashboard)* | required for EAS Build |

> ⚠️ No secrets in mobile `.env` either — the compiled app can be decompiled. All sensitive operations (geofence validation, payroll calc) must happen server-side, never trust client-side config for security decisions.

---

## 5. Docker Compose (local dev only)

`docker-compose.yml` at root — variables can be set in a root-level `.env` consumed by Compose:

| Variable | Example | Notes |
|---|---|---|
| `POSTGRES_USER` | `hrm_user` | |
| `POSTGRES_PASSWORD` | `hrm_local_pass` | local only, never reused elsewhere |
| `POSTGRES_DB` | `hrm_dev` | |
| `POSTGRES_PORT` | `5432` | |
| `REDIS_PORT` | `6379` | |

---

## 6. First-Run Setup (Settings that used to be `.env`, now need a Super Admin to configure)

Because SMTP/SMS/storage/PF/etc. moved to `system_settings`, a **fresh install has no email sending, no SMS, no file storage, and default (unconfigured) payroll rules** until a `super_admin` logs in and fills in the Settings → Integrations / Payroll Configuration screens (`SYSTEM_SETTINGS.md` §7). This is expected, not a bug — but it means:
- The very first account (the initial `super_admin`) must still be creatable **without** SMTP configured yet — i.e., registration/first-login cannot depend on a welcome email being sendable. Handle this via a seeded first-admin credential set during deployment (`MIGRATIONS.md` §6's seed step) rather than an email-invite flow for that one bootstrap account specifically.
- Document this "first things to configure" checklist prominently in `README.md`'s setup steps so it isn't missed silently (features just quietly not working, e.g., leave-approval emails never sending, is worse than an explicit setup step).

---

## 7. Secret Generation Guidance

- JWT secrets / `MASTER_ENCRYPTION_KEY`: generate with `openssl rand -base64 64` (or 32 bytes for `MASTER_ENCRYPTION_KEY`, matching AES-256 key length requirements).
- Never reuse the same secret value across `development`, `staging`, and `production`.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` immediately if ever exposed (forces logout of all users — expected side effect).
- Rotating `MASTER_ENCRYPTION_KEY` is a bigger operation — follow the documented runbook in `SYSTEM_SETTINGS.md` §6, never an ad hoc key swap.

---

## 8. Per-Environment Checklist

| Environment | `.env` source | Notes |
|---|---|---|
| `local` | `.env` file (gitignored) | Docker Compose for DB/Redis |
| `staging` | Hosting platform secret manager | mirrors production config, separate secrets |
| `production` | Hosting platform secret manager | strongest secrets, `CORS_ALLOWED_ORIGINS` locked to real domains only |

---

## 9. `.gitignore` Reminder

Confirm these are present at the root and/or per-app `.gitignore`:
```
.env
.env.local
.env.*.local
```
Only `.env.example` files (placeholder values, no real secrets) should ever be committed.

---

## 10. Open Items

- [x] ~~Finalize SMS provider~~ — no longer a `.env` naming question; provider selection now happens per-org in the Settings UI (`SYSTEM_SETTINGS.md` §3), so no code-level decision is blocking here. Bangladeshi SMS gateway providers (e.g., SSL Wireless, Alpha SMS) remain the likely default options to surface in that UI.
- [x] ~~Finalize storage provider~~ — same reasoning; `storage.provider` is now an admin-configurable setting, not a build-time decision (though the *code* must still support whichever provider(s) are offered as options — that's an `ARCHITECTURE.md` implementation scope question, not an env-naming one)
- [x] ~~Confirm `DEFAULT_CURRENCY` and `PAYROLL_TIMEZONE`~~ — resolved as `payroll.currency = BDT`, `payroll.timezone = Asia/Dhaka` in `system_settings`, seeded as defaults at first migration (jurisdiction confirmed as Bangladesh, per `PRD.md` §7, `PAYROLL_LOGIC.md`)
- [ ] Confirm the exact seeded first-`super_admin` bootstrap mechanism (§6) — e.g., a `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` pair of Tier 0 env vars used only once at first migration, then ignored on subsequent boots
