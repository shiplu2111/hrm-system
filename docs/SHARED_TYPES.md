# SHARED_TYPES.md — `packages/shared` Conventions

Defines how TypeScript types, constants, and utilities are shared across `backend`, `admin`, and `mobile` so all three apps stay in sync instead of drifting into duplicated/conflicting definitions. Cross-references: `ARCHITECTURE.md` §8, `RULES.md` §2.

---

## 1. Core Principle

**`packages/shared` is the single source of truth for any type, enum, or constant used by more than one app.** Backend is the authority on what the shape *should* be (since it owns the database and API contract), but the package itself lives outside any single app so all three import from the same place — no app "owns" the package at the code-organization level, even though backend concepts usually drive it.

Before creating a new type/interface in `admin` or `mobile`, check `packages/shared/types` first (`RULES.md` §2). If it should be reusable, add it there instead of duplicating locally.

---

## 2. Package Structure

```
packages/shared/
├── types/
│   ├── employee.types.ts
│   ├── attendance.types.ts
│   ├── leave.types.ts
│   ├── payroll.types.ts
│   ├── auth.types.ts
│   ├── recruitment.types.ts
│   ├── performance.types.ts
│   ├── training.types.ts
│   ├── notification.types.ts
│   ├── api.types.ts          # generic envelope/pagination/error shapes
│   └── index.ts                # re-exports everything
├── constants/
│   ├── roles.ts
│   ├── enums.ts                # attendance status, leave type, payroll status, etc.
│   ├── error-codes.ts          # mirrors backend's error-codes.ts (see §6)
│   └── index.ts
├── utils/
│   ├── currency.ts             # formatting only, no business math
│   ├── date.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

- Organized by **domain module** (matching `MODULES.md`), not by technical type (no generic dumping-ground `types/index.ts` with everything inline).

---

## 3. What Belongs Here

✅ **Include:**
- API request/response DTO shapes (matching backend DTOs exactly)
- Entity shapes as returned by the API (e.g., `Employee`, `AttendanceRecord`, `Payslip`) — these mirror the DB model's *API-facing* representation, not the raw Prisma model (see §4)
- Enums (`AttendanceStatus`, `LeaveType`, `Role`, `PayrollRunStatus`, etc. — matching `GLOSSARY.md`'s enum reference exactly)
- Error codes (`ERROR_HANDLING.md` §4) — as a shared const/type so `admin`/`mobile` can branch on them safely
- Pure, framework-agnostic utility functions (currency formatting, date formatting) with no side effects and no dependency on React, NestJS, or any app-specific library

❌ **Do NOT include:**
- Business logic / calculations (payroll math, geofence distance calculation) — those are backend-only (`PAYROLL_LOGIC.md`, `ATTENDANCE_LOGIC.md`); frontend apps never reimplement calculation logic, they only display what the API returns
- React components or hooks (belong in `admin`/`mobile` respectively)
- NestJS decorators, guards, or anything backend-framework-specific
- Anything containing secrets, environment-specific config, or credentials

---

## 4. API Types vs. Database Models

**Important distinction:** the backend's Prisma models (`DATABASE_SCHEMA.md`) are *not* directly exported into `packages/shared`. Instead, `packages/shared/types` defines the **API contract shape** — what actually crosses the network — which is often a subset or transformed version of the DB model.

Example:
```typescript
// packages/shared/types/employee.types.ts

// This is what the API returns — NOT a 1:1 mirror of the Prisma `Employee` model.
// Sensitive/internal-only fields (e.g., raw foreign key IDs the client doesn't need,
// soft-delete metadata) are deliberately excluded.
export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  department: { id: string; name: string };
  designation: { id: string; title: string };
  employmentStatus: EmploymentStatus;
  joiningDate: string; // ISO 8601 date
}

// Separate, more restrictive shape for what a `manager` role sees in team listings
export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  department: { id: string; name: string };
}
```

- Field naming: **camelCase** in shared types (even though the DB uses snake_case per `DATABASE_SCHEMA.md` conventions) — the backend's serialization layer (NestJS interceptor or DTO mapping) handles the conversion; `packages/shared` reflects the wire format, not the DB schema.
- If a field is genuinely sensitive (bank account numbers, national ID) and should never leave the backend except to the specifically authorized role/endpoint, it may not appear in the general shared `Employee` type at all — model it as a separate, narrowly-scoped type only imported where actually needed (e.g., `EmployeeBankDetails`, used only in the payroll bank-details screen's specific hook).

---

## 5. Enums & Constants

Enums are defined once and match `GLOSSARY.md`'s "Status/Enum Reference" section exactly — if they ever diverge, `GLOSSARY.md` is updated in the same PR.

```typescript
// packages/shared/constants/enums.ts

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  ABSENT = 'absent',
  ON_LEAVE = 'on_leave',
  REGULARIZED = 'regularized',
}

export enum PayrollRunStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  DISBURSED = 'disbursed',
  CANCELLED = 'cancelled',
}
// ... LeaveRequestStatus, CandidateStage, etc. follow the same pattern
```

**Note — `Role` is deliberately NOT a fixed enum.** Roles are dynamic (`DATABASE_SCHEMA.md` §1, `ROLES_PERMISSIONS.md` §1) — `super_admin` can create custom roles from the admin panel, so a hardcoded `enum Role { SUPER_ADMIN, HR, ... }` here would immediately go stale the first time a custom role is created. Instead:

```typescript
// packages/shared/types/auth.types.ts

export interface Role {
  id: string;
  name: string;
  slug: string;
  isSystemRole: boolean;
}

// Returned as part of the login/session response — this is what admin/mobile
// actually check against (RULES.md §3, ROLES_PERMISSIONS.md §13.2), not a
// role name comparison:
export interface SessionUser {
  id: string;
  employeeId: string | null;
  role: Role;
  permissions: string[]; // flat list of granted permission keys, e.g. ["payroll.approve", "attendance.view:team"]
}
```

- The **four seeded system role slugs** (`super_admin`, `hr`, `manager`, `employee`) can still be referenced as string constants where code genuinely needs to special-case a system role (e.g., `SYSTEM_ROLE_SLUGS.SUPER_ADMIN`), but this should be rare — the large majority of role-aware code should check `permissions.includes('some.key')`, not compare against a role slug, so it works correctly for custom roles too (`ROLES_PERMISSIONS.md` §13.1–13.2).

```typescript
// packages/shared/constants/roles.ts
export const SYSTEM_ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;
```

- String enums (not numeric) — values match the DB's stored string exactly, so no translation layer is needed between what the API returns and what the frontend enum represents.

---

## 6. Error Codes

Mirrors the codes defined across `ERROR_HANDLING.md` §4, `AUTH_FLOW.md` §14, `PAYROLL_LOGIC.md` §12, `ATTENDANCE_LOGIC.md` §10:

```typescript
// packages/shared/constants/error-codes.ts

export const ErrorCode = {
  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',

  // Payroll
  MAKER_CHECKER_VIOLATION: 'MAKER_CHECKER_VIOLATION',
  PAYROLL_ALREADY_APPROVED: 'PAYROLL_ALREADY_APPROVED',

  // Attendance
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  OFFICE_LOCATION_NOT_CONFIGURED: 'OFFICE_LOCATION_NOT_CONFIGURED',

  // ... etc, grouped by module
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];
```

- **Ownership rule:** when a new error code is introduced in the backend (per `ERROR_HANDLING.md` §4, defined first in the relevant module's `error-codes.ts`), it must be added here in the same PR — the shared error handling client layer (`UI_GUIDELINES.md` §3, `ERROR_HANDLING.md` §7) depends on this list being complete, not backend-only.

---

## 7. Versioning & Breaking Changes

- `packages/shared` has no independent version number in this monorepo setup (workspace-linked, not published to a registry) — all three apps always consume the current state of the package from the same commit, per Turborepo/pnpm workspace conventions (`ARCHITECTURE.md` §2).
- A breaking change to a shared type (removing/renaming a field, changing a type) must be made in lockstep with the backend API change it reflects — per `API_GUIDELINES.md` §14's breaking-change policy, this typically means the change ships alongside a new API version or a coordinated deploy of all three apps, not a silent type change that could break `admin`/`mobile` builds unexpectedly.
- CI type-checks all three apps against the current `packages/shared` state (`TESTING.md` §5) — a PR that changes a shared type and breaks another app's build should fail CI, not merge silently.

---

## 8. Utility Functions

Kept minimal and strictly pure — no business logic, no side effects, no framework dependency:

```typescript
// packages/shared/utils/currency.ts
export function formatCurrency(amount: number, currency: string = 'BDT'): string {
  // Formatting only — the amount itself is always calculated server-side
  // (PAYROLL_LOGIC.md) and passed in already correct; this function never
  // performs payroll math.
}

// packages/shared/utils/date.ts
export function formatDate(isoDate: string, format: 'short' | 'long' = 'short'): string {
  // Presentation formatting only
}
```

- If a function needs a library dependency (e.g., a date library), keep that dependency lightweight and framework-agnostic (no React-specific date-picker libraries here) — it must be usable identically from a NestJS service, a React component, and a React Native component.

---

## 9. Import Convention

All three apps import via the package name, not relative paths reaching across the monorepo:

```typescript
// ✅ Correct
import { Employee, AttendanceStatus, ErrorCode } from '@hrm/shared';

// ❌ Incorrect — never reach across app boundaries with relative paths
import { Employee } from '../../../packages/shared/types/employee.types';
```

- Package name: `@hrm/shared` (adjust to actual npm scope/name chosen at Phase 0 setup) — configured once in each app's `package.json` as a workspace dependency.

---

## 10. Checklist for Adding to Shared Types

- [ ] Type reflects the **API wire format** (camelCase), not the raw DB model (§4)
- [ ] No sensitive fields included unless the type is deliberately narrow-scoped for an authorized use case (§4)
- [ ] Enum values match `GLOSSARY.md`'s reference exactly (§5)
- [ ] New error codes added here in the same PR as the backend change introducing them (§6)
- [ ] No business logic, only shape definitions and pure formatting utilities (§3, §8)
- [ ] Breaking changes coordinated across all three apps per §7, not shipped in isolation

---

## 11. Open Items

- [ ] Finalize actual npm workspace package name/scope (`@hrm/shared` is a placeholder, §9) during Phase 0 setup
- [ ] Decide on a lightweight date library (if any) for `utils/date.ts` (§8) — confirm it's safe to use identically across NestJS/React/React Native before adding as a dependency
