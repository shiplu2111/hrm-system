# ATTENDANCE_LOGIC.md

## 1. Capture Methods

Manual entry, mobile app (primary — offline-capable, see OFFLINE_SYNC.md), fingerprint/biometric device, face recognition, QR code, GPS, third-party device/API, bulk CSV/Excel import.

## 2. Attendance Statuses

`Present, Absent, Late, Early Leave, Half Day, Holiday, Weekend, Leave, Work From Home, Business Trip`

Status is computed, not manually chosen, wherever possible — derived from clock-in/out time vs. the employee's assigned shift (see NAVIGATION.md/MODULES.md §12 Roster).

## 3. Clock In / Out Flow

```
CLOCK IN → WORKING → BREAK START → BREAK END → (repeat) → CLOCK OUT
```

Each event stores: timestamp (device + server), GPS coordinates, device ID, source, and — critically for offline — a client-generated `local_id`.

## 4. Working Hours Calculation

```
Gross Hours = clock_out_at - clock_in_at
Net Hours   = Gross Hours - total_break_minutes
Overtime    = max(0, Net Hours - shift.standard_hours)   [subject to OT rules, see PAYROLL_LOGIC.md]
```

## 5. Late / Early Leave

- Late = clock_in_at > shift.start_time + shift.grace_minutes
- Early Leave = clock_out_at < shift.end_time - shift.grace_minutes
- Both are configurable per shift, per company (see DATABASE_SCHEMA.md `shifts`).

## 6. Geofencing

- Each location has `lat`, `lng`, `geofence_radius_m`.
- On clock-in/out, compare device GPS to the assigned location's geofence.
- Company-level policy decides: **Block** (attendance rejected outside geofence) or **Allow with warning** (recorded, flagged for review).
- Geofence validation for OFFLINE-captured events happens **at capture time on-device** (best-effort, using last known/cached geofence config) AND is **re-validated server-side at sync time** as the source of truth. If the two disagree, the server result wins and the record is flagged for manager review — never silently discarded.

## 7. Missed Punch & Regularization

- A record with clock-in but no clock-out past a configurable cutoff (e.g. end of day + N hours) is flagged `missed_punch`.
- Employee or manager can submit a regularization request with a reason; goes through the approval workflow (see ROLES_PERMISSIONS.md).
- Regularized records are audit-logged with original vs. corrected values.

## 8. Attendance Correction

- Employee-initiated correction request (wrong clock time, forgot to punch) requires manager/HR approval.
- Original captured record is never overwritten — a correction creates a linked adjustment record, preserving the original for audit purposes.

## 9. Interaction with Payroll

Attendance records feed directly into payroll processing (see PAYROLL_LOGIC.md). A payroll run for a period can only be calculated once all attendance records in that period are either finalized or explicitly marked as pending-exception (which blocks payroll finalization for affected employees only, not the whole run).

## 10. Offline Behavior

See OFFLINE_SYNC.md for the full sync contract. Summary specific to attendance:

- Clock in/out works fully offline; queued locally.
- Duplicate prevention: `(employee_id, local_id)` unique constraint server-side.
- If a device's clock is significantly skewed from server time at sync, the event is flagged `time_anomaly` for manual review rather than auto-accepted.
