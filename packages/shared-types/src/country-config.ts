/** Country configuration types — platform admin / Rule Resolver (ARCHITECTURE.md §3) */

export type CountryRuleKind =
  | 'leave'
  | 'ot'
  | 'social_security'
  | 'public_holiday';

export interface CountrySummary {
  id: string;
  name: string;
  isoCode: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  tenantCount: number;
  lastRuleUpdate: string | null;
}

export interface TaxBracketRecord {
  id: string;
  countryId: string;
  taxYear: number;
  bracketJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CountryRuleRecord {
  id: string;
  countryId: string;
  ruleType: CountryRuleKind;
  payload: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CountryConfiguration {
  country: Omit<CountrySummary, 'tenantCount' | 'lastRuleUpdate'>;
  taxBrackets: TaxBracketRecord[];
  rules: CountryRuleRecord[];
}

export interface PublicHolidayEntry {
  name: string;
  date: string;
  observed?: string | null;
  recurring?: boolean;
  notes?: string;
}
