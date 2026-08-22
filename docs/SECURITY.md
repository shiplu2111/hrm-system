# SECURITY.md — Security Policy

This document defines the security requirements for the HRM system. It applies to `backend`, `admin`, and `mobile`. Every module dealing with authentication, location, or payroll data must comply with this document — no exceptions without explicit sign-off.

---

## 1. Data Classification

| Category | Examples | Sensitivity |
|---|---|---|
| Critical | Password hash, PIN hash, biometric public keys, JWT secrets, bank account details | Highest — encrypted at rest, never logged |
| Sensitive | Salary/payroll data, national ID, tax info, GPS location history | High — access-controlled, encrypted at rest |
| Internal | Employee profile, attendance records, leave data | Medium — role-based access |
| Public | Company holiday calendar, job postings | Low |

---

## 2. Authentication Security

### 2.1 Password
- Hashed with **bcrypt** (cost factor ≥ 12), never stored or logged in plaintext.
- Minimum policy: 8+ characters, at least one number — enforce on registration.
- Password reset via time-limited, single-use token sent to verified email (never send the password itself).

### 2.2 PIN
- 4–6 digit, hashed with bcrypt, stored in a separate column from password hash.
- Rate-limited: lock the account/PIN login for a cooldown period after 5 consecutive failed attempts.
- PIN is a **secondary** factor for convenience — never the only credential accepted for high-risk actions (e.g., changing bank account for payroll disbursement should still require password re-auth).

### 2.3 Biometric
- **Raw biometric data never leaves the device** and never reaches the backend, under any circumstance.
- Device-generated key pair: private key stays in Android Keystore / iOS Secure Enclave; only the public key is sent to backend during enrollment.
- Login: backend issues a random challenge → device signs it locally (after OS-level biometric verification) → backend verifies signature with stored public key.
- If a device is lost/replaced, biometric login for that device must be revocable from the admin side (employee or HR can deregister a device's public key).

### 2.4 Session & Tokens
- JWT access token: short-lived (~15 minutes).
- Refresh token: longer-lived, stored securely (`httpOnly` + `Secure` cookie on admin web; `expo-secure-store` on mobile) — never in `localStorage` or `AsyncStorage`.
- Refresh token rotation: issue a new refresh token on each use, invalidate the old one (detect reuse as a possible compromise signal).
- Logout must invalidate the refresh token server-side (maintain a revocation list or short-lived token store in Redis).
- All tokens invalidated on password change.

---

## 3. Authorization

- Every backend endpoint enforces permission-based access control server-side via `@RequirePermission()` guards checking the dynamic `role_permissions` table (`DATABASE_SCHEMA.md` §1, `ROLES_PERMISSIONS.md` §13.1) — **frontend permission checks are UX only, never the security boundary.**
- Principle of least privilege: each role (the seeded Super Admin/HR/Manager/Employee, or any custom role created via the admin panel) gets only the permissions required for its function — defined explicitly per permission key, not inferred from a role name. New custom roles start with **zero** permissions by default (`ROLES_PERMISSIONS.md` §13.4) — nothing is implicitly granted.
- Only `super_admin` (specifically, only users with the `roles.manage` / `system.settings.manage` permission keys) can create or edit roles and their permission sets — this is itself a permission-gated action, not a hardcoded role check, but in practice only the seeded `super_admin` role is granted it by default.
- Employees can only access their own attendance/leave/payroll data unless elevated role grants broader access.
- Managers can only access data for employees in their reporting chain — enforce this at the query level, not just UI filtering.
- **Admin-configurable secrets** (SMTP, SMS, storage keys) are now stored in `system_settings`, encrypted with `MASTER_ENCRYPTION_KEY` — see `SYSTEM_SETTINGS.md` for the full encryption/access model, which follows the same principles as this section (server-side enforcement, masked values in API responses, audit-logged changes).

---

## 4. Location Data

- GPS coordinates are collected **only** for attendance check-in/out purposes — not for continuous tracking unless explicitly required and disclosed (see `PRD.md` open question).
- Location data tied to attendance is retained per the data retention policy (Section 8); it is not used for any purpose beyond attendance verification without separate consent.
- Employees must see a clear permission-purpose explanation before the OS location prompt appears (also required for app store approval).
- Location history access restricted to HR/Admin roles — managers see attendance status/validity, not raw coordinate history, unless required.

---

## 5. Payroll & Financial Data Security

- Salary, bank account, and tax details classified as **Critical/Sensitive** — encrypted at rest (column-level encryption for bank account numbers).
- Payroll data access restricted to HR/Super Admin roles only; Managers do not see salary figures unless explicitly granted.
- Any change to an employee's bank account/payment details requires re-authentication (password) and triggers a notification to the employee (fraud detection).
- Payroll approval requires a second role (maker-checker principle) — the person who prepares payroll should not be the sole approver for disbursement.
- Audit log required for all payroll data changes: who changed what, when (see Section 7).

---

## 6. Transport & Infrastructure Security

- All traffic over **HTTPS/TLS only** — no plaintext HTTP, including internal service calls where feasible.
- Database connections use TLS where the hosting provider supports it.
- **Bootstrap secrets only** (DB credentials, `MASTER_ENCRYPTION_KEY`, JWT signing keys) stored in environment variables or a secrets manager — **never committed to git**. Third-party API keys (SMTP, SMS, storage) are now admin-configurable and stored encrypted in the database instead — see `SYSTEM_SETTINGS.md` for the full tiering rationale; this reduces, but doesn't eliminate, the `.env`/secrets-manager surface, since the encryption key protecting those DB-stored secrets must itself still follow this bullet's rule.
- `.env` files in `.gitignore` across all apps; only `.env.example` (no real values) committed.
- CORS configured explicitly — admin/mobile origins whitelisted, not wildcard (`*`) in production.
- Rate limiting on all public-facing endpoints, stricter limits on auth endpoints.
- Input validation on every endpoint via DTOs (prevents injection, malformed data) — see `RULES.md`.
- Parameterized queries / ORM usage only — no raw string-concatenated SQL.

---

## 7. Audit Logging

Mandatory audit trail (who, what, when, from where) for:
- Login attempts (success and failure)
- Payroll data changes (salary structure, bank details, payroll run/approval)
- Employee status changes (activation, suspension, exit)
- Role/permission changes (including custom role creation and permission edits, per `ROLES_PERMISSIONS.md` §13.4)
- System settings changes (`system_settings` table writes — Tier 1 secrets masked in the log entry, Tier 2 business config logged with old/new values, per `SYSTEM_SETTINGS.md` §7)
- Attendance regularization/manual overrides
- Biometric device enrollment/revocation

Audit logs are append-only, retained per Section 8, and accessible only to Super Admin.

---

## 8. Data Retention & Deletion

- Attendance, payroll, and audit log records retained per applicable local labor law requirements (to be finalized — see `PRD.md` open questions).
- On employee offboarding: personal data handled per data protection requirements — anonymize/archive rather than hard-delete where records must be retained for compliance (payroll history, tax records).
- Soft-delete (`deleted_at`) used for employee/payroll/attendance tables per `RULES.md` — no hard deletes on records with audit/compliance relevance.
- Biometric public keys and PIN hashes are hard-deleted immediately upon device deregistration or account deactivation (no compliance reason to retain these).

---

## 9. Mobile-Specific Security

- Secure local storage only (`expo-secure-store`) for tokens/keys — never `AsyncStorage` for anything sensitive.
- Certificate pinning recommended for production builds (prevents MITM on public wifi).
- App must not cache sensitive data (payslips, personal info) in a way accessible to other apps on the device.
- Screenshot/screen-recording prevention recommended on sensitive screens (payslip, bank details) where platform supports it.

---

## 10. Third-Party Dependencies

- Dependency vulnerability scanning in CI (e.g., `npm audit`, Dependabot/Snyk) before merge.
- Pin dependency versions; review changelogs before major version upgrades, especially for auth/crypto-related packages.

---

## 11. Incident Response (baseline)

- Any suspected credential compromise: force logout (revoke refresh tokens) for the affected account immediately.
- Suspected data breach: document scope, affected data classification (Section 1), and follow applicable breach notification law timelines.
- Security-relevant bugs found during development must be tracked and fixed before the affected module ships — do not defer auth/payroll security fixes to "later phases."

---

## 12. Security Checklist for New Features (PR-level)

- [ ] No secrets/credentials hardcoded or logged
- [ ] New endpoints have role-based guards
- [ ] Sensitive fields (salary, bank info, PIN, biometric keys) encrypted/hashed appropriately
- [ ] Input validated via DTO
- [ ] Audit log added if the feature touches Section 7's list
- [ ] No raw biometric or full location history exposed to unauthorized roles
- [ ] Rate limiting applied if the endpoint is auth-related or public-facing

---

## 13. Open Security Decisions

- [ ] Which data protection law applies (e.g., local labor law + any applicable data privacy regulation) — determines exact retention periods and deletion rules
- [ ] Column-level encryption method for bank account details — confirm with `DATABASE_SCHEMA.md` once finalized
- [ ] Whether certificate pinning and screenshot prevention are implemented in mobile v1 or deferred
