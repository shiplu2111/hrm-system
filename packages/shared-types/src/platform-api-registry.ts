import type { ApiAccessScope, TenantApiKeyStatus, TenantOAuthClientStatus } from './api-access';

export interface PlatformApiKeyItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  name: string;
  prefix: string;
  keyMasked: string;
  scopes: ApiAccessScope[];
  status: TenantApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  callVolume: number;
  createdAt: string;
  createdByName: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
}

export interface RevokePlatformApiKeyInput {
  reason: string;
}

export interface PlatformOAuthClientItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  name: string;
  description: string | null;
  clientId: string;
  redirectUris: string[];
  scopes: ApiAccessScope[];
  status: TenantOAuthClientStatus;
  createdAt: string;
  revokedAt: string | null;
  revokedByName: string | null;
}

export interface RevokePlatformOAuthClientInput {
  reason: string;
}

export interface TenantRateLimitOverrideDetail {
  id: string;
  rateLimitPerMin: number;
  burstLimit: number | null;
  reason: string;
  grantedByUserId: string | null;
  grantedByEmail: string | null;
  grantedByName: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantRateLimitItem {
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  planTier: string;
  defaultRateLimitPerMin: number;
  defaultBurstLimit: number;
  override: TenantRateLimitOverrideDetail | null;
  effectiveRateLimitPerMin: number;
  effectiveBurstLimit: number;
  apiCalls24h: number;
}

export interface SetTenantRateLimitOverrideInput {
  rateLimitPerMin: number;
  burstLimit?: number | null;
  reason: string;
  expiresAt?: string | null;
}

export interface PlatformApiRegistrySummary {
  totalActiveKeys: number;
  totalRevokedKeys: number;
  totalApiCalls30d: number;
  activeRateLimitOverrides: number;
  totalOAuthClients: number;
}

export interface PlatformApiKeyQuery {
  tenantId?: string;
  status?: TenantApiKeyStatus | 'all';
  scope?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PlatformOAuthClientQuery {
  tenantId?: string;
  status?: TenantOAuthClientStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface PlatformRateLimitQuery {
  tenantId?: string;
  hasOverride?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
