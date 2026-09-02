# TESTING.md

## 1. Test Levels

```
Unit tests        -- calculation logic (payroll, leave accrual, overtime, tax) — highest priority, see §2
Integration tests  -- API endpoints against a real test DB
E2E tests           -- critical user flows (login → clock in → leave request → payroll run)
Mobile-specific     -- offline sync scenarios (see §3)
```

## 2. Mandatory Unit Test Coverage

No feature in these areas ships without unit tests (see RULES.md §8):
- Payroll calculation chain (PAYROLL_LOGIC.md) — including the Rule Resolver, for at least 2 distinct country rule sets
- Leave accrual/carry-forward/expiry logic (LEAVE_LOGIC.md)
- Overtime and late/early-leave detection (ATTENDANCE_LOGIC.md)
- Permission checks (ROLES_PERMISSIONS.md) — verify denial as rigorously as approval

## 3. Offline Sync Test Scenarios (see OFFLINE_SYNC.md §10)

- Clock in/out fully offline → reconnect → verify exactly one server record, no duplicates
- Sync request sent, connection drops before response → retry → verify idempotency (no duplicate)
- Device clock manually skewed → verify `time_anomaly` flag raised, record not silently accepted into payroll
- Partial batch sync failure → verify only failed items are retried, successful ones aren't resent

## 4. Multi-Tenant Isolation Tests

Automated suite: `npm run test:e2e` (from repo root) — `apps/api/test/tenant-isolation.e2e-spec.ts`.

Covers (TESTING.md / SECURITY.md §8):
- Authenticated user can read own-tenant data
- Same user gets **404** for another tenant's record (not a leak via `200`)
- Client-supplied `tenantId` in query/body is **rejected** (`400 TENANT_ID_NOT_ALLOWED`)
- Prisma extension scopes `findUnique` by JWT `tenant_id`

Requires seeded demo data (`npm run seed`) and a running PostgreSQL instance (`DATABASE_URL` in `.env`).

## 5. Payroll Regression Tests

- Golden-file/snapshot tests: known input (attendance + leave + salary structure) → known expected payslip output, for each supported country configuration. Any change to the calculation engine must not silently alter these outputs without an explicit, reviewed update to the expected snapshot.

## 6. CI Requirements

- Lint, type-check, unit tests, and integration tests run on every PR; merge blocked on failure.
- E2E suite run at minimum before every production deploy (see DEPLOYMENT.md §2).

## 7. Test Data

Seed data (see ENV_SETUP.md §5) is the base fixture set for integration/E2E tests — do not maintain a second divergent sample dataset.

**Demo tenant:** subdomain `demo` · password `password`

| Role | Login email |
|---|---|
| Company Owner | `admin@cmsnbd.com` |
| HR Admin | `hr@cmsnbd.com` |
| Payroll Admin | `payroll@cmsnbd.com` |
| Manager | `manager@cmsnbd.com` |
| Employee | `employee@cmsnbd.com` |

Always pass `tenantSubdomain: "demo"` (or the tenant UUID) on login in tests.

## 8. Manual QA Checklist (pre-release)

- Full payroll cycle walkthrough for at least 2 countries
- Offline mobile scenario walkthrough on both iOS and Android, airplane-mode tested
- Role-based access spot-check for each default role
