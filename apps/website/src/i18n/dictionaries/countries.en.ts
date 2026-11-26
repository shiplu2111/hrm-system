export const countriesEn = {
  index: {
    metaTitle: 'Solutions by Country — Multi-Country Payroll & Compliance',
    metaDescription:
      'Explore active countries supported by CMSN-HR, including payroll currencies, supported pay frequencies, and configurable statutory compliance categories.',
    eyebrow: 'Global Country Framework · Modules §02',
    title: 'Country-Configurable Payroll, Attendance & Statutory Compliance',
    subtitle:
      'Every active country runs on the same deterministic core—configured with local currencies, pay schedules, statutory frameworks, and public holiday calendars.',
    selectorLabel: 'Select an active country',
    selectorPlaceholder: 'Choose a country...',
    selectorGoCta: 'Open country guide',
    activeCountBadge: '{{count}} active countries available',
    emptyTitle: 'No active countries published right now',
    emptyDescription:
      'Country configurations are managed in the platform console. Check back shortly or contact our team to discuss your target jurisdiction.',
    emptyCta: 'Book a demo',
    cardCurrencyLabel: 'Currency',
    cardFrequenciesLabel: 'Pay Frequencies',
    cardStatutoryLabel: 'Statutory Items Supported',
    cardViewDetailsCta: 'Explore country solution',
    cardTrialCta: 'Start free trial',
  },
  detail: {
    breadcrumbSolutions: 'Solutions',
    breadcrumbCountries: 'By Country',
    metaTitleTemplate: '{{country}} Payroll, Attendance & HR Compliance',
    metaDescriptionTemplate:
      'Explore CMSN-HR support for {{country}} ({{currency}}): pay frequencies, statutory tax, {{socialSecurity}}, statutory leave, and public holiday calendars.',
    activeBadge: 'Active Country',
    eyebrow: 'Country Compliance Solution · {{isoCode}}',
    headlineTemplate: 'Payroll, Attendance & HR Compliance for {{country}}',
    summaryTemplate:
      'Configure {{country}} payroll cycles in {{currency}}, enforce statutory leave and public holiday calendars, and keep historical pay runs isolated from future regulatory updates.',
    facts: {
      currencyLabel: 'Payroll Currency',
      frequenciesLabel: 'Pay Frequencies',
      statesLabel: 'States / Provinces',
      statesFallback: 'Country-wide defaults',
      statesValueTemplate: '{{count}} configured',
      statusLabel: 'Platform Status',
      statusActiveValue: 'Active & Supported',
    },
    statutorySection: {
      eyebrow: 'Statutory Capabilities',
      titleTemplate: 'Statutory Frameworks Supported for {{country}}',
      subtitle:
        'All statutory items resolve through the effective-dated hierarchy (Global → Country → State → Company Policy → Employee Contract).',
      supportedLabel: 'Supported',
      configurableLabel: 'Configurable',
      items: {
        tax: {
          title: 'Statutory Income Tax',
          supportedDesc:
            'Effective-dated country tax years, progressive tax slabs, rebates, and statutory filing summaries.',
          configurableDesc:
            'Configurable through the Country Tax Engine with effective-dated rule versioning.',
        },
        socialSecurity: {
          titleDefault: 'Social Security & Provident Contributions',
          titleSuperannuation: 'Superannuation Contributions',
          titlePension: 'Pension & Retirement Contributions',
          supportedDesc:
            'Supports employer and employee statutory contribution schedules, base definitions, and caps.',
          configurableDesc:
            'Configurable contribution rules across country, company, and contract layers.',
        },
        leave: {
          title: 'Statutory Leave Entitlements',
          supportedDesc:
            'Country baseline leave entitlements, accrual schedules, carry-forward rules, and probation settings.',
          configurableDesc:
            'Flexible leave policies configurable by country default and company policy.',
        },
        publicHolidays: {
          title: 'Statutory Public Holidays',
          supportedDesc:
            'Country and state/province public holiday calendars integrated with leave deductions and holiday overtime.',
          configurableDesc:
            'Multi-layer holiday calendars supporting national, regional, and branch schedules.',
        },
      },
    },
    helpCenterNotice: {
      badge: 'Live Statutory Reference Policy',
      title: 'Why tax rates and legal thresholds live in our Help Center',
      description:
        'Statutory tax slabs, contribution thresholds, and labor entitlements change periodically by government mandate. To keep figures accurate, specific rates and legal rules are maintained in our Help Center documentation and versioned inside the platform rather than printed as static marketing text.',
      cta: 'Browse Help Center Compliance Guides',
    },
    otherCountries: {
      heading: 'Explore Other Active Countries',
      subtitle: 'Switch between active country frameworks supported on CMSN-HR.',
    },
    cta: {
      eyebrowTemplate: 'Deploy {{country}} Payroll & HR',
      titleTemplate: 'Ready to run compliant {{country}} payroll in {{currency}}?',
      description:
        'Start a 14-day guided trial with pre-configured country defaults or schedule a walkthrough with our compliance team.',
      primaryLabel: 'Start free trial',
      secondaryLabel: 'Book a demo',
    },
  },
  frequencies: {
    monthly: 'Monthly',
    weekly: 'Weekly',
    fortnightly: 'Fortnightly',
    'bi-weekly': 'Bi-weekly',
    'semi-monthly': 'Semi-monthly',
    semi_monthly: 'Semi-monthly',
    'four-weekly': 'Four-weekly',
    custom: 'Custom',
  },
} as const;
