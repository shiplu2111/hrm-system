export type IntegrationCategory =
  | 'accounting'
  | 'payments'
  | 'notifications'
  | 'attendance'
  | 'developer'
  | 'calendar_sso';

export type IntegrationStatus = 'live' | 'coming_soon';

export interface IntegrationItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  authOrProtocol: string;
  summary: string;
  capabilities: readonly string[];
}

/**
 * Verified inventory of third-party integrations & drivers implemented in `apps/api`
 * (`THIRD_PARTY_INTEGRATIONS.md`). Only integrations backed by working server modules
 * are marked `'live'`; unbuilt or partial roadmap items are marked `'coming_soon'`.
 */
export const INTEGRATIONS_CATALOG: readonly IntegrationItem[] = [
  // Accounting & GL
  {
    id: 'xero',
    name: 'Xero Accounting',
    category: 'accounting',
    status: 'live',
    authOrProtocol: 'OAuth 2.0 + Async Sync Queue',
    summary:
      'Connect each company entity via OAuth 2.0, map earnings and employer liabilities to your Xero chart of accounts, and push balanced manual payroll journals after finalization.',
    capabilities: [
      'Per-company encrypted OAuth token storage with automatic token refresh',
      'Cost-centre overrides and dry-run journal balancing validation',
      'Background sync retries that never block payroll finalization',
    ],
  },
  {
    id: 'payroll-gl-export',
    name: 'GL Journal CSV & Ledger Export',
    category: 'accounting',
    status: 'live',
    authOrProtocol: 'Double-Entry Journal Preview & Export',
    summary:
      'Generate balanced payroll and contractor general-ledger journal previews mapped to custom GL account codes for universal import into local finance workflows.',
    capabilities: [
      'Unmapped account detection before export',
      'Supports earning, deduction, expense, and liability lines',
    ],
  },
  {
    id: 'quickbooks-online',
    name: 'QuickBooks Online',
    category: 'accounting',
    status: 'coming_soon',
    authOrProtocol: 'OAuth 2.0 (Planned)',
    summary:
      'Automated journal entry synchronization for QuickBooks Online using the same per-company GL account mapping layer.',
    capabilities: [
      'Scheduled for Phase 2 accounting expansion behind the GL provider interface',
      'Provider key registered; OAuth & journal push adapter not yet active',
    ],
  },
  {
    id: 'tally',
    name: 'Tally',
    category: 'accounting',
    status: 'coming_soon',
    authOrProtocol: 'API / Voucher Export (Planned)',
    summary:
      'Ledger voucher integration for regional South Asian payroll teams operating on Tally accounting workflows.',
    capabilities: [
      'Designed for voucher-based chart-of-accounts mapping',
      'Provider key registered; integration adapter not yet active',
    ],
  },

  // Payments & Banking
  {
    id: 'stripe',
    name: 'Stripe Billing',
    category: 'payments',
    status: 'live',
    authOrProtocol: 'API + Signed Webhooks',
    summary:
      'Automated SaaS subscription invoicing, customer billing profiles, card charges with idempotency keys, and cryptographically verified webhook reconciliation.',
    capabilities: [
      'Idempotent payment intents and multi-currency invoice support',
      'Signed webhook verification with automatic dunning state updates',
    ],
  },
  {
    id: 'bank-transfer-rails',
    name: 'Direct Bank Transfer APIs (NACHA / Local Rails)',
    category: 'payments',
    status: 'coming_soon',
    authOrProtocol: 'Direct Bank API / Transfer Files (Planned)',
    summary:
      'Automated salary batch disbursement directly through banking APIs and standardized bank file formats generated from finalized payroll runs.',
    capabilities: [
      'Payment batch preparation and payout status tracking already exist internally',
      'Direct bank API submission and automated reconciliation remain planned',
    ],
  },

  // Notifications
  {
    id: 'smtp-email',
    name: 'Email & SMTP Providers',
    category: 'notifications',
    status: 'live',
    authOrProtocol: 'SMTP / TLS (Nodemailer)',
    summary:
      'Connect your company’s own SMTP relay with encrypted credentials and TLS for payslips, approvals, welcome notices, and verification emails.',
    capabilities: [
      'Per-company encrypted SMTP configuration and live test-email diagnostics',
      'PDF attachment support for payroll payslips',
    ],
  },
  {
    id: 'firebase-fcm',
    name: 'Firebase Cloud Messaging (FCM)',
    category: 'notifications',
    status: 'live',
    authOrProtocol: 'Firebase Admin SDK',
    summary:
      'Mobile push notifications to employee iOS and Android devices for shift reminders, leave decisions, approvals, and published payslips.',
    capabilities: [
      'Per-device push token registration and automatic stale-token cleanup',
      'Best-effort exponential retry without interrupting in-app delivery',
    ],
  },
  {
    id: 'realtime-in-app',
    name: 'Real-Time In-App Gateway',
    category: 'notifications',
    status: 'live',
    authOrProtocol: 'WebSockets (/realtime)',
    summary:
      'Persistent in-app notification feed paired with live WebSocket delivery across Admin Portal and Employee My Space sessions.',
    capabilities: [
      'Granular per-event notification toggles and read/unread tracking',
      'Delivered independently even if external email or push relays fail',
    ],
  },
  {
    id: 'sms-gateway',
    name: 'SMS Gateways (Twilio / Local SMS)',
    category: 'notifications',
    status: 'coming_soon',
    authOrProtocol: 'SMS Provider Driver (Planned)',
    summary:
      'Outbound SMS alerts for urgent shift dispatches and fallback verification notifications behind a swappable SMS driver interface.',
    capabilities: [
      'Operational kill-switch governance prepared in Super Admin Console',
      'Live SMS provider dispatch adapter not yet enabled',
    ],
  },

  // Attendance & Devices
  {
    id: 'mobile-offline-sync',
    name: 'Offline-First Mobile Attendance Sync',
    category: 'attendance',
    status: 'live',
    authOrProtocol: 'Idempotent Batch Sync API (/sync/attendance)',
    summary:
      'Synchronizes buffered attendance punches, breaks, and timesheets from iOS and Android field devices with duplicate-safe client IDs and clock-skew detection.',
    capabilities: [
      'Composite server uniqueness guarantees zero duplicate punches on retry',
      'Built-in Haversine geofence verification and time-anomaly flagging',
    ],
  },
  {
    id: 'biometric-hardware',
    name: 'Biometric Terminals & Time-Clock Hardware',
    category: 'attendance',
    status: 'coming_soon',
    authOrProtocol: 'Device Bridge / Gateway API (Planned)',
    summary:
      'Direct integration with wall-mounted biometric scanners and RFID time clocks forwarding punches into the unified idempotent sync endpoint.',
    capabilities: [
      'Unified punch schema supports biometric punch origin tagging',
      'Dedicated hardware SDK / gateway connector not yet implemented',
    ],
  },

  // API, Webhooks & Storage
  {
    id: 'tenant-rest-api',
    name: 'Scoped Tenant REST API & OAuth Clients',
    category: 'developer',
    status: 'live',
    authOrProtocol: 'REST + API Keys & OAuth 2.0',
    summary:
      'Programmatic Enterprise API access scoped to explicit module permissions and rate-limited per tenant for custom internal tooling.',
    capabilities: [
      'Fine-grained scope permissions and instant key revocation',
      'OAuth client credential management with platform governance',
    ],
  },
  {
    id: 'outbound-webhooks',
    name: 'Signed Outbound Webhooks',
    category: 'developer',
    status: 'live',
    authOrProtocol: 'HMAC-SHA256 Signed Events',
    summary:
      'Deliver versioned lifecycle events—such as attendance, leave, and finalized payroll events—to your external endpoints asynchronously.',
    capabilities: [
      'HMAC signature verification, SSRF URL validation, and backoff retries',
      'Isolated queue processing ensures endpoints never slow workspace actions',
    ],
  },
  {
    id: 'object-storage',
    name: 'Amazon S3 & Local File Storage',
    category: 'developer',
    status: 'live',
    authOrProtocol: 'Storage Driver Interface',
    summary:
      'Swappable document storage backend supporting encrypted S3-compatible object buckets or isolated local storage for employee files and payslips.',
    capabilities: [
      'Tenant-prefixed keys and strict document mime/size validation',
      'Unified abstraction shared across documents, exports, and backups',
    ],
  },

  // Calendar & SSO
  {
    id: 'calendar-sync',
    name: 'Google Calendar & Microsoft Outlook Sync',
    category: 'calendar_sso',
    status: 'coming_soon',
    authOrProtocol: 'Calendar OAuth Sync (Planned)',
    summary:
      'Two-way leave, public holiday, and shift roster calendar feeds for Google Workspace and Microsoft 365 teams.',
    capabilities: [
      'Approved leave and holiday event synchronization',
      'Scheduled on the Phase 2 ecosystem roadmap',
    ],
  },
  {
    id: 'enterprise-sso',
    name: 'Enterprise SSO (SAML 2.0 / OIDC)',
    category: 'calendar_sso',
    status: 'coming_soon',
    authOrProtocol: 'SAML 2.0 / OpenID Connect (Planned)',
    summary:
      'Centralized identity federation with Okta, Microsoft Entra ID, and Google Identity for Enterprise workspaces.',
    capabilities: [
      'Plan entitlement flags defined for Enterprise workspaces',
      'SAML/OIDC assertion consumer endpoints scheduled for upcoming release',
    ],
  },
];

export function getIntegrationsCatalog(): readonly IntegrationItem[] {
  return INTEGRATIONS_CATALOG;
}
