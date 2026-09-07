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

export interface TenantPlanInfo {
  planId: SubscriptionPlanTier;
  features: EnterpriseFeature[];
  apiAccessEnabled: boolean;
}
