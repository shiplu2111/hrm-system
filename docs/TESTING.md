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

- Automated test suite that attempts cross-tenant data access (as User A from Tenant 1, try to read/write Tenant 2 data) and asserts failure on every tested endpoint — run in CI, not just manually (see SECURITY.md §8).

## 5. Payroll Regression Tests

- Golden-file/snapshot tests: known input (attendance + leave + salary structure) → known expected payslip output, for each supported country configuration. Any change to the calculation engine must not silently alter these outputs without an explicit, reviewed update to the expected snapshot.

## 6. CI Requirements

- Lint, type-check, unit tests, and integration tests run on every PR; merge blocked on failure.
- E2E suite run at minimum before every production deploy (see DEPLOYMENT.md §2).

## 7. Test Data

- Seed data (see ENV_SETUP.md §5) doubles as the base fixture set for integration/E2E tests — avoid maintaining two divergent sets of "sample data."

## 8. Manual QA Checklist (pre-release)

- Full payroll cycle walkthrough for at least 2 countries
- Offline mobile scenario walkthrough on both iOS and Android, airplane-mode tested
- Role-based access spot-check for each default role
