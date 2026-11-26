export const securityEn = {
  metaTitle: 'How It Works & Security and Trust',
  metaDescription:
    'Learn how CMSN-HR enforces multi-tenant isolation, AES-256-GCM secret encryption, RBAC, append-only audit logs, tested backups, data anonymization, 2FA, and owner-approved support access.',
  eyebrow: 'Security, Architecture & Trust',
  title: 'How It Works & Security Controls',
  subtitle:
    'A factual overview of how CMSN-HR isolates tenant workspaces, secures sensitive payroll data, and enforces owner consent for platform support—describing only controls implemented in the platform.',
  lastReviewedLabel: 'Last reviewed:',
  lastReviewedDate: 'November 25, 2026',
  privacyLinkLabel: 'Read our Privacy Policy',
  heroPrimaryCta: 'Start free trial',
  heroSecondaryCta: 'Book a demo',
  noFakeBadgesNote:
    'Transparency note: This page documents implemented technical controls only. No third-party compliance certification seals are claimed unless an active audited certificate is held.',
  howItWorks: {
    eyebrow: 'Architecture Overview',
    title: 'How Data Flows Safely Inside a Multi-Tenant Request',
    subtitle:
      'Every workspace shares application infrastructure cleanly while enforcing strict tenant boundaries at authentication, query execution, and support access.',
    steps: [
      {
        step: '01',
        title: 'Signed JWT Session & Portal Separation',
        description:
          'Tenant users authenticate against their tenant workspace while platform operators authenticate separately with mandatory TOTP 2FA. Guards reject cross-portal token usage (403 WRONG_PORTAL).',
      },
      {
        step: '02',
        title: 'Session-Derived Tenant Query Scoping',
        description:
          'Application middleware extracts tenantId strictly from the verified JWT—never trusting client parameters—and automatically scopes Prisma reads and writes to that tenant.',
      },
      {
        step: '03',
        title: 'RBAC, Encryption & Append-Only Auditing',
        description:
          'Permission guards verify module-action access, sensitive fields return masked, secrets stay encrypted via AES-256-GCM, and changes append to an immutable audit log.',
      },
    ],
  },
  controlsSection: {
    eyebrow: 'Implemented Security Controls',
    title: 'Eight Core Controls Enforced Across the Platform',
    subtitle: 'Verified directly against SECURITY.md and the API application security layer.',
    controls: [
      {
        id: 'multi-tenant-isolation',
        title: 'Multi-Tenant Data Isolation',
        summary: 'Application-layer query scoping isolates every tenant’s HR and payroll records.',
        details: [
          'Every tenant business table includes a tenant_id column scoped automatically by Prisma query extensions from the authenticated JWT session.',
          'Client-supplied tenantId mismatches on writes are rejected server-side.',
          'Platform operator tokens cannot call tenant business APIs directly, and tenant tokens cannot access /platform/* routes.',
        ],
      },
      {
        id: 'encryption-masking',
        title: 'Encryption & Sensitive Data Masking',
        summary: 'AES-256-GCM field encryption for stored secrets, bcrypt password hashing, and masked sensitive IDs.',
        details: [
          'Stored secrets (platform TOTP secrets, webhook signing secrets, SMTP passwords, integration keys) use AES-256-GCM with random 12-byte IVs and scrypt key derivation.',
          'Passwords are hashed with bcrypt (cost factor 12)—never reversible encryption.',
          'Bank account numbers and tax IDs return masked in read views (e.g. ****1234), while saved integration credentials echo as masked placeholders.',
        ],
      },
      {
        id: 'rbac',
        title: 'Role-Based Access Control (RBAC) & Auth Hardening',
        summary: 'Module-action permissions, reporting-line scoping, and brute-force lockout protection.',
        details: [
          'Endpoints declare explicit module-action permissions (view, create, edit, delete, approve, finalize) alongside data scope (own, team, organization).',
          'Standard employee accounts (data_scope = own) are restricted strictly to My Space self-service routes.',
          'Short-lived 15-minute access tokens, refresh token rotation with reuse detection, rate-limited login (10/min), and progressive account lockout after 5 failed attempts.',
        ],
      },
      {
        id: 'audit-log',
        title: 'Append-Only Audit Logs',
        summary: 'Immutable activity history across both tenant actions and platform operator operations.',
        details: [
          'Tenant and platform audit tables are strictly append-only with no edit or delete endpoints exposed.',
          'Captures user identity, module, action, affected record ID, old/new value diffs (automatically redacting secret keys), IP/device context, and timestamp.',
          'Finalized payroll runs lock against direct mutation; adjustments create linked adjustment records logged in audit history.',
        ],
      },
      {
        id: 'backups-restore',
        title: 'Backups & Dual-Approval Restore Procedure',
        summary: 'Tracked backup runs, periodic automated restore tests, and two-person restore approval.',
        details: [
          'backup_runs log database backups (and local file storage when configured) with artifact size, status, retention expiry, and periodic restore verification results.',
          'Staff-initiated restore requests (full or single-tenant) require a typed justification and approval from a second Platform Owner or Platform Admin.',
          'Single-tenant restores execute in isolation without touching other tenants’ data.',
        ],
      },
      {
        id: 'retention-deletion',
        title: 'Data Retention, Export & Anonymization',
        summary: 'Full tenant data exports and right-to-be-forgotten anonymization preserving statutory records.',
        details: [
          'Supports queued tenant data archive exports and employee anonymization workflows with legal-deadline countdowns.',
          'Employee anonymization scrubs personal identifiers while preserving statutory payroll ledger amounts and audit logs in anonymized form per legal retention exceptions.',
          'Scheduled workspace deletion enforces a grace countdown before hard purge, allowing cancellation during the grace window.',
        ],
      },
      {
        id: 'two-factor-auth',
        title: 'Two-Factor Authentication (2FA)',
        summary: 'Mandatory TOTP 2FA protecting all Platform Super Admin operator accounts.',
        details: [
          'Platform staff authenticate with 6-digit TOTP authenticator codes verified against AES-256-GCM encrypted secrets.',
          '2FA enrollment and verification are enforced prior to issuing Platform Admin access tokens; 2FA resets require administrative approval and audit logging.',
          'Tenant user accounts are protected by password complexity rules, progressive failed-login lockout, and per-session revocation.',
        ],
      },
      {
        id: 'support-access',
        title: 'Owner-Approved, Time-Boxed Support Access',
        summary: 'Platform staff can never enter a tenant account without explicit consent, a time limit, and dual logging.',
        details: [
          'Platform staff cannot view tenant employee or payroll records without an active, approved support session.',
          'Requests require a written reason (minimum 10 characters), bounded duration (15 minutes to 4 hours max), and Company Owner approval (unless pre-authorized in tenant Security Settings).',
          'Sessions default to read-only, strictly block payroll finalization and full bank detail reveal, allow immediate owner revocation, and log the staff member’s name in both Platform and Tenant Audit Logs.',
        ],
      },
    ],
  },
  supportFlow: {
    eyebrow: 'Support Access Governance',
    title: 'How Support-Access Approval Protects Tenant Workspaces',
    subtitle:
      'Step-by-step lifecycle of a platform support session—from request through owner approval and automatic expiration.',
    steps: [
      {
        label: '1. Reason & Scope Request',
        detail: 'Support agent submits reason (min 10 chars), mode (read-only default), and 15–240 min duration.',
      },
      {
        label: '2. Owner Notification & Consent',
        detail: 'Company Owner receives email & in-app alert to approve or reject in Security Settings.',
      },
      {
        label: '3. Guarded Time-Boxed Session',
        detail: 'Short-lived token grants access; payroll finalization & full bank account reveal remain blocked.',
      },
      {
        label: '4. Dual Audit Trail & Revocation',
        detail: 'Every session event records in the tenant’s own Audit Log; owner can revoke immediately at any time.',
      },
    ],
  },
  privacyCallout: {
    title: 'Data Governance & Privacy Policy',
    description:
      'Review how CMSN-HR handles personal data processing, retention periods, and statutory exceptions in our Privacy Policy.',
    cta: 'View Privacy Policy',
  },
  cta: {
    eyebrow: 'Built for Operational Trust',
    title: 'Inspect CMSN-HR security and workspace governance firsthand.',
    description:
      'Start a 14-day isolated trial workspace or book a walkthrough with our team to review RBAC, audit logs, and support-access controls.',
    primaryLabel: 'Start free trial',
    secondaryLabel: 'Book a demo',
  },
} as const;
