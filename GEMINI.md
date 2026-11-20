# HRM System - Workspace Agent Guidelines & Rules

This repository is a **multi-tenant, country-configurable HR + Payroll + Attendance + Workforce Management SaaS platform**.
Always adhere strictly to the rules and architectural principles below.

---

## 1. Non-Negotiable Core Rules (from `docs/RULES.md`)

### Multi-Tenancy
- Every new table with business data **MUST** have a `tenant_id` column.
- Every database query **MUST** be scoped by `tenant_id`, derived from the authenticated session (JWT) — never from client-supplied request params.
- Never write a query that could leak data across tenants, even in administrative or debug endpoints.

### Country/Company-Specific Logic (Rule Resolver Chain)
- **NEVER** hard-code country-specific tax, leave, overtime, or statutory employment rules inside services or controllers.
- Resolve all rules through the Rule Resolver chain:
  `Global Default → Country Rules → State/Province Rules → Company Policy → Employee Contract`
- If a requirement is country/location-specific and lacks a config table, add the config table rather than special-casing in code.

### Payroll & Financial Determinism
- Payroll calculations must be deterministic and reproducible: identical inputs + identical rule version = identical output.
- Finalized payroll runs are **locked** — corrections must create a new linked adjustment record (`payroll_adjustments`), never mutate finalized rows.
- Every create/update/delete on payroll tables **MUST** write to the audit log (`audit_logs`).
- Currency and monetary values must be stored as integers or fixed-precision `numeric(14,2)` — never floating-point.

### Rule Versioning & Effective Dating
- Any table representing statutory rates or policy (tax brackets, leave entitlements, OT rates) must include `effective_from` and `effective_to`.
- Calculations must resolve the rule version active on the calculation/period date, not current system date.

### Offline-Sync Safety & Idempotency
- Any mobile-writable entity (attendance, breaks, leave requests, timesheets) must support a client-generated `local_id` (UUID).
- `UNIQUE (employee_id, local_id)` is enforced server-side. Replaying identical sync payloads must never create duplicates.
- Server-side timestamp is the authoritative source of truth for payroll-eligible records. Significant clock skew triggers `time_anomaly`.

### API & Code Conventions
- Endpoints must follow `API_GUIDELINES.md` (`/api/v1/...`, `{ data, meta }` response wrapper).
- Error responses must follow `ERROR_HANDLING.md` (`{ error: { code, message, details, requestId } }`).
- Cross-app TypeScript types and DTOs belong in `@hrm/shared-types` (`packages/shared-types`). Do not duplicate type definitions.

### Security & Privacy
- Never log sensitive data (passwords, tokens, bank account numbers, tax IDs) in plaintext.
- Use AES field-level encryption for sensitive credentials and tokens (`FIELD_ENCRYPTION_KEY`).
- Mask sensitive identifiers in the UI and read endpoints (`****1234`).
- Every new endpoint must declare explicit required roles and permissions (`@RequirePermissions()`).

---

## 2. Documentation Index (`docs/`)

When working on specific subsystems, consult the relevant documentation in `docs/`:
- **Architecture & System Design**: `docs/ARCHITECTURE.md`
- **Database Schema**: `docs/DATABASE_SCHEMA.md` & `apps/api/prisma/schema.prisma`
- **Domain Logic**:
  - Payroll: `docs/PAYROLL_LOGIC.md`
  - Attendance: `docs/ATTENDANCE_LOGIC.md`
  - Offline Sync: `docs/OFFLINE_SYNC.md`
  - Leave: `docs/LEAVE_LOGIC.md`
- **Platform Services**:
  - Auth: `docs/AUTH_FLOW.md`
  - RBAC: `docs/ROLES_PERMISSIONS.md`
  - Audit: `docs/AUDIT_LOG.md`
  - Notifications: `docs/NOTIFICATION_LOGIC.md`
  - Storage: `docs/FILE_STORAGE.md`
  - Settings: `docs/SYSTEM_SETTINGS.md`
- **Testing & Deployment**:
  - `docs/TESTING.md`
  - `docs/DEPLOYMENT.md`
  - `docs/ENV_SETUP.md`

