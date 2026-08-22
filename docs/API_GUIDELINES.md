# API_GUIDELINES.md — REST API Conventions

Applies to all endpoints in `apps/backend`. Consistency here is what lets `admin` and `mobile` share the same API client patterns and `packages/shared/types`.

---

## 1. Base URL & Versioning

```
https://api.hrm-system.com/api/v1/
```

- All routes prefixed with `/api/v1`.
- Breaking changes → bump to `/api/v2`, keep `/v1` running until all clients migrate. Never break `v1` in place.

---

## 2. Resource Naming

- Plural nouns, kebab-case for multi-word resources: `/employees`, `/attendance-records`, `/leave-requests`, `/payroll-runs`
- No verbs in URLs — action is expressed via HTTP method:
  - ✅ `POST /leave-requests/:id/approve`
  - ❌ `POST /approveLeaveRequest`
- Nested resources only one level deep: `/employees/:id/documents` — avoid `/employees/:id/attendance/:id/regularizations`; use flat top-level resources with query filters instead: `/attendance-regularizations?employee_id=`

---

## 3. HTTP Methods

| Method | Use |
|---|---|
| `GET` | Read (list or single resource) — never mutates state |
| `POST` | Create a resource, or trigger a non-idempotent action (e.g., `/payroll-runs/:id/approve`) |
| `PATCH` | Partial update |
| `PUT` | Full replace (rarely used — prefer `PATCH`) |
| `DELETE` | Soft-delete (sets `deleted_at`) — never a hard delete on compliance-relevant tables, per `RULES.md` |

---

## 4. Request Format

- `Content-Type: application/json` for all request bodies.
- All input validated via DTOs (`class-validator`) — see `RULES.md` §3.
- Auth: `Authorization: Bearer <access_token>` header on all protected routes.

---

## 5. Response Envelope

### 5.1 Success — Single Resource
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "...": "..."
  }
}
```

### 5.2 Success — List (Paginated)
```json
{
  "success": true,
  "data": [ { "...": "..." } ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "total_pages": 8
  }
}
```

### 5.3 Success — Action with No Content
```json
{
  "success": true,
  "data": null
}
```
(Status code `200` or `204` depending on whether a confirmation body is useful to the client — prefer `200` with `data: null` for consistency across clients.)

---

## 6. Error Format

All errors follow one shape, regardless of source (validation, auth, business logic, server error):

```json
{
  "success": false,
  "error": {
    "code": "LEAVE_BALANCE_INSUFFICIENT",
    "message": "Employee does not have enough leave balance for this request.",
    "details": null
  }
}
```

- `code`: machine-readable, SCREAMING_SNAKE_CASE, stable across releases — clients (admin/mobile) may branch on this, never on `message`.
- `message`: human-readable, safe to show in UI.
- `details`: optional object — e.g., field-level validation errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "email": "must be a valid email address",
      "basic_salary": "must be a positive number"
    }
  }
}
```

### 6.1 Standard Error Codes

| HTTP Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation failure |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired access token |
| 401 | `INVALID_CREDENTIALS` | Wrong password/PIN/biometric signature |
| 401 | `ACCOUNT_LOCKED` | Too many failed PIN attempts, per `SECURITY.md` |
| 403 | `FORBIDDEN` | Valid token, but role/permission insufficient |
| 404 | `NOT_FOUND` | Resource doesn't exist or is soft-deleted |
| 409 | `CONFLICT` | Duplicate resource (e.g., email already registered), state conflict (e.g., approving an already-approved payroll run) |
| 422 | `BUSINESS_RULE_VIOLATION` | Passes validation but violates a domain rule (e.g., insufficient leave balance, geofence violation) |
| 429 | `RATE_LIMITED` | Too many requests, per `SECURITY.md` §6 |
| 500 | `INTERNAL_ERROR` | Unhandled server error — never leak stack traces in response body |

Module-specific codes extend this list (e.g., `GEOFENCE_VIOLATION`, `PAYROLL_ALREADY_APPROVED`, `MAKER_CHECKER_VIOLATION`) — document new codes in the relevant module's detail doc (`PAYROLL_LOGIC.md`, `ATTENDANCE_LOGIC.md`) as they're introduced, and keep them SCREAMING_SNAKE_CASE.

---

## 7. Pagination

Required on all list endpoints.

**Request query params:**
```
GET /employees?page=1&limit=20
```

- `page`: default `1`
- `limit`: default `20`, max `100` (reject/cap higher values, don't silently ignore)

**Response:** see §5.2 `meta` block.

---

## 8. Filtering & Sorting

Consistent query param pattern across all list endpoints:

```
GET /attendance-records?employee_id=<uuid>&status=late&from=2026-08-01&to=2026-08-31
GET /employees?sort=-created_at
```

- Filters: plain query params matching field names.
- Sorting: `sort=<field>` ascending, `sort=-<field>` descending. Support one sort field per request unless a specific endpoint documents multi-field sort.
- Date ranges: `from` / `to` query params, ISO 8601 date format (`YYYY-MM-DD`).

---

## 9. Idempotency

- Actions that could be retried on network failure (e.g., mobile offline check-in sync) must be idempotent server-side. Client sends a `client_generated_id` (UUID generated on-device) for offline-created records; backend upserts on that key rather than creating duplicates.
- See `ATTENDANCE_LOGIC.md` for the offline sync contract specifically.

---

## 10. Authentication Endpoints (reference — full flow in `AUTH_FLOW.md`)

```
POST /auth/register
POST /auth/login/password
POST /auth/login/pin
POST /auth/login/biometric/challenge   # request a challenge
POST /auth/login/biometric/verify      # submit signed challenge
POST /auth/refresh
POST /auth/logout
POST /auth/setup-pin
POST /auth/setup-biometric
DELETE /auth/biometric-devices/:id      # revoke a device
```

---

## 11. Rate Limiting Headers

All responses include standard rate-limit headers so clients can back off gracefully:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1755781200
```

---

## 12. File Uploads

- Multipart uploads go to dedicated endpoints (e.g., `POST /employees/:id/documents`), not embedded as base64 in JSON bodies for anything beyond small images.
- Response returns the stored file's URL/metadata, not the raw file.
- Max file size and allowed MIME types enforced server-side, not just client-side.

---

## 13. Real-Time Events (WebSocket)

For live attendance/notification updates (see `ARCHITECTURE.md` §3.5):

```
Event: attendance.checked_in
Payload: { employee_id, attendance_record_id, timestamp, status }

Event: leave_request.status_changed
Payload: { leave_request_id, employee_id, status }

Event: payroll_run.status_changed
Payload: { payroll_run_id, status }
```

Event names: `<resource>.<past_tense_action>`, snake_case.

---

## 14. Versioned Breaking Change Policy

A change is breaking (requires `v2`) if it:
- Removes or renames a response field
- Changes a field's type or meaning
- Changes required request fields
- Changes error `code` values clients may already branch on

Non-breaking (safe within `v1`):
- Adding new optional response fields
- Adding new optional request fields
- Adding new endpoints
- Adding new error codes for new scenarios

---

## 15. Documentation

- Swagger/OpenAPI generated from NestJS decorators (`@nestjs/swagger`) — every DTO must have `@ApiProperty()` annotations so the generated docs stay accurate without separate manual maintenance.
- Available at `/api/v1/docs` in non-production environments (disabled or auth-gated in production).

---

## 16. Checklist for New Endpoints

- [ ] Follows resource naming convention (§2)
- [ ] Correct HTTP method for the action (§3)
- [ ] Request validated via DTO
- [ ] Response follows envelope format (§5)
- [ ] Errors use standard codes where applicable, new codes documented if introduced (§6)
- [ ] Pagination implemented if it's a list endpoint (§7)
- [ ] `@Roles()` guard applied per `SECURITY.md` §3
- [ ] Swagger annotations added (§15)
