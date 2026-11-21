import type {
  CreatePlatformFeatureFlagRequest,
  FeatureEvaluationResult,
  FlagTenantOverrideDetailView,
  PlatformFeatureFlagDetailView,
  PlatformFeatureFlagView,
  SetTenantFeatureOverrideRequest,
  TenantFeatureOverrideView,
  UpdatePlatformFeatureFlagRequest,
} from '@hrm/shared-types';
import { apiRequest } from './api-client';

export async function listFeatureFlags(): Promise<PlatformFeatureFlagView[]> {
  return apiRequest<PlatformFeatureFlagView[]>('/platform/feature-flags');
}

export async function getFeatureFlag(key: string): Promise<PlatformFeatureFlagView> {
  return apiRequest<PlatformFeatureFlagView>(`/platform/feature-flags/${key}`);
}

export async function getFeatureFlagDetail(
  key: string,
): Promise<PlatformFeatureFlagDetailView> {
  return apiRequest<PlatformFeatureFlagDetailView>(`/platform/feature-flags/${key}/detail`);
}

export async function listFlagOverrides(
  key: string,
): Promise<FlagTenantOverrideDetailView[]> {
  return apiRequest<FlagTenantOverrideDetailView[]>(`/platform/feature-flags/${key}/overrides`);
}

export async function createFeatureFlag(
  data: CreatePlatformFeatureFlagRequest,
): Promise<PlatformFeatureFlagView> {
  return apiRequest<PlatformFeatureFlagView>('/platform/feature-flags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFeatureFlag(
  key: string,
  data: UpdatePlatformFeatureFlagRequest,
): Promise<PlatformFeatureFlagView> {
  return apiRequest<PlatformFeatureFlagView>(`/platform/feature-flags/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteFeatureFlag(key: string): Promise<void> {
  return apiRequest<void>(`/platform/feature-flags/${key}`, {
    method: 'DELETE',
  });
}

export async function evaluateFeatureFlag(
  key: string,
  tenantId: string,
): Promise<FeatureEvaluationResult> {
  return apiRequest<FeatureEvaluationResult>(`/platform/feature-flags/${key}/evaluate/${tenantId}`);
}

export async function listTenantFeatureOverrides(
  tenantId: string,
): Promise<TenantFeatureOverrideView[]> {
  return apiRequest<TenantFeatureOverrideView[]>(`/platform/tenants/${tenantId}/feature-overrides`);
}

export async function setTenantFeatureOverride(
  tenantId: string,
  data: SetTenantFeatureOverrideRequest,
): Promise<TenantFeatureOverrideView> {
  return apiRequest<TenantFeatureOverrideView>(`/platform/tenants/${tenantId}/feature-overrides`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeTenantFeatureOverride(
  tenantId: string,
  key: string,
): Promise<void> {
  return apiRequest<void>(`/platform/tenants/${tenantId}/feature-overrides/${key}`, {
    method: 'DELETE',
  });
}
