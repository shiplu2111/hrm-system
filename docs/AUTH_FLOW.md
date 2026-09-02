# AUTH_FLOW.md

## 1. Authentication Method

JWT access token (short-lived, ~15 min) + refresh token (long-lived, stored securely — httpOnly cookie on web, secure keystore/keychain on mobile).

## 2. Login Flow

```
User submits credentials
   → Verify against tenant-scoped user record
   → Check tenant status (active, not suspended)
   → Issue access token (contains: user_id, tenant_id, role_id, permissions summary) + refresh token
   → 2FA challenge if enabled for the user/tenant
```

## 3. Token Refresh

- Access token expiry triggers silent refresh using the refresh token.
- Refresh token rotation: each refresh issues a new refresh token and invalidates the old one (prevents replay if a refresh token is stolen).
- Refresh token revocation list checked on each refresh (for logout-everywhere / security incidents).

## 4. Mobile Offline Session Handling

Because the mobile app must function offline (see OFFLINE_SYNC.md):

- A valid (non-expired) access token is cached and used to authenticate local actions conceptually (e.g. "who is clocking in") even with no network.
- Actual server authentication only happens at sync time — offline actions are tagged with the locally-known `employee_id`/`user_id` and validated server-side once synced.
- If the cached token has fully expired while offline, the app still allows clock in/out (attendance must not be blocked by auth expiry) but flags the session as needing re-login before next sync; the sync itself re-authenticates.

## 5. Multi-Tenant Login

- Login is tenant-aware: either via subdomain (`companyname.app.com`) or an explicit tenant selector if a user belongs to multiple tenants.
- `tenant_id` is embedded in the JWT and used for every subsequent scoping check (see RULES.md §1) — never re-derived from client input.

## 6. 2FA

- TOTP-based (authenticator app) for MVP; SMS-based as a fallback if required by a specific market.
- Enforced per-role where required (e.g. mandatory for Payroll Admin, Super Admin).

## 7. Biometric App Login (Mobile)

- Device biometric (fingerprint/Face ID) or PIN unlocks the **locally cached session** — this authenticates the person to the app, distinct from server-side authentication.
- Biometric app login is NOT the same as biometric attendance capture (face recognition for clock-in) — see ATTENDANCE_LOGIC.md and MODULES.md §33 for that distinction.

## 8. Password Policy

See SECURITY.md for password complexity, rotation, and lockout rules.

## 9. Logout

- Standard logout invalidates the current refresh token.
- "Logout everywhere" invalidates all refresh tokens for the user (used after a suspected compromise, or by an admin forcing logout).

## 10. Role & Permission Loading

On login, a permission snapshot is embedded in the token for fast checks; the authoritative permission set is always re-checked server-side on sensitive actions (never trust the token's permission claims alone for approve/finalize-type actions — see ROLES_PERMISSIONS.md).
