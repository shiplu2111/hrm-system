# THIRD_PARTY_INTEGRATIONS.md

## 1. Integration Categories

```
Accounting/GL   -- Xero, QuickBooks, Tally (payroll journal entry export)
Banking         -- bank transfer file generation / payment API
Notifications   -- Firebase FCM (push), Email provider (SMTP/API), SMS provider
Attendance      -- biometric device APIs, third-party time clocks
Calendar        -- Google/Outlook calendar sync (leave, roster)
SSO             -- enterprise identity providers (Phase 2/Enterprise plan)
```

## 2. General Integration Pattern

- Each integration implemented behind an interface specific to its category (similar to the storage driver pattern in FILE_STORAGE.md), so swapping providers (e.g. Twilio → another SMS provider) doesn't ripple through application code.
- Credentials stored in a secrets manager, scoped per tenant where the integration is tenant-specific (e.g. a tenant's own Xero connection), and platform-wide where it's a vendor-level service (e.g. the platform's own Firebase project).

## 3. Accounting/GL Integration

- Payroll finalization can trigger a journal entry export (see PAYROLL_LOGIC.md) mapped to the tenant's chart of accounts.
- OAuth-based connection per tenant for Xero/QuickBooks; API-key/file-based for Tally where OAuth isn't available.
- Sync failures must be visible to the Payroll Admin, not silent — payroll is still valid/finalized even if the accounting sync fails; the sync retries independently.

## 4. Banking Integration

- Payment batch (see MODULES.md §19) generates either a bank-specific file format (e.g. NACHA, local bank format) for manual upload, or calls a direct payment API where available.
- Failed payments must reconcile back into `payroll_runs`/payment status without manual DB edits.

## 5. Attendance Device Integration

- Biometric/time-clock devices push data via API or the device syncs to a local gateway that forwards to `/sync/attendance` (same idempotency contract as the mobile app — see OFFLINE_SYNC.md §4).

## 6. Webhook Contract (outbound, for tenant-built integrations)

- See API_GUIDELINES.md §9 — signed payloads, versioned schema, retried with backoff.

## 7. Rate Limits & Failure Isolation

- A failing or slow third-party integration must never block core platform operations (e.g. a slow accounting sync must not delay payroll finalization) — integrations run asynchronously via the job queue (BullMQ), not inline in the request/response cycle.

## 8. Enterprise-Only Integrations

- SSO and custom API access are gated to the Enterprise plan (see BILLING_SUBSCRIPTION.md §3).
