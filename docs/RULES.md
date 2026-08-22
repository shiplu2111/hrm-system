# RULES.md — Coding Conventions & AI Agent Guidelines

This file is written to be read by both human developers and AI coding agents (Cursor). Follow these rules strictly and consistently across `backend`, `admin`, and `mobile`.

## 1. General Principles

- Always check `packages/shared/types` before creating a new type/interface — reuse or extend, don't duplicate.
- Never hardcode values that belong in config — infrastructure values (DB URLs, JWT secrets) go in `.env` (`ENV_SETUP.md`); business-configurable values (geofence radius defaults, PF/tax rates, integration API keys) go in the `system_settings` table via `SettingsService`, never hardcoded in application code, per `SYSTEM_SETTINGS.md`.
- Prefer explicit, readable code over clever one-liners.
- Every new module (attendance, payroll, leave, etc.) must follow the existing folder pattern in that app — do not invent a new structure per feature.
- If a business rule is ambiguous (e.g., payroll rounding, geofence tolerance), check `PAYROLL_LOGIC.md` / `ATTENDANCE_LOGIC.md` first. If not documented, ask/flag — do not assume.

## 2. TypeScript Rules

- `strict: true` in all `tsconfig.json` — no `any` unless absolutely unavoidable, and if used, comment why.
- Use `interface` for object shapes that may be extended; `type` for unions/utility compositions.
- All API request/response shapes must be defined as DTOs/types in `packages/shared/types` — never inline `any` payloads.
- Enums for fixed sets (roles, leave types, attendance status) live in `packages/shared/constants`, not duplicated per app.

## 3. Backend (NestJS) Rules

- One module = one business domain. Do not mix unrelated logic into an existing module (e.g., don't put leave logic inside attendance module).
- Controllers: routing + DTO validation only. **No business logic in controllers.**
- Services: all business logic. Services must be unit-testable without HTTP context.
- Repository/data-access logic stays out of services where possible — use Prisma/TypeORM repository pattern.
- Every mutating endpoint (`POST`/`PATCH`/`DELETE`) must validate input via a DTO with `class-validator` decorators.
- Every protected route must have `@UseGuards(JwtAuthGuard)` and, where relevant, `@RequirePermission('module.action')` — permission-based, not a hardcoded role name, per `ROLES_PERMISSIONS.md` §13.1 (roles/permissions are dynamic, backed by DB tables, not a fixed enum).
- Money/salary fields: use `Decimal` type (Prisma `Decimal` / `decimal.js`), never native JS `number` for currency math.
- Dates: store in UTC in DB; convert to local timezone only at presentation layer (admin/mobile).
- Never log sensitive data: passwords, PINs, biometric keys, full JWT tokens.
- All new endpoints must follow response/error format defined in `API_GUIDELINES.md`.

## 4. Database Rules

- Every table: `id` (uuid, primary key), `created_at`, `updated_at`.
- Soft-delete (`deleted_at`) for records with audit/compliance need (employee, payroll, attendance) — do not hard-delete these.
- Foreign keys must have `ON DELETE` behavior explicitly defined (RESTRICT/CASCADE) — never leave default.
- All schema changes go through a migration file. Never edit the DB manually in staging/production.
- Naming: snake_case for DB columns/tables, camelCase in TypeScript/Prisma models.

## 5. Web App (React) Rules

- Feature-folder structure: group by domain (`features/payroll/`, `features/attendance/`), not by generic type (`components/`, `hooks/` globally) for anything domain-specific. Shared/reusable UI atoms (buttons, inputs) can live in a global `components/ui/`.
- All server data fetching goes through TanStack Query hooks — no raw `fetch`/`axios` calls inside components.
- No business logic inside components beyond simple UI conditionals — extract to hooks or utils.
- Forms: use a consistent form library (e.g., React Hook Form) across all modules — do not mix approaches per feature.
- Role-based UI: hide/show elements based on role from auth store, but **never rely on frontend hiding alone for security** — backend must independently enforce permissions.

## 6. Mobile App (React Native) Rules

- Never store biometric data or raw fingerprints — only public keys / device auth results, per `AUTH_FLOW.md`.
- Location permission requests must explain purpose to the user (required by app store review guidelines) before triggering the OS permission prompt.
- All offline-queued actions (e.g., check-in while offline) must be idempotent on sync — backend must handle duplicate submission safely.
- Do not block the UI thread with location/biometric calls — always async with loading states.
- Sensitive local storage (tokens, keys) must use `expo-secure-store`, never `AsyncStorage`.

## 7. API Design Rules (summary — full detail in API_GUIDELINES.md)

- RESTful resource naming: plural nouns (`/employees`, `/attendance-records`), no verbs in URLs.
- Versioned API: `/api/v1/...`
- Consistent success/error envelope (see `API_GUIDELINES.md`).
- Pagination required on all list endpoints (`?page=&limit=`).

## 8. Git & Commit Rules

- Branch naming: `feature/<module>-<short-desc>`, `fix/<module>-<short-desc>`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- No direct commits to `main`/`develop` — PR required.
- PR must reference which module(s) it touches (attendance, payroll, auth, etc.)

## 9. Testing Rules

- Payroll calculation logic: **unit tests mandatory** before merge, no exceptions.
- Attendance geofence validation logic: unit tests mandatory.
- Auth flows (password/PIN/biometric): integration tests required.
- Minimum coverage target: 70% on `services/` in backend (business logic layer).

## 10. AI Agent (Cursor) Specific Instructions

- Before generating code for a new feature, first check: `ARCHITECTURE.md` (where does this belong), `DATABASE_SCHEMA.md` (does a model already exist), `packages/shared/types` (does a type already exist).
- Do not introduce a new library/package without checking if an equivalent is already used elsewhere in the monorepo (e.g., don't add `axios` if `fetch`-based API client already exists).
- When implementing payroll or attendance logic, always cross-check against `PAYROLL_LOGIC.md` / `ATTENDANCE_LOGIC.md` — these are the source of truth for business rules, not assumptions.
- When unsure which app (`backend`/`admin`/`mobile`) a change belongs in, check the module boundary in `ARCHITECTURE.md` before writing code.
- Never generate placeholder/mock payroll or tax calculation logic and leave it unflagged — clearly comment `// TODO: verify against PAYROLL_LOGIC.md` if uncertain.

## 11. Code Review Checklist (applies to human + AI-generated PRs)

- [ ] Follows folder/module structure for the relevant app
- [ ] No business logic in controllers/components
- [ ] DTOs/types added to `packages/shared` if reusable across apps
- [ ] No hardcoded secrets/config
- [ ] Currency fields use Decimal, not float
- [ ] New endpoints follow `API_GUIDELINES.md` response format
- [ ] Tests added for payroll/attendance/auth logic
- [ ] No sensitive data in logs
