import type {
  BulkImportStatesInput,
  BulkImportStatesResult,
  CountryConfigStatusView,
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountryStatus,
  CountrySummary,
  CreateRuleVersionInput,
  CreateStateProvinceInput,
  RuleVersionDiffResult,
  RuleVersionStatus,
  RuleVersionView,
  StateProvinceView,
  TaxBracketRecord,
  UpdateRuleVersionInput,
  UpdateStateProvinceInput,
} from '@hrm/shared-types';
import { apiRequest } from './api-client';

export function listCountries(): Promise<CountrySummary[]> {
  return apiRequest<CountrySummary[]>('/platform/countries');
}

export function getCountryConfiguration(
  countryId: string,
): Promise<CountryConfiguration> {
  return apiRequest<CountryConfiguration>(
    `/platform/countries/${countryId}/configuration`,
  );
}

export function getCountryConfigStatus(
  countryId: string,
): Promise<CountryConfigStatusView> {
  return apiRequest<CountryConfigStatusView>(
    `/platform/countries/${countryId}/config-status`,
  );
}

export function createCountry(input: {
  name: string;
  isoCode: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat?: string;
  defaultFinancialYearStart?: string;
  defaultPayFrequency?: string;
  status?: CountryStatus;
}): Promise<CountrySummary> {
  return apiRequest<CountrySummary>('/platform/countries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCountry(
  countryId: string,
  input: {
    name?: string;
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
    defaultFinancialYearStart?: string;
    defaultPayFrequency?: string;
    status?: CountryStatus;
  },
): Promise<CountrySummary> {
  return apiRequest<CountrySummary>(`/platform/countries/${countryId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listStates(countryId: string): Promise<StateProvinceView[]> {
  return apiRequest<StateProvinceView[]>(
    `/platform/countries/${countryId}/states`,
  );
}

export function createState(
  countryId: string,
  input: CreateStateProvinceInput,
): Promise<StateProvinceView> {
  return apiRequest<StateProvinceView>(
    `/platform/countries/${countryId}/states`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateState(
  countryId: string,
  stateId: string,
  input: UpdateStateProvinceInput,
): Promise<StateProvinceView> {
  return apiRequest<StateProvinceView>(
    `/platform/countries/${countryId}/states/${stateId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function bulkImportStates(
  countryId: string,
  input: BulkImportStatesInput,
): Promise<BulkImportStatesResult> {
  return apiRequest<BulkImportStatesResult>(
    `/platform/countries/${countryId}/states/bulk-import`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function deleteState(
  countryId: string,
  stateId: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(
    `/platform/countries/${countryId}/states/${stateId}`,
    {
      method: 'DELETE',
    },
  );
}

export function updateTaxBracket(
  countryId: string,
  bracketId: string,
  input: {
    taxYear: number;
    bracketJson: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  },
): Promise<TaxBracketRecord> {
  return apiRequest<TaxBracketRecord>(
    `/platform/countries/${countryId}/tax-brackets/${bracketId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function createTaxBracket(
  countryId: string,
  input: {
    taxYear: number;
    bracketJson: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  },
): Promise<TaxBracketRecord> {
  return apiRequest<TaxBracketRecord>(
    `/platform/countries/${countryId}/tax-brackets`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function createCountryRule(
  countryId: string,
  input: {
    ruleType: CountryRuleKind;
    payload: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo?: string;
  },
): Promise<CountryRuleRecord> {
  return apiRequest<CountryRuleRecord>(
    `/platform/countries/${countryId}/rules`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateCountryRule(
  countryId: string,
  ruleId: string,
  input: {
    payload?: Record<string, unknown>;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  },
): Promise<CountryRuleRecord> {
  return apiRequest<CountryRuleRecord>(
    `/platform/countries/${countryId}/rules/${ruleId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

// --- RuleVersion Framework API ---

export function listRuleVersions(
  countryId: string,
  query?: {
    ruleType?: string;
    stateProvinceId?: string | null;
    status?: RuleVersionStatus;
  },
): Promise<RuleVersionView[]> {
  const params = new URLSearchParams();
  if (query?.ruleType) params.set('ruleType', query.ruleType);
  if (query?.stateProvinceId !== undefined) {
    params.set(
      'stateProvinceId',
      query.stateProvinceId === null ? '' : query.stateProvinceId,
    );
  }
  if (query?.status) params.set('status', query.status);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<RuleVersionView[]>(
    `/platform/countries/${countryId}/rule-versions${qs}`,
  );
}

export function getRuleVersion(
  countryId: string,
  versionId: string,
): Promise<RuleVersionView> {
  return apiRequest<RuleVersionView>(
    `/platform/countries/${countryId}/rule-versions/${versionId}`,
  );
}

export function createRuleVersion(
  countryId: string,
  input: CreateRuleVersionInput,
): Promise<RuleVersionView> {
  return apiRequest<RuleVersionView>(
    `/platform/countries/${countryId}/rule-versions`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateRuleVersion(
  countryId: string,
  versionId: string,
  input: UpdateRuleVersionInput,
): Promise<RuleVersionView> {
  return apiRequest<RuleVersionView>(
    `/platform/countries/${countryId}/rule-versions/${versionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function publishRuleVersion(
  countryId: string,
  versionId: string,
): Promise<RuleVersionView> {
  return apiRequest<RuleVersionView>(
    `/platform/countries/${countryId}/rule-versions/${versionId}/publish`,
    {
      method: 'POST',
    },
  );
}

export function deleteRuleVersion(
  countryId: string,
  versionId: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(
    `/platform/countries/${countryId}/rule-versions/${versionId}`,
    {
      method: 'DELETE',
    },
  );
}

export function compareRuleVersions(
  countryId: string,
  baseVersionId: string,
  compareVersionId: string,
): Promise<RuleVersionDiffResult> {
  return apiRequest<RuleVersionDiffResult>(
    `/platform/countries/${countryId}/rule-versions/diff?baseVersionId=${encodeURIComponent(
      baseVersionId,
    )}&compareVersionId=${encodeURIComponent(compareVersionId)}`,
  );
}
