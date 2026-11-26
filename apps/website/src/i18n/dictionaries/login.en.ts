export const loginEn = {
  metaTitle: 'Log In to Your Workspace',
  metaDescription:
    'Enter your company subdomain or work email to reach your organization’s CMSN-HR login portal or employee app.',
  eyebrow: 'Workspace Access',
  title: 'Sign in to CMSN-HR',
  subtitle:
    'Enter your company workspace address or work email so we can direct you to the right login portal.',
  destinationLabel: 'Where are you signing in?',
  destinations: [
    {
      id: 'portal',
      label: 'Company Workspace Portal',
      description: 'HR, payroll & manager sign-in',
    },
    {
      id: 'employee',
      label: 'Employee App',
      description: 'Self-service, attendance & payslips',
    },
  ],
  identifierLabel: 'Company subdomain or work email',
  identifierPlaceholder: 'yourcompany or alex@company.com',
  identifierHint:
    'Enter your workspace name (for example acme in acme.cmsn-hr.com) or your work email address.',
  submitLabel: 'Continue to login',
  submittingLabel: 'Checking...',
  redirectingMessage: 'Redirecting to your workspace sign-in page...',
  validation: {
    identifierRequired: 'Enter your company subdomain or work email address.',
    forgotEmailRequired: 'Enter your work email address.',
    forgotEmailInvalid: 'Enter a valid email address.',
  },
  neutralUnknownTitle: 'Workspace not opened',
  neutralUnknownBody: 'Please check the address or contact your administrator.',
  emailSentTitle: 'Check your inbox',
  emailSentBody:
    'If an active workspace is associated with that email address, we have sent the sign-in links to it. Check your inbox or contact your administrator.',
  rateLimitError:
    'Too many lookup attempts right now. Please wait a minute and try again.',
  genericError: 'Unable to continue right now. Please try again.',
  forgotLinkLabel: 'Forgot company address?',
  forgotPanel: {
    title: 'Find your company address',
    description:
      'Enter your work email address and we will email sign-in links for any workspaces associated with that address.',
    emailLabel: 'Work email address',
    emailPlaceholder: 'alex@company.com',
    honeypotLabel: 'Website (leave blank)',
    submitLabel: 'Email workspace links',
    submittingLabel: 'Sending...',
    cancelLabel: 'Back to sign in',
    confirmationTitle: 'Check your email',
    confirmationBody:
      'If an active workspace is associated with that email address, we have sent the sign-in links to it. Check your inbox or contact your administrator.',
  },
  noAccountPrefix: "Don't have a workspace yet?",
  startTrialLinkLabel: 'Start free trial',
} as const;
