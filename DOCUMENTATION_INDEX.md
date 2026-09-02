# DOCUMENTATION_INDEX.md

Master index of all project documentation. Start here.

## Product & Planning
- **PRD.md** — product vision, scope, success criteria
- **MODULES.md** — full 47-module feature specification
- **PHASES.md** — MVP / Phase 2 / Phase 3 build order

## Architecture & Data
- **ARCHITECTURE.md** — system design, multi-tenancy, country-rule engine, offline architecture overview
- **DATABASE_SCHEMA.md** — entity/table reference
- **MIGRATIONS.md** — schema change process
- **SHARED_TYPES.md** — cross-app TypeScript types/DTOs

## Domain Logic
- **PAYROLL_LOGIC.md** — payroll calculation engine detail
- **LEAVE_LOGIC.md** — leave accrual, policy, approval detail
- **ATTENDANCE_LOGIC.md** — clock in/out, geofence, status detail
- **OFFLINE_SYNC.md** — offline-first mobile sync design (critical — read before building attendance/mobile)

## Platform Services
- **AUTH_FLOW.md** — authentication, tokens, 2FA, offline session
- **ROLES_PERMISSIONS.md** — RBAC model
- **SECURITY.md** — encryption, masking, retention, consent
- **AUDIT_LOG.md** — audit trail requirements
- **NOTIFICATION_LOGIC.md** — event-driven notification engine
- **FILE_STORAGE.md** — S3 vs local storage driver
- **BILLING_SUBSCRIPTION.md** — plan tiers, feature gating
- **THIRD_PARTY_INTEGRATIONS.md** — accounting, banking, device integrations

## API & Code Conventions
- **RULES.md** — non-negotiable coding rules (read first, applies everywhere)
- **API_GUIDELINES.md** — REST conventions
- **ERROR_HANDLING.md** — error response standard

## Frontend
- **DESIGN_SYSTEM.md** — tokens, component library
- **UI_GUIDELINES.md** — UI patterns and requirements per screen type
- **NAVIGATION.md** — app navigation structure

## Mobile
- **MOBILE_PERMISSIONS.md** — device permissions and graceful degradation

## Operations
- **ENV_SETUP.md** — local dev environment setup
- **DEPLOYMENT.md** — CI/CD, environments, rollout
- **SYSTEM_SETTINGS.md** — tenant/platform settings, backup/restore
- **TESTING.md** — test strategy and mandatory coverage areas

## Reference
- **GLOSSARY.md** — shared vocabulary

---

## Recommended Reading Order (new developer / new Cursor session)

1. PRD.md
2. RULES.md
3. ARCHITECTURE.md
4. MODULES.md + PHASES.md
5. DATABASE_SCHEMA.md
6. The specific *_LOGIC.md file for whatever module you're building
7. API_GUIDELINES.md + ERROR_HANDLING.md before writing any endpoint
8. OFFLINE_SYNC.md before touching anything mobile/attendance-related

## Maintenance Rule

Any change to logic, schema, or rules described in these files must update the file in the same commit/PR (see RULES.md §9). Documentation drift is treated as a bug, not a formatting nitpick.
