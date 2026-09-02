# PRD.md — Product Requirements Document

## 1. Product Vision

A **multi-tenant, country-configurable HR + Payroll + Attendance + Workforce Management SaaS platform**. One codebase serves many companies (tenants) across many countries, with country-specific tax, leave, and payroll law handled through configuration — not hard-coded logic.

The platform combines what tools like BambooHR (HR core), Deputy (roster/attendance), and dedicated payroll software each do separately, into one system.

## 2. Target Users

- **Company Admin / HR Admin** — manages employees, org structure, policies
- **Payroll Admin / Finance** — runs payroll, approves, finalizes, handles tax/compliance
- **Manager** — approves leave/OT/expense for their team, views team attendance
- **Employee** — clocks in/out (often offline, in the field or without reliable internet), applies for leave, views payslips, uses Employee Self-Service
- **Super Admin (Anthropic-internal to the SaaS vendor)** — manages tenants, billing, platform health

## 3. Key Product Differentiators

- **Country-independent core**: adding a new country is a configuration exercise, not a code change (see ARCHITECTURE.md, PAYROLL_LOGIC.md)
- **Offline-first mobile attendance**: employees can clock in/out, view roster, and apply for leave without an active internet connection; data syncs when connectivity returns (see OFFLINE_SYNC.md)
- **Dynamic payroll rule engine**: admins define earnings, deductions, and conditional rules without developer involvement
- **Full audit trail**: every payroll and sensitive-data change is tracked (see AUDIT_LOG.md) — this directly protects against financial/compliance loss

## 4. Scope

Full functional scope is defined in **MODULES.md** (47 module categories). Build order and phase priority is defined in **PHASES.md**.

## 5. Out of Scope (for now)

- Full accounting/ERP replacement (only GL export/integration, not a general ledger system)
- Native desktop applications (web + mobile only)
- On-premise installation for individual clients in Phase 1 (SaaS-hosted only; local storage option exists at the file-storage layer, not as a full on-prem deployment)

## 6. Success Criteria (MVP)

- A tenant can be onboarded, configure their country/company/org structure, add employees, and run one full payroll cycle (attendance → leave → payroll → payslip → payment) without developer intervention
- Payroll calculated correctly for at least 2 distinct country configurations using the same codebase
- Employee mobile app functions fully offline for clock in/out and syncs correctly with no data loss or duplication on reconnect
- Every payroll-affecting change is visible in the audit log

## 7. Key Risks (why this documentation set exists)

- **Hard-coding country/payroll logic** → blocks multi-country expansion, requires rewrites
- **Skipping the offline-sync design before building attendance** → data loss, duplicate/missed attendance records, direct payroll/financial impact
- **Building UI before the DB schema and payroll engine are finalized** → expensive rework

## 8. Related Documents

See **DOCUMENTATION_INDEX.md** for the full documentation map.
