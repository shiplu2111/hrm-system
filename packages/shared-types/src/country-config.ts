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
  stateProvinceId?: string | null;
  taxYear: number;
  bracketJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
  status?: RuleVersionStatus;
  sourceReference?: string;
  changeNote?: string;
  createdBy?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Tax Rules & Brackets Framework (§8 DATABASE_SCHEMA.md & §10 PAYROLL_LOGIC.md)
// ---------------------------------------------------------------------------

export interface TaxBracketRow {
  id?: string;
  from: number;
  to: number | null;
  rate: number; // percentage (e.g. 16 for 16%) or decimal (0.16)
  fixedAmount: number; // cumulative base tax for previous brackets
}

export type TaxRebateType = 'fixed_amount' | 'percentage' | 'tapered';

export interface TaxRebateAllowance {
  id: string;
  name: string;
  code: string;
  type: TaxRebateType;
  amount: number;
  threshold?: number | null; // e.g. income phase-out start
  phaseOutRate?: number | null; // e.g. 0.015 (1.5 cents per dollar)
  description?: string;
}

export interface MinimumTaxConfig {
  enabled: boolean;
  amount: number;
  description?: string;
}

export interface FilingStatusTaxConfig {
  statusKey: string;
  label: string;
  brackets: TaxBracketRow[];
  rebates: TaxRebateAllowance[];
  minimumTax: MinimumTaxConfig;
}

export interface TaxRulePayload {
  taxYear: number;
  currency: string;
  hasFilingStatuses: boolean;
  brackets: TaxBracketRow[];
  rebates: TaxRebateAllowance[];
  minimumTax: MinimumTaxConfig;
  filingStatuses?: FilingStatusTaxConfig[];
  notes?: string;
}

export interface TaxBracketValidationError {
  index: number;
  field: 'from' | 'to' | 'rate' | 'fixedAmount' | 'brackets';
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validates bracket rows:
 * - Contiguous: bracket i's 'to' must equal bracket i+1's 'from'
 * - Ascending: 'to' > 'from'
 * - Non-overlapping: no overlapping intervals
 * - Last bracket may be open-ended (to is null)
 * - Only the last bracket may be open-ended
 */
export function validateTaxBrackets(brackets: TaxBracketRow[]): {
  isValid: boolean;
  errors: TaxBracketValidationError[];
  summaryError?: string;
} {
  const errors: TaxBracketValidationError[] = [];

  if (!brackets || brackets.length === 0) {
    return {
      isValid: false,
      errors: [
        {
          index: -1,
          field: 'brackets',
          message: 'At least one tax bracket must be configured.',
          severity: 'error',
        },
      ],
      summaryError: 'At least one tax bracket must be configured.',
    };
  }

  // Bracket 0: from must be non-negative
  if (brackets[0].from < 0) {
    errors.push({
      index: 0,
      field: 'from',
      message: 'The initial bracket must start at 0 or a positive threshold.',
      severity: 'error',
    });
  }

  for (let i = 0; i < brackets.length; i++) {
    const current = brackets[i];
    const isLast = i === brackets.length - 1;

    // Rate validation
    if (current.rate < 0 || current.rate > 100) {
      errors.push({
        index: i,
        field: 'rate',
        message: 'Tax rate must be between 0% and 100%.',
        severity: 'error',
      });
    }

    // Fixed amount non-negative
    if (current.fixedAmount < 0) {
      errors.push({
        index: i,
        field: 'fixedAmount',
        message: 'Fixed base amount cannot be negative.',
        severity: 'error',
      });
    }

    if (!isLast) {
      // Intermediate brackets must have finite 'to'
      if (current.to === null || current.to === undefined || isNaN(current.to)) {
        errors.push({
          index: i,
          field: 'to',
          message: `Intermediate Bracket #${i + 1} must specify an upper bound. Only the final bracket may be open-ended.`,
          severity: 'error',
        });
      } else {
        // Ascending check
        if (current.to <= current.from) {
          errors.push({
            index: i,
            field: 'to',
            message: `Bracket #${i + 1} upper bound (${current.to}) must be greater than lower bound (${current.from}).`,
            severity: 'error',
          });
        }

        // Contiguity and overlap check with next bracket
        const next = brackets[i + 1];
        if (next) {
          if (next.from < current.to) {
            errors.push({
              index: i + 1,
              field: 'from',
              message: `Bracket #${i + 2} starts at ${next.from}, which overlaps with Bracket #${i + 1} (ends at ${current.to}).`,
              severity: 'error',
            });
          } else if (next.from > current.to) {
            errors.push({
              index: i + 1,
              field: 'from',
              message: `Gap detected between Bracket #${i + 1} (ends at ${current.to}) and Bracket #${i + 2} (starts at ${next.from}). Brackets must be contiguous.`,
              severity: 'error',
            });
          }
        }
      }
    } else {
      // Final bracket: if finite 'to' provided, must be > from
      if (current.to !== null && current.to !== undefined && !isNaN(current.to)) {
        if (current.to <= current.from) {
          errors.push({
            index: i,
            field: 'to',
            message: `Final bracket upper bound (${current.to}) must be greater than lower bound (${current.from}).`,
            severity: 'error',
          });
        }
      }
    }
  }

  const isValid = errors.length === 0;
  const summaryError = !isValid
    ? errors[0]?.message || 'Invalid tax bracket configuration.'
    : undefined;

  return { isValid, errors, summaryError };
}

/**
 * Auto-calculates cumulative base/fixed amounts for contiguous brackets.
 */
export function calculateCumulativeFixedAmounts(
  brackets: TaxBracketRow[],
): TaxBracketRow[] {
  let cumulativeTax = 0;
  return brackets.map((b, idx) => {
    if (idx === 0) {
      return { ...b, fixedAmount: 0 };
    }
    const prev = brackets[idx - 1];
    if (prev.to !== null && prev.to !== undefined && prev.to > prev.from) {
      const width = prev.to - prev.from;
      const normalizedRate = prev.rate > 1 ? prev.rate / 100 : prev.rate;
      cumulativeTax += width * normalizedRate;
    }
    return {
      ...b,
      fixedAmount: Math.round(cumulativeTax * 100) / 100,
    };
  });
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
