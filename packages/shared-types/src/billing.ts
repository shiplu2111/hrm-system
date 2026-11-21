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

export type PlanLimitKey =
  | 'employees'
  | 'storage_gb'
  | 'api_calls'
  | 'companies'
  | (string & {});

/** `approaching` starts at `TenantSubscriptionView.approachingRatio` of the limit. */
export type PlanUsageLevel = 'ok' | 'approaching' | 'reached' | 'exceeded';

export type TenantSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'pending_deletion'
  | 'deleted';

export interface PlanDefinition {
  planId: SubscriptionPlanTier;
  features: PlanFeatureKey[];
  /** `null` means unlimited. */
  limits: Partial<Record<PlanLimitKey, number | null>>;
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

export interface PlatformPlanPriceView {
  id: string;
  planId: string;
  currency: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  perSeatAmount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PlatformPlanFeatureView {
  id: string;
  planId: string;
  featureKey: string;
  enabled: boolean;
}

export interface PlatformPlanLimitView {
  id: string;
  planId: string;
  limitKey: string;
  value: number | null;
}

export interface PlatformPlanDetailView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  prices: PlatformPlanPriceView[];
  features: PlatformPlanFeatureView[];
  limits: PlatformPlanLimitView[];
}

