# TESTING.md — Testing Strategy

Defines what must be tested, at what level, and where, across `backend`, `admin`, and `mobile`. Per `RULES.md` §9, payroll and attendance geofence logic have **mandatory** unit test coverage — no PR touching those modules merges without tests.

---

## 1. Testing Pyramid (this project)

```
        ▲
        │   E2E (few)         — critical user flows only
        │   Integration (some) — module boundaries, DB, auth
        │   Unit (many)        — business logic, pure functions
        ▼
```

- Favor unit tests for business logic (payroll math, geofence calc, status determination) — fast, isolated, no DB needed.
- Integration tests for anything crossing a boundary (service → DB, controller → service → DB, auth flow end-to-end).
- E2E sparingly, for the handful of flows where a break would be catastrophic (login, check-in, payroll approval, payslip generation).

---

## 2. Backend (NestJS)

### 2.1 Tools
- **Unit/Integration:** Jest (NestJS default)
- **E2E:** Jest + Supertest (`@nestjs/testing` + `supertest`)
- **Test DB:** separate PostgreSQL database/schema for integration/E2E tests, reset between runs — never run tests against a dev/staging DB with real data.

### 2.2 Unit Tests (services, pure logic)
Mandatory coverage, per `RULES.md` §9 and the relevant logic docs:

| Area | Test against | Doc reference |
|---|---|---|
| Payroll calculation (gross, net, deductions, overtime, pro-ration) | Fixed input/output tables | `PAYROLL_LOGIC.md` §13 |
| Tax calculation strategy | Official tax authority worked examples (once jurisdiction confirmed) | `PAYROLL_LOGIC.md` §4.1 |
| Maker-checker enforcement | Same user cannot prepare + approve | `PAYROLL_LOGIC.md` §8 |
| Geofence distance (Haversine) | Known coordinate pairs, expected distances | `ATTENDANCE_LOGIC.md` §11 |
| Attendance status determination | On-time/late/early-leave/grace-period boundaries | `ATTENDANCE_LOGIC.md` §11 |
| Absence batch job | Idempotency (re-run doesn't duplicate) | `ATTENDANCE_LOGIC.md` §11 |
| Auth: password/PIN/biometric | Success + failure paths, lockout, challenge expiry | `AUTH_FLOW.md` §15 |
| Refresh token rotation | Reuse of revoked token triggers full session revocation | `AUTH_FLOW.md` §15 |
| Global exception filter | Validation/business/unknown error shapes | `ERROR_HANDLING.md` §9 |

**Target:** ≥ 70% coverage on all `*.service.ts` files (per `RULES.md` §9). Coverage is a floor, not the goal — critical paths above should be near 100% regardless of the overall percentage.

### 2.3 Integration Tests
- Auth flows end-to-end against a real (test) DB: register → login → protected route access → refresh → logout.
- Attendance offline-sync upsert: same `client_generated_id` submitted twice → one record (`ATTENDANCE_LOGIC.md` §11, `API_GUIDELINES.md` §9).
- Payroll run lifecycle: draft → pending_approval → approved (with maker-checker enforced) → disbursed, verifying status transitions and rejecting invalid ones.
- Role-based access control: verify a `manager` role cannot access another manager's team data, an `employee` cannot access another employee's payslip, etc. (`SECURITY.md` §3).

### 2.4 E2E Tests (critical flows only)
- Full login flow (password) via HTTP, receiving valid tokens.
- Full check-in flow: mobile-simulated request → geofence validation → correct status stored.
- Full payroll approval flow: draft creation → approval by a second user → payslip generation triggered.

### 2.5 Background Job Tests
- Payroll run processing job: failure on one employee's payslip doesn't block others (`ERROR_HANDLING.md` §8).
- Notification dispatch job: retry behavior on provider failure.
- Absence detection job: correct timezone handling per `ATTENDANCE_LOGIC.md` §7.

---

## 3. Web App (React)

### 3.1 Tools
- **Unit/Component:** Vitest + React Testing Library
- **E2E:** Playwright (recommended — fast, reliable, good CI support)

### 3.2 What to Test
- **Utility/hook logic:** any non-trivial calculation done client-side (e.g., formatting currency, computing display-only aggregates) — pure functions, easy to unit test.
- **Component behavior:** forms validate correctly, role-based UI elements show/hide appropriately (note: this is a UX test, not a security boundary — server enforcement is what's actually tested in backend RBAC tests, per `SECURITY.md` §3).
- **API client layer:** mock server responses (success/error envelope per `API_GUIDELINES.md` §5–6) and verify the app handles each error code per the retry/guidance table in `ERROR_HANDLING.md` §7.
- **Critical E2E flows:** HR login → create employee → view on list; HR reviews and approves a payroll run (maker-checker UI enforces this too, not just backend); Manager approves a leave request.

### 3.3 What NOT to Over-Test
- Don't write component snapshot tests for every UI element — brittle, low value. Focus on behavior (user interacts, expected result happens), not implementation detail or exact markup.

---

## 4. Mobile App (React Native / Expo)

### 4.1 Tools
- **Unit/Component:** Jest + React Native Testing Library
- **E2E:** Detox or Maestro (choose one — Maestro is lighter-weight and often easier to maintain for smaller teams; confirm choice before Phase 2 mobile work begins 🔶)

### 4.2 What to Test
- **Offline queue logic:** events queued locally, synced correctly on reconnect, no duplicates on retry (`ATTENDANCE_LOGIC.md` §8) — this is high-risk logic and should have solid unit coverage independent of any UI.
- **Auth local logic:** secure storage read/write (mocked), biometric prompt success/failure handling, PIN entry validation.
- **Location capture:** mock `expo-location` responses, verify correct payload sent to API (including `accuracy_meters`, `client_generated_id`).
- **Critical E2E flows:** login (all three methods), check-in/check-out (including simulated offline → reconnect → sync), leave application, payslip view.

### 4.3 Permission-Dependent Testing
- Location and biometric permissions can't be fully automated in all CI environments — mock the permission API responses (granted/denied/restricted) to test app behavior in each case, and supplement with manual device testing before releases (`MOBILE_PERMISSIONS.md`).

---

## 5. Shared Package (`packages/shared`)

- Pure utility functions (currency formatting, date helpers) get straightforward unit tests (Jest/Vitest — either works since these are framework-agnostic).
- Type definitions themselves aren't "tested" directly, but a type-check step (`tsc --noEmit`) should run in CI to catch drift/breakage across apps that consume shared types.

---

## 6. CI Pipeline Expectations

Every PR must pass, before merge:
1. Lint (all apps)
2. Type-check (all apps, including `packages/shared` consumers)
3. Unit tests (all apps)
4. Integration tests (backend)
5. Build succeeds (all apps)

E2E suites (§2.4, §3.2, §4.2) run on a slower cadence — e.g., on merge to `main`/`develop`, or nightly — rather than blocking every PR, to keep feedback loops fast. Exception: if a PR specifically touches a critical E2E-covered flow (auth, check-in, payroll approval), its relevant E2E test(s) should run as part of that PR's checks.

---

## 7. Test Data & Fixtures

- Use factory functions (not hardcoded fixtures duplicated across test files) for common entities (`createTestEmployee()`, `createTestPayrollRun()`, etc.) — keep them in a shared `test-utils` location per app.
- Never use real employee/payroll data (even anonymized) in test fixtures — use clearly synthetic data (e.g., `Test Employee`, fake but valid-format bank details) to avoid any confusion with production data.
- Reset test DB state between test files/suites — no test should depend on another test's leftover state.

---

## 8. What Requires Tests Before Merge (Hard Gate)

Per `RULES.md` §9 and this document, the following **cannot** merge without tests, regardless of deadline pressure:
- [ ] Payroll calculation logic (any change to `PAYROLL_LOGIC.md`-derived code)
- [ ] Geofence/attendance status logic (any change to `ATTENDANCE_LOGIC.md`-derived code)
- [ ] Auth flows — password/PIN/biometric, token refresh/rotation
- [ ] Any endpoint handling money (payslips, bank accounts, deductions)
- [ ] Offline sync upsert logic (mobile + backend)

---

## 9. Open Items

- [ ] Confirm mobile E2E tool: Detox vs Maestro (§4.1)
- [ ] Set up test DB provisioning in CI (separate from dev, per §2.1)
- [ ] Define coverage reporting tool/threshold enforcement in CI (e.g., fail PR if backend service coverage drops below 70%)
