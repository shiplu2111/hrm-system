export const helpEn = {
  metaTitle: 'Help Center',
  metaDescription:
    'Browse public guides on onboarding, rule resolution, deterministic payroll, and offline-first attendance capture on CMSN-HR.',
  eyebrow: 'Public Knowledge Base',
  title: 'How can we help you today?',
  subtitle:
    'Search public setup guides, troubleshooting walkthroughs, and step-by-step product documentation.',
  searchPlaceholder: 'Search guides (e.g. payroll adjustments, offline sync, provisioning)...',
  searchButton: 'Search',
  clearSearch: 'Clear',
  searchingLabel: 'Searching Help Center...',
  searchResultsHeading: 'Search results for “{{query}}”',
  searchNoResultsTitle: 'No matching public guides found',
  searchNoResultsBody:
    'Try another keyword or browse categories below. Looking for country-specific or plan-specific tenant documentation? Sign in to your workspace for internal guides.',
  categoriesHeading: 'Browse by topic',
  categoriesSubtitle: 'Public product documentation organized by workflow.',
  articleCountSingular: '{{count}} guide',
  articleCountPlural: '{{count}} guides',
  popularHeading: 'Popular public guides',
  popularSubtitle: 'Most-read setup walkthroughs available for prospective and current teams.',
  emptyStateTitle: 'Help articles are being synced',
  emptyStateBody:
    'Public guides will appear here once published in the platform knowledge base.',
  readArticleLabel: 'Read guide',
  readTimeLabel: '{{minutes}} min read',
  updatedLabel: 'Updated {{date}}',
  breadcrumbs: {
    home: 'Home',
    helpCenter: 'Help Center',
  },
  categoryPage: {
    emptyTitle: 'No public guides in this category',
    backToHelp: 'Back to Help Center',
  },
  articlePage: {
    authorLabel: 'By {{author}}',
    stepPrefix: 'Step {{step}}',
    relatedHeading: 'Related guides',
    feedbackHeading: 'Was this article helpful?',
    feedbackYes: 'Yes, helpful',
    feedbackNo: 'No, needs improvement',
    feedbackThanksYes: 'Thanks for letting us know this guide helped!',
    feedbackThanksNo:
      'Thanks for your feedback. If you have an active workspace, you can reach in-app support for account-specific questions.',
    feedbackStats: '{{yes}} found helpful · {{no}} unhelpful',
    feedbackError: 'Unable to record feedback right now. Please try again.',
    existingCustomerTitle: 'Need workspace-specific help?',
    existingCustomerBody:
      'Country-specific tax guides, plan-restricted docs, and support tickets live inside your Admin Portal and Customer Support channels.',
    existingCustomerCta: 'Contact support options',
    logInCta: 'Log in to workspace',
  },
} as const;
