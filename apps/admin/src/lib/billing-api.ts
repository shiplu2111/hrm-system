import type { TenantSubscriptionView } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getSubscription(): Promise<TenantSubscriptionView | null> {
  return tenantApiRequest<TenantSubscriptionView | null>('/tenant/subscription');
}
