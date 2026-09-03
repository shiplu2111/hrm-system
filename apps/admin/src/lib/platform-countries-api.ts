import type {
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountrySummary,
  TaxBracketRecord,
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

export function createCountry(input: {
  name: string;
  isoCode: string;
  currency: string;
  timezone: string;
  dateFormat: string;
}): Promise<CountrySummary> {
  return apiRequest<CountrySummary>('/platform/countries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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
