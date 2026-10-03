import type {
  PlanDefinition,
  PlanFeatureKey,
  PlanUsageLevel,
  PlanUsageMetric,
  SubscriptionPlanTier,
  TenantSubscriptionView,
} from '@hrm/shared-types';

export const employeeUsage = (view: TenantSubscriptionView): PlanUsageMetric | null =>
  view.usage.find((metric) => metric.key === 'employees') ?? null;

export const planById = (view: TenantSubscriptionView, planId: SubscriptionPlanTier): PlanDefinition | null =>
  view.plans.find((plan) => plan.planId === planId) ?? null;

export const planRank = (view: TenantSubscriptionView, planId: SubscriptionPlanTier) =>
  view.plans.findIndex((plan) => plan.planId === planId);

/** Levels that should show an upgrade prompt (BILLING_SUBSCRIPTION.md §3). */
export const needsUpgradePrompt = (level: PlanUsageLevel) => level !== 'ok';

/** At or past the limit: the server will refuse new employees. */
export const isAtLimit = (level: PlanUsageLevel) => level === 'reached' || level === 'exceeded';

export const usagePercent = (metric: PlanUsageMetric) =>
  metric.limit === null || metric.limit === 0 ? 0 : Math.min(100, Math.round((metric.used / metric.limit) * 100));

export const usageTone = (level: PlanUsageLevel): 'accent' | 'warning' | 'error' =>
  level === 'ok' ? 'accent' : level === 'approaching' ? 'warning' : 'error';

/** Features a plan adds over the plan directly below it. */
export function featuresAddedBy(view: TenantSubscriptionView, planId: SubscriptionPlanTier): PlanFeatureKey[] {
  const rank = planRank(view, planId);
  const plan = view.plans[rank];
  if (!plan) return [];
  const below = new Set(view.plans[rank - 1]?.features ?? []);
  return plan.features.filter((feature) => !below.has(feature));
}

/** Features not in the current plan, each with the lowest plan that unlocks it. */
export function lockedFeatures(view: TenantSubscriptionView): Array<{ feature: PlanFeatureKey; planId: SubscriptionPlanTier }> {
  const owned = new Set(view.features);
  const locked: Array<{ feature: PlanFeatureKey; planId: SubscriptionPlanTier }> = [];
  for (const plan of view.plans.slice(planRank(view, view.planId) + 1)) {
    for (const feature of featuresAddedBy(view, plan.planId)) {
      if (!owned.has(feature)) locked.push({ feature, planId: plan.planId });
    }
  }
  return locked;
}
