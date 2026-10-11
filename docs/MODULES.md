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

**Onboarding checklist rules** (enforced by the API):

- Each company configures checklist templates (Employees → Onboarding Templates). The active default template is applied automatically when a candidate is converted to an employee; HR can also start onboarding manually from the Employee Detail page with any active template.
- Starting onboarding copies the template's items into per-employee tasks, with due dates = start date + the item's due offset. Later template edits only affect onboardings started afterwards.
- Template names are unique per company. Only an active template can be the default; deactivating a template clears its default flag. A template that has been used for any onboarding cannot be deleted (`409 CONFLICT`) — deactivate it instead.
- Item types and how they complete:
  - **Collect a document** — needs an employee-scope document type; completes when the document is uploaded with a file and, if the type requires verification, when it is verified.
  - **Policy acceptance** — needs a document type; completes on recorded acceptance (only when the type does not require verification) or via the signed document, as above.
  - **Provisioning** — completes when a company asset of the item's category is assigned to the employee (or when marked done if no category is set).
  - **Manual task** — marked done by HR.
- Documents the employee already had on file are linked when onboarding starts. Deleting a document reopens the task it satisfied (and the onboarding, if it had completed).
- Progress counts required tasks only (completed or skipped); the onboarding completes when every required task is done. Skipping needs `employee:approve`.
- A completed or skipped task can be reopened, except a task completed by an assigned asset (return the asset) or by an uploaded document (replace or delete the document).

**Offboarding checklist rules** (enforced by the API):

- Offboarding starts automatically when a resignation or termination is recorded (Lifecycle Events), using the company's default offboarding template. HR can also start it from the employee's offboarding tracker (`/employees/:id/offboarding`) with any active template; an employee has at most one offboarding (`409 CONFLICT`). Due dates = start date + the item's due offset.
- Progress counts required steps only (completed or skipped); the offboarding completes when every required step is done and moves back to in progress if a required step is reopened. Skipping needs `employee:approve` and a reason.
- Step types and how they complete:
  - **Clearance / manual task** — signed off by HR (`employee:edit`), with an optional note recorded in the audit log.
  - **Asset return** — live from the asset register (Module 27). Returning an asset (one at a time, or all of the step's category at once) closes its assignment; the step completes automatically once no asset of its category is still assigned. With nothing assigned, HR confirms "nothing to return".
  - **Access revocation** — `employee:approve`. Deactivates the employee's portal account and revokes all refresh tokens (sessions); users cannot revoke their own access.
  - **Exit interview** — completed from the exit interview form; completion requires a main reason for leaving, and the interview date cannot be in the future. Ratings are whole numbers 1–5 per area. The record is hidden from the departing employee (interviewer notes and rehire eligibility are HR-only).
  - **Final settlement** — generates a `final_settlement` payroll adjustment per PAYROLL_LOGIC.md §11: payroll is recalculated as of the last finalized run's period with optional settlement lines (fixed pay components and amounts — e.g. leave encashment, notice pay — applied as structure overrides), and the difference is stored for a later pay cycle. The finalized run is never changed. The entry follows the adjustment flow (draft → submitted → applied).
- One active settlement entry per offboarding. Cancelling it (`payroll:edit`, not allowed once applied) reopens the step so a new entry can be generated. Settlement figures are only returned to users with `payroll:view`.
- Reopen rules: skipped steps can always be reopened; completed asset-return, access-revocation and final-settlement steps cannot (they follow the asset register, the user account and the payroll adjustment respectively). Reopening a completed exit interview keeps the answers but clears the conducted date.
- A cancelled offboarding is read-only.

## 09. Document Management (Generalized)

**Phase:** MVP — Phase 1

- Admin-defined document types with configurable fields (text, number, date, dropdown, checkbox, radio, file, image, signature)
- Required / optional flag, expiry tracking, verification workflow
- Employee-specific vs company-wide documents
- Automatic expiry notifications (e.g. passport expiring in 30 days)
- Custom Field / Form Builder generalized across ALL entities (Employee, Company, Department, etc.), not just documents
- E-signature integration for offer letters, contracts, and policy acknowledgment

**Field definition rules** (shared by document types and the custom field builder, enforced by the API):

- A field's `fieldKey` is generated from its label when created and never changes afterwards; stored values are keyed by it, so renaming a label is always safe.
- Dropdown and radio fields need at least one option; options are trimmed and de-duplicated.
- Once a document type has uploaded documents, the type of an existing field cannot change (`409 FIELD_TYPE_LOCKED`) — add a new field instead. Removing a field hides its stored values; marking it inactive retires it from forms while keeping them.
- Field keys are unique per entity (and per document type for document fields).
- A document type with uploaded documents cannot be deleted; deactivate it to stop new uploads.

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

**Timesheet rules** (enforced by the API):

- The admin view lives at `/attendance/timesheets` and filters by date range (this/last week, this/last month or custom), employee, project and status, with totals for billable vs non-billable hours and breakdowns by employee and by project. A start date after the end date is rejected (`400 VALIDATION_ERROR`). Viewing needs `attendance:view`; data scope limits which employees appear.
- Submitted entries follow the company's default **Timesheet** workflow from the Workflow Builder (Settings → Approval Workflows); without one, they use the built-in single step: the employee's manager.
- The approval queue lives at `/attendance/timesheets/approvals` (`attendance:approve`). "Awaiting me" lists the entries whose current step the user can act on; "All pending" lists every pending entry in the user's data scope.
- Nobody can approve or reject their own entries (`403 FORBIDDEN`), even with organization-wide scope.
- Rejecting needs a reason (max 1000 characters), which is shown to the employee. A rejected entry is closed; the employee logs the time again as a new entry.
- Bulk approve/reject takes up to 100 entries. Each entry is processed independently and the response lists which ones succeeded and which were skipped, with the reason for each skipped entry.

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

**Superannuation contribution rules** (enforced by the API):

- Contribution rates are a `social_security` rule resolved through the Rule Resolver: global default → country → state/province → company → employee contract. Each layer overrides only the settings it defines; payroll uses the version in effect on the calculation date.
- The settings screen at `/payroll/superannuation` is read-only and needs `payroll:view`. It shows the company default rates for a chosen date, which layer supplied each value and the value it replaced, every rule version (in effect, scheduled, ended or superseded), and employees whose state rule or contract changes their rates. Country defaults are edited in the platform's Country Configuration; there is no tenant screen for editing company or contract overrides yet.
- Settings read by payroll: employer rate (`employerContributionRate`, then `superannuationGuaranteeRate`, then `employerRate`), employee rate (`employeeContributionRate`, then `employeeRate`), `contributionBase` (`gross` or `basic`; anything else means gross) and scheme name (`schemeName`, then `scheme`). The first key present wins, so an alias set on a later layer is ignored if an earlier layer sets a higher-priority key; the screen flags this. Other keys are shown as "not used".
- If no layer sets either rate, payroll calculates no superannuation. Employer contributions don't reduce net pay; employee contributions are deducted.

**Benefits rules** (enforced by the API):

- Plans are managed at `/payroll/benefits/plans` and each employee's cover at `/payroll/benefits/enrollments` (`?employee=` selects an employee, `?plan=` lists the employees enrolled in a plan). Viewing needs `payroll:view`; creating plans, enrolling and adding dependents need `payroll:create`; editing plans, cancelling enrollments and removing dependents need `payroll:edit`.
- A plan is unique by name and tier within a company (case-insensitive, `409 CONFLICT`). New plans start as draft or active. A plan with enrollments cannot go back to draft or change category; deactivating it stops new enrollments but keeps existing cover until each enrollment is cancelled. Only active plans accept enrollments.
- Costs are monthly: employee contribution, optional employer contribution, and an optional extra employee cost per covered dependent. An enrollment's employee cost = its contribution + per-dependent cost × active dependents. Payroll does not deduct benefit costs yet.
- Each plan sets whether it covers dependents, an optional maximum (1–20), and which relationships are eligible (none selected = any). Non-life plans cover at most one spouse or domestic partner. Plan rule changes that active enrollments no longer fit are rejected (`409 CONFLICT`).
- For life insurance, dependents are beneficiaries: each needs a share of the payout (0.01–100%), and the shares on an enrollment cannot exceed 100% in total. Shares are rejected on other plan types.
- One active enrollment per employee per plan. Terminated employees cannot be enrolled, and cover cannot start before the hire date. Open-enrollment enrollments need an open period whose dates include today and which offers the plan; a life event enrollment needs a description of the event.
- Cancelling takes the last day of cover (default today, never later than an existing end date); dependents' cover ends with it. If that day is before the start date, the enrollment is recorded as never having started. Removing a dependent keeps the record as cancelled. Every change is audit-logged.

## 22. Loan & Salary Advance

**Phase:** Phase 2

- Employee loan and salary advance requests
- Installment schedule and interest calculation
- Automatic payroll deduction linkage
- Remaining balance tracking

**Loan & advance rules** (enforced by the API):

- The request list lives at `/payroll/loans` and filters by status, type (loan or salary advance) and employee. Each request opens a detail screen at `/payroll/loans/:loanId` with the installment schedule, remaining balance and the payroll deductions grouped by pay period. Viewing needs `payroll:view`; approving or rejecting needs `payroll:approve`.
- Interest is flat: total repayable = principal × (1 + rate%), split evenly over 1–120 monthly installments (the last installment absorbs rounding). Due dates that fall past the end of a shorter month move to that month's last day.
- A pending request shows a projected schedule starting next month. The approver picks the first deduction date, which cannot be in the past (`400 VALIDATION_ERROR`); the default is one month from today.
- Nobody can approve or reject their own request (`403 FORBIDDEN`).
- Rejecting needs a reason (max 1000 characters), which is stored on the request and shown on the detail screen.
- Payroll calculation deducts the scheduled installments whose due date falls inside the pay period. Finalizing the run marks them paid, links them to the run and reduces the remaining balance; the loan becomes fully paid when the last installment is settled.
- Each installment shows a recovery state: recovered, in payroll (a run is in progress), awaiting run, upcoming, not recovered (past due with no deduction, or the period's run was finalized or closed without it), repaid outside payroll, or skipped.
- Installments that pass their due date without a deduction are **not** carried into a later period automatically; the detail screen flags them so payroll can recover them manually.

## 23. Expense & Reimbursement

**Phase:** Phase 2

- Expense claim submission with receipt upload
- Expense categories and configurable limits
- Manager → Finance approval workflow
- Reimbursement processing linked to payroll or direct payment

**Expense rules** (enforced by the API):

- The claim list lives at `/payroll/expenses` and filters by status, category and employee. Each claim opens a detail screen at `/payroll/expenses/:claimId` with the receipt viewer, the approval chain and the category limit check. Categories and limits are managed at `/payroll/expenses/categories`. Viewing needs `payroll:view`; creating claims needs `payroll:create`; managing categories needs `payroll:edit`; approving, rejecting and marking reimbursed need `payroll:approve`.
- Submitting starts the `expense_claim` workflow whose amount trigger matches the claim (for example manager → accountant, plus company owner for high-value claims). If no definition matches, a built-in manager → accountant route is used. A draft shows the route it would follow.
- Nobody can approve, reject or mark as reimbursed their own claim (`403 FORBIDDEN`).
- Rejecting needs a reason (max 1000 characters), which is stored on the claim and shown on the detail screen.
- Limits are optional per category: a per-claim maximum and a per-employee monthly maximum. The monthly total counts the employee's pending, approved and reimbursed claims in that category for the month of the expense date. The per-claim limit cannot be higher than the monthly limit. If limits change after a claim was submitted, the detail screen flags the claim as over the limit instead of blocking it.
- Expense dates cannot be in the future. Amounts allow at most 2 decimals.
- Receipts are PDF, JPG or PNG up to 10 MB. A claim in a category that requires a receipt cannot be submitted without one, and claims in a deactivated category cannot be submitted.
- Category names are unique per company (`409 CONFLICT`). Category changes are audit-logged.
- Reimbursement is a manual "mark reimbursed" step on approved claims. Payroll does **not** pick up approved expense claims automatically yet.

## 24. Employee Self-Service (ESS)

**Phase:** MVP — Phase 1

- Profile update requests, leave application, attendance correction
- Timesheet entry, expense claims, document upload
- Payslip and tax document access
- Roster viewing, shift swap requests, overtime requests

**Implementation notes:**
- There is one web panel. ESS lives in the admin panel as the **My Space** menu group (`/my`, `/my/profile`, `/my/attendance`, `/my/leave`, `/my/roster`, `/my/payslips`, `/my/help`), in English or Bengali via `@hrm/i18n`. The former employee portal was removed; `apps/web` is now the public marketing website (Next.js), whose "Sign in" links point to the admin panel.
- Every user with an employee record gets My Space; users whose role has `data_scope = own` (the default Employee role) see only My Space and land on it. The API enforces this with `@SelfService()` endpoints and `403 OWN_SCOPE_FORBIDDEN` elsewhere (ROLES_PERMISSIONS.md §5).
- My Space covers: dashboard (today's shift, clock in/out and breaks, leave balances, upcoming leave, latest payslip, notifications, company news, surveys, kudos), profile, attendance, leave application with live balance preview and cancellation, the next 14 days of roster, payslip downloads, and help articles and support tickets.

## 25. Performance Management

**Phase:** Phase 3

- KPI and goal setting
- Performance review cycles
- Employee self-assessment and manager assessment
- 360° feedback and rating
- Promotion recommendation

**Implementation notes (KPIs and goals):**
- KPIs and goals have their own screen at `/talent/performance/goals` (sidebar **Performance → KPIs & Goals**, `performance:view` to see it; creating and editing need `performance:create` / `performance:edit`). It has an **Employee goals** tab (goals grouped by employee, with progress and the employee's weight total) and a **KPI library** tab (reusable KPI definitions: unit, direction, default target).
- A goal belongs to one review cycle and has a target, an optional weight and a measurement window. Windows are monthly, quarterly, half-yearly or yearly, counted from the cycle start and clipped at the cycle end; for example, a cycle starting 1 Jul has Q1 = Jul–Sep. A non-custom window must match one of these windows exactly (`400 INVALID_MEASUREMENT_PERIOD`). Custom windows can be any dates inside the cycle. With no window given, the goal covers the whole cycle.
- An employee's goal weights in one cycle add up to at most 100% (`409 WEIGHT_LIMIT_EXCEEDED`); cancelled goals don't count. Higher-is-better KPIs need a target above zero.
- Bulk assign takes up to 500 employees. It can create one goal per window ("every quarter in the cycle"), skips an employee who already has that KPI for the same window (reported back as skipped), and rejects the whole request if any selected employee's review has launched.
- Goals in a closed or archived cycle are read-only (`400 CYCLE_LOCKED`). Once an employee's review for the cycle launches, it rates their goals, so the title, target, window and weight are frozen (`400 TARGETS_LOCKED`); progress, notes and status can still change.
- Status runs draft → active → completed; cancelled is terminal, and nothing goes back to draft. Editing a KPI definition only affects new assignments. A cycle's period can't shrink so that existing goals fall outside it. KPI and goal changes are audit-logged with changed fields.

**Implementation notes (review cycles and assessments):**
- Screens: **Performance → Review cycles** (`/talent/performance/cycles`) sets up cycles and participants; **Performance → Assessments** (`/talent/performance/assessments`) holds the self-assessment and manager assessment forms and the approval sign-off; **Performance → 360° feedback** and **Performance → Results** are described below. All need `performance:view`; creating a cycle needs `performance:create`, editing cycles, participants and assessments needs `performance:edit`, and sign-off needs `performance:approve`.
- A cycle has a name, description, review period, KPI measurement period (which sets the goal windows), review due date (not before the period start) and an optional approval-workflow sign-off. New cycles always start as draft. Status runs draft → active (only by launching) → closed → archived; a draft can be discarded straight to archived, a closed cycle can be reopened, and an active cycle must be closed before archiving (`400 INVALID_STATUS_TRANSITION`). After launch the period, measurement period and sign-off setting are fixed (`400 CYCLE_LAUNCHED`); the name, description and due date can still change. Closed cycles are read-only until reopened, and archived cycles are read-only for good (`400 CYCLE_LOCKED`).
- Participants are active employees and can be added or removed until the cycle closes. Someone who already has a review in the cycle can't be removed (`400 PARTICIPANT_HAS_REVIEW`). Launching creates a review for every participant who doesn't have one, so after adding people to a running cycle, launching again creates just their reviews. The setup screen warns before launch about participants with no manager, no active KPI goals, draft goals, or goal weights that don't total 100%.
- Both forms rate the same items on a 1–5 scale (Well below, Below, Meets, Exceeds expectations, Outstanding), each with an optional comment, plus an overall comment: the default competencies and the employee's active and completed KPI goals for the cycle, showing target, window, weight and actual. The KPI list follows the goals until the manager submits, then it is frozen with the review. Every item must be rated before submitting (`400 INCOMPLETE_ASSESSMENT`). Each form only writes its own side's ratings, so the manager can't change the employee's answers.
- Score = competency average × 60% + KPI average × 40%; KPI ratings are weighted by goal weight when every rated goal has a weight, otherwise averaged. If only one part is rated, it is the score.
- Status flow: not started → self-assessment draft → self submitted → manager review → pending approval (when the cycle requires sign-off) → approved; a rejected sign-off returns the review to the manager. The self-assessment can be edited only before it is submitted; HR can complete it on the employee's behalf (audit-logged). The manager assessment opens after the self-assessment is submitted; someone with no manager is assessed by HR, and nobody can complete the manager assessment or sign off on their own review. Assessments can only be saved while the cycle is active.

**Implementation notes (360° feedback, results and promotion):**
- **Performance → 360° feedback** (`/talent/performance/feedback`) lists each review in a launched cycle with how many reviewers responded, the reviewers for the selected review, and the anonymous results. A **Your feedback requests** section lists the signed-in employee's own requests; the same form is used when HR enters feedback for a reviewer.
- Inviting reviewers needs `performance:edit`. Reviewers are active employees of the same company; the subject and their reviewing manager can't be reviewers; each person is asked once per review, at most 20 reviewers per review. The invite list suggests direct reports, peers from the same department, and anyone else as cross-functional; the relationship can be changed before inviting. Pending requests can be withdrawn; submitted ones can't.
- Collection is open while the cycle is active and until the manager submits their assessment (`400 FEEDBACK_CLOSED`, `400 CYCLE_LOCKED`). A reviewer rates the same competencies as the manager (1–5) with an optional comment, can save a draft, and must rate every competency to submit (`400 INCOMPLETE_ASSESSMENT`). Submitted feedback is final. HR (`performance:edit`, company-wide) can fill in a pending request for a reviewer (audit-logged as on behalf), but nobody, HR included, can open a submitted answer.
- Anonymity: the reviewer list shows who was asked and whether they responded, never their ratings. Averages are shown only once at least 2 people have responded; a relationship group with fewer than 2 responses is hidden; comments are pooled without names and sorted so the order reveals nothing. The review subject can't see the reviewer list.
- **Performance → Results** (`/talent/performance`) shows each review's overall rating = manager score × 60% + 360° average × 40% (whichever is available if one is missing), rounded to 2 decimals, with the breakdown, the self/manager/360° ratings per competency, KPI results and the employee's rating history. The label follows the rating: 4.5+ Outstanding, 3.5+ Exceeds, 2.5+ Meets, otherwise Needs improvement. Until approval the rating is provisional.
- Calibration (`performance:approve`) overrides the overall rating with a value from 1.00 to 5.00 and a reason (audit-logged); clearing it goes back to the calculated rating. It is allowed after the manager submits (pending approval or approved), while the cycle is active, and not once a promotion has been recorded from the review, and never on your own review. Calibrating an approved review updates its performance-review lifecycle event.
- Promotion recommendation: the manager (or HR) recommends a designation different from the current one, from the same company, with a justification; it is saved as a draft and then submitted to HR. It can be made from manager review onwards and changes only while draft or rejected. HR approves or rejects it (`performance:approve` + `employee:approve`); rejection needs a reason, which is appended to the justification so the manager can revise and resubmit.
- **Convert to promotion** (`performance:approve` + `employee:edit`, review and recommendation both approved) opens the employee Lifecycle Event panel prefilled with the recommended designation. Submitting records a promotion lifecycle event linked to the review (subject to the lifecycle action policy), marks the recommendation as promoted, and can't be done twice. The designation must differ from the employee's current one when the promotion is recorded.

## 26. Training & Certification

**Phase:** Phase 3

- Training and course catalog
- Certification tracking and expiry alerts
- Skill matrix
- Training attendance and cost tracking

**Implementation notes (course catalog, attendance and costs):**
- Screens: **Training → Course catalog** (`/talent/training/catalog`; `/talent/training` redirects here) and **Training → Attendance & costs** (`/talent/training/sessions`, `?session=<id>` opens a session). All need `training:view`; adding courses and scheduling sessions needs `training:create`; editing courses and sessions, changing status, enrolling, marking attendance and recording costs need `training:edit`.
- A course has a title (unique per company, ignoring case: `409 DUPLICATE_COURSE`), description, category, delivery mode (self-paced, instructor-led, virtual, blended), optional duration in minutes, which is also the default session length, and a mandatory flag. Status runs draft ⇄ active, while the course has no sessions; a course with sessions goes to archived instead of back to draft. Archiving needs every session completed or cancelled (`400 COURSE_HAS_OPEN_SESSIONS`); an archived course is restored as active. Only active courses can be scheduled or take new enrolments (`400 COURSE_NOT_ACTIVE`).
- A session is a dated delivery of a course with an optional name, location, instructor and notes. It must end after it starts and last at most 14 days. Status runs scheduled → in progress → completed (scheduled → completed is allowed too); scheduled and in-progress sessions can be cancelled; completed and cancelled are final (`400 INVALID_STATUS_TRANSITION`). Starting or completing before the start time is rejected (`400 SESSION_NOT_STARTED`). Completing needs everyone marked (`400 ATTENDANCE_NOT_MARKED`). A session someone attended can't be cancelled (`400 SESSION_HAS_ATTENDANCE`), and cancelling withdraws the remaining enrolments. The date and time change only while scheduled, and cancelled sessions can't be edited (`400 SESSION_CLOSED`).
- Enrolment: up to 200 employees per request, only while the session is scheduled or in progress. Employees must belong to the session's company, be active or on leave, and be within the user's data scope. Anyone already enrolled is skipped with a reason. Someone who withdrew earlier is re-enrolled on the same record. Withdrawing is only possible before attendance is marked.
- Attendance is marked per person or in bulk (registered, attended, completed, no-show), from the session's start time. The first mark moves a scheduled session to in progress. Attended and completed record the time; going back to registered or no-show clears the times and the score. A score from 0 to 100 can be recorded only for people who attended. On a completed session people can be re-marked but not set back to registered.
- Costs are lines by category (venue, instructor, materials, travel, catering, technology, other) recorded in the company currency (payroll base currency, else the country's currency). A different currency is rejected (`400 CURRENCY_MISMATCH`). Older lines in another currency are listed separately and left out of the totals. Each session shows the total cost, the cost per attendee (total ÷ attended or completed) and the cost per enrolled (total ÷ enrolled, excluding withdrawn). Per-head figures stay empty until there's someone to divide by. Course, session, enrolment, attendance and cost changes are audit-logged.
- Not yet covered: session capacity or a waitlist (needs a schema change), and self-service enrolment requests.

**Implementation notes (certification tracker and skill matrix):**
- Screens: **Training → Certification tracker** (`/talent/training/certifications`, `?employee=<id>` opens an employee) and **Training → Skill matrix** (`/talent/training/skills`). Both need `training:view`; adding or renewing a certificate and adding skills need `training:create`; editing, revoking, reinstating and deleting certificates, editing and deleting skills, and setting levels need `training:edit`. Terminated employees are left out of both screens and can't be given new certificates or ratings (`400 EMPLOYEE_TERMINATED`).
- A certificate has a name, issuing body, certificate number, linked course, issue and expiry dates (`YYYY-MM-DD`) and notes. The issue date can't be in the future and the expiry date must be after it. The same certificate twice for an employee is rejected (`409 DUPLICATE_CERTIFICATION`): same name, ignoring case, and the same certificate number, or the same dates when either has no number.
- Expiry state is worked out from today's date, not stored: no expiry date = no expiry; past the expiry date = expired; within 30 days = expiring soon; otherwise valid; revoked stays revoked. Colours follow DESIGN_SYSTEM.md §5: valid and no expiry green, expiring soon amber, expired red, revoked and renewed grey. The list filter on status uses the same rule, so a certificate past its date counts as expired even if it was stored as active.
- Renewing records a new certificate with the same name. Of an employee's certificates with the same name, the one that isn't revoked and expires last (no expiry counts as latest) is current; the others are shown as renewed, kept in the employee's history, and don't trigger expiry alerts. Deleting the newer certificate makes the older one current again.
- Revoking needs a reason, which is added to the notes with the date; a revoked certificate can be reinstated with its original dates. Changing the expiry date or reinstating re-arms the expiry alert.
- The daily expiry alert (06:00, `certification.expiring`) covers active certificates expiring within 30 days, once per certificate, and skips terminated employees and certificates that have already been renewed.
- The tracker lists every employee with their current certificates as coloured chips, sorted by urgency, with tiles for valid, expiring and expired certificates and employees covered. Filters: department, certificate (with “Doesn’t hold it” to find who is missing one) and status (needs attention, expired, expiring, all in date, none).
- Skills have a name (unique per company, ignoring case: `409 DUPLICATE_SKILL`), category and description. Deleting a skill also removes its ratings, after a confirmation that shows how many.
- The matrix shows employees against skills grouped by category. Levels: none (assessed, no proficiency), beginner, intermediate, advanced, expert, shaded from light to dark; an empty cell means not assessed. Setting a level records the assessment date (today by default, never in the future) and optional notes; a rating can be cleared. Each column shows how many of the rated employees are advanced or expert. Rating changes are audit-logged with the previous level.
- Not yet covered: target levels per designation and skill-gap reports (needs a schema change), and attaching certificate files.

## 27. Asset Management

**Phase:** Phase 2

- Asset register (laptop, phone, SIM, ID card, equipment)
- Assignment, assigned date, return date, condition tracking
- Linked to onboarding/offboarding checklists

**Asset register rules** (enforced by the API):

- The register lives at `/operations/assets` (also linked from the onboarding and offboarding trackers), filterable by status (assigned / available, plus in repair / retired when present), category and holder (`?employee=<id>`). Viewing needs `employee:view`; adding, assigning and returning need `employee:edit`.
- Asset tags are unique per company, case-insensitively (`409 CONFLICT`). Warranty expiry cannot be before the purchase date.
- Only available assets can be assigned, and only to employees who have not left and are not being offboarded. Concurrent assignments of the same asset are rejected (`409 CONFLICT`).
- Assigned and returned dates cannot be in the future, and the return date cannot be before the assignment date. Condition is recorded at hand-over and at return; every assignment and return is audited and kept in the asset's assignment history.
- Assigning an asset completes the employee's pending onboarding provisioning step for that category (or a step with no category) and links the assignment to it. Returning that asset while onboarding is still in progress reopens the step.
- Returning an asset — from the register, the employee's onboarding tracker or the offboarding tracker — completes each pending offboarding asset-return step that covers its category once the employee holds no other active asset of that category, and links the return to the step.

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

**Workflow rules** (enforced by the API):

- Workflows are listed at `/settings/workflows` and edited at `/settings/workflows/new` (`?template=` or `?module=` pre-fills it) and `/settings/workflows/:definitionId`. Viewing needs `settings:view`; creating, editing and deleting need `settings:create`, `settings:edit` and `settings:delete`. Every change is audit-logged under `settings`.
- A workflow is an ordered list of 1–10 steps. Each step is approved by the requester's manager, the manager's manager, or anyone holding a named role in the tenant (team-scoped roles only for requesters in their reporting line). The same approver can't appear twice. Role names must match an existing role.
- How each module picks a workflow for a new request:
  - Expense claims: the workflow with the highest amount trigger the claim passes; otherwise the default "every claim" workflow; otherwise the built-in chain (requester's manager → Accountant).
  - Timesheets, contract renewals, job requisitions, offer letters and performance reviews: only the default workflow; otherwise the module's built-in chain.
  - Leave requests use the approval steps on each leave policy, and payroll adjustments are not routed yet, so new workflows can't be created for either.
- Amount rules apply only to expense claims, and compare against the claim amount as submitted, with no currency conversion. A workflow can start at an amount (over or at least X), and any step can carry its own amount condition. A conditional step is left out of the chain when the claim doesn't pass it, and the remaining steps are renumbered. At least one step must apply to every claim. For example, "Expense > 1,000 also needs the Company Owner" is either one default workflow (Manager → Accountant → Company Owner only when over 1,000) or a separate workflow that starts over 1,000.
- One default per module. The default must apply to every request (no amount trigger) and be turned on; turning a workflow off also clears its default flag. Names are unique per module (case-insensitive, `409 CONFLICT`). The end date can't be before the start date.
- A request keeps the steps it started with, so edits only affect new requests. A workflow that has routed any request can't change module or be deleted (`409 CONFLICT`); turn it off instead.

## 36. Accounting / GL Integration

**Phase:** Phase 2

- Payroll → journal entry export
- Integration with Xero / QuickBooks / Tally
- Cost-centre-wise accounting and chart of accounts mapping

**Accounting rules** (enforced by the API):

- Account mapping lives at `/operations/accounting/mapping`. The export and sync history is at `/operations/accounting/exports`, accounting software connections are at `/operations/accounting/connections`, and the payroll journal preview is at `/operations/accounting`. Viewing needs `payroll:view`. Adding accounts needs `payroll:create`. Changing mappings or accounts, connecting or disconnecting Xero, and retrying a sync need `payroll:edit`. Every change, including connect and disconnect, is audit-logged under `accounting`.
- Each company connects to Xero separately through OAuth. The Xero callback returns to the connections screen with the result. If the user authorises several Xero organisations, the first one is used. Disconnecting revokes the token at Xero when it can; if Xero can't be reached, the connection is still disconnected locally and the stored tokens are deleted. Journals already in Xero and the export history are kept.
- The connection status only reflects whether Xero accepts the connection:
  - `connected`: journals sync after payroll is finalized;
  - `token_expired` ("Reconnect required"): Xero rejected the access token (401) or the saved refresh token;
  - `error` ("Connection error"): Xero refused access to the organisation (403);
  - `disconnected`: no automatic sync; CSV export still works.

  A sync that fails for any other reason, such as unmapped accounts, an unbalanced journal, a Xero validation error or a network problem, is recorded on the sync job and as the last sync error, and the connection stays `connected`. Authorisation failures aren't retried automatically. If payroll is finalized while the connection needs a reconnect, a failed sync is recorded so it shows on the export and sync screen and can be retried after reconnecting.
- Account codes are unique per company (`409 CONFLICT`). Each pay component or system line maps to one active account in the same company. An account can't be deactivated while any mapping uses it.
- Cost centres can override the account for employee-cost lines only, meaning earnings and employer superannuation expense. Deductions, tax, net pay and super payable always use the company-wide mapping. Overrides must point at active expense accounts, so an account used by an override can't be changed to another type. Only earning components can be overridden.
- For each employee-cost line, the account is chosen in this order:
  1. the cost centre's override for that exact component or system line;
  2. the cost centre's default account;
  3. the company-wide mapping.

  If none of these exist, the line is reported as unmapped.
- An employee is costed to their current cost centre when the journal is built. Lines are split per cost centre, the description carries the cost centre code, and the CSV has a `Cost Centre` column. Employees without a cost centre use the company-wide mapping.
- Each export or sync attempt is listed with its outcome: succeeded, failed or in progress. When a sync job exists, its status decides the outcome. A newer attempt for the same period or batch and destination supersedes older ones. Only the latest failure counts as needing attention.
- A failed sync can be retried only if it is the latest attempt for that period and provider, and the job queue is running (`503 QUEUE_UNAVAILABLE` otherwise). Retries never touch payroll. A finalized payroll stays finalized whether the export or sync succeeds or fails.

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

**API key rules** (enforced by the API):

- Keys are managed at `/settings/api-keys`. Viewing needs `settings:view`; generating and revoking need `settings:edit`. Generating a key needs the Enterprise plan (`api_access`), otherwise `403 PLAN_FEATURE_UNAVAILABLE`. Listing and revoking work on any plan, so a tenant that downgrades can still see and revoke its old keys; those keys stop authenticating until the tenant is back on Enterprise.
- A key is sent as `Authorization: Bearer hrm_live_…`. The full key is shown once, when it's created; only its SHA-256 hash is stored. It can have an expiry date, which must be in the future.
- Scopes are `read:` or `write:` for `employees`, `attendance`, `leave` and `payroll`. Read grants the module's `view` permission; write adds `create` and `edit`, never `delete`, `approve` or `finalize`. Report endpoints are reachable with the matching read scope. Keys never get `settings`, roles, audit or billing access, so a key can't manage keys.
- A user can only grant scopes their own role holds (`403 SCOPE_EXCEEDS_PERMISSIONS`); the same rule applies to OAuth clients. A key reaches every employee in the tenant, because it has no reporting line; scopes are the only limit.
- Revoking is immediate and can't be undone; revoking an already revoked key does nothing. Creating and revoking are audit-logged under `api_access`.

**Webhook rules** (enforced by the API):

- Endpoints are managed at `/settings/webhooks`. Viewing endpoints and the delivery log needs `settings:view`; everything else needs `settings:edit`. Adding, editing, enabling, rotating the secret, sending a test and retrying need the Enterprise plan (`api_access`). Disabling and deleting work on any plan. After a downgrade, no events are sent; endpoints stay listed so they can be switched off.
- Events are `employee.created`, `leave.approved` and `payroll.finalized`. Each endpoint subscribes to one or more of them, for all companies or for one company. `webhook.test` is sent only by "Send test". Webhooks don't depend on notification rules: turning off a notification doesn't stop its webhook.
- An endpoint URL must be a public `https://` address. Plain `http://` is allowed outside production only. The API rejects URLs with credentials or a fragment, and hosts like `localhost`, single-label names, `.local`/`.internal`, and loopback, private, link-local or CGNAT IPs. It resolves the host again before each delivery and doesn't follow redirects. `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` lifts these limits for self-hosted installs; never set it on shared hosting. There's a limit of 20 endpoints per tenant.
- Every request is a JSON POST with these headers:
  - `X-HRM-Signature: t=<unix>,v1=<hex>`, an HMAC-SHA256 of `"<t>.<raw body>"` computed with the endpoint's secret;
  - `X-HRM-Event-Type`;
  - `X-HRM-Delivery-Id`, which stays the same across retries so the receiver can drop duplicates;
  - `X-HRM-Schema-Version`.

  The secret (`whsec_…`) is shown once, when the endpoint is created or the secret is rotated, and is stored encrypted, so `FIELD_ENCRYPTION_KEY` must be set. Rotating takes effect immediately.
- Any 2xx response within 15 seconds counts as delivered. Anything else, including timeouts and redirects, is retried up to 6 attempts in total, after 1 min, 5 min, 30 min, 2 h and 6 h. The delivery log shows each delivery as Queued, Sending, Retrying (with the attempt number and the next try time), Delivered or Failed, with the last HTTP status and error. A failed delivery can be retried by hand when its endpoint is active; this starts a new set of 6 attempts. Disabling an endpoint fails its pending retries.
- Creating, editing, rotating, deleting and manual retries are audit-logged under `webhooks`. Deleting an endpoint also deletes its delivery log.

## 44. Subscription & Billing

**Phase:** MVP — Phase 1

- Plan tiers: Free, Starter, Business, Enterprise
- Pricing models: per-employee/month or base fee + employee count
- Feature-based restriction per plan (e.g. Roster/Timesheet/Advanced Reports = Business+; API/SSO/Custom Rules = Enterprise)

## 45. In-App Support / Help Center

**Phase:** Phase 2

- Knowledge base
- Live chat / support ticket for both super-admin side and employee side

**Knowledge base rules**

- Admin screen: Support → Knowledge Base (`/support/knowledge-base`, `support:edit`). Articles belong to a category; categories can be renamed and reordered, and deleted only when empty.
- Articles are saved as drafts or published. Only published articles appear in the Help Center, My Space → Help & Support, the help widget and mobile; employees never see categories that contain only drafts.
- The body is Markdown (headings, lists, bold/italic, links, code, quotes), rendered as React elements without raw HTML. Links may only be `http(s)`, `mailto` or app-relative.
- The slug is set when the article is created and stays stable on rename so shared links keep working.
- Opening an article in the editor (`?preview=true`) does not count as a view.

**Support ticket rules**

- Agent queue: Support → Support Tickets (`/support/tickets`, `support:edit`), with status counts, priority, assignee (me/unassigned) and search filters. Requesters use My Space → Help & Support.
- Status flow is Open → In progress → Resolved. Allowed moves: Open → In progress or Resolved; In progress → Open or Resolved; Resolved → In progress (reopen). Legacy `waiting`/`closed` tickets are shown as In progress/Resolved.
- The first public staff reply moves an Open ticket to In progress and assigns it to that agent if nobody is assigned. Starting work on an unassigned ticket does the same.
- Resolving accepts an optional note, posted as a reply the requester can see. A requester reply on a resolved ticket reopens it (In progress if assigned, otherwise Open).
- Internal notes are visible to agents only and never change the status.
- Tickets can only be assigned to active users with `support:edit`.
- In-app notifications: the requester on staff replies and resolution; the assignee on assignment and on requester replies.

## 46. Multi-Currency, Multi-Timezone, Multi-Language

**Phase:** Phase 2

- Multi-currency payroll with exchange rate management and historical rate lock (as of payroll date)
- Multi-timezone support across branches/locations
- Multi-language / i18n UI
- Local date, number, and currency formatting per country

**Exchange rate rules**

- Admin screen: Settings → Currency & Exchange Rates (`/settings/currency`; view with `settings:view`, change with `settings:edit`). It shows each company's payroll base currency, every currency pair needed by active contracts, and the rate history for each pair.
- A company's payroll base currency is its country's currency unless overridden. A rate is stored as "base units per 1 pay-currency unit" (e.g. 1 USD = 1.48 AUD) with up to 8 decimal places. The form lets admins enter it in either direction.
- Rates are versioned by `effective_from`/`effective_to` (inclusive dates; an empty end means open-ended). Versions of a pair never overlap. Adding a version after an open-ended one ends the previous version the day before. A version added before an existing one ends the day before that one starts.
- A payroll run uses the rate in force on its period end date and copies the value onto the run (`exchangeRate`, `exchangeRateDate`, `exchangeRateId`).
- Historical rate lock: for each pair, the latest period end of a finalized/paid/locked run is the locked-through date. Versions starting on or before it are frozen (rate and start date can't change, and they can't be deleted). A frozen open-ended version may still be given an end date on or after the locked-through date. New versions must start after it. A version referenced by a locked run can never be deleted.
- Changing or deleting a rate doesn't touch draft runs that already copied it. They keep the old value until payroll is recalculated, and the screen warns about this.
- Missing rates (an employee paid in a currency with no rate today) and rates ending within 31 days are flagged at the top of the screen. Every create, change, delete and base-currency change is recorded in the audit log.

**Localization rules**

- Admin screen: Settings → Localization (`/settings/localization`; view with `settings:view`, change with `settings:edit`). It covers four settings per company and per branch (location): default language, time zone, date format and number format.
- Inheritance: branch → company → country. An empty value (`null`) inherits from the level above, so a branch on "Same as company" follows later company changes. Countries don't store a language: Bangladesh defaults to Bengali, every other country to English.
- Languages: English (`en`) and Bengali (`bn`). Time zones are IANA names (e.g. `Asia/Dhaka`). Date formats: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD-MM-YYYY`, `DD.MM.YYYY`, `DD MMM YYYY`, `MMM DD, YYYY` (month names follow the language). Number formats: `1,234.56`, `1.234,56`, `1 234,56`, `1'234.56`, `12,34,567.89` (lakh/crore grouping). Digits stay Latin in every language.
- An employee's settings come from their work location's branch, or from their company if they have none. Attendance, roster and dashboard dates use the resolved time zone and date format. A changed time zone applies to new clock-ins, leave and shifts; saved records keep their dates.
- Language switcher: the top bar of the app shell shows a language menu for every signed-in user (`GET/PATCH /me/localization`). A personal choice is saved on the user account and overrides the organization default on every device. "Organization default" clears it. The sidebar groups, My Space items and top-bar labels are translated; the rest of the admin screens are still English only, and the menu says so.
- Company and branch changes are recorded in the audit log. A user's own language choice is a personal preference and is not audited.

## 47. System Settings & Backup

**Phase:** MVP — Phase 1

- General system configuration
- Scheduled backups and tested restore procedure

