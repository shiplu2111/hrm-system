# UI_GUIDELINES.md

## 1. General Principles

- Admin/HR/Payroll users are power users doing repetitive data-heavy tasks — prioritize information density, keyboard efficiency, and bulk actions over decorative UI.
- Employee-facing screens (ESS, mobile) are used quickly and often on the go — prioritize speed and minimal taps over feature density (see MODULES.md §24, §32).

## 2. Data Tables (Admin)

- Sortable, filterable columns; sticky header on scroll.
- Bulk-select with bulk actions (e.g. bulk-approve leave requests) where the underlying workflow supports it.
- Export-to-CSV/Excel available from any major list view (ties to MODULES.md §37 Data Import/Export).

## 3. Status Display

- Every status field (attendance, leave, payroll run, approval) rendered as a colored badge/pill using the shared status color convention (see DESIGN_SYSTEM.md §5) — never plain unstyled text for status.

## 4. Forms

- Inline validation (not just on-submit) for required fields and format errors — error messages follow the human-readable convention from ERROR_HANDLING.md §7.
- Multi-step forms (e.g. employee onboarding, payroll setup wizard) show clear step progress and allow going back without losing entered data.

## 5. Payroll-Specific UI Requirements

- Any screen that finalizes or approves payroll must show a clear confirmation step summarizing the impact (number of employees, total gross/net) before committing — this is a financial action and must not be a single accidental click (see PAYROLL_LOGIC.md §7).
- Finalized/locked payroll runs are visually distinct (e.g. read-only styling) so admins don't attempt edits that will be rejected server-side.

## 6. Mobile-Specific UI (Employee App)

- Clock in/out is the single most-used action — must be reachable within one tap from the home screen.
- Offline state is always visible to the user (a persistent, non-intrusive indicator) — the app must never let the employee wonder whether their clock-in was recorded (see OFFLINE_SYNC.md §9 for the underlying sync-status data this reflects).
- Large touch targets for clock in/out buttons — this is frequently used in the field, sometimes with gloves or in a hurry.

## 7. Empty States

- Every list/table has a designed empty state with a clear next action (e.g. "No employees yet — Add your first employee"), not a blank screen.

## 8. Loading & Error States

- Skeleton loaders for data-heavy screens rather than spinners where feasible.
- Network errors on mobile are distinguished from validation errors and offer a retry action consistent with the offline queue behavior (see ERROR_HANDLING.md §5).

## 9. Localization Readiness

- No hard-coded user-facing strings in components — all text through an i18n layer from the start, even if only one language ships in MVP (keeps MODULES.md §46 Multi-Language from becoming a rewrite later).
