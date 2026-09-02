# DESIGN_SYSTEM.md

## 1. Purpose

Shared design tokens and component conventions across the admin web app, employee web app, and mobile app, so the product feels like one system rather than three separately-designed apps. Fill in actual values once a designer/design tool (Figma) is attached to the project — this file is the placeholder structure.

## 2. Design Tokens

```
Colors:      primary, secondary, success, warning, danger, neutral scale
Typography:  font family, scale (h1–h6, body, caption), weights
Spacing:     4px/8px base scale
Radius:      component corner radius scale
Shadows:     elevation levels
```

## 3. Component Library

- Web: shared component library (e.g. built on top of a base like Radix/shadcn, or a custom kit) used by both Admin and Employee web apps.
- Mobile: React Native equivalent component set, visually aligned to the web tokens but built natively for RN (not a webview).

## 4. Core Reusable Components

Button, Input, Select/Dropdown, Date Picker, Table (with sort/filter/pagination), Modal, Toast/Notification, Badge/Status Pill (for attendance/payroll/leave statuses — see UI_GUIDELINES.md §3 for status color mapping), Stepper/Timeline (for approval workflows), Card, Tabs.

## 5. Status Color Convention

Consistent color mapping across the whole product for recurring statuses (Draft/Pending = neutral or amber, Approved/Finalized/Present = green, Rejected/Absent/Overdue = red, In-Review = blue) — defined once here, referenced everywhere so Payroll status, Leave status, and Attendance status all read consistently to the user.

## 6. Accessibility

- Minimum contrast ratios (WCAG AA) for all text/background combinations.
- All interactive elements keyboard-navigable on web; adequate touch target size on mobile.

## 7. Responsive Behavior (Web)

- Admin web app: desktop-first, must remain usable at tablet width for managers approving requests on the go.
- Employee web app (if offered alongside the mobile app): mobile-responsive by default.

## 8. Ownership

- This file is a living reference — update it as design decisions are finalized, rather than letting the design tool (Figma) be the only source of truth developers have to chase down.
