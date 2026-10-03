/** Subscription & billing (BILLING_SUBSCRIPTION.md) */

export type SubscriptionPlanTier =
  | 'free'
  | 'starter'
  | 'business'
  | 'enterprise';

export type EnterpriseFeature =
  | 'api_access'
  | 'sso'
  | 'custom_payroll_rules'
  | 'advanced_workflow';

/** Plan tier features from BILLING_SUBSCRIPTION.md §1, cumulative from Free to Enterprise. */
export type PlanFeatureKey =
  | 'core_hr'
  | 'attendance'
  | 'leave'
  | 'basic_payroll'
  | 'roster'
  | 'timesheets'
  | 'advanced_reports'
  | EnterpriseFeature;

export type PlanLimitKey = 'employees';

/** `approaching` starts at `TenantSubscriptionView.approachingRatio` of the limit. */
export type PlanUsageLevel = 'ok' | 'approaching' | 'reached' | 'exceeded';

export type TenantSubscriptionStatus = 'active' | 'suspended' | 'cancelled';

export interface PlanDefinition {
  planId: SubscriptionPlanTier;
  features: PlanFeatureKey[];
  /** `null` means unlimited. */
  limits: Record<PlanLimitKey, number | null>;
}

export interface PlanUsageMetric {
  key: PlanLimitKey;
  used: number;
  limit: number | null;
  level: PlanUsageLevel;
}

export interface TenantSubscriptionView {
  planId: SubscriptionPlanTier;
  status: TenantSubscriptionStatus;
  features: PlanFeatureKey[];
  usage: PlanUsageMetric[];
  /** Every tier in ascending order, for plan comparison. */
  plans: PlanDefinition[];
  /** The next tier up, or `null` on the top tier. */
  nextPlanId: SubscriptionPlanTier | null;
  approachingRatio: number;
}

export interface TenantPlanInfo {
  planId: SubscriptionPlanTier;
  features: EnterpriseFeature[];
  apiAccessEnabled: boolean;
}
