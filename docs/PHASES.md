# PHASES.md — Development Roadmap

This defines the build order for the HRM system. Each phase should be functionally complete and testable before moving to the next — do not build features out of order, since later modules (payroll, performance) depend on earlier ones (employee, attendance).

---

## Phase 0 — Project Setup
**Goal:** Monorepo skeleton running end-to-end with a single "hello world" flow (login).

- [ ] Turborepo + pnpm workspace setup (`apps/backend`, `apps/admin`, `apps/mobile`, `packages/shared`)
- [ ] NestJS backend scaffold, PostgreSQL + Redis via Docker Compose
- [ ] Prisma (or chosen ORM) initial setup + connection
- [ ] React (Vite) admin scaffold with routing shell
- [ ] React Native (Expo) mobile scaffold with navigation shell
- [ ] Shared types package wired into all 3 apps
- [ ] CI basics: lint + build check on PR
- [ ] `.env.example` files for all apps

**Exit criteria:** All 3 apps run locally, backend has a health-check endpoint both admin and mobile can successfully call.

---

## Phase 1 — Auth & Employee Core
**Goal:** Users can register, log in (password), and basic employee records exist.

- [ ] `User`/`Employee` DB schema (see `DATABASE_SCHEMA.md`)
- [ ] Registration (password-based) — backend + admin (for HR-created employees) + mobile (self-register, if applicable)
- [ ] Login via password — JWT issuance, refresh token flow
- [ ] Role-based access control (Super Admin / HR / Manager / Employee) — guards + decorators
- [ ] Employee CRUD (profile, department, designation, reporting manager) — admin UI
- [ ] Employee self-profile view — mobile
- [ ] PIN setup (post-registration, in Settings) — backend + mobile
- [ ] Biometric setup (post-registration, in Settings) — backend + mobile, public-key enrollment
- [ ] Login via PIN and Biometric (in addition to password)

**Exit criteria:** An HR user can create an employee from admin; that employee can log into mobile via password, then set up PIN/biometric and re-login using either.

---

## Phase 2 — Attendance & Location Tracking
**Goal:** Employees can check in/out with GPS validation; admin can see attendance in real time.

- [ ] Office/site location config (admin) — geofence radius per site
- [ ] Check-in / check-out — mobile, captures GPS coordinates
- [ ] Server-side geofence validation logic (see `ATTENDANCE_LOGIC.md`)
- [ ] Attendance status auto-flagging (on-time / late / early-leave / absent)
- [ ] Offline check-in queue + sync — mobile
- [ ] Attendance history view — mobile (self) + admin (all employees)
- [ ] Manual attendance regularization request + approval workflow
- [ ] Shift assignment (basic: fixed shift per employee/department)

**Exit criteria:** Employee checks in from within geofence → recorded as valid; from outside → flagged; admin dashboard shows live attendance status per employee.

---

## Phase 3 — Leave Management
**Goal:** Employees can apply for leave; managers/HR can approve.

- [ ] Leave type configuration (Casual/Sick/Earned/Unpaid) — admin
- [ ] Leave balance calculation/allocation per employee per year
- [ ] Apply for leave — mobile
- [ ] Approve/reject workflow — Manager → HR (configurable chain) — admin
- [ ] Leave calendar view — admin + mobile
- [ ] Notifications on leave status change

**Exit criteria:** Employee applies for leave → manager approves → balance updates → employee notified.

---

## Phase 4 — Payroll
**Goal:** Full salary calculation and payslip generation, using attendance + leave data.

- [ ] Salary structure setup per employee (Basic + Allowances) — admin
- [ ] Deduction rules: Tax, PF, Insurance, Loan/Advance — admin config
- [ ] Overtime calculation from attendance data
- [ ] Monthly payroll run (background job) — see `PAYROLL_LOGIC.md`
- [ ] Payroll approval workflow before finalization
- [ ] Payslip PDF generation
- [ ] Payslip view — mobile (self-service)
- [ ] Bank disbursement export (file-based, per open decision in `ARCHITECTURE.md`)
- [ ] Payroll cost reports — admin

**Exit criteria:** A full monthly payroll run executes for a test employee set, correctly factoring attendance/leave/overtime, producing accurate payslips.

---

## Phase 5 — Recruitment & Onboarding
**Goal:** Basic hiring pipeline and structured onboarding for new employees.

- [ ] Job requisition creation — admin
- [ ] Candidate pipeline (Applied → Interview → Offer → Hired) — admin
- [ ] Convert hired candidate → employee record (links to Phase 1 employee module)
- [ ] Onboarding checklist per new hire

**Exit criteria:** A candidate can be tracked through the pipeline and converted into an active employee record with an onboarding checklist assigned.

---

## Phase 6 — Performance Management
**Goal:** Goal-setting and appraisal cycles.

- [ ] KPI/Goal setting per employee — admin
- [ ] Appraisal cycle configuration (quarterly/annual)
- [ ] Self-review + manager review — mobile + admin
- [ ] Performance history view

**Exit criteria:** An appraisal cycle can run start-to-finish for a test employee with both self and manager review captured.

---

## Phase 7 — Training & Offboarding
**Goal:** Round out the employee lifecycle.

- [ ] Training program listing + enrollment — admin + mobile
- [ ] Training completion tracking
- [ ] Exit request workflow
- [ ] Final settlement calculation (links to Payroll module)
- [ ] Asset return checklist

**Exit criteria:** An employee exit can be processed end-to-end, including final settlement.

---

## Phase 8 — Reports, Analytics & Polish
**Goal:** Cross-module reporting and production readiness.

- [ ] Attendance summary reports (daily/monthly/department)
- [ ] Payroll cost/summary reports
- [ ] Leave utilization reports
- [ ] Export to CSV/PDF across reports
- [ ] Notification system hardening (email/SMS/push channels finalized)
- [ ] Performance/load testing
- [ ] Security audit pass (see `SECURITY.md`)
- [ ] Bengali localization (if in scope — see `PRD.md` open question)

**Exit criteria:** System is production-ready — reports accurate, security reviewed, load-tested for target employee count.

---

## Notes on Sequencing

- **Do not start Payroll (Phase 4) before Attendance (Phase 2) and Leave (Phase 3) are stable** — payroll depends on their data.
- **Auth (Phase 1) must be fully done, including biometric, before broad mobile feature work** — retrofitting auth later is costly.
- Recruitment, Performance, and Training (Phases 5–7) are relatively independent of each other and can be reordered or parallelized if team capacity allows, but all depend on the core Employee module from Phase 1.
- Each phase should ship with its own tests (see `TESTING.md`) — do not defer testing to Phase 8.

## MVP Definition

If a faster launch is needed, the **minimum viable product** = Phase 0 + 1 + 2 + 3 + 4 (Setup → Auth/Employee → Attendance → Leave → Payroll). Recruitment, Performance, and Training can launch post-MVP.
