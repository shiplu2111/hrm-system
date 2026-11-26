export const legalEn = {
  badges: {
    draftBannerTitle: 'DRAFT, pending legal review',
    draftBannerDescription:
      'This legal notice is a structural pre-launch draft and must be reviewed and approved by qualified legal counsel (LEGAL_APPROVED=true with a reviewedOn date) before production release.',
    approvedBannerTitle: 'Legal Review Completed',
    versionLabel: 'Version',
    effectiveDateLabel: 'Effective Date',
    reviewedOnLabel: 'Reviewed On',
    pendingReviewValue: 'Pending review',
  },
  nav: {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    dpa: 'DPA',
    subprocessors: 'Subprocessors',
    security: 'Security & Retention',
  },
  dpa: {
    downloadCardTitle: 'Download Standard DPA PDF',
    downloadCardSubtitle:
      'Served directly from our verified FileStorage document vault for customer compliance records.',
    downloadCta: 'Download DPA PDF',
    subprocessorsLinkCta: 'View active subprocessors',
    fileMetaNote: '{{filename}} · {{sizeKb}} KB · PDF',
  },
  subprocessors: {
    eyebrow: 'Authorized Third-Party Processors',
    title: 'Subprocessors',
    subtitle:
      'Only third-party service providers actively configured and used in this platform deployment are listed below.',
    lastUpdatedLabel: 'Last Updated',
    activeCountLabel: '{{count}} Active Subprocessors',
    tableTitle: 'Active Third-Party Subprocessors',
    tableHeaders: {
      provider: 'Subprocessor',
      category: 'Category',
      purpose: 'Processing Purpose',
      dataProcessed: 'Data Processed',
      region: 'Region',
    },
    unconfiguredTitle: 'Categories With No External Subprocessor Configured',
    subscribeHeading: 'Subscribe to subprocessor updates',
    subscribeDescription:
      'Receive advance email notifications whenever we add or replace an authorized third-party subprocessor.',
    subscribeConsentPrefix:
      'I agree to receive CMSN-HR subprocessor update notices by email and acknowledge the',
    unavailableFallback:
      'Subprocessor registry telemetry could not be loaded right now. Please try again shortly.',
  },
  consent: {
    bannerTitle: 'Your privacy & cookie preferences',
    bannerBody:
      'We use necessary cookies and storage to operate currency preferences and remember your privacy choice. Optional analytics and marketing scripts remain blocked unless you consent.',
    policyLink: 'Read Cookie Policy',
    acceptAll: 'Accept all',
    declineAll: 'Decline non-essential',
    customize: 'Cookie settings',
    modalTitle: 'Cookie Preferences',
    modalSubtitle:
      'Choose which optional cookie categories may run on CMSN-HR. You can update or withdraw consent at any time.',
    savePreferences: 'Save preferences',
    closeModal: 'Close preferences',
    alwaysActive: 'Always active',
    openSettingsCta: 'Manage cookie preferences',
    categories: {
      necessary: {
        title: 'Necessary',
        description:
          'Essential storage required for core page security, selected display currency, and remembering your consent decision.',
      },
      analytics: {
        title: 'Analytics',
        description:
          'Optional aggregated pageview and onboarding performance telemetry. Never runs unless explicitly enabled.',
      },
      marketing: {
        title: 'Marketing',
        description:
          'Optional campaign attribution storage to measure acquisition channels. Never runs unless explicitly enabled.',
      },
    },
  },
} as const;
