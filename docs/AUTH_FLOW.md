# AUTH_FLOW.md — Authentication Flow

Full technical flow for registration and the three login methods (Password / PIN / Biometric), plus session management. Cross-references: `DATABASE_SCHEMA.md` §1, `SECURITY.md` §2, `API_GUIDELINES.md` §10, `ERROR_HANDLING.md`.

---

## 1. Core Rule

**Registration is password-only.** PIN and Biometric are opt-in, set up later from Settings, and only work if the user already has a verified account. A user can never register directly with PIN or biometric.

---

## 2. Registration Flow

```
Mobile/Admin              Backend
     │                        │
     │  POST /auth/register   │
     │  { email, password,    │
     │    employee_id }       │
     ├───────────────────────►│
     │                        │  1. Validate email uniqueness
     │                        │  2. Validate password policy (SECURITY.md §2.1)
     │                        │  3. bcrypt hash password
     │                        │  4. Create `users` row (pin_hash = null,
     │                        │     is_pin_enabled = false,
     │                        │     is_biometric_enabled = false)
     │                        │  5. Link to `employees` row if employee_id given
     │                        │
     │  { access_token,       │
     │    refresh_token,      │
     │    user }               │
     │◄───────────────────────┤
```

- If registration is HR-initiated (HR creates the employee in admin, employee gets an invite), the flow is the same but the initial password may be a system-generated temporary password sent via email, with `must_change_password` forcing a reset on first login.
- Errors: `409 CONFLICT` (`EMAIL_ALREADY_REGISTERED`) if email exists; `400 VALIDATION_ERROR` for weak password.

---

## 3. Login — Password (default, always available)

```
Mobile/Admin              Backend
     │                        │
     │ POST /auth/login/password
     │ { email, password }    │
     ├───────────────────────►│
     │                        │  1. Look up user by email
     │                        │  2. bcrypt.compare(password, password_hash)
     │                        │  3. If mismatch → increment failed count,
     │                        │     return 401 INVALID_CREDENTIALS
     │                        │  4. If match → issue tokens, reset failed count,
     │                        │     update last_login_at
     │  { access_token,       │
     │    refresh_token }     │
     │◄───────────────────────┤
```

- No separate lockout on password attempts beyond standard rate limiting (`API_GUIDELINES.md` §11) — PIN has stricter lockout since it's a shorter/weaker secret (see §5).

---

## 4. PIN Setup (post-registration, logged-in only)

```
Mobile                     Backend
     │                        │
     │  (already authenticated with valid access_token)
     │                        │
     │ POST /auth/setup-pin   │
     │ { pin, current_password }  ◄── re-auth with password required
     ├───────────────────────►│
     │                        │  1. Verify current_password (re-auth check)
     │                        │  2. Validate PIN format (4-6 digits)
     │                        │  3. bcrypt hash PIN → pin_hash
     │                        │  4. Set is_pin_enabled = true
     │  { success: true }     │
     │◄───────────────────────┤
```

- Requiring `current_password` here prevents someone with a stolen unlocked session from silently adding a weaker PIN credential.

---

## 5. Login — PIN

```
Mobile                     Backend
     │                        │
     │ POST /auth/login/pin   │
     │ { employee_id or email, pin } │
     ├───────────────────────►│
     │                        │  1. Look up user; check is_pin_enabled
     │                        │  2. Check pin_locked_until — reject if still locked
     │                        │     (401 ACCOUNT_LOCKED)
     │                        │  3. bcrypt.compare(pin, pin_hash)
     │                        │  4. If mismatch:
     │                        │       - failed_pin_attempts += 1
     │                        │       - if failed_pin_attempts >= PIN_MAX_FAILED_ATTEMPTS:
     │                        │           set pin_locked_until = now + PIN_LOCKOUT_MINUTES
     │                        │       - return 401 INVALID_CREDENTIALS
     │                        │  5. If match:
     │                        │       - reset failed_pin_attempts = 0
     │                        │       - issue tokens
     │  { access_token,       │
     │    refresh_token }     │
     │◄───────────────────────┤
```

- Config values (`PIN_MAX_FAILED_ATTEMPTS`, `PIN_LOCKOUT_MINUTES`) per `ENV_SETUP.md`.
- PIN login must **not** be accepted for re-authentication on high-risk actions (e.g., changing bank account details) — those require password re-entry per `SECURITY.md` §5.

---

## 6. Biometric Setup (post-registration, logged-in only)

Biometric auth uses **asymmetric key pair signing** — the private key never leaves the device.

```
Mobile                              Backend
     │                                  │
     │ (already authenticated)          │
     │                                  │
     │ 1. Device prompts OS biometric   │
     │    (Face ID / Touch ID /         │
     │    Android Fingerprint)          │
     │ 2. On success, device generates  │
     │    a key pair in secure hardware │
     │    (Keystore / Secure Enclave)   │
     │                                  │
     │ POST /auth/setup-biometric       │
     │ { public_key, device_id,         │
     │   device_name, current_password }│
     ├─────────────────────────────────►│
     │                                  │ 1. Verify current_password (re-auth)
     │                                  │ 2. Create `biometric_devices` row
     │                                  │    (is_active = true)
     │                                  │ 3. Set is_biometric_enabled = true
     │                                  │    on `users`
     │  { success: true,                │
     │    biometric_device_id }         │
     │◄─────────────────────────────────┤
```

- A user may enroll **multiple devices**. Each gets its own `biometric_devices` row.
- Private key storage: `expo-secure-store`, backed by Android Keystore / iOS Secure Enclave — per `ARCHITECTURE.md` §7, `SECURITY.md` §2.3.

---

## 7. Login — Biometric (challenge-response, two-step)

Biometric login is **always two API calls** — never a single call with a "biometric token," because the server must issue a fresh, unpredictable challenge each time to prevent replay attacks.

### Step 1 — Request Challenge

```
Mobile                              Backend
     │                                  │
     │ POST /auth/login/biometric/challenge
     │ { device_id }                    │
     ├─────────────────────────────────►│
     │                                  │ 1. Look up biometric_devices by device_id
     │                                  │    (must be is_active = true)
     │                                  │ 2. Generate random challenge string
     │                                  │ 3. Store challenge in Redis with TTL
     │                                  │    = BIOMETRIC_CHALLENGE_EXPIRY_SECONDS
     │  { challenge }                   │
     │◄─────────────────────────────────┤
```

### Step 2 — Verify Signed Challenge

```
Mobile                              Backend
     │                                  │
     │ 1. Device prompts OS biometric   │
     │ 2. On success, signs challenge   │
     │    with device's private key     │
     │                                  │
     │ POST /auth/login/biometric/verify│
     │ { device_id, signed_challenge }  │
     ├─────────────────────────────────►│
     │                                  │ 1. Fetch challenge from Redis by device_id
     │                                  │    - if expired/missing → 401
     │                                  │      (CHALLENGE_EXPIRED)
     │                                  │ 2. Fetch public_key from biometric_devices
     │                                  │ 3. Verify signature using public_key
     │                                  │ 4. If valid:
     │                                  │      - delete challenge from Redis
     │                                  │        (single use)
     │                                  │      - issue tokens
     │                                  │ 5. If invalid → 401 INVALID_CREDENTIALS
     │  { access_token,                 │
     │    refresh_token }               │
     │◄─────────────────────────────────┤
```

- Challenge is single-use and short-lived (`BIOMETRIC_CHALLENGE_EXPIRY_SECONDS`, default 60s per `ENV_SETUP.md`).
- Raw fingerprint/face data is verified entirely by the OS on-device — it is never transmitted, stored, or seen by the backend, at any point in this flow.

---

## 8. Device Revocation

```
DELETE /auth/biometric-devices/:id
```

- Employee can revoke their own device from Settings (e.g., lost phone).
- HR/Super Admin can revoke any employee's device from admin (emergency case).
- Sets `is_active = false`, `revoked_at = now()` — row is not hard-deleted (audit trail), but `is_active = false` devices are rejected at the Challenge step (§7 Step 1).
- Action is logged in `audit_logs` per `SECURITY.md` §7.

---

## 9. Token Refresh

```
Mobile/Admin              Backend
     │                        │
     │ POST /auth/refresh     │
     │ { refresh_token }      │
     ├───────────────────────►│
     │                        │  1. Verify refresh_token signature + expiry
     │                        │  2. Check token_hash exists in `refresh_tokens`
     │                        │     and is_revoked = false
     │                        │  3. If reused/revoked token detected →
     │                        │     treat as possible compromise:
     │                        │     revoke ALL refresh tokens for this user,
     │                        │     force full re-login (SECURITY.md §2.4)
     │                        │  4. If valid:
     │                        │       - revoke old refresh token
     │                        │       - issue new access_token + refresh_token
     │                        │         (rotation)
     │  { access_token,       │
     │    refresh_token }     │
     │◄───────────────────────┤
```

---

## 10. Logout

```
POST /auth/logout
{ refresh_token }
```

- Marks the given `refresh_tokens` row `is_revoked = true`.
- Client discards both tokens locally (secure storage cleared on mobile; cookies cleared on admin).
- Does **not** revoke other active sessions/devices — logout is per-session unless the user explicitly chooses "log out of all devices" (optional future feature — would revoke all `refresh_tokens` rows for the user).

---

## 11. Client-Side Auth State (summary, per app)

### Mobile (React Native / Expo)
- Tokens stored via `expo-secure-store`.
- Biometric private key stored in Keystore/Secure Enclave, accessed only via `expo-local-authentication` — never exported/read directly by app code.
- On app launch: check for stored access/refresh token → attempt silent refresh → route to login screen if refresh fails.
- Login screen offers Password, PIN, and Biometric (if set up) — all three flows (§3, §5, §7) are available on mobile.

### Web (React — `apps/admin`, serves both admin roles and employee self-service, per `ARCHITECTURE.md` §6)
- Access token in memory (Zustand store); refresh token in `httpOnly` + `Secure` cookie, per `SECURITY.md` §2.4.
- On app load: attempt `/auth/refresh` using the cookie to establish a session silently.
- **Login screen offers Password only** — PIN and Biometric login (§5, §7) are mobile-only and are not offered on the web login screen, regardless of the logged-in user's role. This is a deliberate scope decision, not a gap: PIN/biometric exist to speed up *repeated* unlocks on a personal device the employee already trusts and controls (`SECURITY.md` §2.3); a shared/work PC doesn't have the same trust model, and browsers don't have a standardized equivalent to `expo-local-authentication`'s device-bound key flow without adding WebAuthn as a separate, larger scope item (🔶 could be considered post-v1 if there's demand, but is out of scope for the initial employee-web-login feature).
- An employee who has PIN/biometric set up on their phone still logs into the web app with their password — the two clients don't share a "logged in" state or a faster unlock path; each is a fully independent session per `SECURITY.md` §2.4's per-session token model.

---

## 12. Settings Screen — Auth Method Management

Employee-facing Settings (available on both mobile and web, per §11) should expose:
- **Change Password** (requires current password) — available on both clients
- **Set up / Change PIN** (requires current password, per §4) — **mobile only**, per §11
- **Enable / Disable Biometric** (enable requires current password, per §6; disable can be done with just a confirmation, setting `is_biometric_enabled = false` and deactivating that device's row) — **mobile only**, per §11
- **Manage Devices** — list of enrolled biometric devices with "Revoke" action per device (§8) — viewable/manageable from **either** client (an employee should be able to revoke a lost phone's biometric access from a work PC, even though biometric enrollment itself only happens on mobile)

At least one method (password) must always remain active — the system should prevent a state where a user has PIN/biometric only, since password is the recovery baseline (e.g., "Forgot PIN" flow requires re-auth with password, not another PIN).

---

## 13. Forgot Password / PIN Recovery

- **Forgot Password:** Standard email-based reset — time-limited, single-use token sent to verified email (`SECURITY.md` §2.1). On successful reset, all existing refresh tokens are revoked (force re-login everywhere) as a precaution.
- **Forgot PIN:** No separate "forgot PIN" email flow — user must log in with password, then go to Settings and re-run PIN setup (§4). This avoids adding a second recovery surface for a weaker credential.
- **Lost biometric device:** User logs in via password (or PIN) on a new/other device, then revokes the old device (§8) and re-enrolls biometric on the current device if desired.

---

## 14. Error Codes Reference (this module)

| Code | HTTP | Meaning |
|---|---|---|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registration with existing email |
| `INVALID_CREDENTIALS` | 401 | Wrong password / PIN / biometric signature |
| `ACCOUNT_LOCKED` | 401 | PIN locked out after too many failed attempts |
| `CHALLENGE_EXPIRED` | 401 | Biometric challenge expired or already used |
| `DEVICE_NOT_ENROLLED` | 401 | `device_id` has no active biometric enrollment |
| `REAUTH_REQUIRED` | 401 | Sensitive action attempted without fresh password confirmation |
| `PIN_NOT_ENABLED` | 400 | PIN login attempted but user never set one up |
| `BIOMETRIC_NOT_ENABLED` | 400 | Biometric login attempted but user never set it up |

(Registered in `common/constants/error-codes.ts` per `ERROR_HANDLING.md` §4.)

---

## 15. Testing Requirements

- Integration tests for all three login methods, both success and failure paths.
- PIN lockout: test that the Nth failed attempt triggers lockout and the lockout window is respected.
- Biometric: test challenge expiry, single-use enforcement, and signature verification failure.
- Refresh token rotation: test that reusing a revoked/old refresh token triggers full session revocation.
- Test that PIN/biometric setup endpoints reject requests without valid `current_password`.
