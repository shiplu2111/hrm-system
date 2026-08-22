# ERROR_HANDLING.md — Backend Exception Handling

This document defines *how* errors are handled inside `apps/backend` (implementation-level). For the *response shape* clients receive, see `API_GUIDELINES.md` §6 — this doc is about how we get there consistently.

---

## 1. Core Principle

**Never let a raw/unhandled exception reach the client.** Every error response must go through the global exception filter and match the standard envelope in `API_GUIDELINES.md` §6. No endpoint should hand-roll its own error response shape.

---

## 2. Exception Layers

```
Domain Exception (thrown in service)
        │
        ▼
Global Exception Filter (catches everything)
        │
        ▼
Standard Error Response (API_GUIDELINES.md §6 shape)
```

### 2.1 Domain/Business Exceptions
Custom exception classes for known business-rule failures, thrown from services — never from controllers.

```typescript
// common/exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(code: string, message: string, status = 422, details?: Record<string, any>) {
    super({ code, message, details }, status);
  }
}

// Usage in a service
throw new BusinessException(
  'LEAVE_BALANCE_INSUFFICIENT',
  'Employee does not have enough leave balance for this request.',
  422,
);
```

Prefer specific subclasses over passing raw strings everywhere, e.g.:

```typescript
export class GeofenceViolationException extends BusinessException {
  constructor(details?: Record<string, any>) {
    super('GEOFENCE_VIOLATION', 'Check-in location is outside the allowed office radius.', 422, details);
  }
}

export class MakerCheckerViolationException extends BusinessException {
  constructor() {
    super('MAKER_CHECKER_VIOLATION', 'The payroll preparer cannot also approve the same payroll run.', 422);
  }
}
```

### 2.2 Validation Exceptions
Handled automatically by the global `ValidationPipe` (class-validator on DTOs) — these are converted to `VALIDATION_ERROR` (400) by the exception filter, with per-field messages in `details`. Do not manually validate and throw inside services what a DTO should already catch.

### 2.3 Framework/Infrastructure Exceptions
NestJS built-ins (`UnauthorizedException`, `ForbiddenException`, `NotFoundException`, etc.) are still fine to throw directly for generic cases — the global filter maps them to the standard codes in `API_GUIDELINES.md` §6.1.

### 2.4 Unexpected/Unhandled Exceptions
Anything not explicitly thrown as a known exception type (DB connection failure, null pointer, third-party API failure) is caught by the filter's fallback, logged with full stack trace server-side, and returned to the client as:

```json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again.", "details": null }
}
```

**Never** return the raw error message or stack trace to the client in any environment, including staging — log it server-side only.

---

## 3. Global Exception Filter

Single filter registered app-wide, responsible for:
1. Catching all exception types (`BusinessException`, NestJS `HttpException` subtypes, and unknown `Error`)
2. Mapping to the standard response envelope
3. Setting the correct HTTP status code
4. Logging (see §5) — with request ID for traceability
5. Stripping any sensitive data from `details` before it leaves the server (see §6)

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 1. Determine status + error code + message from exception type
    // 2. Log appropriately (see §5)
    // 3. Respond with standard envelope (API_GUIDELINES.md §6)
  }
}
```

---

## 4. Error Code Ownership

- Generic codes (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) are defined once in `common/constants/error-codes.ts` and reused everywhere.
- Module-specific codes (`GEOFENCE_VIOLATION`, `PAYROLL_ALREADY_APPROVED`, `LEAVE_BALANCE_INSUFFICIENT`, `MAKER_CHECKER_VIOLATION`, etc.) are defined in that module's own `error-codes.ts` (e.g., `modules/payroll/payroll-error-codes.ts`) and exported into the shared enum used by `packages/shared/constants` so `admin`/`mobile` can branch on them too (e.g., to show a specific UI message or icon).
- **Never** throw an ad-hoc string as a `code` inline — always reference a defined constant. This keeps codes greppable and prevents silent typos/drift between backend and frontend.

---

## 5. Logging Rules

| Error Type | Log Level | Include Stack Trace? |
|---|---|---|
| `VALIDATION_ERROR` (400) | `debug`/`info` | No |
| `UNAUTHENTICATED` / `INVALID_CREDENTIALS` (401) | `info` (but flag repeated failures — see `SECURITY.md`) | No |
| `FORBIDDEN` (403) | `warn` | No |
| `NOT_FOUND` (404) | `debug` | No |
| `BUSINESS_RULE_VIOLATION` (422) | `info` | No |
| `RATE_LIMITED` (429) | `warn` | No |
| `INTERNAL_ERROR` (500) | `error` | **Yes**, server-side only |

- Every log line includes a request ID so a single request's error can be traced end-to-end.
- **Never log:** passwords, PIN, biometric keys/signatures, full JWT tokens, raw bank account numbers, national ID. Redact these fields explicitly in the logger config — see `SECURITY.md` §2, §6.

---

## 6. Sensitive Data in Error Details

Before an error's `details` object is serialized to the client, it must be checked against a redaction list (same fields as §5's "never log" list). A validation error on a `bank_accounts.account_number` field, for example, should say `"account_number": "must be a valid account number"` — never echo back the invalid value the user submitted if that field is classified Sensitive/Critical in `SECURITY.md` §1.

---

## 7. Retry & Client Guidance

| Error Code | Client Should |
|---|---|
| `VALIDATION_ERROR` | Show field-level messages from `details`, do not retry until fixed |
| `UNAUTHENTICATED` | Attempt token refresh once (`POST /auth/refresh`); if that also fails, force re-login |
| `ACCOUNT_LOCKED` | Show cooldown message with time remaining if available; do not retry automatically |
| `FORBIDDEN` | Do not retry — not a transient issue |
| `CONFLICT` | Refresh local state, then let user decide whether to retry |
| `BUSINESS_RULE_VIOLATION` | Show `message` to user, do not retry automatically |
| `RATE_LIMITED` | Respect `X-RateLimit-Reset` header (`API_GUIDELINES.md` §11), backoff before retry |
| `INTERNAL_ERROR` | Safe to offer a manual "Try again" — do not auto-retry in a loop |

This table should be mirrored in the admin/mobile API client layer (a single shared error-handling hook/interceptor per app) rather than handled ad hoc per screen.

---

## 8. Background Job Errors

Errors in Bull/Redis background jobs (payroll run processing, payslip PDF generation, notification dispatch) are **not** returned to an HTTP client synchronously — they must:
1. Be logged with full context (job name, payload, attempt number)
2. Trigger a retry per the job's configured retry policy (exponential backoff, max attempts)
3. On final failure, mark the parent record's status appropriately (e.g., `payroll_runs.status` stays `pending_approval` rather than silently appearing `disbursed`) and notify the responsible role (HR/Super Admin) via the Notification module

Silent job failures that leave data in an ambiguous state (e.g., "was payroll disbursed or not?") are treated as high-severity bugs — payroll and attendance sync jobs must be idempotent (see `API_GUIDELINES.md` §9) so retries are always safe.

---

## 9. Testing Requirements

- Every custom `BusinessException` subclass should have at least one test asserting it's thrown under the correct condition (e.g., `GeofenceViolationException` when check-in coordinates are outside radius).
- Global exception filter should have a test suite covering: validation error shape, business exception shape, unknown error fallback shape, and confirming stack traces never leak into the response body.

---

## 10. Checklist for New Business Logic

- [ ] Known failure cases use a specific `BusinessException` subclass, not a generic `Error`
- [ ] Error code added to the module's `error-codes.ts` and exported to `packages/shared/constants`
- [ ] No sensitive fields possibly present in `details`
- [ ] Logging level matches §5's table
- [ ] If part of a background job, failure handling follows §8
