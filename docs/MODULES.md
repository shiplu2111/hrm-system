# MODULES.md

Full functional module list for the HRMS/HCM SaaS platform. This is the single source of truth for feature scope — every module and its features listed here must be accounted for in design, DB schema, and implementation.

> See PHASES.md for build order. See PRD.md for the product vision this scope serves.

## 01. SaaS Platform & Multi-Tenancy

**Phase:** MVP — Phase 1

- Tenant / Company registration and isolation (tenant_id on all data tables)
- Super Admin panel (separate from company/customer admin panel)
- Tenant provisioning and lifecycle (create, suspend, delete, restore)
- Tenant-level data isolation and encryption
- Tenant usage & storage monitoring
- Feature management per tenant (feature flags tied to subscription plan)
- System-wide notifications and announcements
- Sandbox / staging environment per tenant (test company for client evaluation)
- White-labeling: custom domain, branding, logo, colors, email sender per tenant
- Configurable file storage backend: S3-compatible object storage (AWS S3, DigitalOcean Spaces, MinIO, etc.) OR local/hosting-server disk storage — selectable at setup, with the storage driver abstracted so switching later doesn't require code changes

## 02. Global Country & Compliance Framework

**Phase:** MVP — Phase 1

- Country master (state/province, currency, timezone, date format, number format)
- Country-specific financial year and payroll frequency
- Country-specific tax rules, tax brackets, tax year
- Country-specific social security / superannuation / pension rules
- Country-specific leave rules and public holidays
- Country-specific overtime rules and standard working hours
- Country-specific employment/termination rules
- Hierarchy: Global default → Country → State/Province → Company → Location → Employee contract (override chain)
- Country configuration admin screen (add new country without code changes)
- Rule versioning / effective-dating (law changes must not alter historical payroll)
- Compliance calendar: statutory filing deadlines, tax submission reminders, license/permit renewals

## 03. Company / Organization Setup

**Phase:** MVP — Phase 1

- Company profile, branches, locations
- Hierarchical department (parent_department_id, unlimited nesting)
- Dynamic designation (name, code, department, job level, salary grade)
- Dynamic job level / grade (company-configurable, e.g. L1 Intern → L8 Executive)
- Dynamic employment type (Full Time, Part Time, Casual, Contractor, Intern, etc. — company can add custom types)
- Team management
- Cost centre
- Reporting structure / manager hierarchy
- Interactive org chart visualization with vacant position tracking

## 04. Employee Core (HRIS)

**Phase:** MVP — Phase 1

- Employee profile: personal info, contact, emergency contact, family/dependents, address
- Bank account and tax information
- Employment information: job title, department, designation, employment type, employment status
- Hire date, probation period, confirmation date, salary start/end date
- Manager/supervisor, work location, cost centre, team assignment
- Employee documents and notes
- Employee history / audit log
- Employee lifecycle state machine: Applicant → Interview → Offer → Hired → Onboarding → Probation → Confirmed → Promotion/Transfer → Resignation/Termination

## 05. Employee Lifecycle Events

**Phase:** MVP — Phase 1

- Promotion
- Transfer
- Salary revision
- Probation and confirmation
- Suspension
- Resignation and termination
- Rehire
- Exit interview
- Full & final settlement

## 06. Contract Management

**Phase:** Phase 2

- Employment contract (start/end date, probation, working hours, pay rate, pay frequency)
- Leave entitlement, overtime rule, notice period, termination rule within contract
- Contract renewal workflow
- Contract expiry alerts
- Multiple contract types (fixed-term, permanent, casual, project-based)
- Contract documents storage

## 07. Recruitment / ATS

**Phase:** Phase 2

- Job requisition, job position, job description
- Candidate database and application tracking
- Resume/CV parsing and storage
- Screening workflow
- Multi-round interview (Technical → HR → Management → Final Decision)
- Interview scheduling, scoring, and feedback
- Offer letter generation and approval
- Candidate → Employee conversion on hire

## 08. Onboarding / Offboarding

**Phase:** Phase 2

- Onboarding checklist and required document collection
- Document verification workflow
- Policy acceptance tracking
- Equipment / ID card / system access provisioning
- Welcome email/notification automation
- Offboarding checklist: clearance, asset return, access revocation, exit interview, final settlement

## 09. Document Management (Generalized)

**Phase:** MVP — Phase 1

- Admin-defined document types with configurable fields (text, number, date, dropdown, checkbox, radio, file, image, signature)
- Required / optional flag, expiry tracking, verification workflow
- Employee-specific vs company-wide documents
- Automatic expiry notifications (e.g. passport expiring in 30 days)
- Custom Field / Form Builder generalized across ALL entities (Employee, Company, Department, etc.), not just documents
- E-signature integration for offer letters, contracts, and policy acknowledgment

## 10. Attendance

**Phase:** MVP — Phase 1

- Attendance methods: Manual, Mobile, Fingerprint, Face Recognition, QR, GPS, Device/API, CSV/Excel import
- Attendance status: Present, Absent, Late, Early Leave, Half Day, Holiday, Weekend, Leave, WFH, Business Trip
- Clock in/out with break start/end, total working hours, overtime calculation
- Break management (lunch, custom breaks) with gross vs net working hours
- Missed punch handling and attendance regularization workflow
- Attendance correction request and approval

## 11. Timesheet

**Phase:** Phase 2

- Timesheet by employee, date, project, task
- Start/end time, break, total hours
- Billable vs non-billable hours
- Timesheet approval workflow

## 12. Roster / Shift Management

**Phase:** MVP — Phase 1

- Shift master: name, start/end time, break, grace period, minimum hours, OT rule, late rule, early leave rule, weekend rule
- Shift types: Fixed, Rotating, Night, Split, Flexible, Overnight
- Roster assignment: employee → shift → date → location
- Shift swap requests and approval
- Roster change notifications

## 13. Leave Management

**Phase:** MVP — Phase 1

- Configurable leave types (Annual, Sick, Personal, Unpaid, Maternity/Paternity, Compassionate, Custom)
- Leave policy: entitlement, accrual, carry-forward, expiry, encashment, probation restriction, negative balance, half-day leave
- Configurable multi-step approval workflow (Employee → Manager → HR)
- Leave balance tracking and reporting

## 14. Holiday Calendar

**Phase:** MVP — Phase 1

- Public holiday (country), state/province holiday, company holiday, branch-specific holiday
- Employee-specific calendar overrides

## 15. Overtime Management

**Phase:** MVP — Phase 1

- Automatic and manual overtime detection
- Overtime request and approval workflow
- Configurable OT rates: weekday, weekend, holiday, night
- Maximum overtime limits/caps

## 16. Payroll Setup & Salary Structure

**Phase:** MVP — Phase 1

- Pay schedule: Weekly, Fortnightly, Semi-monthly, Monthly, Custom
- Payroll period definition (start, end, payment date, status)
- Dynamic earnings: Basic, Hourly Rate, Overtime, Allowance, Bonus, Commission, Incentive, Transport, Housing, Meal, custom earnings
- Dynamic deductions: Tax, Loan, Advance, Unpaid Leave, Late Deduction, Insurance, Pension, Superannuation, custom deductions
- Admin-defined earning/deduction types (no hard-coding)
- Multiple salary structures per employee (hourly / daily / monthly)

## 17. Payroll Rules / Formula Engine

**Phase:** Phase 2

- Admin-configurable rule engine (e.g. IF hours > 8 THEN overtime = rate × 1.5)
- Visual/UI-based formula builder for Gross → Deductions → Net Pay calculation chain
- Conditional rules based on employee type, attendance, leave status
- Rule versioning tied to effective dates (country law versioning)
- Rule Resolver pattern: Country Rules → State Rules → Company Policy → Employee Contract → Calculation

## 18. Payroll Processing

**Phase:** MVP — Phase 1

- End-to-end pipeline: Attendance + Leave + Timesheet + Overtime + Salary Structure + Bonuses + Deductions → Calculation → Review → Approval → Finalize
- Payroll status flow: Draft → Calculated → Under Review → Approved → Finalized → Paid → Cancelled
- Payroll lock/freeze after finalization
- Payroll recalculation and adjustment (with audit trail)
- Retroactive salary adjustment
- Payroll simulation ('what-if' net pay preview without committing)
- Payroll reconciliation

## 19. Payslip & Salary Payment

**Phase:** MVP — Phase 1

- Auto-generated payslip: employee info, earnings, deductions, gross/net summary, PDF/email/mobile delivery
- Payment batch processing and bank transfer file generation
- Payment status tracking, failed payment handling, transaction reference
- Payment reconciliation
- Final settlement payslip (on termination/resignation)

## 20. Tax Management

**Phase:** MVP — Phase 1

- Tax engine: Country → Tax Year → Tax Rules → Tax Brackets → Employee Tax Profile → Payroll Tax Calculation
- Country-specific tax slabs, rebates, minimum tax
- Tax certificate generation
- Tax report for statutory filing

## 21. Superannuation / Pension / Benefits

**Phase:** Phase 2

- Superannuation/pension fund, employee & employer contribution rates
- Contribution period and contribution reports
- Benefits administration separate from superannuation: health insurance, life insurance, benefit plans
- Enrollment / open enrollment workflow, dependent coverage

## 22. Loan & Salary Advance

**Phase:** Phase 2

- Employee loan and salary advance requests
- Installment schedule and interest calculation
- Automatic payroll deduction linkage
- Remaining balance tracking

## 23. Expense & Reimbursement

**Phase:** Phase 2

- Expense claim submission with receipt upload
- Expense categories and configurable limits
- Manager → Finance approval workflow
- Reimbursement processing linked to payroll or direct payment

## 24. Employee Self-Service (ESS)

**Phase:** MVP — Phase 1

- Profile update requests, leave application, attendance correction
- Timesheet entry, expense claims, document upload
- Payslip and tax document access
- Roster viewing, shift swap requests, overtime requests

## 25. Performance Management

**Phase:** Phase 3

- KPI and goal setting
- Performance review cycles
- Employee self-assessment and manager assessment
- 360° feedback and rating
- Promotion recommendation

## 26. Training & Certification

**Phase:** Phase 3

- Training and course catalog
- Certification tracking and expiry alerts
- Skill matrix
- Training attendance and cost tracking

## 27. Asset Management

**Phase:** Phase 2

- Asset register (laptop, phone, SIM, ID card, equipment)
- Assignment, assigned date, return date, condition tracking
- Linked to onboarding/offboarding checklists

## 28. Employee Relations / Case Management

**Phase:** Phase 3

- Grievance / complaint logging
- Disciplinary action tracking
- Verbal/written warning letters
- Investigation records and HR case tracking

## 29. Employee Engagement

**Phase:** Phase 3

- Survey / eNPS tools
- Company announcement / news feed
- Employee recognition and kudos

## 30. Health & Safety

**Phase:** Phase 3

- Workplace incident reporting
- Injury log
- Safety compliance tracking

## 31. Vendor / Contractor Management

**Phase:** Phase 3

- Non-employee payroll for freelancers/consultants
- Invoice-based payment (separate logic from salary structure)
- Contract-based payment terms

## 32. Mobile App

**Phase:** MVP — Phase 1

- Employee dashboard: today's shift, clock in/out, working hours, leave balance, next payroll, latest payslip, notifications
- Clock in/out, start/continue break, attendance history, timesheet
- Biometric app authentication (fingerprint/Face ID/PIN) — distinct from biometric attendance
- Push notifications and reminders (shift start, break end, clock-out reminder, roster update)

## 33. Attendance Security (Geofence / Device / Biometric)

**Phase:** MVP — Phase 1

- Geofencing: office location + radius, block or warn on out-of-zone clock-in
- GPS-based attendance capture
- QR code attendance
- Face recognition attendance
- Biometric device integration
- Device registration and management: allowed devices per employee, device revoke, suspicious login/multiple device detection

## 34. Notification Engine

**Phase:** MVP — Phase 1

- Event-driven architecture: Event → Rule → Channel → Recipient
- Channels: In-app, Push, Email, SMS, WhatsApp (future)
- Events: leave approved/rejected, payroll finalized, payslip generated, salary paid, late/absent, roster changed, shift reminder, document/contract expiring, birthday, work anniversary, interview reminder, probation ending, approval pending
- Admin-configurable notification rules

## 35. Approval Workflow Engine / Workflow Builder

**Phase:** Phase 2

- Reusable workflow engine used across Leave, Expense, Payroll, Contract, etc.
- Visual drag-and-drop workflow builder for admins
- Configurable multi-step, conditional (e.g. amount-based) approval chains

## 36. Accounting / GL Integration

**Phase:** Phase 2

- Payroll → journal entry export
- Integration with Xero / QuickBooks / Tally
- Cost-centre-wise accounting and chart of accounts mapping

## 37. Data Import / Export & Migration

**Phase:** MVP — Phase 1

- Bulk employee import (Excel/CSV) with validation
- Bulk attendance import
- Data migration tool from legacy HR systems
- Standard export templates for all major entities

## 38. Reports

**Phase:** MVP — Phase 1

- Payroll: employee summary, activity summary, superannuation summary, register, salary summary, earnings/deduction/tax/overtime/variance/payment reports
- Attendance: daily/monthly attendance, late, early leave, absence, working hours, overtime, break, exception reports
- HR: headcount, new hires, terminations, turnover, demographics, department summary, employment type summary, contract/document expiry, probation ending
- Scheduled/subscribed reports: automatic weekly/monthly email delivery

## 39. Dashboard

**Phase:** MVP — Phase 1

- Admin dashboard: headcount, on leave, absent/late today, working now, payroll cost, pending payroll, pending approvals, document/contract expiry
- Employee dashboard: today's shift, clock in/out, working hours, break, leave balance, upcoming leave, latest payslip, notifications

## 40. RBAC / Roles / Permissions

**Phase:** MVP — Phase 1

- Default roles: Super Admin, Company Owner, HR Admin, Payroll Admin, Manager, Employee, Accountant, Recruiter
- Company-defined custom roles (e.g. HR Manager, Payroll Officer, Branch Manager)
- Granular permission matrix: Role → Module → Action (view/create/edit/delete/approve/finalize)

## 41. Security & Compliance

**Phase:** MVP — Phase 1

- 2FA and SSO
- Password policy and session management
- Login history
- Data encryption and sensitive data masking
- API rate limiting
- Backup and restore
- Tenant data isolation
- Data retention policy
- Employee data deletion / anonymization (right-to-be-forgotten)
- Consent management

## 42. Audit Log

**Phase:** MVP — Phase 1

- Full change tracking: user, action, module, record, old value, new value, IP, device, timestamp
- Payroll audit trail (mandatory — who changed what, when, and why)

## 43. Integration / API

**Phase:** Phase 2

- REST API and webhooks
- API keys and OAuth
- Accounting software integration
- Banking / payroll payment integration
- Attendance device API
- Email/SMS provider integration, Firebase, SSO, calendar integration

## 44. Subscription & Billing

**Phase:** MVP — Phase 1

- Plan tiers: Free, Starter, Business, Enterprise
- Pricing models: per-employee/month or base fee + employee count
- Feature-based restriction per plan (e.g. Roster/Timesheet/Advanced Reports = Business+; API/SSO/Custom Rules = Enterprise)

## 45. In-App Support / Help Center

**Phase:** Phase 2

- Knowledge base
- Live chat / support ticket for both super-admin side and employee side

## 46. Multi-Currency, Multi-Timezone, Multi-Language

**Phase:** Phase 2

- Multi-currency payroll with exchange rate management and historical rate lock (as of payroll date)
- Multi-timezone support across branches/locations
- Multi-language / i18n UI
- Local date, number, and currency formatting per country

## 47. System Settings & Backup

**Phase:** MVP — Phase 1

- General system configuration
- Scheduled backups and tested restore procedure

