import type {
  EnterpriseFeature,
  PlanDefinition,
  PlanFeatureKey,
  PlanUsageLevel,
  SubscriptionPlanTier,
} from '@hrm/shared-types';

export const DEFAULT_PLAN: SubscriptionPlanTier = 'starter';

export const PLAN_ORDER: readonly SubscriptionPlanTier[] = [
  'free',
  'starter',
  'business',
  'enterprise',
];

export const PLAN_FEATURES: Record<SubscriptionPlanTier, EnterpriseFeature[]> = {
  free: [],
  starter: [],
  business: [],
  enterprise: [
    'api_access',
    'sso',
    'custom_payroll_rules',
    'advanced_workflow',
  ],
};

/** Features each tier adds on top of the tier below (BILLING_SUBSCRIPTION.md §1). */
const PLAN_FEATURE_ADDITIONS: Record<SubscriptionPlanTier, PlanFeatureKey[]> = {
  free: ['core_hr'],
  starter: ['attendance', 'leave', 'basic_payroll'],
  business: ['roster', 'timesheets', 'advanced_reports'],
  enterprise: PLAN_FEATURES.enterprise,
};

/** Billable employee caps per tier; `null` is unlimited. Business-owned values — see BILLING_SUBSCRIPTION.md §3. */
export const PLAN_EMPLOYEE_LIMITS: Record<SubscriptionPlanTier, number | null> = {
  free: 10,
  starter: 50,
  business: 250,
  enterprise: null,
};

/** Share of a limit at which the admin starts seeing the upgrade prompt. */
export const PLAN_LIMIT_APPROACHING_RATIO = 0.8;

export const PLAN_CATALOG: readonly PlanDefinition[] = PLAN_ORDER.map(
  (planId, index) => ({
    planId,
    features: PLAN_ORDER.slice(0, index + 1).flatMap(
      (tier) => PLAN_FEATURE_ADDITIONS[tier],
    ),
    limits: { employees: PLAN_EMPLOYEE_LIMITS[planId] },
  }),
);

export function normalizePlanId(planId: string | null | undefined): SubscriptionPlanTier {
  const normalized = (planId ?? DEFAULT_PLAN).toLowerCase();
  if (
    normalized === 'free' ||
    normalized === 'starter' ||
    normalized === 'business' ||
    normalized === 'enterprise'
  ) {
    return normalized;
  }
  return DEFAULT_PLAN;
}

export function tenantHasFeature(
  planId: string | null | undefined,
  feature: EnterpriseFeature,
): boolean {
  const plan = normalizePlanId(planId);
  return PLAN_FEATURES[plan].includes(feature);
}

export function planDefinition(planId: SubscriptionPlanTier): PlanDefinition {
  return PLAN_CATALOG[PLAN_ORDER.indexOf(planId)];
}

export function nextPlanId(planId: SubscriptionPlanTier): SubscriptionPlanTier | null {
  return PLAN_ORDER[PLAN_ORDER.indexOf(planId) + 1] ?? null;
}

export function usageLevel(used: number, limit: number | null): PlanUsageLevel {
  if (limit === null) return 'ok';
  if (used > limit) return 'exceeded';
  if (used === limit) return 'reached';
  if (used >= Math.ceil(limit * PLAN_LIMIT_APPROACHING_RATIO)) return 'approaching';
  return 'ok';
}

/** Whether `additional` more billable employees fit under the limit. */
export function hasSeatsFor(used: number, limit: number | null, additional: number): boolean {
  return limit === null || used + additional <= limit;
}
