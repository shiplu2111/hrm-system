# MODULES.md — Module Summary

This document gives a one-stop summary of every business module: what it does, its key inputs/outputs, which other modules it depends on, and where to find deeper detail. Use this as an index before diving into a specific module's code or detailed doc.

---

## 1. Auth
**Purpose:** Identity verification and session management — Password / PIN / Biometric.

- **Inputs:** email+password (register/login), PIN (login), signed challenge (biometric login)
- **Outputs:** JWT access + refresh token
- **Depends on:** Employee module (a `user` links to an `employee` record)
- **Used by:** Every other module (all protected routes require a valid session)
- **Deep dive:** `AUTH_FLOW.md`, `SECURITY.md`

---

## 2. Employee Management
**Purpose:** Central source of truth for employee identity, org structure, and documents.

- **Inputs:** Employee profile data, department/designation assignment, documents (HR-entered via admin)
- **Outputs:** Employee record consumed by nearly every other module
- **Depends on:** Auth (for user linkage)
- **Used by:** Attendance, Leave, Payroll, Recruitment (on hire), Performance, Training, Offboarding
- **Deep dive:** `DATABASE_SCHEMA.md` §2

---

## 3. Attendance & Location Tracking
**Purpose:** Record and validate when/where employees check in and out.

- **Inputs:** GPS coordinates + timestamp at check-in/out (mobile)
- **Outputs:** `attendance_records` with status (present/late/absent/etc.), used downstream by Payroll for overtime/absence deduction
- **Business logic:** Server-side geofence validation against `office_locations`; offline check-ins queued and synced; regularization requests for exceptions
- **Depends on:** Employee (office/shift assignment)
- **Used by:** Payroll (overtime/absence calc), Reports
- **Deep dive:** `ATTENDANCE_LOGIC.md`

---

## 4. Leave Management
**Purpose:** Track leave balances and manage the apply/approve workflow.

- **Inputs:** Leave application (type, date range, reason)
- **Outputs:** Approved/rejected leave records; updates `leave_balances`; feeds Attendance (leave days ≠ absent) and Payroll (unpaid leave deduction)
- **Business logic:** Balance check before allowing application; approval chain (Manager → HR, configurable)
- **Depends on:** Employee, Attendance (leave days shouldn't double-count as absence)
- **Used by:** Payroll, Attendance, Reports
- **Deep dive:** `DATABASE_SCHEMA.md` §4

---

## 5. Payroll
**Purpose:** Calculate and disburse employee salary, factoring attendance, leave, overtime, and deductions.

- **Inputs:** `salary_structures`, `attendance_records` (overtime/absence), `leave_requests` (unpaid leave), deduction rules
- **Outputs:** `payroll_runs` → `payslips` → PDF payslip; bank disbursement export
- **Business logic:** Maker-checker approval (preparer ≠ approver, per `SECURITY.md`); tax/PF/deduction calculation; overtime formula
- **Depends on:** Employee, Attendance, Leave
- **Used by:** Reports, Offboarding (final settlement)
- **Deep dive:** `PAYROLL_LOGIC.md`

---

## 6. Recruitment & Onboarding
**Purpose:** Manage hiring pipeline and convert candidates into employees.

- **Inputs:** Job requisitions, candidate applications
- **Outputs:** Candidate pipeline status; on hire → creates an `employees` record + `onboarding_checklists`
- **Depends on:** Department/Designation (from Employee module)
- **Used by:** Employee module (hire conversion), Training (new-hire enrollment)
- **Deep dive:** `DATABASE_SCHEMA.md` §6

---

## 7. Performance Management
**Purpose:** Goal-setting and structured appraisal cycles.

- **Inputs:** Goals set by employee/manager, self-review, manager-review ratings/comments
- **Outputs:** `performance_reviews` history per appraisal cycle
- **Depends on:** Employee (reporting manager relationship determines reviewer)
- **Used by:** Reports (optional), future compensation review linkage
- **Deep dive:** `DATABASE_SCHEMA.md` §7

---

## 8. Training & Development
**Purpose:** Track training programs and employee enrollment/completion.

- **Inputs:** Training program creation (admin), employee enrollment
- **Outputs:** Completion status per employee per program
- **Depends on:** Employee
- **Used by:** Onboarding (assign mandatory training to new hires), Reports
- **Deep dive:** `DATABASE_SCHEMA.md` §8

---

## 9. Offboarding
**Purpose:** Manage employee exit process end-to-end.

- **Inputs:** Exit request (employee/HR-initiated), asset return checklist
- **Outputs:** Exit status, links to a final settlement payslip
- **Business logic:** Final settlement calculation triggers Payroll module for a one-off settlement run
- **Depends on:** Employee, Payroll
- **Used by:** Employee module (status → exited)
- **Deep dive:** `DATABASE_SCHEMA.md` §8

---

## 10. Notifications
**Purpose:** Deliver alerts across push/email/SMS for events in other modules.

- **Inputs:** Trigger events from other modules (leave status change, payroll processed, attendance anomaly, etc.)
- **Outputs:** `notifications` records + dispatched message via chosen channel
- **Business logic:** Queued via background job (Bull/Redis) — never sent synchronously in the request/response cycle
- **Depends on:** All modules that trigger events
- **Deep dive:** `ARCHITECTURE.md` §3.4

---

## 11. Reports & Analytics
**Purpose:** Cross-module reporting for HR/Admin decision-making.

- **Inputs:** Aggregated data from Attendance, Leave, Payroll
- **Outputs:** Attendance summaries, payroll cost reports, leave utilization — exportable CSV/PDF
- **Depends on:** Attendance, Leave, Payroll (read-only aggregation, no writes back to source modules)
- **Deep dive:** `PRD.md` §3.11

---

## 12. Role-Based Access Control (cross-cutting)
**Purpose:** Not a standalone feature module — enforced across every module.

- **Roles:** Super Admin, HR, Manager, Employee
- **Business logic:** Server-side enforcement only (frontend hiding is UX, not security) — see `SECURITY.md` §3
- **Deep dive:** `SECURITY.md` §3, `RULES.md` §3

---

## Module Dependency Graph (simplified)

```
Auth ──────────────┐
                    ▼
              Employee ◄────────────────┐
             /    |    \                │
            ▼     ▼     ▼               │
      Attendance Leave Recruitment      │
            \     |    /                │
             ▼    ▼   ▼                 │
              Payroll ────────► Offboarding
                 │
                 ▼
             Reports / Notifications
```

Performance and Training depend on Employee only, and are otherwise independent of the Attendance/Leave/Payroll chain — they can be built in parallel (see `PHASES.md`).

## Build Order Reference

See `PHASES.md` for the actual sequencing — this document is a reference index, not a build plan.
