/** Country configuration types — platform admin / Rule Resolver (ARCHITECTURE.md §3, DATABASE_SCHEMA.md §1) */

export type CountryStatus = 'draft' | 'active' | 'retired';

export type StateProvinceStatus = 'active' | 'retired';

export type RuleVersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'superseded'
  | 'archived';

export type CountryRuleKind =
  | 'tax'
  | 'leave'
  | 'ot'
  | 'social_security'
  | 'public_holiday'
  | 'health_safety'
  | 'employment_rules'
  | 'pension'
  | 'working_hours'
  | 'payroll'
  | 'termination'
  | 'compliance';

export interface RuleVersionView {
  id: string;
  countryId: string;
  stateProvinceId?: string | null;
  stateProvinceCode?: string | null;
  ruleType: string;
  version: number;
  status: RuleVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceReference: string;
  changeNote: string;
  createdBy: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleVersionInput {
  ruleType: string;
  stateProvinceId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sourceReference: string;
  changeNote: string;
  payload: Record<string, unknown>;
  status?: RuleVersionStatus;
}

export interface UpdateRuleVersionInput {
  effectiveFrom?: string;
  effectiveTo?: string | null;
  sourceReference?: string;
  changeNote?: string;
  payload?: Record<string, unknown>;
  status?: RuleVersionStatus;
}

export interface RuleVersionMetadataDiff {
  field: string;
  label: string;
  baseValue: string | null;
  compareValue: string | null;
  hasChanged: boolean;
}

export interface RuleVersionPayloadFieldDiff {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  baseValue?: unknown;
  compareValue?: unknown;
}

export interface RuleVersionDiffResult {
  baseVersion: RuleVersionView;
  compareVersion: RuleVersionView;
  metadataDiff: RuleVersionMetadataDiff[];
  payloadDiff: RuleVersionPayloadFieldDiff[];
  stats: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  rawBaseJson: string;
  rawCompareJson: string;
}

export interface StateProvinceView {
  id: string;
  countryId: string;
  name: string;
  code: string;
  status: StateProvinceStatus;
  companiesCount: number;
  tenantsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStateProvinceInput {
  name: string;
  code: string;
  status?: StateProvinceStatus;
}

export interface UpdateStateProvinceInput {
  name?: string;
  code?: string;
  status?: StateProvinceStatus;
}

export interface BulkImportStateItem {
  name: string;
  code: string;
  status?: StateProvinceStatus;
}

export interface BulkImportStatesInput {
  states: BulkImportStateItem[];
}

export interface BulkImportStatesResult {
  createdCount: number;
  updatedCount: number;
  errors: { line?: number; code?: string; message: string }[];
  states: StateProvinceView[];
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
  stateProvinceId?: string | null;
  ruleType: CountryRuleKind;
  version?: number;
  payload: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
  status?: RuleVersionStatus;
  sourceReference?: string;
  changeNote?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
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
