export const CURRENCIES = ['BDT', 'USD'] as const;
export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export const PLAN_IDS = ['starter', 'business', 'enterprise'] as const;

export type Currency = (typeof CURRENCIES)[number];
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type PlanId = (typeof PLAN_IDS)[number];

/** Yearly billing charges this many months for twelve months of service. */
export const YEARLY_MONTHS_CHARGED = 10;

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** null = unlimited */
  employeeLimit: number | null;
  /** Monthly list price per company; null = quoted by sales */
  monthlyPrice: Record<Currency, number> | null;
  highlights: string[];
  featured?: boolean;
}

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Core HR, time and leave for growing teams.',
    employeeLimit: 250,
    monthlyPrice: { BDT: 35_000, USD: 299 },
    highlights: [
      'Up to 250 employees',
      'Employee records & documents',
      'Attendance, leave & holiday calendar',
      'Rosters and shift management',
      'Employee self-service on web & mobile',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Payroll, hiring and automation for scaling companies.',
    employeeLimit: 1_000,
    monthlyPrice: { BDT: 105_000, USD: 899 },
    featured: true,
    highlights: [
      'Up to 1,000 employees',
      'Everything in Starter',
      'Payroll, payslips & tax',
      'Recruitment, onboarding & offboarding',
      'Approval workflow builder',
      'Reports, analytics & GL export',
      'Priority email & chat support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Every module, custom controls and a dedicated team.',
    employeeLimit: null,
    monthlyPrice: null,
    highlights: [
      'Unlimited employees & companies',
      'Everything in Business',
      'Multi-country compliance packs',
      'SSO, API access & webhooks',
      'Custom data retention & backups',
      'Dedicated success manager & SLA',
    ],
  },
];

export function getPlan(id: string | null | undefined): Plan | undefined {
  return plans.find((plan) => plan.id === id);
}

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency);
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return BILLING_CYCLES.includes(value as BillingCycle);
}

/** Amount charged per billing period, or null when the plan is quoted. */
export function periodPrice(plan: Plan, currency: Currency, cycle: BillingCycle): number | null {
  if (!plan.monthlyPrice) return null;
  const monthly = plan.monthlyPrice[currency];
  return cycle === 'yearly' ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** Effective monthly price shown on plan cards. */
export function effectiveMonthlyPrice(plan: Plan, currency: Currency, cycle: BillingCycle): number | null {
  const total = periodPrice(plan, currency, cycle);
  if (total === null) return null;
  return cycle === 'yearly' ? Math.round(total / 12) : total;
}

export function yearlySaving(plan: Plan, currency: Currency): number | null {
  if (!plan.monthlyPrice) return null;
  return plan.monthlyPrice[currency] * (12 - YEARLY_MONTHS_CHARGED);
}

export function formatMoney(amount: number, currency: Currency): string {
  return currency === 'BDT'
    ? `৳${new Intl.NumberFormat('en-IN').format(amount)}`
    : `$${new Intl.NumberFormat('en-US').format(amount)}`;
}

export function employeeLimitLabel(plan: Plan): string {
  return plan.employeeLimit === null
    ? 'Unlimited employees'
    : `Up to ${new Intl.NumberFormat('en-US').format(plan.employeeLimit)} employees`;
}

type Cell = boolean | string;

export interface ComparisonRow {
  label: string;
  values: Record<PlanId, Cell>;
}

export interface ComparisonGroup {
  group: string;
  rows: ComparisonRow[];
}

const all = (value: Cell = true): Record<PlanId, Cell> => ({ starter: value, business: value, enterprise: value });

export const comparison: ComparisonGroup[] = [
  {
    group: 'Core HR',
    rows: [
      { label: 'Employees', values: { starter: 'Up to 250', business: 'Up to 1,000', enterprise: 'Unlimited' } },
      { label: 'Companies / legal entities', values: { starter: '1', business: 'Up to 5', enterprise: 'Unlimited' } },
      { label: 'Employee profiles & documents', values: all() },
      { label: 'Org chart, departments & positions', values: all() },
      { label: 'Lifecycle events (promotion, transfer, exit)', values: all() },
      { label: 'Contract management', values: { starter: false, business: true, enterprise: true } },
    ],
  },
  {
    group: 'Time & attendance',
    rows: [
      { label: 'Attendance (web, mobile, kiosk)', values: all() },
      { label: 'Leave policies & balances', values: all() },
      { label: 'Rosters, shifts & shift swaps', values: all() },
      { label: 'Overtime rules', values: { starter: false, business: true, enterprise: true } },
      { label: 'Geofence & biometric device sync', values: { starter: false, business: true, enterprise: true } },
      { label: 'Timesheets & projects', values: { starter: false, business: true, enterprise: true } },
    ],
  },
  {
    group: 'Payroll & finance',
    rows: [
      { label: 'Payroll processing & payslips', values: { starter: false, business: true, enterprise: true } },
      { label: 'Tax, provident fund & benefits', values: { starter: false, business: true, enterprise: true } },
      { label: 'Loans, advances & expense claims', values: { starter: false, business: true, enterprise: true } },
      { label: 'Accounting / GL integration', values: { starter: false, business: 'Export', enterprise: 'Export + live sync' } },
      { label: 'Multi-currency payroll', values: { starter: false, business: false, enterprise: true } },
    ],
  },
  {
    group: 'Talent',
    rows: [
      { label: 'Recruitment / ATS', values: { starter: false, business: true, enterprise: true } },
      { label: 'Onboarding & offboarding checklists', values: { starter: false, business: true, enterprise: true } },
      { label: 'Performance reviews & KPIs', values: { starter: false, business: true, enterprise: true } },
      { label: 'Training, engagement & kudos', values: { starter: false, business: true, enterprise: true } },
    ],
  },
  {
    group: 'Platform & security',
    rows: [
      { label: 'Employee self-service & mobile app', values: all() },
      { label: 'Roles & permissions', values: { starter: 'Default roles', business: 'Custom roles', enterprise: 'Custom roles' } },
      { label: 'Approval workflow builder', values: { starter: false, business: true, enterprise: true } },
      { label: 'Audit log', values: { starter: '90 days', business: '1 year', enterprise: 'Custom retention' } },
      { label: 'SSO, API access & webhooks', values: { starter: false, business: false, enterprise: true } },
      { label: 'Support', values: { starter: 'Email', business: 'Priority email & chat', enterprise: 'Dedicated manager + SLA' } },
    ],
  },
];
