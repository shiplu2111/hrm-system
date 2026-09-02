# SECURITY.md

## 1. Data Encryption

- Encryption in transit: TLS everywhere (API, web, mobile, admin panel).
- Encryption at rest: database-level encryption for the whole DB, plus field-level encryption for highly sensitive fields: bank account numbers, national ID/tax ID numbers, biometric templates (if stored at all — prefer device-side matching, never store raw biometric images server-side).

## 2. Sensitive Data Masking

- Bank account numbers, tax IDs: masked in UI by default (e.g. `****1234`), full value visible only to roles with explicit permission and only on demand (not in list views).
- Never include sensitive fields in list/export endpoints unless explicitly required and permissioned.

## 3. Password Policy

- Minimum length and complexity enforced at signup/reset.
- Bcrypt/Argon2 hashing, never reversible encryption for passwords.
- Account lockout after N failed attempts, with backoff.
- Forced password rotation only where required by a specific enterprise client's policy (not a blanket default — overly aggressive rotation reduces security in practice).

## 4. Session Management

- Refresh token rotation (see AUTH_FLOW.md).
- Session/device list visible to the user; user can revoke sessions individually.
- Idle session timeout, configurable per tenant.

## 5. API Rate Limiting

- Per-IP and per-tenant rate limits on auth endpoints (login, password reset) to prevent brute force.
- General API rate limiting to protect against abuse/runaway integrations.

## 6. Audit Logging

See AUDIT_LOG.md — all sensitive data access/change is logged, append-only.

## 7. Backup & Restore

- Automated scheduled backups (see SYSTEM_SETTINGS.md).
- Backups encrypted at rest.
- Restore procedure tested periodically, not just assumed to work.

## 8. Tenant Data Isolation

- Enforced at the application query layer (see RULES.md §1).
- Periodic automated tests that attempt cross-tenant data access and assert failure.

## 9. Data Retention & Deletion

- Configurable data retention policy per tenant/jurisdiction.
- Employee data deletion/anonymization ("right to be forgotten") supported: personal identifiers are scrubbed while financial/payroll records required for statutory retention periods are preserved in anonymized form.

## 10. Consent Management

- Track consent for data processing where required (e.g. biometric attendance opt-in, background location for geofencing).
- Consent withdrawal must degrade gracefully (e.g. disable biometric attendance for that employee, fall back to another method) rather than break the app.

## 11. Third-Party Integration Security

- API keys/secrets for integrations (banking, SMS, email, accounting) stored in a secrets manager, never in code or plain config files committed to the repo.
- Scoped, revocable API keys for outbound integrations — see THIRD_PARTY_INTEGRATIONS.md.
- Credentials entered by admins through the Admin Panel (SMTP passwords, per-tenant integration API keys — see SYSTEM_SETTINGS.md §2a, DATABASE_SCHEMA.md §11) are encrypted at rest using the same field-level encryption as other sensitive data (§1), never logged in plaintext (see RULES.md §7), and never echoed back in full by any settings-read API — the UI shows a masked value and offers "replace" or "test connection" rather than "view."

## 12. Vulnerability Handling

- Dependency scanning in CI.
- No production secrets in `.env.example` (see ENV_SETUP.md) — only placeholders.
