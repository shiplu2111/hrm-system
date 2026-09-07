import type {
  ApiAccessScope,
  ApiAccessStatus,
  CreateTenantApiKeyResult,
  CreateTenantOAuthClientResult,
  TenantApiKeyRecord,
  TenantOAuthClientRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getApiAccessStatus(): Promise<ApiAccessStatus> {
  return tenantApiRequest<ApiAccessStatus>('/tenant/api-access/status');
}

export function listTenantApiKeys(): Promise<TenantApiKeyRecord[]> {
  return tenantApiRequest<TenantApiKeyRecord[]>('/tenant/api-keys');
}

export function createTenantApiKey(input: {
  name: string;
  scopes: ApiAccessScope[];
  expiresAt?: string;
}): Promise<CreateTenantApiKeyResult> {
  return tenantApiRequest<CreateTenantApiKeyResult>('/tenant/api-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function revokeTenantApiKey(keyId: string): Promise<TenantApiKeyRecord> {
  return tenantApiRequest<TenantApiKeyRecord>(`/tenant/api-keys/${keyId}`, {
    method: 'DELETE',
  });
}

export function listTenantOAuthClients(): Promise<TenantOAuthClientRecord[]> {
  return tenantApiRequest<TenantOAuthClientRecord[]>('/tenant/oauth-clients');
}

export function createTenantOAuthClient(input: {
  name: string;
  description?: string;
  redirectUris: string[];
  scopes: ApiAccessScope[];
}): Promise<CreateTenantOAuthClientResult> {
  return tenantApiRequest<CreateTenantOAuthClientResult>('/tenant/oauth-clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function revokeTenantOAuthClient(
  clientId: string,
): Promise<TenantOAuthClientRecord> {
  return tenantApiRequest<TenantOAuthClientRecord>(
    `/tenant/oauth-clients/${clientId}`,
    { method: 'DELETE' },
  );
}
