import type {
  CompanyLocalizationView,
  LocalizationSettingsOverview,
  MyLocalization,
  UiLanguage,
  UpdateLocalizationInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getLocalizationOverview(): Promise<LocalizationSettingsOverview> {
  return tenantApiRequest<LocalizationSettingsOverview>('/tenant/localization');
}

export function updateCompanyLocalization(
  companyId: string,
  input: UpdateLocalizationInput,
): Promise<CompanyLocalizationView> {
  return tenantApiRequest<CompanyLocalizationView>(`/tenant/localization/companies/${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateBranchLocalization(
  locationId: string,
  input: UpdateLocalizationInput,
): Promise<CompanyLocalizationView> {
  return tenantApiRequest<CompanyLocalizationView>(`/tenant/localization/branches/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function companyQuery(companyId?: string | null): string {
  return companyId ? `?${new URLSearchParams({ companyId }).toString()}` : '';
}

export function getMyLocalization(companyId?: string | null): Promise<MyLocalization> {
  return tenantApiRequest<MyLocalization>(`/me/localization${companyQuery(companyId)}`);
}

export function updateMyLanguage(language: UiLanguage | null, companyId?: string | null): Promise<MyLocalization> {
  return tenantApiRequest<MyLocalization>(`/me/localization${companyQuery(companyId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  });
}
