import type {
  CustomDomainView,
  TenantBrandingView,
  UpdateTenantBrandingInput,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getTenantBranding(): Promise<TenantBrandingView> {
  return tenantApiRequest<TenantBrandingView>('/branding');
}

export function updateTenantBranding(
  input: UpdateTenantBrandingInput,
): Promise<TenantBrandingView> {
  return tenantApiRequest<TenantBrandingView>('/branding', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listCustomDomains(): Promise<CustomDomainView[]> {
  return tenantApiRequest<CustomDomainView[]>('/custom-domains');
}

export function createCustomDomain(domain: string): Promise<CustomDomainView> {
  return tenantApiRequest<CustomDomainView>('/custom-domains', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
}

export function verifyCustomDomain(
  id: string,
): Promise<VerifyCustomDomainResult> {
  return tenantApiRequest<VerifyCustomDomainResult>(
    `/custom-domains/${id}/verify`,
    {
      method: 'POST',
    },
  );
}

export function deleteCustomDomain(id: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(`/custom-domains/${id}`, {
    method: 'DELETE',
  });
}
