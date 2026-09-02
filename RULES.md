# RULES.md

Non-negotiable coding rules for this project. These apply regardless of which module is being worked on. Cursor/AI agents and developers must follow these without exception.

## 1. Multi-Tenancy

- Every new table with business data MUST have a `tenant_id` column.
- Every query MUST be scoped by `tenant_id`, derived from the authenticated session — never from a request parameter/body the client can set.
- Never write a query that could leak data across tenants, even in an admin/debug endpoint.

## 2. Country/Company-Specific Logic

- NEVER hard-code country-specific tax, leave, overtime, or employment rules inside services or controllers.
- All such logic must be resolved through the Rule Resolver chain described in ARCHITECTURE.md: Global → Country → State → Company → Employee Contract.
- If a requirement seems country-specific and there's no existing config table for it, stop and add the config table — do not special-case it in code.

## 3. Payroll & Financial Data

- Payroll calculations must be deterministic and reproducible: given the same inputs and the same rule version, the same output must always result.
- Once a payroll run is finalized, it is locked — corrections happen via a new adjustment record, never by mutating a finalized payroll row.
- Every create/update/delete on payroll-related tables must write to the audit log (see AUDIT_LOG.md). This is not optional.
- Money values are stored as integers (smallest currency unit, e.g. paisa/cents) or a fixed-precision decimal type — never as floating point.

## 4. Rule Versioning

- Any table representing a law/policy/rate (tax brackets, leave entitlement, OT rate) must include `effective_from` / `effective_to`.
- Calculations must resolve the rule version active on the calculation/payroll date, not the current date.

## 5. Offline-Sync Safety

- Any mobile-writable entity (attendance, leave request) must support a client-generated `local_id` and be sync-idempotent — replaying the same sync payload must never create duplicates.
- Server-side timestamp is the source of truth for anything payroll-affecting; device timestamp is stored but not trusted alone (see OFFLINE_SYNC.md).

## 6. API & Code Conventions

- Follow API_GUIDELINES.md for endpoint naming, versioning, and response shape.
- Follow ERROR_HANDLING.md for error response format — do not invent ad-hoc error shapes per module.
- Shared types (DTOs used by both backend and mobile/web) live in the shared types package — see SHARED_TYPES.md; do not duplicate type definitions.

## 7. Security

- Never log sensitive data (passwords, tokens, full bank account numbers, national ID numbers) in plaintext.
- Follow SECURITY.md for encryption-at-rest and masking rules for sensitive fields.
- All new endpoints must declare required roles/permissions explicitly — no endpoint is "open by default."

## 8. General Engineering

- No feature ships without: unit tests for calculation logic (payroll, leave accrual, overtime), and a migration file for any schema change (see MIGRATIONS.md).
- Do not begin UI work on a module until its entry in DATABASE_SCHEMA.md and relevant *_LOGIC.md file exists and is confirmed.
- When in doubt about scope, check MODULES.md and PHASES.md before building — do not build Phase 2/3 features while Phase 1 is incomplete.

## 9. Documentation Discipline

- If you change a rule, calculation, or schema described in one of these `.md` files, update the file in the same PR/commit. Stale documentation is treated as a bug.
