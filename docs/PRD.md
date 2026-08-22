# Product Requirements Document (PRD) — HRM System

## 1. Overview

### 1.1 Purpose
A Human Resource Management (HRM) system to digitize and centralize employee management, attendance tracking with location verification, and full payroll processing for an organization. The system consists of a mobile app (employee-facing) and an admin web dashboard (HR/management-facing), backed by a single REST API.

### 1.2 Goals
- Eliminate manual/paper-based attendance and payroll processes
- Verify employee attendance using GPS location + geofencing
- Provide flexible, secure login (Password, PIN, Biometric)
- Automate payroll calculation (salary, deductions, tax, overtime)
- Give managers/HR real-time visibility into attendance, leave, and workforce data
- Provide employees self-service access to their own data (attendance, leave, payslips)

### 1.3 Out of Scope (v1)
- Multi-country/multi-currency payroll (single country/currency assumed for v1)
- Deep third-party accounting software integration (planned for later phase)
- Advanced AI-based performance analytics

## 2. Target Users

| Persona | Description | Primary Interface |
|---|---|---|
| Super Admin | System owner/IT admin, configures modules, roles, and system settings | Web App |
| HR Officer | Manages employees, payroll, leave, recruitment | Web App |
| Manager | Approves leave, views team attendance/performance | Web App / Mobile |
| Employee | Checks in/out, applies leave, views payslip | Mobile App (check-in) / Web App (self-service) |
| *(Custom roles)* | Org-defined, e.g. "Field Technician" — created and permissioned via the admin panel without a code change | Depends on granted permissions, per `ROLES_PERMISSIONS.md` |

Roles are **dynamic**, not fixed — `super_admin` can create new roles and adjust any role's permissions from the admin panel; the four personas above are the seeded defaults, not a hardcoded ceiling. See `ROLES_PERMISSIONS.md`.

"Admin Dashboard" is now referred to as the **Web App** throughout this document set — it serves both admin-facing tooling and employee/manager self-service in one app, role-scoped. See `ARCHITECTURE.md` §6.

## 3. Modules & Requirements

### 3.1 Authentication
- **Registration:** Email/Employee ID + Password only
- **Login options (any one, on mobile):**
  - Password
  - PIN (4–6 digit, set up after registration via Settings)
  - Biometric (fingerprint/Face ID, set up after registration via Settings, device-local verification + public key challenge to backend)
- **Login on web:** Password only — PIN/Biometric are mobile-only by design, see `AUTH_FLOW.md` §11
- Failed attempt lockout/cooldown for PIN and password
- JWT-based session with refresh token
- See `AUTH_FLOW.md` for full technical flow

### 3.2 Employee Management
- Employee profile (personal info, contact, documents, emergency contact)
- Department / Designation / Reporting manager assignment
- Org chart view
- Document upload (contract, ID, certificates)
- Employee status: Active / On Leave / Suspended / Exited

### 3.3 Attendance & Location Tracking
- Check-in / Check-out via mobile app
- GPS location captured at check-in/out
- Geofencing: attendance only valid within configured office radius (configurable per office/site)
- Manual override/regularization request (with approval) for edge cases (field employees, network issues)
- Attendance history view (employee + admin)
- Late/early/absent auto-flagging based on shift rules
- Offline check-in support with sync when back online
- See `ATTENDANCE_LOGIC.md`

### 3.4 Leave Management
- Leave types: Casual, Sick, Earned, Unpaid (configurable)
- Leave balance tracking per employee per year
- Apply / Approve / Reject workflow (Manager → HR)
- Leave calendar view
- Notification on status change

### 3.5 Payroll
- Salary structure: Basic + Allowances (HRA, Transport, etc.) + Bonus
- Deductions: Tax, Provident Fund, Insurance, Loan/Advance recovery
- Overtime calculation based on shift/attendance data
- Automated monthly payroll run
- Payslip generation (PDF)
- Bank disbursement file export (or integration, phase 2)
- Payroll approval workflow before disbursement
- See `PAYROLL_LOGIC.md`

### 3.6 Recruitment & Onboarding
- Job requisition creation
- Candidate pipeline (Applied → Interview → Offer → Hired)
- Onboarding checklist for new hires

### 3.7 Performance Management
- KPI/Goal setting per employee
- Periodic appraisal cycles
- Manager review + self-review

### 3.8 Training & Development
- Training program listing
- Employee enrollment & completion tracking

### 3.9 Offboarding
- Exit request workflow
- Final settlement calculation (linked to payroll)
- Asset return checklist

### 3.10 Notifications
- Push (mobile), Email, SMS (configurable channels)
- Triggers: leave status, payroll processed, attendance anomaly, announcements

### 3.11 Reports & Analytics
- Attendance summary (daily/monthly, by department)
- Payroll summary/cost reports
- Leave utilization reports
- Exportable (CSV/PDF)

### 3.12 Role-Based Access Control
- **Dynamic roles**, admin-configurable — Super Admin, HR, Manager, Employee are the seeded defaults; custom roles can be created from the admin panel without a code change
- Module-level and action-level permissions (view/create/edit/approve), assignable per role at a granular (dot-notation key) level
- See `ROLES_PERMISSIONS.md`

### 3.13 System Settings
- Admin panel section (Super Admin only, mostly) for configuring: SMTP/SMS/storage integrations, payroll rules (PF rate, overtime-eligible roles, insurance), attendance rules (geofence defaults, background location toggle), branding, and leave policy — without requiring a redeploy for changes
- See `SYSTEM_SETTINGS.md`

## 4. Non-Functional Requirements

- **Security:** All sensitive data encrypted at rest and in transit; see `SECURITY.md`
- **Performance:** API response < 500ms for standard queries under normal load
- **Availability:** Target 99.5% uptime
- **Scalability:** Support growth from ~50 to 5,000+ employees without architecture change
- **Platform:** Admin dashboard — modern browsers; Mobile — Android & iOS (cross-platform via React Native)
- **Localization:** Bengali + English UI support (v1 minimum: English, Bengali as fast-follow)
- **Data Retention:** Attendance/payroll records retained per local labor law requirements

## 5. Success Metrics

- % reduction in manual attendance disputes
- Payroll processing time (target: same-day run for < 500 employees)
- Employee adoption rate of self-service features (target: >80% monthly active)
- Attendance data accuracy (GPS-verified vs manual override ratio)

## 6. Assumptions & Constraints

- Single organization, single country payroll/tax rules for v1 — **Bangladesh**, per `PAYROLL_LOGIC.md`
- Employees have smartphones capable of biometric auth for mobile login
- Office locations have fixed, known GPS coordinates for geofencing setup
- Internet connectivity may be intermittent for field employees → offline sync required

## 7. Open Questions

- [x] ~~Which country's tax/labor law applies for payroll rules?~~ — **Resolved: Bangladesh.** Payroll follows the Bangladesh Labour Act 2006 (as amended) and NBR Finance Ordinance 2025 tax slabs. Currency: BDT. Full detail in `PAYROLL_LOGIC.md`.
- [ ] Is background (continuous) location tracking required, or only at check-in/out? (still open — default assumption remains foreground-only at check-in/out, per `MOBILE_PERMISSIONS.md` §2.2)
- [ ] Will one device be used by one employee only, or shared devices in some locations? (still open)
- [ ] Is bank disbursement a direct integration or manual export file in v1? (still open — likely routed via BEFTN per `PAYROLL_LOGIC.md` §11, exact approach TBD)

## 8. Release Phases

See `PHASES.md` for the phased build plan (MVP → full feature set).
