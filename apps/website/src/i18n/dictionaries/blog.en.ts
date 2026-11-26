export const blogEn = {
  metaTitle: 'Blog',
  metaDescription:
    'Product engineering notes, payroll compliance guides, and workforce operations insights from the CMSN-HR team.',
  eyebrow: 'CMSN-HR Journal',
  title: 'Product, Payroll & Compliance Insights',
  subtitle:
    'Deep dives on deterministic payroll architecture, country-configurable employment rules, and offline-first workforce tools.',
  rssLabel: 'RSS Feed',
  allCategoriesLabel: 'All topics',
  readMoreLabel: 'Read article',
  readTimeLabel: '{{minutes}} min read',
  byAuthor: 'By {{author}}',
  emptyTitle: 'No blog posts published yet',
  emptyBody:
    'We only publish verified articles and deep dives here—never filler posts. Check back soon or subscribe below for updates when new articles go live.',
  emptyBrowseHelpCta: 'Browse Help Center guides',
  paginationPrevious: 'Previous',
  paginationNext: 'Next',
  paginationStatus: 'Page {{page}} of {{totalPages}}',
  breadcrumbs: {
    home: 'Home',
    blog: 'Blog',
  },
  share: {
    heading: 'Share this article',
    copyLink: 'Copy link',
    copied: 'Link copied',
    shareLinkedIn: 'LinkedIn',
    shareX: 'X',
    shareEmail: 'Email',
  },
  relatedHeading: 'Related articles',
  subscribe: {
    heading: 'Get new articles by email',
    description:
      'Receive occasional notifications when we publish new payroll, compliance, and product deep dives.',
    emailLabel: 'Work email address',
    emailPlaceholder: 'you@company.com',
    consentPrefix:
      'I agree to receive CMSN-HR blog updates by email and acknowledge the',
    privacyLinkLabel: 'Privacy Policy',
    honeypotLabel: 'Website (leave blank)',
    submitLabel: 'Subscribe',
    submittingLabel: 'Subscribing...',
    confirmationTitle: 'Subscription confirmed',
    confirmationBody:
      'Your email preferences and consent have been saved. Thank you for subscribing.',
    validation: {
      emailRequired: 'Enter your email address.',
      emailInvalid: 'Enter a valid email address.',
      consentRequired: 'Confirm email subscription consent before subscribing.',
    },
    genericError: 'Unable to save subscription right now. Please try again.',
  },
} as const;
