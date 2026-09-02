# ENV_SETUP.md

## 1. Prerequisites

- Node.js (LTS), PostgreSQL, Redis
- npm/pnpm
- (Mobile) React Native tooling — Xcode for iOS build, Android Studio for Android build

## 0. Bootstrap Config (`.env`) vs. Runtime Config (Admin Panel) — read this first

Not every setting belongs in `.env`. This project splits configuration into two categories:

**Bootstrap config (`.env`, requires redeploy to change):**
Only what the app needs before it can even connect to the database or start serving requests — database connection, Redis connection, JWT signing secrets, the storage driver choice and its base credentials, and which port to listen on. This is genuinely infrastructure-level and rarely changes.

**Runtime config (stored in DB, editable live from the Admin Panel, no redeploy/restart needed):**
- SMTP/email settings (per-company and platform default) — see SYSTEM_SETTINGS.md §2a
- SMS/push provider credentials where a tenant brings their own
- Notification rules and real-time (WebSocket) notification toggles — see NOTIFICATION_LOGIC.md
- Feature flags, plan limits, country rule sets, tenant branding/white-label settings
- Third-party integration credentials (accounting, banking) — see THIRD_PARTY_INTEGRATIONS.md

**Rule of thumb:** if a non-developer (a Company Admin or Super Admin) should reasonably be able to change it without filing a ticket to the dev team, it belongs in the database-backed settings tables and admin panel UI — not in `.env`. See DATABASE_SCHEMA.md §11 for the `tenant_settings`/`platform_settings` tables this relies on.

## 2. Environment Variables (`.env`)

```
# App
NODE_ENV=development
PORT=3000
APP_URL=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/hrms

# Redis / Queue
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Storage (see FILE_STORAGE.md)
STORAGE_DRIVER=local   # or s3
LOCAL_STORAGE_PATH=./storage
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=

# Notifications
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
# NOTE: These are the *platform default fallback* credentials only, used when
# a tenant hasn't configured their own SMTP/SMS/push provider via the Admin
# Panel (see SYSTEM_SETTINGS.md §2a). Per-tenant SMTP/notification settings
# are NOT env vars — they live in the database and are managed at runtime.
EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=

# Real-time layer (WebSocket) — bootstrap connection info only;
# which events broadcast in real time is a runtime setting (see NOTIFICATION_LOGIC.md §10)
WEBSOCKET_PORT=

# Third-party (as integrated — see THIRD_PARTY_INTEGRATIONS.md)
ACCOUNTING_INTEGRATION_KEY=
BANKING_API_KEY=
```

`.env.example` in the repo mirrors this file with placeholder/blank values only — never real secrets committed.

## 3. Local Setup Steps

```bash
git clone <repo>
cd <repo>
cp .env.example .env   # fill in local values (see §2)
npm install
npm run migrate        # apply Prisma migrations — see MIGRATIONS.md
npm run seed           # demo tenant, roles, users — see §5
npm run dev:api        # API on http://localhost:3000
```

**Swagger UI (interactive API docs):** http://localhost:3000/api/docs

**Health check (no auth):** http://localhost:3000/health

## 4. Mobile App Local Setup

```bash
cd apps/mobile
npm install
npx pod-install          # iOS only
npm run android          # or: npm run ios
```

Point the mobile app at `http://localhost:3000` (or your machine IP) for the API base URL.

## 5. Seed Data

Seed script: `apps/api/prisma/seed.ts` — run via `npm run seed` from the repo root.

Idempotent (safe to re-run). Creates:

| Entity | Value |
|---|---|
| Tenant | **Demo Corp** — subdomain `demo` |
| Company | **Demo Corp Pty Ltd** (AU financial year starts July) |
| Country | **Australia** (`AUS`, AUD, progressive tax brackets + leave/OT country rules) |
| Roles | 8 system roles with permissions (see ROLES_PERMISSIONS.md §1) |
| Employees | 5 sample employees with manager hierarchy + leave balances |

### Demo login accounts

All accounts share password **`password`** (local dev only — never use in staging/production).

| Role | Email |
|---|---|
| Company Owner | `admin@cmsnbd.com` |
| HR Admin | `hr@cmsnbd.com` |
| Payroll Admin | `payroll@cmsnbd.com` |
| Manager | `manager@cmsnbd.com` |
| Employee | `employee@cmsnbd.com` |

**Login request** (`POST /api/v1/auth/login`):

```json
{
  "email": "admin@cmsnbd.com",
  "password": "password",
  "tenantSubdomain": "demo"
}
```

Returns JWT `accessToken` (15 min) + `refreshToken` (30 days, rotated on each refresh). See AUTH_FLOW.md and Swagger at `/api/docs`.

## 6. Per-Environment Config

- `development`, `staging`, `production` each have their own `.env` (never shared secrets across environments).
- See DEPLOYMENT.md for how these are provisioned in CI/CD.
