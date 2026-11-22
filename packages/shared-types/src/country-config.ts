/** Country configuration types — platform admin / Rule Resolver (ARCHITECTURE.md §3, DATABASE_SCHEMA.md §1) */
import type { LeaveAccrualType } from './leave';

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

export type SocialSecurityContributionFrequency =
  | 'monthly'
  | 'per_pay_period'
  | 'quarterly'
  | 'annual'
  | 'weekly'
  | 'biweekly';

export type StatutoryFundCategory =
  | 'pension'
  | 'health'
  | 'unemployment'
  | 'disability'
  | 'accident'
  | 'maternity'
  | 'provident'
  | 'other';

export interface StatutoryFundItem {
  id: string;
  name: string;
  code: string;
  category: StatutoryFundCategory;
  employeeRate: number;
  employerRate: number;
  wageFloor?: number | null;
  wageCeiling?: number | null;
  contributionBase: 'gross' | 'basic';
  preTax: boolean;
  administratorName?: string;
  description?: string;
}

export interface SocialSecurityRulePayload {
  schemeName: string;
  fundCode?: string;
  administratorName?: string;
  registrationNumber?: string;
  contributionFrequency: SocialSecurityContributionFrequency;
  contributionBase: 'gross' | 'basic';
  employerContributionRate: number;
  employeeContributionRate: number;
  employerRate?: number;
  employeeRate?: number;
  superannuationGuaranteeRate?: number;
  wageFloor?: number | null;
  wageCeiling?: number | null;
  exemptBelowFloor?: boolean;
  preTax?: boolean;
  voluntaryContributionAllowed?: boolean;
  voluntaryContributionMaxRate?: number | null;
  hasSubFunds?: boolean;
  funds?: StatutoryFundItem[];
  notes?: string;
}

export function validateSocialSecurityPayload(
  payload: Partial<SocialSecurityRulePayload>,
): {
  isValid: boolean;
  errors: string[];
  summaryError?: string;
} {
  const errors: string[] = [];

  if (!payload.schemeName || !payload.schemeName.trim()) {
    errors.push('Statutory scheme / fund name is required.');
  }

  if (
    typeof payload.employerContributionRate !== 'number' ||
    isNaN(payload.employerContributionRate) ||
    payload.employerContributionRate < 0 ||
    payload.employerContributionRate > 100
  ) {
    errors.push('Employer contribution rate must be a percentage between 0% and 100%.');
  }

  if (
    typeof payload.employeeContributionRate !== 'number' ||
    isNaN(payload.employeeContributionRate) ||
    payload.employeeContributionRate < 0 ||
    payload.employeeContributionRate > 100
  ) {
    errors.push('Employee contribution rate must be a percentage between 0% and 100%.');
  }

  if (
    payload.contributionBase &&
    payload.contributionBase !== 'gross' &&
    payload.contributionBase !== 'basic'
  ) {
    errors.push("Contribution base must be either 'gross' or 'basic'.");
  }

  const validFrequencies: SocialSecurityContributionFrequency[] = [
    'monthly',
    'per_pay_period',
    'quarterly',
    'annual',
    'weekly',
    'biweekly',
  ];
  if (
    payload.contributionFrequency &&
    !validFrequencies.includes(payload.contributionFrequency)
  ) {
    errors.push(
      `Contribution frequency must be one of: ${validFrequencies.join(', ')}.`,
    );
  }

  if (payload.wageFloor !== null && payload.wageFloor !== undefined) {
    if (isNaN(payload.wageFloor) || payload.wageFloor < 0) {
      errors.push('Wage floor must be 0 or a positive monetary threshold.');
    }
  }

  if (payload.wageCeiling !== null && payload.wageCeiling !== undefined) {
    if (isNaN(payload.wageCeiling) || payload.wageCeiling <= 0) {
      errors.push('Wage ceiling must be a positive monetary threshold.');
    }
  }

  if (
    payload.wageFloor !== null &&
    payload.wageFloor !== undefined &&
    payload.wageCeiling !== null &&
    payload.wageCeiling !== undefined
  ) {
    if (payload.wageCeiling < payload.wageFloor) {
      errors.push(
        `Wage ceiling (${payload.wageCeiling}) cannot be less than wage floor (${payload.wageFloor}).`,
      );
    }
  }

  if (
    payload.voluntaryContributionAllowed &&
    payload.voluntaryContributionMaxRate !== null &&
    payload.voluntaryContributionMaxRate !== undefined
  ) {
    if (
      isNaN(payload.voluntaryContributionMaxRate) ||
      payload.voluntaryContributionMaxRate < 0 ||
      payload.voluntaryContributionMaxRate > 100
    ) {
      errors.push(
        'Voluntary contribution maximum rate must be between 0% and 100%.',
      );
    }
  }

  if (Array.isArray(payload.funds)) {
    payload.funds.forEach((fund, idx) => {
      if (!fund.name || !fund.name.trim()) {
        errors.push(`Fund #${idx + 1}: Name is required.`);
      }
      if (!fund.code || !fund.code.trim()) {
        errors.push(`Fund #${idx + 1}: Code is required.`);
      }
      if (
        typeof fund.employeeRate !== 'number' ||
        isNaN(fund.employeeRate) ||
        fund.employeeRate < 0 ||
        fund.employeeRate > 100
      ) {
        errors.push(`Fund #${idx + 1} (${fund.name || 'unnamed'}): Employee rate must be 0%–100%.`);
      }
      if (
        typeof fund.employerRate !== 'number' ||
        isNaN(fund.employerRate) ||
        fund.employerRate < 0 ||
        fund.employerRate > 100
      ) {
        errors.push(`Fund #${idx + 1} (${fund.name || 'unnamed'}): Employer rate must be 0%–100%.`);
      }
      if (
        fund.wageFloor !== null &&
        fund.wageFloor !== undefined &&
        fund.wageCeiling !== null &&
        fund.wageCeiling !== undefined &&
        fund.wageCeiling < fund.wageFloor
      ) {
        errors.push(
          `Fund #${idx + 1} (${fund.name || 'unnamed'}): Ceiling (${fund.wageCeiling}) cannot be less than floor (${fund.wageFloor}).`,
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    summaryError: errors[0],
  };
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

// ============================================================================
// STATUTORY LEAVE RULES (STAGE C.04 - LEGISLATED LEGAL MINIMUMS)
// ============================================================================

export type StatutoryLeaveCategory =
  | 'annual'
  | 'sick'
  | 'maternity'
  | 'paternity'
  | 'compassionate'
  | 'unpaid'
  | 'study'
  | 'other';

export interface StatutoryLeaveRuleItem {
  id: string;
  category: StatutoryLeaveCategory;
  leaveType: string; // identifier/code e.g. 'annual', 'sick', 'maternity'
  name: string; // e.g. 'Annual Leave', 'Personal & Carer\'s Leave'
  isPaid: boolean;
  minimumEntitlementDays: number; // e.g. 20 for annual, 10 for sick
  accrualMethod: LeaveAccrualType; // 'monthly' | 'yearly' | 'on_hire'
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null; // null = uncapped
  carryForwardExpiryMonths: number | null; // null = does not expire
  encashmentAllowed: boolean;
  maxEncashmentDays: number | null; // null = uncapped or not applicable
  proRataApplicable: boolean;
  notes?: string;
}

export interface LeaveRulePayload {
  statutoryLeaves: StatutoryLeaveRuleItem[];
  probationEntitlementRestricted?: boolean;
  allowNegativeBalance?: boolean;
  legalJurisdictionBaseline?: string; // e.g. "Fair Work Act 2009 (NES)"
  notes?: string;
}

export interface CompanyStatutoryLeaveMinimums {
  countryIso: string;
  countryName: string;
  stateCode?: string | null;
  stateName?: string | null;
  statutoryLeaves: StatutoryLeaveRuleItem[];
  baselineReference?: string;
}

/**
 * Validate statutory leave rule payload.
 * Ensures non-negative entitlements, valid accrual methods, and valid statutory sub-rules.
 */
export function validateLeaveRulePayload(payload: unknown): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summaryError?: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      errors: ['Leave rules payload must be an object.'],
      warnings: [],
      summaryError: 'Leave rules payload must be an object.',
    };
  }

  const p = payload as Partial<LeaveRulePayload> & Record<string, unknown>;

  let leaves = p.statutoryLeaves;
  if (!Array.isArray(leaves) || leaves.length === 0) {
    if (
      typeof p.annual_leave_days === 'number' ||
      typeof p.annualLeaveDays === 'number' ||
      typeof p.sick_leave_days === 'number' ||
      typeof p.sickLeaveDays === 'number'
    ) {
      leaves = normalizeLegacyLeavePayload(p, 'GEN');
    }
  }

  if (!Array.isArray(leaves) || leaves.length === 0) {
    errors.push('At least one statutory leave type must be configured.');
    return {
      isValid: false,
      errors,
      warnings,
      summaryError: errors[0],
    };
  }

  const validCategories: StatutoryLeaveCategory[] = [
    'annual',
    'sick',
    'maternity',
    'paternity',
    'compassionate',
    'unpaid',
    'study',
    'other',
  ];

  const validAccrualMethods: LeaveAccrualType[] = ['monthly', 'yearly', 'on_hire'];

  leaves.forEach((leave, idx) => {
    const label = leave.name ? `"${leave.name}"` : `Leave type #${idx + 1}`;

    if (!leave.name || !leave.name.trim()) {
      errors.push(`${label}: Name is required.`);
    }

    if (!leave.category || !validCategories.includes(leave.category)) {
      errors.push(`${label}: Valid statutory category is required.`);
    }

    if (
      typeof leave.minimumEntitlementDays !== 'number' ||
      isNaN(leave.minimumEntitlementDays) ||
      leave.minimumEntitlementDays < 0
    ) {
      errors.push(`${label}: Minimum entitlement must be 0 or more days.`);
    }

    if (!leave.accrualMethod || !validAccrualMethods.includes(leave.accrualMethod)) {
      errors.push(`${label}: Accrual method must be 'monthly', 'yearly', or 'on_hire'.`);
    }

    if (
      leave.maxCarryForwardDays !== null &&
      leave.maxCarryForwardDays !== undefined &&
      (typeof leave.maxCarryForwardDays !== 'number' ||
        isNaN(leave.maxCarryForwardDays) ||
        leave.maxCarryForwardDays < 0)
    ) {
      errors.push(`${label}: Maximum carry forward days cannot be negative.`);
    }

    if (
      leave.carryForwardExpiryMonths !== null &&
      leave.carryForwardExpiryMonths !== undefined &&
      (typeof leave.carryForwardExpiryMonths !== 'number' ||
        isNaN(leave.carryForwardExpiryMonths) ||
        leave.carryForwardExpiryMonths < 1)
    ) {
      errors.push(`${label}: Carry forward expiry months must be at least 1 month.`);
    }

    if (
      leave.maxEncashmentDays !== null &&
      leave.maxEncashmentDays !== undefined &&
      (typeof leave.maxEncashmentDays !== 'number' ||
        isNaN(leave.maxEncashmentDays) ||
        leave.maxEncashmentDays < 0)
    ) {
      errors.push(`${label}: Maximum encashment days cannot be negative.`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summaryError: errors[0],
  };
}

/**
 * Default statutory leaves for recognized countries (e.g. Australia Fair Work NES).
 */
export function getDefaultStatutoryLeavesForCountry(countryIso: string): StatutoryLeaveRuleItem[] {
  if (countryIso === 'AUS') {
    return [
      {
        id: 'stat-aus-annual',
        category: 'annual',
        leaveType: 'annual',
        name: 'Annual Leave',
        isPaid: true,
        minimumEntitlementDays: 20, // 4 weeks
        accrualMethod: 'monthly',
        carryForwardAllowed: true,
        maxCarryForwardDays: null,
        carryForwardExpiryMonths: null,
        encashmentAllowed: true,
        maxEncashmentDays: 10,
        proRataApplicable: true,
        notes: 'Fair Work Act 2009 (NES) §87: 4 weeks paid annual leave for full-time employees.',
      },
      {
        id: 'stat-aus-sick',
        category: 'sick',
        leaveType: 'sick',
        name: 'Sick & Carer\'s Leave',
        isPaid: true,
        minimumEntitlementDays: 10, // 10 days
        accrualMethod: 'monthly',
        carryForwardAllowed: true,
        maxCarryForwardDays: null,
        carryForwardExpiryMonths: null,
        encashmentAllowed: false,
        maxEncashmentDays: null,
        proRataApplicable: true,
        notes: 'Fair Work Act 2009 (NES) §96: 10 days paid personal/carer\'s leave. Cashing out prohibited unless permitted by modern award.',
      },
      {
        id: 'stat-aus-maternity',
        category: 'maternity',
        leaveType: 'maternity',
        name: 'Maternity Leave',
        isPaid: true,
        minimumEntitlementDays: 84, // 12 weeks
        accrualMethod: 'on_hire',
        carryForwardAllowed: false,
        maxCarryForwardDays: null,
        carryForwardExpiryMonths: null,
        encashmentAllowed: false,
        maxEncashmentDays: null,
        proRataApplicable: false,
        notes: 'Fair Work Act 2009 (NES) §70: Parental leave entitlement (up to 52 weeks statutory leave entitlement).',
      },
      {
        id: 'stat-aus-paternity',
        category: 'paternity',
        leaveType: 'paternity',
        name: 'Paternity / Partner Leave',
        isPaid: true,
        minimumEntitlementDays: 10, // 2 weeks
        accrualMethod: 'on_hire',
        carryForwardAllowed: false,
        maxCarryForwardDays: null,
        carryForwardExpiryMonths: null,
        encashmentAllowed: false,
        maxEncashmentDays: null,
        proRataApplicable: false,
        notes: 'Fair Work Act 2009 (NES) §70 & Australian Government Paid Parental Leave scheme.',
      },
      {
        id: 'stat-aus-compassionate',
        category: 'compassionate',
        leaveType: 'compassionate',
        name: 'Compassionate Leave',
        isPaid: true,
        minimumEntitlementDays: 2, // 2 days per occasion
        accrualMethod: 'on_hire',
        carryForwardAllowed: false,
        maxCarryForwardDays: null,
        carryForwardExpiryMonths: null,
        encashmentAllowed: false,
        maxEncashmentDays: null,
        proRataApplicable: false,
        notes: 'Fair Work Act 2009 (NES) §104: 2 days paid compassionate leave per permissible occasion.',
      },
    ];
  }

  // Standard generic statutory baseline
  return [
    {
      id: 'stat-gen-annual',
      category: 'annual',
      leaveType: 'annual',
      name: 'Annual Leave',
      isPaid: true,
      minimumEntitlementDays: 14,
      accrualMethod: 'monthly',
      carryForwardAllowed: true,
      maxCarryForwardDays: 5,
      carryForwardExpiryMonths: 12,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      proRataApplicable: true,
      notes: 'Standard statutory vacation leave baseline.',
    },
    {
      id: 'stat-gen-sick',
      category: 'sick',
      leaveType: 'sick',
      name: 'Sick Leave',
      isPaid: true,
      minimumEntitlementDays: 7,
      accrualMethod: 'monthly',
      carryForwardAllowed: false,
      maxCarryForwardDays: null,
      carryForwardExpiryMonths: null,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      proRataApplicable: true,
      notes: 'Standard statutory medical sick leave.',
    },
    {
      id: 'stat-gen-maternity',
      category: 'maternity',
      leaveType: 'maternity',
      name: 'Maternity Leave',
      isPaid: true,
      minimumEntitlementDays: 60,
      accrualMethod: 'on_hire',
      carryForwardAllowed: false,
      maxCarryForwardDays: null,
      carryForwardExpiryMonths: null,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      proRataApplicable: false,
      notes: 'Statutory maternity leave protection.',
    },
    {
      id: 'stat-gen-paternity',
      category: 'paternity',
      leaveType: 'paternity',
      name: 'Paternity Leave',
      isPaid: true,
      minimumEntitlementDays: 5,
      accrualMethod: 'on_hire',
      carryForwardAllowed: false,
      maxCarryForwardDays: null,
      carryForwardExpiryMonths: null,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      proRataApplicable: false,
      notes: 'Statutory paternity leave.',
    },
    {
      id: 'stat-gen-compassionate',
      category: 'compassionate',
      leaveType: 'compassionate',
      name: 'Compassionate Leave',
      isPaid: true,
      minimumEntitlementDays: 2,
      accrualMethod: 'on_hire',
      carryForwardAllowed: false,
      maxCarryForwardDays: null,
      carryForwardExpiryMonths: null,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      proRataApplicable: false,
      notes: 'Statutory bereavement / compassionate leave.',
    },
  ];
}

/**
 * Gracefully normalizes legacy leave rule payloads to the structured StatutoryLeaveRuleItem format.
 */
export function normalizeLegacyLeavePayload(
  rawPayload: Record<string, unknown>,
  countryIso: string,
): StatutoryLeaveRuleItem[] {
  if (Array.isArray(rawPayload.statutoryLeaves) && rawPayload.statutoryLeaves.length > 0) {
    return rawPayload.statutoryLeaves as StatutoryLeaveRuleItem[];
  }

  const defaults = getDefaultStatutoryLeavesForCountry(countryIso);

  const annualDays =
    typeof rawPayload.annual_leave_days === 'number'
      ? rawPayload.annual_leave_days
      : typeof rawPayload.annualLeaveDays === 'number'
      ? rawPayload.annualLeaveDays
      : null;

  const sickDays =
    typeof rawPayload.sick_leave_days === 'number'
      ? rawPayload.sick_leave_days
      : typeof rawPayload.sickLeaveDays === 'number'
      ? rawPayload.sickLeaveDays
      : null;

  const parentalWeeks =
    typeof rawPayload.parental_leave_weeks === 'number'
      ? rawPayload.parental_leave_weeks
      : typeof rawPayload.parentalLeaveWeeks === 'number'
      ? rawPayload.parentalLeaveWeeks
      : null;

  return defaults.map((item) => {
    if (item.category === 'annual' && annualDays !== null) {
      return { ...item, minimumEntitlementDays: annualDays };
    }
    if (item.category === 'sick' && sickDays !== null) {
      return { ...item, minimumEntitlementDays: sickDays };
    }
    if (item.category === 'maternity' && parentalWeeks !== null) {
      return { ...item, minimumEntitlementDays: parentalWeeks * 7 };
    }
    return item;
  });
}

/**
 * Fuzzy matches a company leave type name (e.g. "Annual Leave", "Personal/Carer", "Vacation")
 * to a standard statutory leave category.
 */
export function matchLeaveTypeToCategory(typeName: string): StatutoryLeaveCategory | null {
  const norm = typeName.trim().toLowerCase();
  if (
    norm.includes('annual') ||
    norm.includes('vacation') ||
    norm.includes('holiday') ||
    norm.includes('recreational')
  ) {
    return 'annual';
  }
  if (
    norm.includes('sick') ||
    norm.includes('carer') ||
    norm.includes('personal') ||
    norm.includes('medical') ||
    norm.includes('illness')
  ) {
    return 'sick';
  }
  if (norm.includes('maternity')) {
    return 'maternity';
  }
  if (norm.includes('paternity') || norm.includes('parental') || norm.includes('partner')) {
    return 'paternity';
  }
  if (
    norm.includes('compassionate') ||
    norm.includes('bereavement') ||
    norm.includes('mourning') ||
    norm.includes('funeral')
  ) {
    return 'compassionate';
  }
  if (norm.includes('unpaid') || norm.includes('lwop')) {
    return 'unpaid';
  }
  if (norm.includes('study') || norm.includes('exam') || norm.includes('training')) {
    return 'study';
  }
  return null;
}

export interface LeavePolicyComplianceViolation {
  field: 'entitlementDays' | 'carryForward' | 'encashment';
  severity: 'warning' | 'error';
  message: string;
  statutoryRuleName: string;
  statutoryMinimum: string | number | boolean;
  tenantConfigured: string | number | boolean;
}

export interface LeavePolicyComplianceResult {
  isCompliant: boolean;
  matchedStatutoryRule?: StatutoryLeaveRuleItem;
  violations: LeavePolicyComplianceViolation[];
}

/**
 * Evaluates a tenant company's leave policy against the statutory minimum baseline.
 * Tenants may exceed statutory minimums, but warning flags are raised when falling below.
 */
export function evaluateLeavePolicyCompliance(
  policy: {
    entitlementDays: number;
    carryForwardEnabled?: boolean;
    carryForwardMax?: number | null;
    encashmentAllowed?: boolean;
  },
  statutoryRule?: StatutoryLeaveRuleItem,
): LeavePolicyComplianceResult {
  if (!statutoryRule) {
    return { isCompliant: true, violations: [] };
  }

  const violations: LeavePolicyComplianceViolation[] = [];

  // 1. Legal Minimum Entitlement Check (Tenants may exceed, but not go below)
  if (policy.entitlementDays < statutoryRule.minimumEntitlementDays) {
    violations.push({
      field: 'entitlementDays',
      severity: 'warning',
      message: `Configured entitlement of ${policy.entitlementDays} days is below the statutory legal minimum of ${statutoryRule.minimumEntitlementDays} days for ${statutoryRule.name}.`,
      statutoryRuleName: statutoryRule.name,
      statutoryMinimum: statutoryRule.minimumEntitlementDays,
      tenantConfigured: policy.entitlementDays,
    });
  }

  // 2. Mandatory Carry-Forward Check
  if (
    statutoryRule.carryForwardAllowed &&
    policy.carryForwardEnabled === false &&
    statutoryRule.minimumEntitlementDays > 0
  ) {
    violations.push({
      field: 'carryForward',
      severity: 'warning',
      message: `${statutoryRule.name} legally entitles employees to carry-forward unused balances, but carry-forward is currently disabled in this policy.`,
      statutoryRuleName: statutoryRule.name,
      statutoryMinimum: true,
      tenantConfigured: false,
    });
  }

  // 3. Encashment Prohibition Check
  if (!statutoryRule.encashmentAllowed && policy.encashmentAllowed) {
    violations.push({
      field: 'encashment',
      severity: 'warning',
      message: `Statutory regulation strictly prohibits cashing out / encashment of ${statutoryRule.name}.`,
      statutoryRuleName: statutoryRule.name,
      statutoryMinimum: false,
      tenantConfigured: true,
    });
  }

  return {
    isCompliant: violations.length === 0,
    matchedStatutoryRule: statutoryRule,
    violations,
  };
}
