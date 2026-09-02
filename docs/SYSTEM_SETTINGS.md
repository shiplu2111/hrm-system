# SYSTEM_SETTINGS.md

## 1. Tenant-Level Settings

- Company profile, branches, locations, default working hours, default currency/timezone (inherited from country, overridable — see ARCHITECTURE.md §3)
- Notification rule configuration (see NOTIFICATION_LOGIC.md §4)
- Storage driver selection, if configurable per tenant rather than platform-wide (see FILE_STORAGE.md §3)
- Feature flags (driven by subscription plan, see BILLING_SUBSCRIPTION.md §3, but some may be independently toggleable — e.g. enabling background location tracking)

## 2. Platform-Level Settings (Super Admin only)

- Default plan feature matrix
- Global notification provider credentials (Firebase, email/SMS provider — unless a tenant brings their own)
- Country configuration (add/edit country rule sets — see ARCHITECTURE.md §3, MODULES.md §02)
- System-wide announcements/maintenance banners

## 2a. Runtime-Configurable Settings via Admin Panel (not just `.env`)

A key requirement: **SMTP/email settings, notification settings, and other operational config must be editable from the admin panel at runtime**, not locked in `.env` files that require a redeploy to change. This applies at two levels:

**Tenant/Company-level (Company Admin panel):**
- Company's own SMTP settings (host, port, username, password/app-password, from-address, from-name) — so a company can send payslip/notification emails from their own domain instead of the platform's shared sender.
- Notification channel toggles and rules per event type (see NOTIFICATION_LOGIC.md §4) — on/off per channel, per event, editable live.
- Real-time notification settings: enable/disable in-app real-time push (WebSocket) per company, configure which events trigger a live in-app toast/banner vs. a silent notification-center entry only.

**Platform-level (Super Admin panel):**
- Default/fallback SMTP provider (used when a tenant hasn't configured their own) and default SMS/push provider credentials.
- Global toggles for maintenance mode, feature-flag defaults, and platform-wide notification broadcast tools.

**Implementation rule:** these settings are stored in the database (`tenant_settings` / `platform_settings` tables — see DATABASE_SCHEMA.md), not in `.env`. The `.env` file only holds true bootstrap secrets needed before the app can even reach the database (see ENV_SETUP.md §7 for the exact split). Changing a company's SMTP settings or a notification rule must take effect immediately without a server restart or redeploy.

- All changes to these settings are audit-logged (see AUDIT_LOG.md), since SMTP credentials and notification routing are security/compliance-sensitive.
- SMTP passwords and any provider API keys stored via admin panel are encrypted at rest (see SECURITY.md §1) and masked in the UI after saving (shown as `••••••••`, never re-displayed in plaintext — only "test connection" / "replace" actions).

## 3. Backup Configuration

- Scheduled backup frequency (e.g. daily full + continuous WAL archiving for point-in-time recovery), retention period, and storage location for backups (separate from the app's own file storage — see FILE_STORAGE.md §8).
- Local-disk-storage deployments must explicitly include the file storage directory in the backup scope, not just the database.

## 4. Restore Procedure

- Documented, tested restore runbook (who can trigger it, from which backup point, expected downtime) — not just "we have backups." See DEPLOYMENT.md §6 for related rollback process.

## 5. Data Export

- Tenant-level "export all my data" capability (supports offboarding a client cleanly and supports data-portability compliance requirements) — separate from the routine bulk export templates in MODULES.md §37.

## 6. Audit of Settings Changes

- Changes to system settings (both tenant-level and platform-level) are themselves audit-logged (see AUDIT_LOG.md) — settings changes can have payroll/security impact and must be traceable.
