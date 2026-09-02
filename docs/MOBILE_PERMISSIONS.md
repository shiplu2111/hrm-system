# MOBILE_PERMISSIONS.md

## 1. Required Device Permissions

```
Location (foreground)     -- geofenced clock in/out (see ATTENDANCE_LOGIC.md §6)
Location (background)*    -- optional, only if the company enables continuous field-tracking for business trips; must be a clear, separate opt-in
Camera                    -- face recognition attendance, document photo capture, profile photo
Biometric (Face ID/Touch ID/fingerprint)  -- app authentication (see AUTH_FLOW.md §7)
Push Notifications        -- see NOTIFICATION_LOGIC.md
Storage/Photos            -- attach receipts (expense), documents
```
*Background location requires explicit, separately-worded consent and clear rationale shown to the employee — do not bundle it with the foreground location prompt.

## 2. Permission Request Timing

- Request each permission contextually (at the point of first use), not all at once on app launch — improves grant rates and matches App Store/Play Store review guidelines.
- Location permission requested when the employee first attempts to clock in, with an explanation of why it's needed (geofence validation).

## 3. Graceful Degradation

- If location permission is denied: the app must still allow clock-in per company policy — either blocked with a clear message (if company policy requires geofencing) or allowed with a flag (if company policy is "allow with warning" — see ATTENDANCE_LOGIC.md §6).
- If camera permission is denied: face-recognition attendance falls back to another configured method (PIN, manual) rather than locking the employee out of clocking in entirely.
- If notification permission is denied: in-app notifications still work; only push delivery is affected (see NOTIFICATION_LOGIC.md §7).

## 4. Consent Tracking

- Permission grant/denial state (and any related consent, e.g. biometric attendance opt-in) is tracked per SECURITY.md §10 (Consent Management) — this matters for compliance, not just app UX.

## 5. Platform-Specific Notes

- **iOS**: `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSFaceIDUsageDescription` strings must clearly state the HR/attendance purpose (App Store review will reject vague descriptions).
- **Android**: runtime permission requests (API 23+); background location requires the separate `ACCESS_BACKGROUND_LOCATION` permission and, on newer Android versions, an additional system-level confirmation step.

## 6. Offline Interaction

- Location captured for offline clock-in uses the last available GPS fix (or cached/last-known location if GPS lock isn't immediately available) — see OFFLINE_SYNC.md §6 for how this is validated at sync time.
