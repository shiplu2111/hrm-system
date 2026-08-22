# MOBILE_PERMISSIONS.md — Mobile App Permissions

Applies to `apps/mobile` (React Native / Expo). Covers every OS-level permission the app requests, why, how it's requested, and fallback behavior when denied. Cross-references: `ARCHITECTURE.md` §7, `SECURITY.md` §9, `ATTENDANCE_LOGIC.md`, `AUTH_FLOW.md`.

---

## 1. Core Principle

**Always show a purpose explanation before triggering the OS permission prompt** (per `RULES.md` §6 and App Store/Play Store review guidelines). Never request a permission the app doesn't immediately use — request at the point of need (e.g., ask for location right when the employee taps "Check In," not on app launch).

---

## 2. Location Permission

### 2.1 Purpose
Required for GPS-based attendance check-in/out and geofence validation (`ATTENDANCE_LOGIC.md`).

### 2.2 Type Requested
- **Foreground location only** (`when in use`) for v1 — check-in/out is a deliberate, in-app action, not a background/continuous tracking feature.
- 🔶 **Background location** is a separate, higher-friction permission (and separate App Store/Play Store review scrutiny) — only requested if `PRD.md`'s open question on continuous field-employee tracking is resolved in favor of it. Do not request background location speculatively "in case it's needed later" — this alone can cause app store rejection and unnecessary employee distrust.

### 2.3 Flow
```
1. Employee taps "Check In"
2. If permission not yet determined:
     a. Show in-app explanation screen first:
        "HRM needs your location to verify you're checking in
         from an approved office location. This is only used
         at check-in/check-out — we don't track your location
         at other times."
     b. On "Continue" → trigger OS permission prompt
        (expo-location: Location.requestForegroundPermissionsAsync())
3. If granted → capture location → proceed with check-in
   (ATTENDANCE_LOGIC.md §2)
4. If denied → show fallback state (§2.4)
```

### 2.4 Denied / Restricted Handling
- Show a clear in-app state: "Location access is needed to check in. You can enable it in Settings." with a direct deep link to the OS app settings screen (`Linking.openSettings()`).
- Do **not** allow a check-in to proceed without location — an unverified check-in defeats the purpose of the feature. If an employee has a legitimate reason they can't grant location (device issue, privacy concern), that's an HR/regularization conversation (`ATTENDANCE_LOGIC.md` §6), not a silent app bypass.
- If location is granted but returns very low accuracy or fails to resolve (GPS signal issue indoors, etc.), show a retry option before falling back to a manual regularization request suggestion.

### 2.5 iOS-Specific
- `NSLocationWhenInUseUsageDescription` in `app.json`/`Info.plist` must match the in-app explanation copy in tone (Apple reviews this string, and a mismatch between the system prompt text and actual app behavior is a rejection risk).

### 2.6 Android-Specific
- `ACCESS_FINE_LOCATION` (not just `ACCESS_COARSE_LOCATION`) — geofence validation needs precise location, per `ATTENDANCE_LOGIC.md` §3.
- Android 10+ requires explicit handling of the "Allow only while using the app" vs "Allow all the time" distinction in the system dialog — the app's flow only ever needs the "while using" tier for v1 (§2.2).

---

## 3. Biometric Permission

### 3.1 Purpose
Enables fingerprint/Face ID login as an alternative to password/PIN, per `AUTH_FLOW.md` §6–7.

### 3.2 Type Requested
- Device-native biometric authentication via `expo-local-authentication` — this is technically an OS capability check + a per-use prompt, not a persistent "permission grant" in the same sense as location/notifications, but the same purpose-first principle applies.

### 3.3 Flow
```
1. Employee goes to Settings → "Enable Biometric Login"
2. Show in-app explanation:
   "Use your fingerprint or face to log in faster. Your
    biometric data never leaves your device or reaches
    our servers — only a secure device key is used to
    verify it's you." (per SECURITY.md §2.3)
3. Employee confirms current password (AUTH_FLOW.md §6 — re-auth required)
4. Trigger LocalAuthentication.authenticateAsync()
5. On success → generate key pair, enroll device (AUTH_FLOW.md §6)
6. On failure/cancel → remain on password/PIN login, no error state needed
   beyond "Biometric setup wasn't completed — you can try again anytime
   in Settings"
```

### 3.4 Device Capability Check
- Before showing the "Enable Biometric Login" option at all, check `LocalAuthentication.hasHardwareAsync()` and `LocalAuthentication.isEnrolledAsync()` — if the device has no biometric hardware, or has hardware but no fingerprint/face enrolled at the OS level, hide the option entirely (or show a disabled state with "Set up Face ID/Fingerprint in your device settings first") rather than presenting a toggle that will just fail.

### 3.5 Login-Time Behavior
- Each biometric login attempt re-triggers the OS prompt (`LocalAuthentication.authenticateAsync()`) — there is no "stay logged in via biometric" bypass; per `AUTH_FLOW.md` §7, every login is a fresh challenge-response.
- On repeated biometric failures at the OS level, fall back gracefully to the password/PIN login screen rather than getting stuck — the OS itself typically handles lockout after N failed attempts (device-level, separate from the app's own PIN lockout in `SECURITY.md` §2.2).

---

## 4. Notification Permission

### 4.1 Purpose
Push notifications for leave status changes, payroll processed, attendance anomalies, announcements (`MODULES.md` §10).

### 4.2 Flow
```
1. Requested at a natural point — e.g., after successful first login/
   onboarding, not immediately on cold app launch before the user has
   context for why it's being asked.
2. In-app explanation:
   "Get notified when your leave is approved, your payslip is ready,
    or there's something that needs your attention."
3. Trigger Notifications.requestPermissionsAsync()
```

### 4.3 Denied Handling
- App remains fully functional without notifications — this is the one permission that's genuinely optional. Show an unread indicator/in-app notification center as a fallback so employees who deny push still see updates when they open the app.
- No repeated re-prompting — if denied, don't ask again on every app launch; can offer a single re-prompt path from Settings if the employee changes their mind later.

---

## 5. Camera / Photo Library Permission (Documents)

### 5.1 Purpose
Uploading profile photo or documents (ID, certificates) if this is supported in mobile (vs. admin-only upload — confirm scope 🔶).

### 5.2 Flow
Standard purpose-first pattern, requested only when the employee taps "Upload Document" or "Change Profile Photo" — not requested elsewhere.

---

## 6. Permission Request Summary Table

| Permission | When Requested | Required or Optional | Fallback if Denied |
|---|---|---|---|
| Location (foreground) | At first check-in attempt | Required for check-in | Cannot check in; directed to Settings; regularization path available |
| Biometric | Employee-initiated in Settings | Optional | Password/PIN login remains available |
| Notifications | After first successful login | Optional | In-app notification center as fallback |
| Camera/Photo Library | At document/photo upload action | Optional (feature-specific) | That specific upload feature unavailable, rest of app unaffected |

---

## 7. Testing Requirements

Per `TESTING.md` §4.3:
- Mock each permission's granted/denied/restricted state and verify the app's fallback behavior matches §2.4, §3.4, §4.3.
- Manually verify on real iOS and Android devices before each release — permission dialogs and OS-level behavior can't be fully simulated in CI.
- Verify the iOS usage description strings (§2.5) are present and accurate before every App Store submission — missing/mismatched strings are an automatic rejection.

---

## 8. Open Items

- [ ] Confirm whether background location tracking is in scope (currently assumed out of scope for v1, per §2.2 and `PRD.md` open questions) — this is a significant scope decision affecting Expo managed vs. bare workflow (`ARCHITECTURE.md` §7)
- [ ] Confirm whether document/photo upload happens via mobile, admin-only, or both (§5.1)
- [ ] Finalize exact in-app explanation copy with product/HR input before implementation — drafts above are functional placeholders, not final user-facing copy
