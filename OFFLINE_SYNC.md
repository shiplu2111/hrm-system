# OFFLINE_SYNC.md

This is a **critical** document — the employee mobile app must function fully without an internet connection (e.g. clocking in at a site with no signal) and sync correctly once connectivity returns, with **zero data loss and zero duplication**. Every design decision here has direct payroll/financial impact.

## 1. Local Storage

- Mobile app uses an embedded local database (SQLite via WatermelonDB or equivalent — final choice recorded here once decided).
- Locally-writable entities in MVP: **attendance clock in/out, breaks, leave requests, timesheet entries** (expand as ESS features roll out).
- Reference/lookup data (shifts, roster, leave types, company policy) is cached locally and refreshed opportunistically when online, so the app can render correctly offline.

## 2. Client-Generated IDs

- Every offline-created record gets a `local_id` (UUID) generated on-device at creation time.
- `local_id` is sent to the server on sync and stored alongside the server-generated `id`.
- Uniqueness constraint: `(employee_id, local_id)` is unique server-side — this is what makes sync **idempotent**. Replaying the same sync payload (e.g. due to a retried request) must never create a duplicate record.

## 3. Sync Queue

- All offline actions are appended to a local action queue in the order they occurred.
- On reconnect, the app processes the queue in order, sending batched sync requests.
- Each queue item has a status: `pending → syncing → synced` or `failed`.
- Failed items are retried with exponential backoff; the app must surface unsynced/failed items to the user rather than silently dropping them.

## 4. Server-Side Sync Endpoint Contract

```
POST /sync/attendance
Body: { deviceId, events: [{ local_id, employee_id, type, timestamp_device, gps, ... }, ...] }

Response: { results: [{ local_id, status: "created"|"duplicate"|"rejected", server_id?, reason? }, ...] }
```

- The server MUST be able to accept the same payload twice without side effects (idempotency).
- Partial failure is expected and must be handled gracefully: some events in a batch may succeed, others may fail validation (e.g. `time_anomaly`) — response reports per-event status, app retries only the failed ones.

## 5. Timestamp Trust Model

- Device timestamp (`timestamp_device`) is stored but **not trusted alone** for anything payroll-affecting.
- Server timestamp (`timestamp_server`, set at sync time) is also stored.
- If the gap between device time and server time (adjusted for known offline duration) exceeds a configurable threshold, the record is flagged `time_anomaly` and routed to manager review rather than auto-accepted into payroll calculation.

## 6. Geofence Validation Timing

- On-device: best-effort geofence check at capture time using cached location config (fast feedback to the employee).
- Server-side (authoritative): geofence is re-validated at sync time using the server's current location config. If device and server disagree, the **server result is authoritative**, and the discrepancy is flagged for review rather than silently overridden.

## 7. Conflict Resolution

- Attendance events are append-only (clock-in, clock-out, break-start, break-end are separate events) — there is generally nothing to "merge," which avoids most conflict scenarios.
- For entities that can be edited (e.g. a leave request draft edited on two devices before sync), **last-write-wins by server timestamp**, with the losing write preserved in the audit log rather than discarded.

## 8. Sync Triggers

- Automatic sync attempt on network reconnect (listen for connectivity change).
- Manual "sync now" option in the app.
- Background sync on app foreground/resume.

## 9. Failure & Partial Sync UX

- The app must clearly show: what's synced, what's pending, what failed and why.
- Payroll-affecting data (attendance) that fails to sync must never be silently discarded — it stays queued and visibly flagged until resolved.

## 10. Testing Requirements

- Simulate: airplane-mode clock in/out → reconnect → verify single record created.
- Simulate: sync request sent, connection drops before response received, app retries → verify no duplicate.
- Simulate: device clock manually set forward/backward → verify `time_anomaly` flagging.

See ATTENDANCE_LOGIC.md, MOBILE_PERMISSIONS.md, and DATABASE_SCHEMA.md §4 for related detail.
