# OFFLINE_SYNC.md — Mobile Offline Queue & Sync

Applies to `apps/mobile`. Details the client-side implementation of offline attendance check-in/out, extending the contract already defined in `ATTENDANCE_LOGIC.md` §8 and `API_GUIDELINES.md` §9. This document is the mobile-side implementation spec; those documents are the source of truth for the business rules.

---

## 1. Why This Exists

Field employees and anyone in low-connectivity areas must be able to check in/out without a live network connection. The check-in event is captured locally with full fidelity (location, timestamp) and reliably synced later — without ever creating duplicate records or losing data on app crash/restart.

---

## 2. Storage

- **Local DB:** WatermelonDB (or `expo-sqlite` directly — confirm final choice 🔶, WatermelonDB recommended for its built-in sync-friendly model if the queue logic grows beyond simple attendance events) per `ARCHITECTURE.md` §7.
- Queue persists across app restarts and OS-level app kills — never held only in memory.
- Queue is **per-device local storage**, not shared/synced between an employee's multiple devices before reaching the server.

---

## 3. Queued Event Shape

Each queued event mirrors exactly what would be sent live to `POST /attendance/check-in` or `/check-out` (`ATTENDANCE_LOGIC.md` §2, §8.1):

```typescript
interface QueuedAttendanceEvent {
  client_generated_id: string;   // UUID, generated at the moment of the action
  type: 'check_in' | 'check_out';
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at: string;           // ISO 8601, device local time at capture
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed';
  sync_attempts: number;
  last_sync_error?: string;      // for local debugging/support, not shown raw to user
  created_at: string;             // when queued locally
}
```

- `client_generated_id` is generated **at the moment the employee taps Check In/Out**, not at sync time — this is what makes the eventual sync idempotent (`API_GUIDELINES.md` §9). It must never be regenerated on retry.

---

## 4. Queueing Flow

```
1. Employee taps "Check In" (or "Check Out")
2. App captures location (per MOBILE_PERMISSIONS.md §2)
3. Attempt live network request immediately:
     a. If network available and request succeeds → done,
        no queue entry needed (fast path)
     b. If network unavailable, or request fails/times out →
        write a QueuedAttendanceEvent locally (sync_status: 'pending')
4. Show immediate UI confirmation either way — "Checked in" —
   the employee should not need to know or care whether it synced
   live or is queued; the local record is the source of truth for
   what they see until sync confirms server acceptance.
```

- The UI must clearly distinguish, when viewing attendance history, entries that are "Pending sync" vs. confirmed — a small, non-alarming indicator (not a red error state, since this is expected normal behavior in poor connectivity, not a failure).

---

## 5. Sync Trigger Conditions

Sync attempts are triggered by, in order of preference:
1. **Network state change:** app detects connectivity restored (`NetInfo` listener) → immediately attempt sync of all `pending`/`failed` queued events.
2. **App foreground:** every time the app returns to foreground, check for pending events and attempt sync.
3. **Periodic background check:** 🔶 if background sync is added later (requires background task permissions beyond `MOBILE_PERMISSIONS.md` v1 scope) — deferred unless flagged as needed.
4. **Manual pull-to-refresh** on the attendance history screen also triggers a sync attempt as a user-visible fallback.

---

## 6. Sync Process

```
For each queued event where sync_status IN ('pending', 'failed'):
  1. Set sync_status = 'syncing'
  2. POST /attendance/check-in (or /check-out)
     { latitude, longitude, accuracy_meters,
       client_generated_id, captured_at }
  3. On success (2xx):
       - Set sync_status = 'synced'
       - Store the returned server attendance_record.id locally
         for cross-reference
       - Remove from active queue view after a short grace period
         (keep for a few days for local debugging/support, then prune)
  4. On failure:
       - Network/timeout error → sync_status = 'pending' (retry later,
         not a hard failure)
       - Server validation error (4xx, e.g. OFFICE_LOCATION_NOT_CONFIGURED
         per ATTENDANCE_LOGIC.md §10) → sync_status = 'failed',
         store last_sync_error, surface to user (see §8)
       - Server error (5xx) → sync_status = 'pending' (retry with backoff)
  5. Increment sync_attempts regardless of outcome
```

- Sync processes events in the order they were queued (`created_at` ascending) — a check-out queued after a check-in must not sync before its corresponding check-in, since the backend needs the check-in to exist first (`ATTENDANCE_LOGIC.md` §2 flow).

---

## 7. Retry & Backoff

| Attempt | Delay Before Retry |
|---|---|
| 1st retry | Immediate (on next trigger condition, §5) |
| 2nd–4th retry | Exponential backoff: 30s, 2min, 10min |
| 5th+ retry | Capped at retrying once per app-foreground event, no aggressive polling |

- Never retry in a tight loop that could drain battery or spam the API — respect `API_GUIDELINES.md` §11 rate limit headers if a `429 RATE_LIMITED` response is ever received (back off further than the standard schedule).

---

## 8. Stale Queue Handling

Per `ATTENDANCE_LOGIC.md` §8.3: if a queued event remains unsynced past 🔶 (default assumption: 7 days) despite retries, do not continue silently retrying indefinitely.

```
1. Mark the event as sync_status = 'stale' (distinct from 'failed')
2. Surface a clear, non-alarming prompt in the app:
   "You have a check-in from [date] that couldn't be saved.
    Would you like to submit it as a regularization request instead?"
3. If employee confirms → pre-fill an attendance_regularization_requests
   submission (ATTENDANCE_LOGIC.md §6) with the queued event's captured
   data, then remove it from the sync queue
4. If employee dismisses → leave in queue, continue background retry
   at reduced frequency (once per day) rather than the standard backoff
```

---

## 9. Failed (Non-Retryable) Events

For a `4xx` business-rule rejection (not a network issue) — e.g., the employee's office location was deconfigured server-side between queueing and syncing:

- Do **not** silently drop the event — the employee still needs a record of the attempt.
- Show it in attendance history as "Couldn't be saved — [reason]" with a clear next step (contact HR, or submit regularization per §8's flow), using the error message translation pattern from `ERROR_HANDLING.md` §7.
- Never surface a raw error code or stack trace to the employee — translate via the shared error-handling client layer.

---

## 10. Conflict Scenarios

### 10.1 Duplicate Check-In (already checked in live, then offline queue also has one)
- Backend's upsert-by-`client_generated_id` (`API_GUIDELINES.md` §9) prevents a true duplicate *record*, but if the employee somehow triggers two separate check-in actions (different `client_generated_id`s) for the same day — one live, one queued from an earlier attempt — the backend's `ALREADY_CHECKED_IN` rule (`ATTENDANCE_LOGIC.md` §10) applies. The mobile app should mark the second as `sync_status = 'failed'` with that specific error, and the §9 flow surfaces it clearly rather than looking like a silent failure.

### 10.2 Check-Out Queued Before Check-In Syncs
- Handled by the ordering rule in §6 — the local queue processor must not attempt to sync a check-out event while its corresponding check-in event (same day, same employee) is still `pending`/`syncing`.

---

## 11. Local Data Retention

- Synced events: keep locally for a short grace period (🔶 default 7 days) for offline viewing/debugging, then prune to keep local DB size manageable — the server (`attendance_records`) remains the permanent record.
- Stale/failed events converted to a regularization request (§8) are removed from the sync queue once submitted, since the regularization flow now owns that record's fate.

---

## 12. Testing Requirements

Per `TESTING.md` §4.2:
- Unit test the queue processor's ordering logic (§6, §10.2) with simulated pending events.
- Unit test idempotent sync — simulate a sync request that "succeeds on the server but the response is lost" (client retries, server must not create a duplicate — verifies the `client_generated_id` upsert contract end-to-end with a mocked backend).
- Unit test backoff timing (§7) doesn't drift or retry more aggressively than specified.
- Integration test the full offline → reconnect → sync → confirmed flow using a simulated network toggle.
- Test the stale-event-to-regularization conversion flow (§8) end-to-end.

---

## 13. Open Items

- [ ] Confirm WatermelonDB vs. `expo-sqlite` direct usage (§2)
- [ ] Confirm stale threshold: 7 days is a placeholder default (§8, §11) — adjust based on realistic field-employee connectivity patterns once known
- [ ] Confirm whether background sync (beyond app-foreground/network-change triggers) is needed for v1 (§5.3) — affects Expo managed vs. bare workflow scope, same open item as `MOBILE_PERMISSIONS.md` §8
