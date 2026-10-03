# AUDIT_LOG.md

This directly protects against the financial/compliance loss risk called out in PRD.md — treat this as mandatory infrastructure, not an optional nice-to-have.

## 1. What Gets Logged

Every create/update/delete on:
- Employee records (especially salary, bank details, employment status)
- Payroll: salary structure changes, payroll run status transitions, manual adjustments, finalization
- Leave: policy changes, balance adjustments, approvals/rejections
- Attendance: manual corrections/regularizations
- Roles/permissions changes
- Document verification/expiry status changes
- Any Super Admin action affecting a tenant (suspend, plan change, feature flag change)

## 2. Schema

```
audit_logs
  id
  tenant_id
  user_id            -- who performed the action
  action              -- create | update | delete | approve | finalize | ...
  module              -- e.g. "payroll", "employee", "leave"
  record_id           -- the affected entity's id
  old_value (json)    -- null for create
  new_value (json)    -- null for delete
  ip_address
  device
  created_at
```

- **Append-only**: no UPDATE or DELETE is ever performed on `audit_logs` rows, enforced at the DB permission level, not just application logic.

## 3. What NOT to Log

- Raw passwords, full unmasked bank/tax ID numbers in `old_value`/`new_value` — log that the field changed, not necessarily its full sensitive value (or store it encrypted with restricted-role access to view). See SECURITY.md §2.

## 4. Payroll-Specific Requirements

- Every transition in the payroll status flow (Draft → Calculated → ... → Finalized → Paid) is logged individually, not just the final state.
- A finalized payroll run cannot be altered — any subsequent correction is a new adjustment record, and creating that adjustment is itself logged (see PAYROLL_LOGIC.md §7, §11).

## 5. Access to Audit Logs

- Read access is itself permissioned (see ROLES_PERMISSIONS.md) — typically HR Admin, Payroll Admin, Company Owner, and Super Admin (for platform-level events).
- Audit log viewing/searching should support filtering by module, user, date range, and record ID — this is what makes it useful during a dispute or financial review, not just a data dump.

### 5a. Implementation

- **Permission:** `audit:view`. The default holders are Company Owner, HR Admin and Payroll Admin (granted in `prisma/seed.ts`); no other system role has it. Gating is by permission, not role name, so a tenant can deliberately grant it to a custom role (ROLES_PERMISSIONS.md §2). Platform-level events are reviewed in the Super Admin portal.
- **API** (read-only; there are no write endpoints):
  - `GET /api/v1/tenant/audit-logs` — filters `module`, `userId`, `recordId` (UUID, exact), `action`, `from` (inclusive) and `to` (exclusive) as ISO 8601 date-times, plus `page` / `pageSize` (max 100). Always scoped to the caller's tenant, newest first, with `meta.total`.
  - `GET /api/v1/tenant/audit-logs/filters` — the modules and users that appear in the tenant's audit trail, for the filter dropdowns.
- **Redaction on read (§3):** values under password/secret/token/`*Encrypted`/API-key keys are returned as `[redacted]`, and bank account, tax ID, national ID and passport numbers are masked to their last four characters, so older writes cannot leak through the viewer.
- **Admin screen:** Settings → Audit Log (`/settings/audit-log`). Filters live in the URL so a filtered view can be shared during a review; date filters are whole days in the viewer's local time. Each entry opens a field-by-field before/after comparison with a shortcut to the record's full history.

## 6. Retention

- Audit logs are retained at least as long as the statutory record-retention period for payroll/financial data in the relevant country (confirm per-country requirement — see country_rules in DATABASE_SCHEMA.md), and are not deleted even if the underlying record is later anonymized/deleted (see SECURITY.md §9).

## 7. Performance Consideration

- High-volume writes (audit logs accumulate fast) — index by `tenant_id`, `module`, `record_id`, `created_at`; consider partitioning by date for large tenants as volume grows.
