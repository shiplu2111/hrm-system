export const integrationsEn = {
  meta: {
    title: 'Integrations Directory',
    description:
      'Explore live accounting, payment, notification, attendance sync, and developer API integrations supported by CMSN-HR, plus upcoming roadmap connectors marked Coming soon.',
  },
  hero: {
    eyebrow: 'Connected Ecosystem',
    title: 'Integrations Built Around Clean Driver Boundaries',
    subtitle:
      'See every accounting, payment, notification, attendance, and developer integration verified as live today—and what is transparently scheduled next.',
    liveSummaryLabel: '{{live}} Live Integrations',
    comingSoonSummaryLabel: '{{comingSoon}} Coming Soon',
  },
  filters: {
    categoryLabel: 'Category',
    statusLabel: 'Availability',
    allCategories: 'All Categories',
    allStatuses: 'All',
    statusLive: 'Live',
    statusComingSoon: 'Coming soon',
    emptyMessage: 'No integrations match the selected category and availability filters.',
    resetButton: 'Reset filters',
    categories: {
      accounting: 'Accounting & GL',
      payments: 'Payments & Banking',
      notifications: 'Notifications',
      attendance: 'Attendance & Devices',
      developer: 'API, Webhooks & Storage',
      calendar_sso: 'Calendar & Enterprise SSO',
    },
  },
  card: {
    statusLive: 'Live',
    statusComingSoon: 'Coming soon',
  },
  architecture: {
    eyebrow: 'Failure Isolation & Security',
    title: 'Designed So Third-Party Delays Never Block Payroll',
    subtitle:
      'Every connector follows a swappable driver architecture with encrypted credentials and asynchronous execution.',
    cards: [
      {
        title: 'Asynchronous Queue Isolation',
        description:
          'Accounting syncs and outbound webhooks run asynchronously in background worker queues. A slow downstream API never delays payroll finalization or attendance clock-ins.',
      },
      {
        title: 'Swappable Provider Interfaces',
        description:
          'Accounting, payment, notification, and storage integrations sit behind clean provider interfaces so new regional providers slot in cleanly without rewriting core HR logic.',
      },
      {
        title: 'Tenant-Scoped Encrypted Secrets',
        description:
          'Per-company OAuth tokens, SMTP passwords, and webhook secrets are encrypted at rest and strictly scoped to the owning tenant.',
      },
    ],
  },
  cta: {
    eyebrow: 'Need a Custom Connector?',
    title: 'Build with our scoped REST API or partner with our team',
    description:
      'Connect internal finance or workforce tools via HMAC-signed webhooks today, or tell us which accounting, banking, or hardware connector your team relies on.',
    primaryCta: 'Start free trial',
    secondaryCta: 'Contact Partnerships',
  },
} as const;
