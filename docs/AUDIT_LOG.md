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

## 6. Retention

- Audit logs are retained at least as long as the statutory record-retention period for payroll/financial data in the relevant country (confirm per-country requirement — see country_rules in DATABASE_SCHEMA.md), and are not deleted even if the underlying record is later anonymized/deleted (see SECURITY.md §9).

## 7. Performance Consideration

- High-volume writes (audit logs accumulate fast) — index by `tenant_id`, `module`, `record_id`, `created_at`; consider partitioning by date for large tenants as volume grows.
