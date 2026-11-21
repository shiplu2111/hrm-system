import type {
  PlatformApplyDiscountRequest,
  PlatformCancelSubscriptionRequest,
  PlatformChangePlanRequest,
  PlatformExtendTrialRequest,
  PlatformPauseSubscriptionRequest,
  PlatformSubscriptionDetailView,
  PlatformSubscriptionListItem,
} from '@hrm/shared-types';
import { apiRequest } from './api-client';

export interface QuerySubscriptionsParams {
  status?: string;
  search?: string;
  planId?: string;
}

export async function listPlatformSubscriptions(
  params?: QuerySubscriptionsParams,
): Promise<PlatformSubscriptionListItem[]> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== 'All') q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.planId && params.planId !== 'All') q.set('planId', params.planId);

  const qs = q.toString();
  return apiRequest<PlatformSubscriptionListItem[]>(
    `/platform/subscriptions${qs ? `?${qs}` : ''}`,
  );
}

export async function getPlatformSubscription(
  id: string,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}`,
  );
}

export async function changeSubscriptionPlan(
  id: string,
  dto: PlatformChangePlanRequest,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/change-plan`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function extendSubscriptionTrial(
  id: string,
  dto: PlatformExtendTrialRequest,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/extend-trial`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function applySubscriptionDiscountOrCredit(
  id: string,
  dto: PlatformApplyDiscountRequest,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/discount`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function pauseSubscription(
  id: string,
  dto: PlatformPauseSubscriptionRequest,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/pause`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function resumeSubscription(
  id: string,
  dto?: { reason?: string },
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/resume`,
    {
      method: 'POST',
      body: JSON.stringify(dto ?? {}),
    },
  );
}

export async function cancelSubscription(
  id: string,
  dto: PlatformCancelSubscriptionRequest,
): Promise<PlatformSubscriptionDetailView> {
  return apiRequest<PlatformSubscriptionDetailView>(
    `/platform/subscriptions/${id}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}
