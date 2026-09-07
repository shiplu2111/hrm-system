import type { EnterpriseFeature, SubscriptionPlanTier } from '@hrm/shared-types';

export const DEFAULT_PLAN: SubscriptionPlanTier = 'starter';

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
