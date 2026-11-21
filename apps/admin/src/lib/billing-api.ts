import type {
  PlanChangePreview,
  PlanChangeResult,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getSubscription(): Promise<TenantSubscriptionView | null> {
  return tenantApiRequest<TenantSubscriptionView | null>('/tenant/subscription');
}

export function previewPlanChange(targetPlanCode: string): Promise<PlanChangePreview> {
  return tenantApiRequest<PlanChangePreview>(
    `/tenant/subscription/plan-change-preview?targetPlanCode=${encodeURIComponent(targetPlanCode)}`,
  );
}

export function executePlanChange(targetPlanCode: string): Promise<PlanChangeResult> {
  return tenantApiRequest<PlanChangeResult>('/tenant/subscription/change-plan', {
    method: 'POST',
    body: JSON.stringify({ targetPlanCode }),
  });
}

