import { SetMetadata } from '@nestjs/common';
import type { EnterpriseFeature } from '@hrm/shared-types';

export const ENTERPRISE_FEATURE_KEY = 'enterpriseFeature';

/** Gate endpoint to tenants on a plan that includes the feature (BILLING_SUBSCRIPTION.md §3). */
export const RequireEnterpriseFeature = (feature: EnterpriseFeature) =>
  SetMetadata(ENTERPRISE_FEATURE_KEY, feature);
