# ATTENDANCE_LOGIC.md — Attendance & Geofencing Rules

Source of truth for attendance business logic. Per `RULES.md` §10, any code implementing check-in/out, geofence validation, or offline sync must match this document. Cross-references: `DATABASE_SCHEMA.md` §3, `ARCHITECTURE.md` §7, `API_GUIDELINES.md` §9, `SECURITY.md` §4.

⚠️ Placeholders marked 🔶 must be finalized before Phase 2 (`PHASES.md`) is considered complete.

**Note on jurisdiction (Bangladesh):** the `shifts` table's default configuration should reflect the **Bangladesh Labour Act 2006** standard of **8 hours/day, 48 hours/week** as the baseline shift definition, since this is also the threshold `PAYROLL_LOGIC.md` §3.3 uses to calculate overtime — keep the two in sync. Geofence and multi-site handling below remain company-configuration decisions, not jurisdiction-dependent ones.

---

## 1. Core Principle

**The backend is always the source of truth for attendance validity.** The mobile app captures and sends GPS coordinates, but never decides for itself whether a check-in is "valid" — that decision is made server-side against `office_locations`, because client-side validation is spoofable (mock GPS apps, rooted devices).

---

## 2. Check-In Flow

```
Mobile                              Backend
     │                                  │
     │ 1. Employee taps "Check In"      │
     │ 2. App requests current GPS      │
     │    location (expo-location)      │
     │                                  │
     │ POST /attendance/check-in        │
     │ { latitude, longitude,           │
     │   accuracy_meters,               │
     │   client_generated_id,           │
     │   captured_at }                  │
     ├─────────────────────────────────►│
     │                                  │ 1. Look up employee's assigned
     │                                  │    office_location (or nearest, if
     │                                  │    multi-site — see §3.3)
     │                                  │ 2. Calculate distance between
     │                                  │    submitted coords and office
     │                                  │    coords (Haversine formula)
     │                                  │ 3. within_geofence =
     │                                  │    distance <= geofence_radius_meters
     │                                  │ 4. Determine status (§4): on-time/late
     │                                  │ 5. Upsert attendance_records by
     │                                  │    client_generated_id (idempotent,
     │                                  │    API_GUIDELINES.md §9)
     │  { attendance_record,            │
     │    within_geofence,              │
     │    status }                      │
     │◄─────────────────────────────────┤
```

- If `within_geofence = false`, the check-in is **still recorded** (not rejected outright) but flagged — see §5 for what happens next. Silently rejecting could leave field employees with no record at all, which is worse for dispute resolution.
- `captured_at` (device timestamp) is stored for reference, but `check_in_at` on the server is set from **server time on receipt**, not trusted client time — prevents clock manipulation. The two are compared; a large mismatch (🔶 threshold, e.g., >5 min) can be flagged for review.

---

## 3. Geofence Validation

### 3.1 Formula (Haversine distance)
```
distance_meters = haversine(
  employee_submitted_lat, employee_submitted_lng,
  office_location.latitude, office_location.longitude
)

within_geofence = distance_meters <= office_location.geofence_radius_meters
```

### 3.2 GPS Accuracy Handling
- Mobile devices report `accuracy_meters` (how confident the OS is in the coordinate). If `accuracy_meters` is very poor (🔶 threshold, e.g., > 100m, common indoors/urban canyon), the check-in should still be accepted but marked with a `low_accuracy` flag rather than silently trusting a possibly-wrong location as a geofence pass or fail.
- Do not reject a check-in purely for poor accuracy — that punishes employees for device/environment limitations outside their control. Flag for HR visibility instead.

### 3.3 Multi-Site Employees
- Each employee has a primary `office_location_id` (`DATABASE_SCHEMA.md` §2).
- 🔶 Open decision: if an employee legitimately works across multiple sites, does geofence check against only their assigned site, or the nearest of any configured site? Default assumption for v1: single assigned site only; multi-site support deferred unless flagged as needed in `PRD.md`.

### 3.4 Field Employees (No Fixed Site)
- 🔶 Open decision: some employees (sales, field service) may have no meaningful office geofence. For v1, these employees can be configured with `office_location_id = null`, in which case geofence validation is skipped entirely and every check-in requires a `regularization`-style note, or is simply recorded without a `within_geofence` judgment. Confirm approach against `PRD.md` scope before Phase 2 sign-off.

---

## 4. Attendance Status Determination

Computed at check-in/out time server-side, using the employee's assigned `shifts` record.

```
Status Logic (on check-in):
  if check_in_at <= shift.start_time + shift.grace_minutes:
      status = 'present'
  else:
      status = 'late'

Status Logic (on check-out, if check_out_at < shift.end_time):
      status = 'early_leave'   # overrides 'present'/'late' if checkout is early

Status Logic (end-of-day batch job, see §7):
  if no check_in_at recorded for the day AND no approved leave covering the day:
      status = 'absent'
```

- `status = 'on_leave'` is set by the Leave module (`MODULES.md` §4) when an approved leave request covers that date — attendance job must check for this **before** marking `absent` (§7).
- `status = 'regularized'` is set only when an `attendance_regularization_requests` row is approved for that date (§6) — it overrides whatever the original computed status was.

---

## 5. Geofence Violation Handling

A check-in/out outside the geofence is **not automatically rejected**, but:

1. Recorded with `check_in_within_geofence = false` (or `check_out_within_geofence = false`)
2. Visible to the employee's manager/HR on the admin dashboard, distinctly flagged (e.g., a warning icon)
3. Does **not** by itself change the `status` field (still evaluated as present/late/etc. per §4) — geofence validity and time-based status are tracked as separate concerns, so a late arrival that's also outside geofence isn't double-penalized in one field
4. Employee may proactively submit an `attendance_regularization_requests` explaining the reason (§6), or HR may follow up directly

🔶 Open decision: should repeated/frequent geofence violations trigger an automated notification to HR (pattern detection), or is manual dashboard review sufficient for v1? Default: manual review only for v1, automated pattern flagging deferred.

---

## 6. Regularization Requests

For missing or disputed attendance records (forgot to check in, app crashed, genuine field-work exception).

```
POST /attendance-regularizations
{ attendance_record_id (nullable), requested_check_in_at, requested_check_out_at, reason }
```

- Employee submits with a reason; goes to `status = 'pending'`.
- Manager/HR reviews via admin — approve or reject.
- On approval:
  - If `attendance_record_id` is provided, update that record's times and set `status = 'regularized'`
  - If null (no original record existed — a fully missing day), create a new `attendance_records` row with `status = 'regularized'`
- On rejection, the original record (or absence) stands unchanged; employee is notified either way (`MODULES.md` §10).
- Regularization actions are logged in `audit_logs` per `SECURITY.md` §7.

---

## 7. Absence Detection (Batch Job)

Since "absent" can only be determined by the *absence* of a check-in, this cannot be set at request time — it requires an end-of-day scheduled job.

```
Daily job (runs shortly after each shift's end_time + grace period, per shift):
  For each active employee assigned to that shift:
    1. Check if an attendance_records row exists for today
       → if yes, skip (already has present/late/early_leave status)
    2. Check if an approved leave_requests row covers today
       → if yes, skip (leave module already/will mark as on_leave —
         see MODULES.md §4 dependency)
    3. Otherwise, create attendance_records with status = 'absent'
       (check_in_at = null)
```

- Runs via Bull scheduled job (`ARCHITECTURE.md` §3.4), not a synchronous request — must be idempotent (safe to re-run without creating duplicate absent records for the same employee/day).
- Timezone: evaluated per `PAYROLL_TIMEZONE`/office-local time, not server UTC directly (`ENV_SETUP.md`).

---

## 8. Offline Check-In & Sync

Field/low-connectivity employees may check in while offline.

### 8.1 Client-Side Queue
- Mobile app stores unsent check-in/out events locally (SQLite/WatermelonDB per `ARCHITECTURE.md` §7) with a **client-generated UUID** (`client_generated_id`) created at the moment of the action, not at sync time.
- Captured `latitude`, `longitude`, `accuracy_meters`, and device `captured_at` timestamp are stored locally exactly as they would be sent live.

### 8.2 Sync on Reconnect
```
POST /attendance/check-in  (or /check-out)
{ ..., client_generated_id, captured_at }
```
- Backend **upserts** on `client_generated_id` — if a record with this ID already exists (e.g., sync retried after a network blip mid-request), it is not duplicated (`API_GUIDELINES.md` §9).
- `is_offline_synced = true` is set on the resulting `attendance_records` row so admin/HR can distinguish live vs. synced-later entries if needed for dispute resolution.
- `captured_at` (original device time) is preserved and used for status determination (§4) instead of server receipt time, since the actual check-in happened earlier — but is compared against server time at sync for anomaly detection (§2's clock mismatch check applies at the `captured_at` vs. sync-received-at level here, not `captured_at` vs check-in receipt).

### 8.3 Sync Failure Handling
- Failed sync attempts are retried by the client with backoff; queue persists across app restarts until successfully synced.
- If a queued event is older than 🔶 (e.g., 7 days) and still unsynced, flag it locally for the employee to review/re-submit manually rather than silently syncing very stale data as current.

---

## 9. Reporting Data Points (feeds `MODULES.md` §11)

Attendance module must expose, per employee per period:
- Total present / late / early_leave / absent / on_leave / regularized days
- Total geofence-violation count (informational, not a status)
- Total hours worked (for overtime calc, `PAYROLL_LOGIC.md` §3.3)

---

## 10. Error Codes Reference (this module)

| Code | HTTP | Meaning |
|---|---|---|
| `ALREADY_CHECKED_IN` | 409 | Duplicate check-in attempt for a day that already has a check_in_at (non-offline, non-upsert case) |
| `NOT_CHECKED_IN` | 422 | Check-out attempted with no matching check-in for today |
| `OFFICE_LOCATION_NOT_CONFIGURED` | 422 | Employee has no assigned `office_location_id` and field-employee handling (§3.4) isn't applicable |
| `REGULARIZATION_ALREADY_REVIEWED` | 409 | Attempting to approve/reject a regularization request that's no longer `pending` |

(Registered in `common/constants/error-codes.ts` per `ERROR_HANDLING.md` §4. Note: geofence violation itself is **not** an error code — per §5, it's a flag, not a rejection.)

---

## 11. Testing Requirements (mandatory, per `RULES.md` §9)

- Unit tests for Haversine distance calculation against known coordinate pairs with expected distances.
- Unit tests for status determination (§4) covering on-time, late, early-leave, and grace-period boundary cases.
- Unit tests for the absence batch job (§7), including idempotency (running twice doesn't duplicate).
- Integration test for offline sync upsert behavior — same `client_generated_id` submitted twice results in one record.
- Test that geofence violations are recorded but never block the check-in/out request itself (§5).

---

## 12. Open Decisions (🔶 Summary — Must Resolve Before Phase 2 Sign-Off)

- [ ] GPS accuracy threshold for `low_accuracy` flagging (§3.2)
- [ ] Multi-site employee geofence handling — assigned site only vs. nearest of any site (§3.3)
- [ ] Field employee (no fixed site) handling approach (§3.4)
- [ ] Whether repeated geofence violations trigger automated HR notification vs. manual review only (§5)
- [ ] Clock-mismatch threshold between device `captured_at` and server time for anomaly flagging (§2)
- [ ] Stale offline-queue age threshold before flagging for manual review (§8.3)
