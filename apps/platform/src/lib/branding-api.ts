import type {
  ApiResponse as ApiEnvelope,
  DisableCustomDomainInput,
  TenantBrandingView,
  UpdateTenantBrandingInput,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1';

async function platformRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & {
    error?: { message?: string; code?: string };
    message?: string;
  };

  if (!response.ok) {
    const errorMsg =
      body.error?.message ||
      (typeof body.message === 'string' ? body.message : null) ||
      `HTTP error ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return (body.data !== undefined ? body.data : (body as unknown)) as T;
}

/**
 * Fetch branding and custom domain details for a tenant.
 */
export async function getTenantBranding(tenantId: string): Promise<TenantBrandingView> {
  return platformRequest<TenantBrandingView>(`/platform/tenants/${tenantId}/branding`);
}

/**
 * Update tenant branding (colors, logo, title, custom domain).
 */
export async function updateTenantBranding(
  tenantId: string,
  input: UpdateTenantBrandingInput,
): Promise<TenantBrandingView> {
  return platformRequest<TenantBrandingView>(`/platform/tenants/${tenantId}/branding`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/**
 * Re-check DNS records for custom domain.
 */
export async function verifyTenantCustomDomain(
  tenantId: string,
): Promise<VerifyCustomDomainResult> {
  return platformRequest<VerifyCustomDomainResult>(
    `/platform/tenants/${tenantId}/custom-domain/verify`,
    {
      method: 'POST',
    },
  );
}

/**
 * Disable custom domain with audited justification reason.
 */
export async function disableTenantCustomDomain(
  tenantId: string,
  input: DisableCustomDomainInput,
): Promise<TenantBrandingView> {
  return platformRequest<TenantBrandingView>(
    `/platform/tenants/${tenantId}/custom-domain/disable`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

/**
 * Re-enable a disabled custom domain.
 */
export async function reEnableTenantCustomDomain(
  tenantId: string,
): Promise<TenantBrandingView> {
  return platformRequest<TenantBrandingView>(
    `/platform/tenants/${tenantId}/custom-domain/re-enable`,
    {
      method: 'POST',
    },
  );
}
