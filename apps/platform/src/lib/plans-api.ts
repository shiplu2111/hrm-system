import type {
  PlatformPlanDetailView,
  PlatformPlanFeatureView,
  PlatformPlanPriceView,
} from '@hrm/shared-types';
import { apiRequest } from './api-client';

export interface CreatePlatformPlanInput {
  code: string;
  name: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}

export interface UpdatePlatformPlanInput {
  name?: string;
  code?: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}

export interface UpdatePlanLimitItem {
  limitKey: string;
  value: number | null;
}

export interface UpdatePlanFeatureItem {
  featureKey: string;
  enabled: boolean;
}

export interface CreatePlanPriceInput {
  currency: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  perSeatAmount?: number | null;
  effectiveFrom: string;
}

export async function listPlatformPlans(): Promise<PlatformPlanDetailView[]> {
  return apiRequest<PlatformPlanDetailView[]>('/platform/plans');
}

export async function getPlatformPlan(id: string): Promise<PlatformPlanDetailView> {
  return apiRequest<PlatformPlanDetailView>(`/platform/plans/${id}`);
}

export async function createPlatformPlan(
  data: CreatePlatformPlanInput,
): Promise<PlatformPlanDetailView> {
  return apiRequest<PlatformPlanDetailView>('/platform/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePlatformPlan(
  id: string,
  data: UpdatePlatformPlanInput,
): Promise<PlatformPlanDetailView> {
  return apiRequest<PlatformPlanDetailView>(`/platform/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updatePlanLimits(
  id: string,
  limits: UpdatePlanLimitItem[],
): Promise<PlatformPlanDetailView> {
  return apiRequest<PlatformPlanDetailView>(`/platform/plans/${id}/limits`, {
    method: 'PUT',
    body: JSON.stringify({ limits }),
  });
}

export async function updatePlanFeatures(
  id: string,
  features: UpdatePlanFeatureItem[],
): Promise<PlatformPlanDetailView> {
  return apiRequest<PlatformPlanDetailView>(`/platform/plans/${id}/features`, {
    method: 'PUT',
    body: JSON.stringify({ features }),
  });
}

export async function togglePlanFeature(
  planId: string,
  featureKey: string,
  enabled: boolean,
): Promise<PlatformPlanFeatureView> {
  return apiRequest<PlatformPlanFeatureView>('/platform/plans/features/toggle', {
    method: 'PATCH',
    body: JSON.stringify({ planId, featureKey, enabled }),
  });
}

export async function createPlanPrice(
  planId: string,
  data: CreatePlanPriceInput,
): Promise<PlatformPlanPriceView> {
  return apiRequest<PlatformPlanPriceView>(`/platform/plans/${planId}/prices`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
