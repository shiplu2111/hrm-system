import { apiRequest } from './api-client';
import type {
  AvailableTenantLanguage,
  CreateLanguagePackInput,
  ImportTranslationsInput,
  ImportTranslationsResult,
  MissingKeysReport,
  PlatformLanguagePackDetail,
  PlatformLanguagePackSummary,
  UpdateLanguagePackInput,
} from '@hrm/shared-types';

/**
 * List all supported language packs with translation completeness
 */
export function listPlatformLanguagePacks(query?: {
  availableOnly?: boolean;
  search?: string;
}): Promise<PlatformLanguagePackSummary[]> {
  const params = new URLSearchParams();
  if (query?.availableOnly) {
    params.set('availableOnly', 'true');
  }
  if (query?.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<PlatformLanguagePackSummary[]>(`/platform/language-packs${qs}`);
}

/**
 * Get details and full translations of a specific language pack
 */
export function getPlatformLanguagePack(
  code: string,
): Promise<PlatformLanguagePackDetail> {
  return apiRequest<PlatformLanguagePackDetail>(
    `/platform/language-packs/${encodeURIComponent(code)}`,
  );
}

/**
 * Generate a missing-keys report comparing against baseline reference language (en)
 */
export function getPlatformMissingKeysReport(
  code: string,
): Promise<MissingKeysReport> {
  return apiRequest<MissingKeysReport>(
    `/platform/language-packs/${encodeURIComponent(code)}/missing-keys`,
  );
}

/**
 * Export translation catalog as JSON
 */
export async function exportPlatformLanguagePack(
  code: string,
  format: 'nested' | 'flat' | 'missing-template' = 'nested',
): Promise<{ filename: string; jsonContent: string }> {
  const res = await fetch(
    `/api/v1/platform/language-packs/${encodeURIComponent(code)}/export?format=${format}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('hrm_platform_access_token') || ''}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to export translation catalog (${res.status})`);
  }

  const contentDisposition = res.headers.get('Content-Disposition') || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `${code}-translations.json`;
  const jsonContent = await res.text();

  return { filename, jsonContent };
}

/**
 * Import a translation file (JSON)
 */
export function importPlatformLanguagePack(
  code: string,
  input: ImportTranslationsInput,
): Promise<ImportTranslationsResult> {
  return apiRequest<ImportTranslationsResult>(
    `/platform/language-packs/${encodeURIComponent(code)}/import`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

/**
 * Mark a language as available or unavailable to tenants
 */
export function setPlatformLanguageAvailability(
  code: string,
  isAvailableToTenants: boolean,
  reason?: string,
): Promise<PlatformLanguagePackSummary> {
  return apiRequest<PlatformLanguagePackSummary>(
    `/platform/language-packs/${encodeURIComponent(code)}/availability`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isAvailableToTenants, reason }),
    },
  );
}

/**
 * Register a new supported language pack
 */
export function createPlatformLanguagePack(
  input: CreateLanguagePackInput,
): Promise<PlatformLanguagePackDetail> {
  return apiRequest<PlatformLanguagePackDetail>('/platform/language-packs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update language pack metadata
 */
export function updatePlatformLanguagePack(
  code: string,
  input: UpdateLanguagePackInput,
): Promise<PlatformLanguagePackSummary> {
  return apiRequest<PlatformLanguagePackSummary>(
    `/platform/language-packs/${encodeURIComponent(code)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

/**
 * List language packs marked available for tenant selection
 */
export function listAvailableTenantLanguages(): Promise<AvailableTenantLanguage[]> {
  return apiRequest<AvailableTenantLanguage[]>(
    '/platform/language-packs/available-for-tenants',
  );
}
