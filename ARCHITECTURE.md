# ARCHITECTURE.md

## 1. High-Level System

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Web App (React) │     │ Mobile App (RN)   │     │ Super Admin Panel   │
│  Admin/Employee   │     │ Employee (offline)│     │                    │
└────────┬─────────┘     └────────┬──────────┘     └─────────┬──────────┘
         │                        │  (queued sync)             │
         └────────────┬───────────┴────────────┬───────────────┘
                       │        REST API (JWT)   │
              ┌────────▼─────────────────────────▼────────┐
              │            NestJS Backend                  │
              │  ┌──────────────┐  ┌──────────────────┐    │
              │  │ Auth/RBAC     │  │ Payroll Engine    │    │
              │  ├──────────────┤  ├──────────────────┤    │
              │  │ Tenant Mgmt   │  │ Rule Resolver     │    │
              │  ├──────────────┤  ├──────────────────┤    │
              │  │ Attendance    │  │ Sync/Queue (BullMQ)│   │
              │  └──────────────┘  └──────────────────┘    │
              └───────────┬─────────────────┬───────────────┘
                           │                 │
                  ┌────────▼──────┐   ┌──────▼───────┐
                  │ PostgreSQL     │   │ Redis / Queue │
                  └────────────────┘   └───────────────┘
                           │
                  ┌────────▼──────────────┐
                  │ File Storage (driver)   │
                  │ S3-compatible OR local   │
                  └────────────────────────┘
```

## 2. Multi-Tenancy

- Every business data table carries a `tenant_id` column.
- All queries MUST be scoped by `tenant_id` at the repository/service layer — never trust a client-supplied tenant filter alone; derive it from the authenticated session.
- Tenant isolation is enforced in code (row-level), not by separate databases, for MVP. Revisit dedicated-DB-per-tenant only if a specific enterprise client requires it.

## 3. Country-Rule Engine (core architectural principle)

```
Payroll/Leave/Tax Calculation Request
            │
            ▼
      Rule Resolver
            │
   ┌────────┼─────────┬──────────────┬───────────────────┐
   ▼        ▼          ▼              ▼                   ▼
Global   Country    State/Province   Company Policy   Employee Contract
Default  Rules      Rules            (override)       (final override)
            │
            ▼
   Effective-dated rule version (matched to the payroll/calculation date)
            │
            ▼
        Calculation
```

**Non-negotiable rule:** country-specific or company-specific logic must never be hard-coded inside controllers or services. It is always resolved through this chain from configuration/database tables. See RULES.md.

## 4. Payroll Calculation Pipeline

See PAYROLL_LOGIC.md for full detail. Summary:

```
Attendance + Leave + Timesheet + Overtime + Salary Structure + Bonuses + Deductions
        → Rule Resolver (country/state/company/contract)
        → Gross Pay
        → Deductions (tax, loan, insurance, etc.)
        → Net Pay
        → Payslip
        → Payment Batch
```

## 5. Offline-First Mobile Architecture

See OFFLINE_SYNC.md for full detail. Summary: the mobile app is not a thin client — it has a local database, queues actions offline, and reconciles with the server using idempotent sync operations keyed by a client-generated `local_id`.

## 6. File Storage Abstraction

All file operations (documents, payslips, assets, profile photos) go through a storage driver interface:

```ts
interface StorageDriver {
  upload(key: string, file: Buffer, meta: FileMeta): Promise<string>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
```

Two implementations: `S3StorageDriver` (AWS S3 / DigitalOcean Spaces / MinIO) and `LocalDiskStorageDriver`. The active driver is chosen per deployment via environment configuration (see ENV_SETUP.md and FILE_STORAGE.md) — application code never references the storage mechanism directly.

## 7. Effective-Dated Rule Versioning

Tax brackets, leave policies, and OT rules change over time. Every rule table includes `effective_from` and `effective_to`. Payroll always resolves rules using the payroll period's date, not "today" — this keeps historical payroll runs correct even after law changes.

## 8. Related Documents

- DATABASE_SCHEMA.md — table-level detail
- PAYROLL_LOGIC.md, LEAVE_LOGIC.md, ATTENDANCE_LOGIC.md — domain logic
- OFFLINE_SYNC.md — mobile sync design
- SECURITY.md, AUTH_FLOW.md — auth and data protection
- FILE_STORAGE.md — storage driver detail
