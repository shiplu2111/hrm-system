# ERROR_HANDLING.md

## 1. Standard Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "requestId": "uuid-for-support-correlation"
  }
}
```

Every error response uses this shape — no module invents its own format (see RULES.md §6).

## 2. Standard Error Codes

```
VALIDATION_ERROR        400
UNAUTHENTICATED          401
FORBIDDEN                403   -- authenticated but lacks permission (see ROLES_PERMISSIONS.md)
NOT_FOUND                404
CONFLICT                 409   -- e.g. duplicate, or payroll already finalized
RATE_LIMITED              429
INTERNAL_ERROR            500
```

Module-specific business errors use a namespaced code, e.g. `PAYROLL_ALREADY_FINALIZED`, `LEAVE_INSUFFICIENT_BALANCE`, `ATTENDANCE_TIME_ANOMALY` — always documented alongside the endpoint in the OpenAPI spec.

## 3. Payroll-Specific Error Handling

- Attempting to edit a finalized payroll run returns `409 PAYROLL_ALREADY_FINALIZED` — never silently allowed or silently ignored.
- Calculation errors (e.g. missing required rule for a country) must fail loudly and block payroll finalization for the affected employee, not silently skip the component.

## 4. Offline Sync Error Handling

- Sync endpoints return per-item status (see OFFLINE_SYNC.md §4) rather than failing the whole batch on one bad record.
- `time_anomaly`, `geofence_mismatch` etc. are not hard failures — they're accepted but flagged for review (see ATTENDANCE_LOGIC.md §10).

## 5. Client-Side Handling

- Web/mobile clients must distinguish network errors (retry-able, especially relevant offline) from validation/permission errors (not retry-able, must surface to user).
- Mobile app queues network-failure cases for retry (see OFFLINE_SYNC.md); it does not treat them as permanent failures.

## 6. Logging

- All 5xx errors logged with full stack trace + `requestId` server-side; never expose stack traces to the client.
- 4xx errors logged at a lower severity but still tracked for pattern analysis (e.g. repeated permission denials may indicate a UI bug or an attack).

## 7. User-Facing Messages

- Error messages shown to end users are human-readable and actionable ("Your leave balance is insufficient for this request" not "LEAVE_INSUFFICIENT_BALANCE"). The code is for programmatic/support use; the message is for the user.
