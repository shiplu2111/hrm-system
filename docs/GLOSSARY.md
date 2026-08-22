# GLOSSARY.md — Domain Terms

Shared vocabulary for the HRM system. Everyone (developers, HR, AI agents) should use these terms consistently — do not invent synonyms in code, docs, or UI copy.

---

## A

**Absent**
Attendance status when an employee has no valid check-in for a working day and no approved leave covering that day.

**Access Token**
Short-lived JWT (~15 min) used to authenticate API requests. See `SECURITY.md` §2.4.

**Allowance**
A salary component added on top of Basic Salary (e.g., HRA, Transport). See `salary_components` in `DATABASE_SCHEMA.md`.

**Appraisal Cycle**
A defined time period (e.g., quarterly, annual) during which performance goals and reviews are conducted.

**Attendance Record**
A single day's check-in/check-out entry for one employee, including location and validity status.

**Audit Log**
An append-only record of who did what, when — required for sensitive actions (payroll changes, role changes). See `SECURITY.md` §7.

## B

**Basic Salary**
The base component of an employee's salary before allowances, bonuses, or deductions.

**Biometric Login**
Login using device-native fingerprint/Face ID. Verified locally on-device; backend never receives raw biometric data — only a signed challenge. See `AUTH_FLOW.md`.

## C

**Check-in / Check-out**
The act of an employee marking the start/end of their workday via the mobile app, capturing GPS coordinates.

## D

**Deduction**
An amount subtracted from gross salary (e.g., tax, Provident Fund, loan recovery).

**Designation**
An employee's job title (e.g., "Software Engineer", "HR Manager").

**Disbursement**
The process of actually paying out approved payroll to employees' bank accounts.

## E

**Employee Code**
Human-readable unique identifier for an employee (e.g., `EMP-0001`), distinct from the internal UUID.

**Exit Request**
A formal record initiating an employee's offboarding process.

## F

**Final Settlement**
The last payroll calculation for an exiting employee, covering pro-rated salary, unused leave encashment, and any dues/deductions.

## G

**Geofence**
A virtual circular boundary (defined by center coordinates + radius) around an office location. Attendance check-in/out is validated against this boundary.

**Gross Salary**
Total salary before deductions (Basic + all Allowances + Bonus).

## J

**JWT (JSON Web Token)**
The token format used for authentication. See Access Token, Refresh Token.

## L

**Late**
Attendance status when check-in occurs after the shift's configured start time plus grace period.

**Leave Balance**
The number of leave days an employee has remaining for a given leave type in a given year.

**Leave Type**
A category of leave (e.g., Casual, Sick, Earned, Unpaid), each with its own allocation rules.

## M

**Maker-Checker**
A control principle where the person who creates/prepares a sensitive action (e.g., payroll run) cannot be the same person who approves it. See `SECURITY.md` §5.

## N

**Net Salary**
The final amount paid to an employee after all deductions are subtracted from gross salary.

## O

**Offboarding**
The end-to-end process of an employee leaving the organization (exit request → asset return → final settlement).

**Office Location**
An admin-configured physical site with GPS coordinates and a geofence radius, used to validate attendance.

**Onboarding Checklist**
A set of tasks assigned to a new hire to complete during their initial period.

**Overtime**
Additional hours worked beyond the standard shift, calculated from attendance data and factored into payroll.

## P

**Payslip**
A generated document (and corresponding DB record) showing an individual employee's salary breakdown for one payroll run.

**Payroll Run**
A single execution of the payroll calculation process for a given month/period, covering all eligible employees.

**PIN**
A 4–6 digit numeric credential set up post-registration, usable as an alternative login method to password. Mobile-only — not offered on the Web App login screen, see `AUTH_FLOW.md` §11.

**Permission**
A single grantable capability, stored as a dot-notation key (e.g., `payroll.approve`, `attendance.view`). Roles are made up of permissions, not the other way around — see `ROLES_PERMISSIONS.md` §2.

**Provident Fund (PF)**
A retirement savings deduction, typically matched by employer contribution (rules vary by jurisdiction — see `PAYROLL_LOGIC.md`).

## R

**Refresh Token**
A longer-lived token used to obtain a new access token without re-entering credentials. Rotated on each use. See `SECURITY.md` §2.4.

**Regularization**
A request to correct or add a missing/incorrect attendance record, subject to manager/HR approval.

**Role**
A named, admin-configurable set of permissions assigned to a user — not a fixed list. Four roles (Super Admin, HR, Manager, Employee) are seeded by default, but `super_admin` can edit any role's permission set or create entirely new custom roles from the admin panel without a code change. See `ROLES_PERMISSIONS.md`.

## S

**Salary Structure**
The defined breakdown of an employee's compensation (basic + components), versioned by effective date to preserve history across raises.

**Self-Service**
Features allowing employees to view/manage their own data (attendance, leave, payslips) without HR intervention — available on both the Mobile App and the Web App, see `NAVIGATION.md` §9.

**Shift**
A defined work schedule (start time, end time, grace period) assigned to an employee or department.

**Soft Delete**
Marking a record as deleted (`deleted_at` timestamp) without physically removing it from the database — used for compliance-relevant records.

**System Settings**
Admin-configurable settings (secrets and business rules — SMTP, PF rate, overtime rules, branding, etc.) stored in the database instead of hardcoded or left in `.env`, editable from the admin panel without a redeploy. See `SYSTEM_SETTINGS.md`.

## T

**Tax**
Statutory income tax deduction calculated per applicable local tax rules — see `PAYROLL_LOGIC.md`.

**Tier 0 / Tier 1 / Tier 2**
The three-level split of configuration: Tier 0 (bootstrap secrets, stay in `.env`), Tier 1 (admin-configurable secrets, encrypted in DB), Tier 2 (admin-configurable business config, plain in DB). See `SYSTEM_SETTINGS.md` §1.

## U

**Unpaid Leave**
Leave taken beyond available balance or of a type not eligible for pay, resulting in a payroll deduction.

## W

**Web App**
The React web application (`apps/admin`) — serves both admin-facing tooling (HR/Manager/Super Admin) and employee self-service, role-scoped from one shared codebase. Formerly referred to as "Admin Dashboard" in earlier docs. See `ARCHITECTURE.md` §6.

---

## Status/Enum Reference (quick lookup)

**Employment Status:** `active` · `on_leave` · `suspended` · `exited`

**Attendance Status:** `present` · `late` · `early_leave` · `absent` · `on_leave` · `regularized`

**Leave Request Status:** `pending` · `approved` · `rejected` · `cancelled`

**Payroll Run Status:** `draft` · `pending_approval` · `approved` · `disbursed` · `cancelled`

**Payroll Run Type:** `regular` · `settlement`

**Candidate Stage:** `applied` · `interview` · `offer` · `hired` · `rejected`

**Role (seeded defaults — not exhaustive, dynamic):** `super_admin` · `hr` · `manager` · `employee`

---

## Note for AI Agents (Cursor)

When generating code, UI copy, or docs, always use the exact terms defined here (e.g., always "Leave Balance," never "Leave Quota" or "Remaining Leave" as a variable/label name) to keep naming consistent across `backend`, `admin`, and `mobile`. If a new domain term is introduced during development, add it here rather than letting it live only in code comments.
