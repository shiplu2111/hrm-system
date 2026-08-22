# UI_GUIDELINES.md — Web App (React)

Applies to `apps/admin` — the Web App serving both admin tooling and employee self-service (`ARCHITECTURE.md` §6). Defines folder structure, component conventions, styling approach, and interaction/writing standards. Pairs with `DESIGN_SYSTEM.md` (tokens, colors, typography) — this doc covers *how we build*, that one covers *what things look like*.

---

## 1. Folder Structure (feature-first, per `RULES.md` §5)

```
src/
├── app/                  # routing, providers, app shell/layout
├── components/
│   └── ui/                # generic, reusable, domain-agnostic (Button, Modal, DataTable wrapper)
├── features/
│   ├── attendance/
│   │   ├── components/    # feature-specific components
│   │   ├── hooks/          # TanStack Query hooks for this feature
│   │   ├── api/             # API call functions
│   │   └── types.ts         # local types not in packages/shared
│   ├── payroll/
│   ├── leave/
│   ├── employees/
│   └── ...
├── store/                 # Zustand stores (auth session, UI-only global state)
├── routes/                 # route definitions + guards
└── lib/                     # generic utils (formatting, constants)
```

- A component belongs in `components/ui/` only if it has **zero knowledge** of any HRM domain concept (no "employee," "payroll," "leave" in its props/logic). Everything else lives inside its feature folder.
- Don't create a global `hooks/` or `utils/` folder for domain-specific logic — it belongs with the feature that owns it.

---

## 2. Component Conventions

- One component per file, file name matches component name (`EmployeeTable.tsx` exports `EmployeeTable`).
- Functional components with hooks only — no class components.
- Props typed via `interface`, not inline object types, for anything reused or exported.
- No business logic inside JSX beyond simple conditionals (`{isLoading ? <Spinner /> : <Table />}`) — extract calculations/formatting to a hook or `lib/` function.
- Avoid prop-drilling more than 2 levels — if a value needs to go deeper, either lift it to a feature-local context or reconsider the component boundary.

---

## 3. Data Fetching

- **All** server data goes through TanStack Query — no raw `fetch`/`axios` calls inside components (`RULES.md` §5).
- One hook per query/mutation, named descriptively: `useEmployees()`, `useApproveLeaveRequest()`, `usePayrollRun(id)`.
- Query keys follow a consistent structure: `['employees', filters]`, `['payroll-runs', runId]` — enables predictable cache invalidation.
- Loading and error states are handled at the feature level, using the shared error-handling pattern from `ERROR_HANDLING.md` §7 (a single interceptor/hook translating API error codes into user-facing messages) — don't write ad hoc `if (error) return <div>Error</div>` per component.

---

## 4. Forms

- Single form library across the app: **React Hook Form** — do not mix approaches per feature.
- Validation schemas: **Zod**, shared where possible with backend DTO shape expectations (not literally shared code across the language boundary, but kept in sync conceptually with `packages/shared/types`).
- Every form field shows inline validation errors, not just a toast/banner — per the writing principles in §8, errors are specific about what's wrong and how to fix it.
- Submit buttons disable during submission and show a loading state — never allow a double-submit on payroll/financial actions especially.

---

## 5. Tables & Lists (HRM is data-heavy — this matters a lot)

- Use Ant Design's `Table` component as the base for all list views (employees, attendance, leave requests, payroll runs) — don't build custom table components from scratch.
- Every list view that hits `GET` list endpoints must implement pagination matching `API_GUIDELINES.md` §7 (page/limit), not fetch-all-then-paginate-client-side, once employee counts grow.
- Filters and sort controls map directly to the query params defined in `API_GUIDELINES.md` §8 — keep the UI vocabulary and the API vocabulary aligned (e.g., a "Status" filter dropdown maps directly to the `status` query param, not a differently-named internal filter key).
- Row actions (approve, edit, view) use icon + label for primary actions, icon-only with tooltip acceptable for secondary/space-constrained actions — never icon-only with no accessible label for a destructive action (delete, reject).

---

## 6. Role-Based UI

- Hide/disable UI elements based on the current user's **permission key list** (returned at login per `SHARED_TYPES.md`'s `SessionUser.permissions`, not a role name from JWT claims) **for UX clarity only** — this is never the actual security boundary (`SECURITY.md` §3, `RULES.md` §5). The backend independently enforces every permission via `@RequirePermission()` (`ROLES_PERMISSIONS.md` §13.1).
- Pattern: a single `usePermissions()` hook or `<RequirePermission permission="payroll.approve">` wrapper component, checking against the permission key list — don't scatter raw `if (user.role === 'hr')` checks across many components, and don't hardcode role-name comparisons anywhere, since this breaks the moment a `super_admin` creates a custom role (`ROLES_PERMISSIONS.md` §1, §13.4).
- Since the same app now serves both admin tooling and employee self-service (`ARCHITECTURE.md` §6), this hook also drives which **top-level app shell** a user lands in — someone with only self-service permission keys sees the self-service sidebar (`NAVIGATION.md` §9), while someone with broader permissions sees the full admin nav, with self-service sections layered in additively for roles like Manager that have both (`NAVIGATION.md` §9's "additive, not either/or" rule).
- If a user reaches a page/action they don't have permission for (e.g., stale UI, direct URL entry), the backend returns `403 FORBIDDEN` (`API_GUIDELINES.md` §6.1) and the UI shows a clear "you don't have access to this" state — not a silent failure or broken page.

---

## 7. Loading, Empty, and Error States

Every data view must explicitly handle all three states — this isn't optional polish, it's baseline correctness for a system HR relies on daily:

- **Loading:** skeleton loaders for tables/cards (preferred over spinners for perceived performance on data-heavy views); a simple spinner is fine for quick actions.
- **Empty:** per the writing principle in §8 — an empty state is an invitation to act, not just "No data." E.g., an empty employee list for a new company says something like "No employees yet — add your first employee to get started," with the action button right there, not just neutral silence.
- **Error:** translated from the API error code (`ERROR_HANDLING.md` §7) into a specific, actionable message — never a raw error dump or generic "Something went wrong" when a more specific `code` is available.

---

## 8. Writing / UI Copy Standards

- **Active voice, matching the action's name through the whole flow:** a button that says "Approve Leave" leads to a confirmation and success message that also say "Approve"/"Approved" — not "Submit" then "Success."
- **Name things by what the user controls, not backend implementation:** "Attendance Record," not "Attendance Row"; "Payroll Run," not "Payroll Job." Match the terms in `GLOSSARY.md` exactly.
- **Errors are specific, not apologetic:** "This employee already has an active salary structure — end the current one before adding a new one," not "Something went wrong, please try again."
- **Confirmations for destructive/high-stakes actions** (approving payroll, revoking a biometric device, rejecting leave) state exactly what will happen — not a generic "Are you sure?"

---

## 9. Styling

- Ant Design as the component base (per `ARCHITECTURE.md` §6); customize via Ant Design's theme tokens (`ConfigProvider` theme) rather than overriding styles with ad hoc CSS per component, to keep the look consistent as the app grows.
- See `DESIGN_SYSTEM.md` for the actual color/type tokens.
- No inline `style={{ ... }}` for anything beyond a one-off layout tweak — prefer theme tokens or a shared style utility.

---

## 10. Accessibility (baseline, not optional)

- All interactive elements reachable and operable via keyboard (tab order, visible focus states) — HR staff often work across many records quickly and rely on keyboard navigation.
- Form fields have associated labels (Ant Design's `Form.Item` handles this by default — don't strip it out for custom-styled forms).
- Color is never the only signal for status (e.g., "late" attendance shown with a color **and** a text/icon label, not a colored dot alone) — matters both for accessibility and for colorblind users interpreting attendance/payroll status at a glance.
- Respect `prefers-reduced-motion` for any transitions/animations added beyond Ant Design's defaults.

---

## 11. Responsive Behavior

- Admin dashboard is primarily desktop-first (HR/managers typically work at a desk), but must remain usable on tablet-sized screens at minimum — verify table views degrade gracefully (horizontal scroll or column prioritization) rather than breaking layout.
- Not required to fully optimize for phone-sized screens for v1 (that's the mobile app's job, per `PRD.md`) — but nothing should be fully broken/unusable if opened on a phone browser.

---

## 12. Checklist for New Admin Features

- [ ] Feature folder follows §1 structure
- [ ] Data fetching via TanStack Query hooks only (§3)
- [ ] Forms use React Hook Form + Zod (§4)
- [ ] Lists use Ant Design `Table` with server-side pagination matching `API_GUIDELINES.md` (§5)
- [ ] Role-based UI uses the shared permission pattern, not scattered checks (§6)
- [ ] Loading / empty / error states all explicitly handled (§7)
- [ ] Copy follows §8 (matches `GLOSSARY.md` terms, active voice, specific errors)
- [ ] Keyboard-accessible, labeled form fields, no color-only status signals (§10)
