# NAVIGATION.md — Mobile App Navigation Structure

Applies to `apps/mobile`. Defines the screen hierarchy, navigation library conventions, and routing/guard rules. Uses **React Navigation** (per `ARCHITECTURE.md` §7).

---

## 1. Top-Level Navigation Structure

```
RootNavigator (stack)
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   ├── RegisterScreen (if self-registration is in scope — else invite-only, see PRD.md)
│   ├── ForgotPasswordScreen
│   └── ResetPasswordScreen
│
└── AppStack (authenticated) — wraps MainTabs
    ├── MainTabs (bottom tab navigator)
    │   ├── HomeTab
    │   ├── AttendanceTab
    │   ├── LeaveTab
    │   ├── PayslipsTab
    │   └── ProfileTab
    │
    └── Modal/Detail screens (pushed on top of tabs, not part of tab bar)
        ├── CheckInDetailScreen
        ├── LeaveRequestFormScreen
        ├── LeaveRequestDetailScreen
        ├── PayslipDetailScreen
        ├── SettingsScreen
        ├── PinSetupScreen
        ├── BiometricSetupScreen
        ├── DeviceManagementScreen
        ├── DocumentUploadScreen
        ├── RegularizationRequestScreen
        ├── NotificationCenterScreen
        └── TrainingDetailScreen (if training self-enrollment is in mobile scope)
```

---

## 2. Root-Level Auth Gating

```
RootNavigator decides AuthStack vs AppStack based on:
  - Presence of a valid (or refreshable) token in secure storage
  - Checked on app launch (AUTH_FLOW.md §11 — silent refresh attempt)

On launch:
  1. Show a brief splash/loading state while checking stored tokens
  2. Attempt silent token refresh (AUTH_FLOW.md §9)
  3. If successful → AppStack
  4. If failed/no tokens → AuthStack
```

- Auth state changes (login success, logout, forced re-login on refresh-token compromise per `AUTH_FLOW.md` §9) trigger a full switch between `AuthStack` and `AppStack` — never a partial/manual navigation reset that could leave stale authenticated screens in the stack after logout.
- On logout, explicitly reset navigation state (not just switch stacks) so a "back" gesture can never return to an authenticated screen using a stale in-memory stack.

---

## 3. Bottom Tab Structure (MainTabs)

| Tab | Icon (Lucide) | Purpose |
|---|---|---|
| Home | `home` | Dashboard: today's check-in status, quick actions, announcements/notifications summary |
| Attendance | `clock` | Check-in/out action, attendance history calendar view |
| Leave | `calendar-days` | Leave balance, apply for leave, leave history |
| Payslips | `receipt` | Payslip list (only `disbursed` payslips visible, per `PAYROLL_LOGIC.md` §8) |
| Profile | `user` | Own profile view, links into Settings |

- Exactly 5 tabs — per mobile UX convention, avoid overflowing into a "More" tab for v1's scope. If Performance/Training self-service screens are added later, evaluate whether they belong under an existing tab (e.g., Profile) rather than expanding the tab bar.
- The **Attendance tab is the most-used action** (per `PRD.md` core use case) — its icon/tab should be positioned prominently (commonly center or second position) rather than buried last.

---

## 4. Screen-by-Screen Flow

### 4.1 Home
- Shows current day's attendance status prominently (checked in / not yet / checked out).
- Primary action button: "Check In" or "Check Out" depending on current state — this is the fastest path to the most common action, available directly from Home without navigating to the Attendance tab (though the Attendance tab also has it).
- Notification bell icon → `NotificationCenterScreen`.
- Announcement/summary cards (leave balance snapshot, upcoming holiday, pending items).

### 4.2 Attendance
- Check-in/out button + status (same action as Home, kept in sync).
- Calendar/list view of attendance history — entries show status badge (`present`/`late`/`absent`/`on_leave`/`regularized`, per `GLOSSARY.md` enum list) and a "Pending sync" indicator where applicable (`OFFLINE_SYNC.md` §4).
- Tapping a day → `CheckInDetailScreen` (shows check-in/out times, location validity, option to submit regularization if there's an issue → `RegularizationRequestScreen`).

### 4.3 Leave
- Leave balance summary by type (Casual/Sick/Earned/Unpaid, per `GLOSSARY.md`).
- "Apply for Leave" button → `LeaveRequestFormScreen`.
- List of past/pending leave requests with status badges → tap for `LeaveRequestDetailScreen`.

### 4.4 Payslips
- List of payslips by month, most recent first.
- Tap → `PayslipDetailScreen` (breakdown per `payslip_line_items`, download/share PDF).
- Empty state (no disbursed payslips yet) follows the writing principle from `UI_GUIDELINES.md` §8 — informative, not just blank.

### 4.5 Profile
- Own profile summary (name, department, designation, reporting manager).
- Limited self-edit fields only (contact info — per `ROLES_PERMISSIONS.md` §3, employees cannot edit employment status/department themselves).
- Link to `SettingsScreen`.

### 4.6 Settings
- Change Password
- Set up / Manage PIN → `PinSetupScreen`
- Enable / Manage Biometric → `BiometricSetupScreen` → `DeviceManagementScreen`
- Notification preferences
- Logout (with confirmation)
- App version / support contact info

---

## 5. Navigation Conventions

- **Stack navigation** for drill-down flows (list → detail → sub-action) — standard push/pop, native back gesture supported.
- **Modal presentation** (`presentation: 'modal'`) for focused single-task screens that interrupt the current flow: `LeaveRequestFormScreen`, `RegularizationRequestScreen`, `PinSetupScreen` — these should feel like a task the user completes and dismisses, not a deeper drill-down.
- **No nested tab navigators** — keep navigation depth predictable; a screen reached from any tab should have one clear way back, not multiple competing back-stacks.
- Screen names in code match this document's naming (`PascalCase` + `Screen` suffix) — keeps the doc and codebase directly cross-referenceable for future navigation changes.

---

## 6. Deep Linking (Push Notifications)

Notifications (`MODULES.md` §10) should deep-link directly to the relevant screen, not just open the app to Home:

| Notification Type | Deep Links To |
|---|---|
| `leave_approved` / `leave_rejected` | `LeaveRequestDetailScreen` (specific request) |
| `payroll_processed` | `PayslipDetailScreen` (specific payslip) |
| `attendance_regularization_reviewed` | `CheckInDetailScreen` (specific day) |
| `biometric_device_revoked` | `DeviceManagementScreen` |
| General announcement | `NotificationCenterScreen` |

- Deep link targets must handle the "cold start" case (app wasn't running, notification tap launches it) as well as "warm" (app already open) — both must land on the correct screen, not just Home with the notification unopened.

---

## 7. Guarded/Conditional Navigation

- `PinSetupScreen` / `BiometricSetupScreen`: entry requires a recent password confirmation step first (per `AUTH_FLOW.md` §4, §6) — the screen itself should redirect to a re-auth prompt if entered without one, rather than assuming the caller already handled it.
- `PayslipDetailScreen`: only reachable for payslips where `payroll_runs.status = 'disbursed'` — the Payslips tab list itself should never surface draft/pending payslips to navigate into (`PAYROLL_LOGIC.md` §8), so this is enforced at the list-query level, not just hidden at the detail screen.
- Screens requiring a specific role (none in mobile v1, since mobile is employee-only self-service per `PRD.md` personas — Manager/HR/Admin functions live in `apps/admin`) — if manager-specific mobile screens (e.g., approving leave on the go) are added later, they'd need role-gating consistent with `ROLES_PERMISSIONS.md`, which is currently out of mobile's v1 scope.

---

## 8. Back Behavior & Interruption Handling

- Forms with unsaved input (`LeaveRequestFormScreen`, `RegularizationRequestScreen`) prompt a confirmation before discarding on back/dismiss — standard "Discard changes?" pattern, not a silent loss of input.
- Check-in/out action is **not** interruptible by navigation mid-request — the button shows a loading state and blocks a second tap/navigation-away until the request (or offline queue write, per `OFFLINE_SYNC.md` §4) completes, to avoid ambiguous partial states.

---

## 9. Web Self-Service Navigation (Employee role on `apps/admin`)

Per `ARCHITECTURE.md` §6, employees can now log in on the web app (`apps/admin`) as well as mobile. The web app is primarily desktop-first admin tooling (`UI_GUIDELINES.md` §11), so the employee self-service view is **not** a tab-bar clone of mobile — it's a left-nav sidebar section, consistent with the rest of the admin app's navigation pattern, scoped to only the routes the `employee` permission set allows (`ROLES_PERMISSIONS.md` §13.2).

| Mobile Screen (this doc, §3–4) | Web Equivalent Route | Notes |
|---|---|---|
| Home | `/` (redirects here on login for `employee`-scoped users, per `ARCHITECTURE.md` §6) | Same content intent: today's status, quick actions |
| Attendance | `/attendance` | Check-in/out **not offered on web** — per `PRD.md`, GPS check-in is a mobile-only action (a desktop browser's location is a poor proxy for "at the office" and defeats the geofence's purpose); web shows history/regularization requests only, no check-in button |
| Leave | `/leave` | Full parity with mobile — apply, view balance, view history |
| Payslips | `/payslips` | Full parity with mobile |
| Profile / Settings | `/profile`, `/settings` | Full parity with mobile except PIN/Biometric setup, per `AUTH_FLOW.md` §12 |

- Sidebar nav items for these routes are shown/hidden using the same `usePermissions()` mechanism as the rest of the admin app (`UI_GUIDELINES.md` §6, `ROLES_PERMISSIONS.md` §13.2) — no separate "employee nav" component, just the existing role-based nav rendering fewer items for a permission set that only includes self-service keys.
- A `manager`-role user sees **both** their own self-service section (since managers are also employees with attendance/leave/payslips of their own) **and** their team-management sections (approvals, reports) — the sidebar is additive based on the union of granted permission keys, not an either/or switch between "admin mode" and "employee mode."

---

## 10. Open Items

- [ ] Confirm self-registration (`RegisterScreen`) is in mobile scope vs. invite-only via HR-created accounts (`AUTH_FLOW.md` §2) — affects whether this screen exists at all
- [ ] Confirm whether Performance/Training self-service screens are in mobile v1 scope (currently omitted from the tab structure, §3) — if yes, decide placement without expanding beyond 5 tabs
- [ ] Confirm final tab order/icons with actual design review (`DESIGN_SYSTEM.md` equivalent for mobile, if a separate mobile design system doc is created)
- [ ] Confirm whether web check-in should be offered at all in a limited form (e.g., only for office-based employees on a recognized office network) rather than omitted entirely (§9) — default v1 assumption is mobile-only check-in
