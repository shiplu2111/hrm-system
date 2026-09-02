# NAVIGATION.md

## 1. Admin Web App — Top-Level Navigation

```
Dashboard
Employees        → list, profile, lifecycle events, documents
Organization      → departments, designations, job levels, locations
Recruitment        → (Phase 2) requisitions, candidates, interviews
Attendance          → daily view, corrections, exceptions
Roster               → shift management, schedule view
Leave                 → requests, policies, balances
Payroll                → periods, runs, salary structures, rules (Phase 2 for rule builder UI)
Reports                  → all report categories (see MODULES.md §38)
Settings                   → company, roles/permissions, notifications, integrations, billing
```

Role-based visibility: a Manager sees a reduced nav (their team's Attendance/Leave/Approvals, not company-wide Payroll setup) — driven by ROLES_PERMISSIONS.md, not a separate hard-coded nav config per role.

## 2. Employee Self-Service (Web/Mobile) — Top-Level Navigation

```
Home/Dashboard   → today's shift, clock in/out, quick actions
Attendance        → my history, timesheet
Leave               → apply, balance, history
Payslips              → view/download
Profile                 → my info, documents
Notifications
```

## 3. Mobile App Navigation Pattern

- Bottom tab bar: Home, Attendance, Leave, Payslips, Profile (confirm final 5-tab set once UX is designed — Clock In/Out likely lives prominently on Home rather than as its own tab, per UI_GUIDELINES.md §6).
- Offline indicator persistent across all tabs (see OFFLINE_SYNC.md §9, UI_GUIDELINES.md §6).

## 4. Super Admin Panel — Top-Level Navigation

```
Tenants          → list, provisioning, suspend/restore
Subscription/Billing
Feature Flags
Country Configuration
System Notifications
Audit Logs (platform-level)
Support Tickets
```

## 5. Deep Linking

- Notifications (see NOTIFICATION_LOGIC.md) should deep-link into the relevant screen (e.g. tapping a "leave approved" push opens that leave request), both on web (URL routing) and mobile (RN deep link/universal link config).

## 6. Breadcrumbs & Back Navigation

- Admin web: breadcrumb trail on nested pages (e.g. Employees → John Doe → Documents).
- Mobile: standard platform back-gesture/back-button behavior; never trap the user without a way back.
