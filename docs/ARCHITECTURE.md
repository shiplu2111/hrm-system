# ARCHITECTURE.md — HRM System

## 1. High-Level Overview

The system is a monorepo with three client-facing applications sharing one backend API and a shared types/utils package.

```
                        ┌─────────────────────┐
                        │   PostgreSQL (DB)    │
                        └──────────┬───────────┘
                                   │
                        ┌──────────┴───────────┐
                        │   Redis (Cache/Queue) │
                        └──────────┬───────────┘
                                   │
                        ┌──────────┴───────────┐
                        │   NestJS API Server   │
                        │  (apps/backend)       │
                        └──────────┬───────────┘
                                   │  REST + WebSocket (JWT auth)
              ┌────────────────────┼────────────────────┐
              │                    │                    │
   ┌──────────┴─────────┐ ┌────────┴────────┐  ┌────────┴────────┐
   │  Web App            │ │  Mobile App     │  │  (Future) Public │
   │  (Admin + Employee  │ │  React Native   │  │  API Consumers   │
   │   Self-Service)     │ │  (apps/mobile)  │  │                  │
   │  React + Vite       │ │                 │  │                  │
   │  (apps/admin)       │ │                 │  │                  │
   └─────────────────────┘ └─────────────────┘  └─────────────────┘
```

## 2. Monorepo Layout

```
hrm-system/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── employee/
│   │       │   ├── attendance/
│   │       │   ├── leave/
│   │       │   ├── payroll/
│   │       │   ├── recruitment/
│   │       │   ├── performance/
│   │       │   ├── notification/
│   │       │   └── reports/
│   │       ├── common/          # guards, interceptors, filters, decorators
│   │       ├── config/          # env config, validation
│   │       └── main.ts
│   ├── admin/
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       ├── features/        # module-based: attendance/, payroll/, leave/...
│   │       ├── api/              # API client calls (uses shared types)
│   │       ├── store/            # zustand stores
│   │       └── routes/
│   └── mobile/
│       └── src/
│           ├── screens/
│           ├── components/
│           ├── features/
│           ├── api/
│           ├── auth/            # biometric/PIN local logic
│           └── navigation/
├── packages/
│   └── shared/
│       ├── types/                # DTOs, interfaces shared across apps
│       ├── constants/            # roles, leave types, error codes
│       └── utils/                # date/currency formatting, validators
└── docs/
```

## 3. Backend Architecture (NestJS)

### 3.1 Module Pattern
Each business domain (attendance, payroll, leave, etc.) is a **self-contained NestJS module** with:
- `*.controller.ts` — route handlers only, no business logic
- `*.service.ts` — business logic
- `*.repository.ts` (or Prisma/TypeORM equivalent) — data access
- `dto/` — request/response validation (class-validator)
- `entities/` — DB models
- `*.module.ts` — wiring

### 3.2 Layering Rule
```
Controller → Service → Repository → Database
```
Controllers never touch the database directly. Services never know about HTTP (req/res).

### 3.3 Cross-Cutting Concerns
- **Auth Guard:** JWT verification + role-based `@Roles()` decorator on every protected route
- **Validation:** Global `ValidationPipe` using DTOs
- **Error Handling:** Global exception filter → consistent error shape (see `API_GUIDELINES.md`)
- **Logging:** Structured logger (e.g., Pino), request ID tracing
- **Rate Limiting:** On auth endpoints especially (PIN brute-force protection)

### 3.4 Background Jobs
Use **Bull (Redis-backed queue)** for:
- Monthly payroll run
- Payslip PDF generation
- Notification dispatch (email/SMS/push)
- Attendance offline-sync reconciliation

### 3.5 Real-time
Socket.io gateway for:
- Live attendance status on admin dashboard
- Leave approval notifications

## 4. Database

- **Engine:** PostgreSQL
- **ORM:** Prisma (recommended for type-safety + migration DX with TypeScript monorepo)
- Full schema detailed in `DATABASE_SCHEMA.md`
- Financial tables (payroll, salary) use `DECIMAL`, never `FLOAT`
- All tables: `id (uuid)`, `created_at`, `updated_at`, soft-delete via `deleted_at` where applicable

## 5. Authentication Architecture

- JWT access token (short-lived, ~15 min) + refresh token (long-lived, stored httpOnly/secure on admin; secure storage on mobile)
- Password: bcrypt hash
- PIN: bcrypt hash, separate column, rate-limited endpoint
- Biometric: **device never sends raw biometric data**. Device generates a key pair on enrollment (stored in Android Keystore / iOS Secure Enclave via `expo-secure-store`), sends public key to backend. Login = device signs a server-issued challenge with the private key after local biometric verification; backend verifies signature with stored public key.
- Full flow in `AUTH_FLOW.md`

## 6. Web App Architecture (React) — Admin + Employee Self-Service

`apps/admin` is a **single web app serving every role**, not an admin-only tool — HR/Manager/Super Admin get the full admin surface, while `employee` (and any custom role scoped similarly) logs into the same app and sees a restricted, self-service-only subset of screens (mirroring the mobile app's tab structure — check-in status, leave, payslips, profile — per `NAVIGATION.md` §10). This means **employees can log in from a PC/browser as well as the mobile app**, using the same account and the same dynamic permission set (`ROLES_PERMISSIONS.md` §1) — there is no separate "employee web portal" codebase to maintain in parallel.

- **Vite + TypeScript**
- **Server state:** TanStack Query (all API data — caching, refetch, mutation)
- **Client/UI state:** Zustand (auth session, UI toggles) — kept minimal
- **UI Kit:** Ant Design (data-heavy tables/forms suit HRM use case)
- **Routing:** React Router, route guards based on the current user's **permission key list** returned at login (`ROLES_PERMISSIONS.md` §13.2), not a hardcoded role name — a route like `/payroll` checks for `payroll.view_all` in the session's permission list, so it works identically for the seeded `hr` role and any future custom role granted that same permission.
- **Feature-folder structure:** each module (`payroll/`, `attendance/`, `leave/`) contains its own components, hooks, and API calls — not split by generic type (avoids `components/`, `hooks/` global sprawl)
- **Auth method on web:** password only (or SSO if added later) — **PIN and biometric login remain mobile-only** (`AUTH_FLOW.md` §11 clarifies this split), since PIN/biometric exist specifically for the mobile app's faster-repeated-unlock use case and don't map cleanly to a browser context; an employee who set up PIN/biometric on mobile still logs into the web app with their password.
- **Landing experience by role:** on login, `employee`-scoped users land on a self-service home view (check-in status, leave balance, recent payslip) instead of the admin dashboard's org-wide overview — the app shell is shared, but the default route and available nav items differ by permission set, same mechanism as route guards above.

## 7. Mobile App Architecture (React Native / Expo)

- **Expo managed workflow** (switch to bare workflow only if continuous background location tracking becomes a hard requirement)
- **Location:** `expo-location` — captured at check-in/out; geofence validation done server-side (client sends coordinates, backend is source of truth for validity)
- **Biometric:** `expo-local-authentication` for device-level prompt; `expo-secure-store` for key storage
- **Offline support:** local queue (e.g., SQLite via `expo-sqlite` or `WatermelonDB`) for check-in/out events made offline; background sync on reconnect
- **Navigation:** React Navigation
- **State:** TanStack Query + Zustand (same pattern as admin, for consistency)

## 8. Shared Package (`packages/shared`)

- TypeScript types/DTOs used by backend (as source of truth), re-exported and consumed by admin + mobile to avoid drift
- Shared constants: role enums, leave type enums, error codes
- Shared pure utility functions: currency formatting, date helpers (no framework-specific code here)

## 9. Environment Separation

| Environment | Purpose |
|---|---|
| `local` | Developer machines, Docker Compose DB/Redis |
| `staging` | Pre-production testing |
| `production` | Live system |

Config validated at boot via `@nestjs/config` + Joi/Zod schema — app fails fast if required env vars are missing.

## 10. Deployment (high-level, adjust per infra choice)

- **Backend:** Containerized (Docker), deployed to a VM/container service (e.g., ECS, Railway, Render, or self-hosted VPS)
- **Admin:** Static build, served via CDN/Nginx or hosting like Vercel
- **Mobile:** Built via EAS Build (Expo), distributed via Play Store / App Store / internal TestFlight
- **DB:** Managed PostgreSQL recommended in production (backups, point-in-time recovery)

## 11. Key Architectural Decisions & Rationale

| Decision | Rationale |
|---|---|
| Monorepo (Turborepo + pnpm) | Shared types across 3 apps, single install, consistent tooling |
| NestJS over Express | Enforced modular structure suits multi-module HRM domain |
| PostgreSQL over NoSQL | Payroll/attendance data is relational, needs strong consistency/transactions |
| Server-side geofence validation | Client-side-only validation is spoofable; backend must be source of truth |
| Public-key biometric auth | Biometric data never leaves the device — required for security/compliance |
| TanStack Query on both admin & mobile | Consistent data-fetching pattern, less duplicated logic |

## 12. Open Architecture Decisions

- [ ] Prisma vs TypeORM — finalize before backend scaffolding begins
- [ ] Bank disbursement: direct integration vs export file (impacts payroll module design)
- [ ] Background location tracking requirement (impacts Expo managed vs bare workflow choice)
