export const pricingEn = {
  metaTitle: 'Pricing & Plans',
  metaDescription:
    'Transparent plans per employee and base-plus-seat tiers across currencies. Estimate your monthly cost, compare features, and start a free trial.',
  eyebrow: 'Transparent Pricing',
  title: 'Predictable pricing built for growing teams.',
  subtitle:
    'Choose your billing currency and compare plans from core HR free for up to 10 employees to configurable country payroll and enterprise controls.',
  controls: {
    billingCycleLabel: 'Billing cycle',
    monthlyLabel: 'Monthly',
    annualLabel: 'Annual',
    annualBadge: 'Annual billing available',
    currencyLabel: 'Currency',
    popularBadge: 'Popular',
  },
  units: {
    free: 'Free · up to {{seats}} employees',
    perEmployeeMonth: '/ employee / month',
    perEmployeeYear: '/ employee / year',
    basePlusMonthly: '/ month base + {{perSeat}} / additional employee above {{included}}',
    basePlusAnnual: '/ year base + {{perSeat}} / additional employee above {{included}}',
    flatMonth: '/ month flat workspace fee',
    flatYear: '/ year flat workspace fee',
    contactUs: 'Contact us',
    contactUsNote: 'Custom pricing for tailored requirements',
    unlimitedSeats: 'Unlimited employees',
    upToSeats: 'Up to {{seats}} active employees',
  },
  ctas: {
    startTrial: 'Start free trial',
    contactSales: 'Contact sales',
    contactUs: 'Contact us',
  },
  calculator: {
    eyebrow: 'Pricing Estimator',
    title: 'Estimate your subscription cost',
    subtitle:
      'Enter your active employee count to calculate your estimated price using the same base and per-seat billing rule used at invoice generation.',
    employeeCountLabel: 'Active employees',
    employeeCountHelp: 'Active, on-leave, and suspended profiles hold a seat; terminated employees do not.',
    planSelectLabel: 'Selected plan',
    estimateBadge: 'Estimate only',
    monthlyEquivalentLabel: 'Estimated monthly cost',
    billedAnnuallyLabel: 'Billed annually ({{cycleTotal}} / year)',
    baseFeeLabel: 'Base subscription ({{included}} seats included)',
    extraSeatsLabel: '{{extraSeats}} additional seats × {{perSeat}}',
    noExtraSeatsLabel: 'All {{count}} seats fit within base allocation',
    customPlanNotice:
      'No self-serve published rate applies to this selection. Contact sales for a custom quote.',
    capExceededNotice:
      'Exceeds the {{planName}} limit of {{cap}} employees. Choose a higher plan for {{count}} employees.',
    disclaimer:
      'Estimate only. Final invoices apply the active effective-dated rate in your selected currency and exclude regional taxes.',
    presetLabel: 'Quick presets:',
  },
  matrix: {
    eyebrow: 'Plan Comparison',
    title: 'Compare plans side by side',
    subtitle:
      'Every feature flag and workspace quota enforced across Free, Starter, Business, and Enterprise tiers.',
    featureColumnHeading: 'Capability & Limits',
    limitsGroupHeading: 'Workspace Limits',
    featuresGroupHeading: 'Included Modules & Governance',
    unlimitedValue: 'Unlimited',
    zeroValue: 'Not included',
    includedAria: 'Included',
    notIncludedAria: 'Not included',
  },
  unavailable: {
    title: 'Pricing catalog temporarily unavailable',
    body: 'We could not load live plan pricing from the platform catalog right now. Please refresh shortly or contact our team for current pricing.',
    retryHint: 'Contact sales',
  },
  faq: {
    eyebrow: 'Pricing FAQ',
    title: 'Billing, trials, and account questions',
    subtitle: 'Straight answers grounded in our subscription and data handling policies.',
    items: [
      {
        id: 'billing',
        question: 'How do monthly and annual billing work, and which currencies are supported?',
        answer:
          'You can choose monthly or annual billing where annual pricing is published for your selected currency. Under base-plus-employee plans, the base fee covers up to the included seat threshold and any additional active employees above that threshold are billed at the plan per-seat rate. Currencies with active catalog pricing can be switched directly on this page or in the footer.',
      },
      {
        id: 'trial',
        question: 'What is included in the free trial and do I need a credit card to start?',
        answer:
          'New workspaces start on a free trial period configured on the platform without requiring a payment card upfront. You can configure your company structure, country rules, and test payroll and attendance workflows before converting to a paid plan.',
      },
      {
        id: 'cancelling',
        question: 'What happens if we downgrade or cancel our subscription?',
        answer:
          'Plan downgrades schedule for your next renewal date so your team retains higher-tier access through the remainder of the paid cycle. If you cancel or fall past due into suspension, your workspace enters read-only mode and we never delete tenant records automatically as a consequence of non-payment.',
      },
      {
        id: 'data-export',
        question: 'Can we export our HR, attendance, and payroll data if we leave?',
        answer:
          'Yes. Even in read-only suspension mode, authorized administrators can view records and export data. When an owner explicitly schedules account deletion, there is a grace period before irreversible purge so your team can complete exports.',
      },
      {
        id: 'employee-limits',
        question: 'How are active employee limits counted across plans?',
        answer:
          'Every employee profile that is active, on leave, or suspended holds a seat; terminated and soft-deleted employees do not count toward your limit. The platform alerts administrators at 80% usage and prompts for a plan upgrade when reaching your tier cap.',
      },
    ],
  },
  cta: {
    heading: 'Start with a guided trial or request custom Enterprise terms',
    body: 'Spin up your tenant workspace in minutes or talk through multi-country rules and volume pricing with our team.',
    primaryCta: 'Start free trial',
    secondaryCta: 'Contact sales',
  },
} as const;
