/** Country configuration types — platform admin / Rule Resolver (ARCHITECTURE.md §3, DATABASE_SCHEMA.md §1) */

export type CountryStatus = 'draft' | 'active' | 'retired';

export type RuleVersionStatus = 'draft' | 'published' | 'archived';

export type CountryRuleKind =
  | 'tax'
  | 'leave'
  | 'ot'
  | 'social_security'
  | 'public_holiday'
  | 'health_safety'
  | 'employment_rules';

export interface StateProvinceView {
  id: string;
  countryId: string;
  name: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStateProvinceInput {
  name: string;
  code: string;
}

export interface CountryConfigCategoryStatus {
  category: CountryRuleKind;
  label: string;
  required: boolean;
  complete: boolean;
  ruleCount: number;
  latestEffectiveFrom?: string | null;
  status?: RuleVersionStatus;
}

export interface CountryConfigStatusSummary {
  isReadyForActivation: boolean;
  completedRequiredCount: number;
  totalRequiredCount: number;
  missingCategories: string[];
}

export interface CountryConfigStatusView {
  countryId: string;
  countryName: string;
  isoCode: string;
  status: CountryStatus;
  isReadyForActivation: boolean;
  missingCategories: string[];
  categories: CountryConfigCategoryStatus[];
}

export interface CountrySummary {
  id: string;
  name: string;
  isoCode: string;
  currency: string;
  timezone: string;
  defaultTimezone?: string;
  dateFormat: string;
  numberFormat: string;
  defaultFinancialYearStart: string;
  defaultPayFrequency: string;
  status: CountryStatus;
  tenantCount: number;
  statesCount?: number;
  lastRuleUpdate: string | null;
  configStatus?: CountryConfigStatusSummary;
}

export interface TaxBracketRecord {
  id: string;
  countryId: string;
  taxYear: number;
  bracketJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
  status?: RuleVersionStatus;
}

export interface CountryRuleRecord {
  id: string;
  countryId: string;
  ruleType: CountryRuleKind;
  payload: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
  status?: RuleVersionStatus;
}

export interface CountryConfiguration {
  country: Omit<CountrySummary, 'tenantCount' | 'lastRuleUpdate' | 'configStatus'>;
  taxBrackets: TaxBracketRecord[];
  rules: CountryRuleRecord[];
  states?: StateProvinceView[];
  configStatus?: CountryConfigStatusView;
}

export interface PublicHolidayEntry {
  name: string;
  date: string;
  observed?: string | null;
  recurring?: boolean;
  notes?: string;
}
