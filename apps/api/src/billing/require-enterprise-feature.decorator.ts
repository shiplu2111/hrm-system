import { SetMetadata } from '@nestjs/common';
import type { EnterpriseFeature, PlanFeatureKey } from '@hrm/shared-types';

export const ENTERPRISE_FEATURE_KEY = 'enterpriseFeature';
export const FEATURE_KEY = ENTERPRISE_FEATURE_KEY;

/** Gate endpoint to tenants on a plan that includes the feature (BILLING_SUBSCRIPTION.md §3). */
export const RequireEnterpriseFeature = (feature: EnterpriseFeature | string) =>
  SetMetadata(ENTERPRISE_FEATURE_KEY, feature);

export const RequireFeature = (feature: PlanFeatureKey | string) =>
  SetMetadata(FEATURE_KEY, feature);
