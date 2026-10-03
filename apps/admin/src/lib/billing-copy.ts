import type { PlanFeatureKey, SubscriptionPlanTier, TenantSubscriptionStatus } from '@hrm/shared-types';

/**
 * User-facing strings for the subscription screen and upgrade prompts.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const billingCopy = {
  title: 'Plan & usage',
  description: 'Your subscription plan, what it includes, and how much of it you are using.',
  loadError: 'Could not load your subscription.',
  noTenant: 'Subscription details are only available inside a company workspace.',

  plans: {
    free: { name: 'Free', tagline: 'Core HR for small teams getting started.' },
    starter: { name: 'Starter', tagline: 'Attendance, leave and basic payroll.' },
    business: { name: 'Business', tagline: 'Rostering, timesheets and advanced reports.' },
    enterprise: { name: 'Enterprise', tagline: 'API access, SSO, advanced workflows and custom payroll rules.' },
  } satisfies Record<SubscriptionPlanTier, { name: string; tagline: string }>,

  status: {
    active: 'Active',
    suspended: 'Suspended',
    cancelled: 'Cancelled',
  } satisfies Record<TenantSubscriptionStatus, string>,
  statusNotice: {
    suspended: 'Your subscription is suspended. Your data is safe, but some actions are unavailable until it is reactivated.',
    cancelled: 'Your subscription is cancelled. Your data is kept, but some actions are unavailable until you resubscribe.',
  },

  currentPlan: 'Current plan',
  usageTitle: 'Usage',
  employeesMetric: 'Employees',
  employeesHint: 'Everyone not terminated counts, including people on leave or suspended.',
  usageOf: (used: number, limit: number) => `${used.toLocaleString()} of ${limit.toLocaleString()}`,
  unlimited: 'Unlimited',
  usedUnlimited: (used: number) => `${used.toLocaleString()} in use · no limit on your plan`,
  seatsLeft: (n: number) => (n === 1 ? '1 seat left' : `${n.toLocaleString()} seats left`),
  noSeatsLeft: 'No seats left',
  overBy: (n: number) => `${n.toLocaleString()} over the limit`,

  includedTitle: 'Included in your plan',
  lockedTitle: 'Available on higher plans',
  lockedOn: (plan: string) => `${plan} plan`,
  topTier: 'Your plan includes every feature.',

  compareTitle: 'Compare plans',
  compareBody: 'Pricing depends on your headcount and billing cycle — our team confirms it when you request a change.',
  employeesLimit: (limit: number | null) =>
    limit === null ? 'Unlimited employees' : `Up to ${limit.toLocaleString()} employees`,
  everythingIn: (plan: string) => `Everything in ${plan}, plus:`,
  yourPlan: 'Your plan',
  requestUpgrade: 'Request upgrade',
  downgradeNote: 'To downgrade, contact support so we can check nothing you use is lost.',

  prompt: {
    approachingTitle: 'You are close to your employee limit',
    approachingBody: (used: number, limit: number, plan: string) =>
      `You are using ${used.toLocaleString()} of ${limit.toLocaleString()} employee seats on the ${plan} plan.`,
    reachedTitle: 'You have reached your employee limit',
    reachedBody: (limit: number, plan: string) =>
      `All ${limit.toLocaleString()} employee seats on the ${plan} plan are in use. New employees can't be added until you upgrade.`,
    exceededTitle: 'You are over your employee limit',
    exceededBody: (used: number, limit: number, plan: string) =>
      `${used.toLocaleString()} employees are on the books, but the ${plan} plan covers ${limit.toLocaleString()}. New employees can't be added until you upgrade.`,
    nextPlan: (plan: string, limit: number | null) =>
      limit === null
        ? `${plan} has no employee limit.`
        : `${plan} covers up to ${limit.toLocaleString()} employees.`,
    freeSeat: 'You can also free a seat by terminating someone who has left.',
    viewPlan: 'View plan',
    dismiss: 'Dismiss',
  },

  request: {
    title: (plan: string) => `Upgrade to ${plan}`,
    body: 'We will open a support request for our team. They will confirm pricing with you and switch your plan — nothing changes until then.',
    current: 'Current plan',
    requested: 'Requested plan',
    usage: 'Employees in use',
    noteLabel: 'Anything we should know? (optional)',
    notePlaceholder: 'e.g. we are hiring 30 people next quarter',
    submit: 'Send request',
    sending: 'Sending…',
    cancel: 'Cancel',
    close: 'Close',
    sent: (ticket: string) =>
      `Request sent as support ticket ${ticket}. Our team will be in touch to confirm the change.`,
    failed: 'Could not send the request. Please try again.',
    noPermission: 'Only people who can raise support requests can ask for an upgrade. Ask your Company Owner to request it.',
    subject: (from: string, to: string) => `Plan upgrade request: ${from} → ${to}`,
    ticketBody: (lines: { from: string; to: string; usage: string; note: string }) =>
      [
        `Requested plan: ${lines.to}`,
        `Current plan: ${lines.from}`,
        `Employees in use: ${lines.usage}`,
        ...(lines.note ? ['', lines.note] : []),
      ].join('\n'),
  },

  limitError: {
    viewPlan: 'View plan & upgrade',
  },

  features: {
    core_hr: { label: 'Core HR', description: 'Employee records, organization structure and documents' },
    attendance: { label: 'Attendance', description: 'Clock-ins, shifts and holiday calendars' },
    leave: { label: 'Leave management', description: 'Leave requests, policies and balances' },
    basic_payroll: { label: 'Payroll', description: 'Pay runs, payslips and tax profiles' },
    roster: { label: 'Rostering', description: 'Shift rosters and swaps' },
    timesheets: { label: 'Timesheets', description: 'Project time tracking and approvals' },
    advanced_reports: { label: 'Advanced reports', description: 'Scheduled reports, imports and exports' },
    api_access: { label: 'API access', description: 'API keys, OAuth clients and webhooks' },
    sso: { label: 'Single sign-on', description: 'Sign in through your identity provider' },
    advanced_workflow: { label: 'Advanced workflows', description: 'Multi-step, conditional approval chains' },
    custom_payroll_rules: { label: 'Custom payroll rules', description: 'Company-specific pay formulas and rules' },
  } satisfies Record<PlanFeatureKey, { label: string; description: string }>,
} as const;

export const planName = (planId: SubscriptionPlanTier) => billingCopy.plans[planId].name;
