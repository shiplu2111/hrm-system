# SHARED_TYPES.md

## 1. Purpose

Types/DTOs used by both backend (NestJS) and clients (React web, React Native mobile) live in a single shared package to prevent drift between what the API returns and what the client expects (see RULES.md §6).

## 2. Package Structure

```
/packages/shared-types/
  src/
    employee.ts
    attendance.ts
    leave.ts
    payroll.ts
    auth.ts       -- LoginRequest, LoginResponse, AuthUser, AccessTokenClaims
    common.ts     -- ApiResponse, ApiError, PermissionAction, SyncableRecord
  package.json
```

Consumed via npm workspaces (`@hrm/shared-types`) by `apps/api`, `apps/web`, `apps/admin`, and `apps/mobile`.

## 3. Core Shared Enums (examples)

```ts
export type AttendanceStatus =
  | "present" | "absent" | "late" | "early_leave" | "half_day"
  | "holiday" | "weekend" | "leave" | "wfh" | "business_trip";

export type PayrollRunStatus =
  | "draft" | "calculated" | "under_review" | "approved"
  | "finalized" | "paid" | "cancelled";

export type PermissionAction =
  | "view" | "create" | "edit" | "delete" | "approve" | "finalize";
```

## 4. Sync-Related Shared Types (critical for offline)

```ts
export interface SyncableRecord {
  local_id: string;      // client-generated UUID
  server_id?: string;    // populated after first successful sync
  sync_status: "pending" | "syncing" | "synced" | "failed";
}

export interface AttendanceEventDTO extends SyncableRecord {
  employee_id: string;
  type: "clock_in" | "clock_out" | "break_start" | "break_end";
  timestamp_device: string; // ISO
  gps?: { lat: number; lng: number };
}
```

## 5. API Response Wrapper

```ts
export interface ApiResponse<T> {
  data: T;
  meta?: { page: number; total: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }>; requestId: string };
}
```
Matches API_GUIDELINES.md and ERROR_HANDLING.md exactly — any change to the API response shape must update this file in the same commit.

## 5a. Auth types (implemented)

```ts
export interface LoginRequest {
  email: string;
  password: string;
  tenantSubdomain?: string;  // e.g. "demo"
  tenantId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  roleId: string;
  employeeId: string | null;
  permissions: { module: string; action: PermissionAction }[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;   // seconds, default 900 (15m)
  user: AuthUser;
}
```

## 6. Versioning

- Shared types package version bumped alongside API version changes (see API_GUIDELINES.md §1); backend and clients should pin compatible versions rather than always using "latest," to avoid a mobile app in the field breaking against a newer, incompatible type set.
