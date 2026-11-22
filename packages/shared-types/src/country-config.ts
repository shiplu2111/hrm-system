/** Country configuration types — platform admin / Rule Resolver (ARCHITECTURE.md §3, DATABASE_SCHEMA.md §1) */
import type { LeaveAccrualType } from './leave';

export type CountryStatus = 'draft' | 'active' | 'retired';

export type StateProvinceStatus = 'active' | 'retired';

export type RuleVersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'superseded'
  | 'archived'
  | 'rejected';

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
  submittedBy?: string | null;
  submittedAt?: string | null;
  submissionNote?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
}

export interface SubmitRuleVersionInput {
  submissionNote?: string;
}

export interface PublishRuleVersionInput {
  confirmBackdated?: boolean;
  backdatedReason?: string;
  approvalNote?: string;
}

export interface RejectRuleVersionInput {
  reason: string;
}

export interface AffectedPayrollTenantCompanySummary {
  companyId: string;
  companyName: string;
  affectedRunsCount: number;
  affectedEmployeesCount: number;
}

export interface AffectedPayrollTenantSummary {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  companies: AffectedPayrollTenantCompanySummary[];
  totalAffectedRuns: number;
}

export interface RuleVersionPayrollImpact {
  isBackdated: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  calculationDate: string;
  affectedFinalizedPayrollRunsCount: number;
  affectedTenantsCount: number;
  affectedCompaniesCount: number;
  tenants: AffectedPayrollTenantSummary[];
  warning: string | null;
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

// ---------------------------------------------------------------------------
// OVERTIME & WORKING HOURS RULES (STAGE C.05 & C.06)
// ATTENDANCE_LOGIC.md §4 & PAYROLL_LOGIC.md §9
// ---------------------------------------------------------------------------

/**
 * Overtime cap breach behavior.
 * PAYROLL_LOGIC.md §9: "Maximum OT caps are enforced at calculation time and any breach is flagged, not silently capped, unless the company policy explicitly says to auto-cap."
 */
export type OvertimeCapBreachAction = 'flag' | 'auto_cap';

/**
 * Structured Working Hours & Overtime rule payload.
 * Used by Rule Resolver for ATTENDANCE_LOGIC.md §4 and PAYROLL_LOGIC.md §9.
 */
export interface WorkingHoursOtRulePayload {
  // 1. Standard Working Hours & Ceilings
  standardDailyHours: number;          // e.g. 7.6 or 8.0
  standardWeeklyHours: number;         // e.g. 38.0 or 40.0
  maxDailyHours: number;              // e.g. 10.0 or 12.0
  maxWeeklyHours: number;             // e.g. 48.0 or 60.0
  maxConsecutiveDays: number;         // e.g. 6

  // 2. Minimum Break Rules & Rest Periods
  restBreakRequiredAfterHours: number; // e.g. 5.0
  minimumRestBreakMinutes: number;     // e.g. 30
  dailyRestPeriodHours: number;        // e.g. 11.0 (minimum rest between shifts)
  paidBreakMinutes?: number | null;    // e.g. 10 or 15

  // 3. Overtime Multipliers
  weekdayMultiplier: number;           // e.g. 1.50
  enableWeekdayTiers?: boolean;
  weekdayTier1HoursCap?: number | null;// e.g. 2.0 (hours at tier 1 before tier 2 kicks in)
  weekdayTier2Multiplier?: number | null; // e.g. 2.00

  weekendMultiplier: number;           // e.g. 2.00
  separateSaturdaySunday?: boolean;
  saturdayMultiplier?: number | null;  // e.g. 1.50
  sundayMultiplier?: number | null;    // e.g. 2.00

  holidayMultiplier: number;           // e.g. 2.50

  nightMultiplier: number;             // e.g. 1.15
  nightShiftWindowStart: string;       // e.g. "18:00"
  nightShiftWindowEnd: string;         // e.g. "06:00"

  // 4. Overtime Caps & Breach Handling (PAYROLL_LOGIC.md §9)
  maxDailyOvertimeHours?: number | null;
  maxWeeklyOvertimeHours?: number | null;
  maxMonthlyOvertimeHours?: number | null;
  actionOnCapBreach: OvertimeCapBreachAction; // 'flag' | 'auto_cap'

  // 5. Governance & General Options
  requireManagerApproval?: boolean;
  timeOffInLieuAllowed?: boolean;
  notes?: string;
}

export interface WorkingHoursOtValidationResult {
  isValid: boolean;
  errors: string[];
  summaryError?: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates a Working Hours & Overtime rule payload with comprehensive inline rules.
 */
export function validateWorkingHoursOtPayload(
  payload: unknown,
): WorkingHoursOtValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      errors: ['Working hours and overtime payload must be a non-empty object.'],
      summaryError: 'Working hours and overtime payload must be a non-empty object.',
    };
  }

  const p = payload as Partial<WorkingHoursOtRulePayload>;

  // 1. Standard Working Hours
  if (p.standardDailyHours === undefined || p.standardDailyHours === null || typeof p.standardDailyHours !== 'number' || isNaN(p.standardDailyHours)) {
    errors.push('Standard daily hours is required and must be a valid number.');
  } else if (p.standardDailyHours <= 0 || p.standardDailyHours > 24) {
    errors.push('Standard daily hours must be greater than 0 and at most 24.');
  }

  if (p.standardWeeklyHours === undefined || p.standardWeeklyHours === null || typeof p.standardWeeklyHours !== 'number' || isNaN(p.standardWeeklyHours)) {
    errors.push('Standard weekly hours is required and must be a valid number.');
  } else if (p.standardWeeklyHours <= 0 || p.standardWeeklyHours > 168) {
    errors.push('Standard weekly hours must be greater than 0 and at most 168.');
  }

  // Ceilings
  if (p.maxDailyHours !== undefined && p.maxDailyHours !== null) {
    if (typeof p.maxDailyHours !== 'number' || isNaN(p.maxDailyHours) || p.maxDailyHours < (p.standardDailyHours ?? 0)) {
      errors.push(`Maximum daily hours (${p.maxDailyHours}) must be greater than or equal to standard daily hours (${p.standardDailyHours}).`);
    } else if (p.maxDailyHours > 24) {
      errors.push('Maximum daily hours cannot exceed 24 hours.');
    }
  }

  if (p.maxWeeklyHours !== undefined && p.maxWeeklyHours !== null) {
    if (typeof p.maxWeeklyHours !== 'number' || isNaN(p.maxWeeklyHours) || p.maxWeeklyHours < (p.standardWeeklyHours ?? 0)) {
      errors.push(`Maximum weekly hours (${p.maxWeeklyHours}) must be greater than or equal to standard weekly hours (${p.standardWeeklyHours}).`);
    } else if (p.maxWeeklyHours > 168) {
      errors.push('Maximum weekly hours cannot exceed 168 hours.');
    }
  }

  if (p.maxConsecutiveDays !== undefined && p.maxConsecutiveDays !== null) {
    if (typeof p.maxConsecutiveDays !== 'number' || p.maxConsecutiveDays < 1 || p.maxConsecutiveDays > 14) {
      errors.push('Maximum consecutive working days must be between 1 and 14 days.');
    }
  }

  // 2. Break Rules
  if (p.restBreakRequiredAfterHours !== undefined && p.restBreakRequiredAfterHours !== null) {
    if (typeof p.restBreakRequiredAfterHours !== 'number' || p.restBreakRequiredAfterHours <= 0) {
      errors.push('Rest break trigger hours must be greater than 0.');
    } else if (p.standardDailyHours && p.restBreakRequiredAfterHours > p.standardDailyHours) {
      errors.push(`Rest break required after hours (${p.restBreakRequiredAfterHours}h) cannot exceed standard daily hours (${p.standardDailyHours}h).`);
    }
  }

  if (p.minimumRestBreakMinutes !== undefined && p.minimumRestBreakMinutes !== null) {
    if (typeof p.minimumRestBreakMinutes !== 'number' || p.minimumRestBreakMinutes < 0 || p.minimumRestBreakMinutes > 240) {
      errors.push('Minimum rest break duration must be between 0 and 240 minutes.');
    }
  }

  if (p.dailyRestPeriodHours !== undefined && p.dailyRestPeriodHours !== null) {
    if (typeof p.dailyRestPeriodHours !== 'number' || p.dailyRestPeriodHours < 0 || p.dailyRestPeriodHours > 24) {
      errors.push('Daily rest period between shifts must be between 0 and 24 hours.');
    }
  }

  // 3. Multipliers
  if (p.weekdayMultiplier === undefined || p.weekdayMultiplier === null || typeof p.weekdayMultiplier !== 'number' || isNaN(p.weekdayMultiplier)) {
    errors.push('Weekday overtime multiplier is required and must be a valid number.');
  } else if (p.weekdayMultiplier < 1.0 || p.weekdayMultiplier > 10.0) {
    errors.push('Weekday overtime multiplier must be between 1.0× and 10.0×.');
  }

  if (p.enableWeekdayTiers) {
    if (p.weekdayTier1HoursCap === undefined || p.weekdayTier1HoursCap === null || p.weekdayTier1HoursCap <= 0) {
      errors.push('When weekday overtime tiers are enabled, Tier 1 hours cap must be greater than 0.');
    }
    if (p.weekdayTier2Multiplier === undefined || p.weekdayTier2Multiplier === null || p.weekdayTier2Multiplier < (p.weekdayMultiplier ?? 1)) {
      errors.push(`Tier 2 overtime multiplier (${p.weekdayTier2Multiplier}×) must be greater than or equal to Tier 1 multiplier (${p.weekdayMultiplier}×).`);
    }
  }

  if (p.weekendMultiplier === undefined || p.weekendMultiplier === null || typeof p.weekendMultiplier !== 'number' || isNaN(p.weekendMultiplier)) {
    errors.push('Weekend overtime multiplier is required and must be a valid number.');
  } else if (p.weekendMultiplier < 1.0 || p.weekendMultiplier > 10.0) {
    errors.push('Weekend overtime multiplier must be between 1.0× and 10.0×.');
  }

  if (p.separateSaturdaySunday) {
    if (p.saturdayMultiplier !== undefined && p.saturdayMultiplier !== null && (p.saturdayMultiplier < 1.0 || p.saturdayMultiplier > 10.0)) {
      errors.push('Saturday overtime multiplier must be between 1.0× and 10.0×.');
    }
    if (p.sundayMultiplier !== undefined && p.sundayMultiplier !== null && (p.sundayMultiplier < 1.0 || p.sundayMultiplier > 10.0)) {
      errors.push('Sunday overtime multiplier must be between 1.0× and 10.0×.');
    }
  }

  if (p.holidayMultiplier === undefined || p.holidayMultiplier === null || typeof p.holidayMultiplier !== 'number' || isNaN(p.holidayMultiplier)) {
    errors.push('Public holiday overtime multiplier is required and must be a valid number.');
  } else if (p.holidayMultiplier < 1.0 || p.holidayMultiplier > 10.0) {
    errors.push('Public holiday overtime multiplier must be between 1.0× and 10.0×.');
  }

  if (p.nightMultiplier === undefined || p.nightMultiplier === null || typeof p.nightMultiplier !== 'number' || isNaN(p.nightMultiplier)) {
    errors.push('Night shift multiplier is required and must be a valid number.');
  } else if (p.nightMultiplier < 1.0 || p.nightMultiplier > 10.0) {
    errors.push('Night shift multiplier must be between 1.0× and 10.0×.');
  }

  if (p.nightShiftWindowStart && !TIME_REGEX.test(p.nightShiftWindowStart)) {
    errors.push('Night shift window start must be in HH:mm 24-hour format (e.g. 18:00 or 22:00).');
  }
  if (p.nightShiftWindowEnd && !TIME_REGEX.test(p.nightShiftWindowEnd)) {
    errors.push('Night shift window end must be in HH:mm 24-hour format (e.g. 06:00).');
  }

  // 4. Overtime Caps
  if (p.maxDailyOvertimeHours !== undefined && p.maxDailyOvertimeHours !== null && p.maxDailyOvertimeHours < 0) {
    errors.push('Maximum daily overtime hours cannot be negative.');
  }
  if (p.maxWeeklyOvertimeHours !== undefined && p.maxWeeklyOvertimeHours !== null && p.maxWeeklyOvertimeHours < 0) {
    errors.push('Maximum weekly overtime hours cannot be negative.');
  }
  if (p.maxMonthlyOvertimeHours !== undefined && p.maxMonthlyOvertimeHours !== null && p.maxMonthlyOvertimeHours < 0) {
    errors.push('Maximum monthly overtime hours cannot be negative.');
  }

  if (p.actionOnCapBreach !== undefined && p.actionOnCapBreach !== 'flag' && p.actionOnCapBreach !== 'auto_cap') {
    errors.push("Action on cap breach must be either 'flag' or 'auto_cap' (PAYROLL_LOGIC.md §9).");
  }

  return {
    isValid: errors.length === 0,
    errors,
    summaryError: errors[0],
  };
}

/**
 * Returns default statutory working hours & overtime rules for a specific jurisdiction.
 */
export function getDefaultWorkingHoursOtForCountry(countryIso?: string): WorkingHoursOtRulePayload {
  const iso = (countryIso || '').trim().toUpperCase();

  if (iso === 'AUS') {
    return {
      standardDailyHours: 7.6,
      standardWeeklyHours: 38,
      maxDailyHours: 10,
      maxWeeklyHours: 48,
      maxConsecutiveDays: 6,
      restBreakRequiredAfterHours: 5,
      minimumRestBreakMinutes: 30,
      dailyRestPeriodHours: 11,
      paidBreakMinutes: 10,
      weekdayMultiplier: 1.5,
      enableWeekdayTiers: true,
      weekdayTier1HoursCap: 2,
      weekdayTier2Multiplier: 2.0,
      weekendMultiplier: 2.0,
      separateSaturdaySunday: true,
      saturdayMultiplier: 1.5,
      sundayMultiplier: 2.0,
      holidayMultiplier: 2.5,
      nightMultiplier: 1.15,
      nightShiftWindowStart: '18:00',
      nightShiftWindowEnd: '06:00',
      maxDailyOvertimeHours: 4,
      maxWeeklyOvertimeHours: 12,
      maxMonthlyOvertimeHours: 50,
      actionOnCapBreach: 'flag',
      requireManagerApproval: true,
      timeOffInLieuAllowed: true,
      notes: 'Fair Work Act 2009 (NES §62): 38-hour standard week. Modern award baseline: 1.5× first 2 hours overtime, 2.0× thereafter. 2.5× public holidays. 11h minimum rest break between shifts.',
    };
  }

  if (iso === 'BGD') {
    return {
      standardDailyHours: 8,
      standardWeeklyHours: 48,
      maxDailyHours: 10,
      maxWeeklyHours: 60,
      maxConsecutiveDays: 6,
      restBreakRequiredAfterHours: 6,
      minimumRestBreakMinutes: 60,
      dailyRestPeriodHours: 11,
      paidBreakMinutes: 0,
      weekdayMultiplier: 2.0,
      enableWeekdayTiers: false,
      weekdayTier1HoursCap: null,
      weekdayTier2Multiplier: null,
      weekendMultiplier: 2.0,
      separateSaturdaySunday: false,
      saturdayMultiplier: 2.0,
      sundayMultiplier: 2.0,
      holidayMultiplier: 2.5,
      nightMultiplier: 1.25,
      nightShiftWindowStart: '20:00',
      nightShiftWindowEnd: '06:00',
      maxDailyOvertimeHours: 2,
      maxWeeklyOvertimeHours: 12,
      maxMonthlyOvertimeHours: 48,
      actionOnCapBreach: 'flag',
      requireManagerApproval: true,
      timeOffInLieuAllowed: false,
      notes: 'Bangladesh Labor Act 2006 (§100, §102, §108): 48 hours standard weekly work. Overtime payable at double the ordinary basic wage rate (2.0×). Maximum 60 total weekly hours.',
    };
  }

  if (iso === 'USA') {
    return {
      standardDailyHours: 8,
      standardWeeklyHours: 40,
      maxDailyHours: 12,
      maxWeeklyHours: 60,
      maxConsecutiveDays: 6,
      restBreakRequiredAfterHours: 5,
      minimumRestBreakMinutes: 30,
      dailyRestPeriodHours: 8,
      paidBreakMinutes: 15,
      weekdayMultiplier: 1.5,
      enableWeekdayTiers: false,
      weekdayTier1HoursCap: null,
      weekdayTier2Multiplier: null,
      weekendMultiplier: 1.5,
      separateSaturdaySunday: false,
      saturdayMultiplier: 1.5,
      sundayMultiplier: 1.5,
      holidayMultiplier: 2.0,
      nightMultiplier: 1.10,
      nightShiftWindowStart: '22:00',
      nightShiftWindowEnd: '06:00',
      maxDailyOvertimeHours: 6,
      maxWeeklyOvertimeHours: 20,
      maxMonthlyOvertimeHours: 80,
      actionOnCapBreach: 'flag',
      requireManagerApproval: true,
      timeOffInLieuAllowed: true,
      notes: 'US Fair Labor Standards Act (FLSA): Overtime at 1.5× for hours exceeding 40 per workweek.',
    };
  }

  if (iso === 'GBR') {
    return {
      standardDailyHours: 7.5,
      standardWeeklyHours: 37.5,
      maxDailyHours: 10,
      maxWeeklyHours: 48,
      maxConsecutiveDays: 6,
      restBreakRequiredAfterHours: 6,
      minimumRestBreakMinutes: 20,
      dailyRestPeriodHours: 11,
      paidBreakMinutes: 0,
      weekdayMultiplier: 1.5,
      enableWeekdayTiers: false,
      weekdayTier1HoursCap: null,
      weekdayTier2Multiplier: null,
      weekendMultiplier: 1.5,
      separateSaturdaySunday: true,
      saturdayMultiplier: 1.5,
      sundayMultiplier: 2.0,
      holidayMultiplier: 2.0,
      nightMultiplier: 1.20,
      nightShiftWindowStart: '23:00',
      nightShiftWindowEnd: '06:00',
      maxDailyOvertimeHours: 4,
      maxWeeklyOvertimeHours: 12,
      maxMonthlyOvertimeHours: 48,
      actionOnCapBreach: 'flag',
      requireManagerApproval: true,
      timeOffInLieuAllowed: true,
      notes: 'UK Working Time Regulations 1998: Maximum 48-hour average work week, 11 hours consecutive daily rest, 20m in-work rest break for 6+ hour shifts.',
    };
  }

  // Default international baseline
  return {
    standardDailyHours: 8,
    standardWeeklyHours: 40,
    maxDailyHours: 12,
    maxWeeklyHours: 48,
    maxConsecutiveDays: 6,
    restBreakRequiredAfterHours: 5,
    minimumRestBreakMinutes: 30,
    dailyRestPeriodHours: 11,
    paidBreakMinutes: 0,
    weekdayMultiplier: 1.5,
    enableWeekdayTiers: false,
    weekdayTier1HoursCap: null,
    weekdayTier2Multiplier: null,
    weekendMultiplier: 2.0,
    separateSaturdaySunday: false,
    saturdayMultiplier: 2.0,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    nightMultiplier: 1.15,
    nightShiftWindowStart: '22:00',
    nightShiftWindowEnd: '06:00',
    maxDailyOvertimeHours: 4,
    maxWeeklyOvertimeHours: 16,
    maxMonthlyOvertimeHours: 60,
    actionOnCapBreach: 'flag',
    requireManagerApproval: true,
    timeOffInLieuAllowed: true,
    notes: 'Standard statutory baseline: 40h standard week, 1.5× weekday overtime, 2.0× weekend and holiday overtime, action on cap breach flagged.',
  };
}

/**
 * Normalizes legacy and loosely-structured payloads into the strict WorkingHoursOtRulePayload format.
 */
export function normalizeWorkingHoursOtPayload(
  raw: Record<string, unknown> | null | undefined,
  countryIso?: string,
): WorkingHoursOtRulePayload {
  const defaults = getDefaultWorkingHoursOtForCountry(countryIso);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const rawMultipliers = (raw.multipliers as Record<string, unknown>) || {};

  const standardDaily =
    typeof raw.standardDailyHours === 'number'
      ? raw.standardDailyHours
      : typeof raw.standard_daily_hours === 'number'
      ? raw.standard_daily_hours
      : typeof raw.daily_hours === 'number'
      ? raw.daily_hours
      : defaults.standardDailyHours;

  const standardWeekly =
    typeof raw.standardWeeklyHours === 'number'
      ? raw.standardWeeklyHours
      : typeof raw.standard_weekly_hours === 'number'
      ? raw.standard_weekly_hours
      : typeof raw.weeklyThresholdHours === 'number'
      ? raw.weeklyThresholdHours
      : typeof raw.weekly_hours === 'number'
      ? raw.weekly_hours
      : defaults.standardWeeklyHours;

  const maxDaily =
    typeof raw.maxDailyHours === 'number'
      ? raw.maxDailyHours
      : typeof raw.max_daily_hours === 'number'
      ? raw.max_daily_hours
      : typeof raw.maxDailyMinutes === 'number'
      ? raw.maxDailyMinutes / 60
      : defaults.maxDailyHours;

  const maxWeekly =
    typeof raw.maxWeeklyHours === 'number'
      ? raw.maxWeeklyHours
      : typeof raw.max_weekly_hours === 'number'
      ? raw.max_weekly_hours
      : defaults.maxWeeklyHours;

  const weekdayMult =
    typeof raw.weekdayMultiplier === 'number'
      ? raw.weekdayMultiplier
      : typeof rawMultipliers.weekday === 'number'
      ? rawMultipliers.weekday
      : typeof raw.overtime_rate_tier1 === 'number'
      ? raw.overtime_rate_tier1
      : defaults.weekdayMultiplier;

  const weekendMult =
    typeof raw.weekendMultiplier === 'number'
      ? raw.weekendMultiplier
      : typeof rawMultipliers.weekend === 'number'
      ? rawMultipliers.weekend
      : typeof raw.weekend_multiplier === 'number'
      ? raw.weekend_multiplier
      : defaults.weekendMultiplier;

  const holidayMult =
    typeof raw.holidayMultiplier === 'number'
      ? raw.holidayMultiplier
      : typeof rawMultipliers.publicHoliday === 'number'
      ? rawMultipliers.publicHoliday
      : typeof raw.holiday_multiplier === 'number'
      ? raw.holiday_multiplier
      : defaults.holidayMultiplier;

  const nightMult =
    typeof raw.nightMultiplier === 'number'
      ? raw.nightMultiplier
      : typeof rawMultipliers.night === 'number'
      ? rawMultipliers.night
      : typeof raw.night_multiplier === 'number'
      ? raw.night_multiplier
      : defaults.nightMultiplier;

  const actionOnBreach: OvertimeCapBreachAction =
    raw.actionOnCapBreach === 'auto_cap' ? 'auto_cap' : 'flag';

  return {
    standardDailyHours: Number(standardDaily) || defaults.standardDailyHours,
    standardWeeklyHours: Number(standardWeekly) || defaults.standardWeeklyHours,
    maxDailyHours: Number(maxDaily) || defaults.maxDailyHours,
    maxWeeklyHours: Number(maxWeekly) || defaults.maxWeeklyHours,
    maxConsecutiveDays: typeof raw.maxConsecutiveDays === 'number' ? raw.maxConsecutiveDays : defaults.maxConsecutiveDays,

    restBreakRequiredAfterHours:
      typeof raw.restBreakRequiredAfterHours === 'number'
        ? raw.restBreakRequiredAfterHours
        : typeof raw.break_after_hours === 'number'
        ? raw.break_after_hours
        : defaults.restBreakRequiredAfterHours,
    minimumRestBreakMinutes:
      typeof raw.minimumRestBreakMinutes === 'number'
        ? raw.minimumRestBreakMinutes
        : typeof raw.min_break_minutes === 'number'
        ? raw.min_break_minutes
        : defaults.minimumRestBreakMinutes,
    dailyRestPeriodHours:
      typeof raw.dailyRestPeriodHours === 'number'
        ? raw.dailyRestPeriodHours
        : typeof raw.daily_rest_hours === 'number'
        ? raw.daily_rest_hours
        : defaults.dailyRestPeriodHours,
    paidBreakMinutes:
      typeof raw.paidBreakMinutes === 'number'
        ? raw.paidBreakMinutes
        : defaults.paidBreakMinutes,

    weekdayMultiplier: Number(weekdayMult) || defaults.weekdayMultiplier,
    enableWeekdayTiers:
      typeof raw.enableWeekdayTiers === 'boolean'
        ? raw.enableWeekdayTiers
        : typeof raw.overtime_rate_tier2 === 'number',
    weekdayTier1HoursCap:
      typeof raw.weekdayTier1HoursCap === 'number'
        ? raw.weekdayTier1HoursCap
        : typeof raw.overtime_tier1_hours_cap === 'number'
        ? raw.overtime_tier1_hours_cap
        : defaults.weekdayTier1HoursCap,
    weekdayTier2Multiplier:
      typeof raw.weekdayTier2Multiplier === 'number'
        ? raw.weekdayTier2Multiplier
        : typeof raw.overtime_rate_tier2 === 'number'
        ? raw.overtime_rate_tier2
        : defaults.weekdayTier2Multiplier,

    weekendMultiplier: Number(weekendMult) || defaults.weekendMultiplier,
    separateSaturdaySunday:
      typeof raw.separateSaturdaySunday === 'boolean'
        ? raw.separateSaturdaySunday
        : defaults.separateSaturdaySunday,
    saturdayMultiplier:
      typeof raw.saturdayMultiplier === 'number'
        ? raw.saturdayMultiplier
        : defaults.saturdayMultiplier,
    sundayMultiplier:
      typeof raw.sundayMultiplier === 'number'
        ? raw.sundayMultiplier
        : defaults.sundayMultiplier,

    holidayMultiplier: Number(holidayMult) || defaults.holidayMultiplier,

    nightMultiplier: Number(nightMult) || defaults.nightMultiplier,
    nightShiftWindowStart:
      typeof raw.nightShiftWindowStart === 'string' && TIME_REGEX.test(raw.nightShiftWindowStart)
        ? raw.nightShiftWindowStart
        : defaults.nightShiftWindowStart,
    nightShiftWindowEnd:
      typeof raw.nightShiftWindowEnd === 'string' && TIME_REGEX.test(raw.nightShiftWindowEnd)
        ? raw.nightShiftWindowEnd
        : defaults.nightShiftWindowEnd,

    maxDailyOvertimeHours:
      typeof raw.maxDailyOvertimeHours === 'number'
        ? raw.maxDailyOvertimeHours
        : defaults.maxDailyOvertimeHours,
    maxWeeklyOvertimeHours:
      typeof raw.maxWeeklyOvertimeHours === 'number'
        ? raw.maxWeeklyOvertimeHours
        : defaults.maxWeeklyOvertimeHours,
    maxMonthlyOvertimeHours:
      typeof raw.maxMonthlyOvertimeHours === 'number'
        ? raw.maxMonthlyOvertimeHours
        : defaults.maxMonthlyOvertimeHours,
    actionOnCapBreach: actionOnBreach,

    requireManagerApproval:
      typeof raw.requireManagerApproval === 'boolean'
        ? raw.requireManagerApproval
        : defaults.requireManagerApproval,
    timeOffInLieuAllowed:
      typeof raw.timeOffInLieuAllowed === 'boolean'
        ? raw.timeOffInLieuAllowed
        : defaults.timeOffInLieuAllowed,
    notes: typeof raw.notes === 'string' ? raw.notes : defaults.notes,
  };
}

/**
 * Pure calculation helper evaluating overtime hours and pay multipliers according to
 * ATTENDANCE_LOGIC.md §4 and PAYROLL_LOGIC.md §9.
 */
export interface OvertimeCalculationInput {
  workedHours: number;
  dayType?: 'weekday' | 'saturday' | 'sunday' | 'holiday';
  nightHours?: number;
  scheduledStandardHours?: number;
}

export interface OvertimeCalculationResult {
  standardHours: number;
  regularOvertimeHours: number;
  tier1OvertimeHours: number;
  tier2OvertimeHours: number;
  overtimeHoursBeforeCap: number;
  overtimeHoursPayable: number;
  cappedHours: number;
  isCapBreached: boolean;
  capBreachMessage?: string;
  effectiveMultiplier: number;
  equivalentRegularHours: number;
  nightHoursPayable: number;
  nightRateMultiplier: number;
}

export function calculateOvertimePayBreakdown(
  input: OvertimeCalculationInput,
  rules: WorkingHoursOtRulePayload,
): OvertimeCalculationResult {
  const scheduledStandard = input.scheduledStandardHours ?? rules.standardDailyHours;
  const standardHours = Math.min(input.workedHours, scheduledStandard);
  const overtimeHoursRaw = Math.max(0, input.workedHours - standardHours);

  let overtimeHoursPayable = overtimeHoursRaw;
  let cappedHours = 0;
  let isCapBreached = false;
  let capBreachMessage: string | undefined;

  const dailyCap = rules.maxDailyOvertimeHours;
  if (dailyCap !== null && dailyCap !== undefined && overtimeHoursRaw > dailyCap) {
    isCapBreached = true;
    if (rules.actionOnCapBreach === 'auto_cap') {
      cappedHours = overtimeHoursRaw - dailyCap;
      overtimeHoursPayable = dailyCap;
      capBreachMessage = `Overtime automatically capped at daily limit of ${dailyCap}h (${cappedHours}h removed).`;
    } else {
      capBreachMessage = `Overtime breach flagged: ${overtimeHoursRaw}h worked exceeds daily limit of ${dailyCap}h. Sent for supervisor review.`;
    }
  }

  const dayType = input.dayType || 'weekday';
  let tier1OT = 0;
  let tier2OT = 0;
  let baseOtMultiplier = rules.weekdayMultiplier;

  if (dayType === 'holiday') {
    baseOtMultiplier = rules.holidayMultiplier;
    tier1OT = overtimeHoursPayable;
  } else if (dayType === 'saturday') {
    baseOtMultiplier = rules.separateSaturdaySunday && rules.saturdayMultiplier
      ? rules.saturdayMultiplier
      : rules.weekendMultiplier;
    tier1OT = overtimeHoursPayable;
  } else if (dayType === 'sunday') {
    baseOtMultiplier = rules.separateSaturdaySunday && rules.sundayMultiplier
      ? rules.sundayMultiplier
      : rules.weekendMultiplier;
    tier1OT = overtimeHoursPayable;
  } else {
    // Weekday overtime tiers
    if (rules.enableWeekdayTiers && rules.weekdayTier1HoursCap && rules.weekdayTier2Multiplier) {
      const tier1Cap = rules.weekdayTier1HoursCap;
      tier1OT = Math.min(overtimeHoursPayable, tier1Cap);
      tier2OT = Math.max(0, overtimeHoursPayable - tier1Cap);
    } else {
      tier1OT = overtimeHoursPayable;
      tier2OT = 0;
    }
  }

  // Calculate equivalent regular hours:
  // standard hours × 1.0 + tier1 × rate1 + tier2 × rate2 + night loading
  const tier1Rate = dayType === 'weekday' ? rules.weekdayMultiplier : baseOtMultiplier;
  const tier2Rate = rules.weekdayTier2Multiplier ?? rules.weekdayMultiplier;

  const overtimePayWeight = (tier1OT * tier1Rate) + (tier2OT * tier2Rate);
  const nightHours = Math.min(input.nightHours ?? 0, input.workedHours);
  const nightLoadingExcess = nightHours * Math.max(0, rules.nightMultiplier - 1.0);

  const equivalentRegularHours = standardHours + overtimePayWeight + nightLoadingExcess;
  const effectiveMultiplier = input.workedHours > 0
    ? equivalentRegularHours / input.workedHours
    : 1.0;

  return {
    standardHours: Number(standardHours.toFixed(2)),
    regularOvertimeHours: Number(overtimeHoursPayable.toFixed(2)),
    tier1OvertimeHours: Number(tier1OT.toFixed(2)),
    tier2OvertimeHours: Number(tier2OT.toFixed(2)),
    overtimeHoursBeforeCap: Number(overtimeHoursRaw.toFixed(2)),
    overtimeHoursPayable: Number(overtimeHoursPayable.toFixed(2)),
    cappedHours: Number(cappedHours.toFixed(2)),
    isCapBreached,
    capBreachMessage,
    effectiveMultiplier: Number(effectiveMultiplier.toFixed(3)),
    equivalentRegularHours: Number(equivalentRegularHours.toFixed(2)),
    nightHoursPayable: Number(nightHours.toFixed(2)),
    nightRateMultiplier: rules.nightMultiplier,
  };
}

// ============================================================================
// EMPLOYMENT & TERMINATION RULES (Stage C.09 & Stage C.10)
// ATTENDANCE_LOGIC.md, PAYROLL_LOGIC.md §5, MODULES.md §32
// ============================================================================

export interface NoticePeriodTier {
  minTenureMonths: number;
  maxTenureMonths: number | null; // null represents open-ended upper bound (e.g. 5+ years)
  noticeWeeks: number;
  noticeDays?: number | null;
  description?: string;
}

export type FinalSettlementComponentKind = 'earning' | 'deduction';
export type FinalSettlementTaxability =
  | 'fully_taxable'
  | 'tax_exempt'
  | 'statutory_concessional'
  | 'etp'; // Employment Termination Payment concessional caps (e.g. Australia ATO)

export interface FinalSettlementComponentConfig {
  code: string;
  name: string;
  kind: FinalSettlementComponentKind;
  isMandatory: boolean;
  taxability: FinalSettlementTaxability;
  settlementTimelineDays: number;
  calculationBasis: 'ordinary_hourly' | 'daily_rate' | 'structured_formula' | 'fixed_balance';
  description?: string;
}

export type SeveranceFormulaType =
  | 'statutory_table'     // Graduated schedule by tenure (e.g. Fair Work Act NES §119)
  | 'multiplier_per_year' // X weeks/days per completed year of service (e.g. Bangladesh Labor Act §26/27)
  | 'gratuity_statutory'  // Statutory gratuity scheme
  | 'structured_ast';     // Declarative sandboxed AST formula (never eval)

export interface SeveranceTenureTableTier {
  minYears: number;
  maxYears: number | null;
  severanceWeeks: number;
}

export type SeveranceAstNode =
  | { type: 'variable'; name: 'service_years' | 'weekly_rate' | 'daily_rate' | 'basic_salary' | 'gross_salary' }
  | { type: 'constant'; value: number }
  | { type: 'binary_op'; op: '+' | '-' | '*' | '/' | 'min' | 'max'; left: SeveranceAstNode; right: SeveranceAstNode }
  | {
      type: 'conditional';
      condition: {
        left: SeveranceAstNode;
        op: '>' | '>=' | '<' | '<=' | '==';
        right: SeveranceAstNode;
      };
      then: SeveranceAstNode;
      else: SeveranceAstNode;
    };

export interface StructuredSeveranceFormula {
  type: SeveranceFormulaType;
  tenureTable?: SeveranceTenureTableTier[];
  payUnitPerYear?: 'weeks' | 'days' | 'months';
  payUnitsPerYearNumber?: number; // e.g. 2 weeks per year or 30 days per year
  proratePartialYears?: boolean;
  minimumServiceYearsRequired?: number; // e.g. 1 year to qualify for severance
  maxSeveranceWeeks?: number | null;    // e.g. 16 weeks statutory cap
  maxSeveranceMonetaryCap?: number | null;
  astRoot?: SeveranceAstNode;
  notes?: string;
}

export type EmploymentTypeKind =
  | 'full_time'
  | 'part_time'
  | 'casual'
  | 'fixed_term'
  | 'contractor'
  | 'apprentice';

export interface StatutoryContractRequirements {
  writtenContractMandatory: boolean;
  minAgeOfEmployment: number;
  allowedEmploymentTypes: EmploymentTypeKind[];
  casualLoadingPercentage?: number | null; // e.g. 25% for Australian Modern Awards
  maxFixedTermMonths?: number | null;      // e.g. 24 months cap under Fair Work Closing Loopholes
  maxFixedTermRenewals?: number | null;    // e.g. 1 renewal max
  minimumWageHourly: number;               // e.g. 24.10 AUD
  minimumWageMonthly?: number | null;
  itemizedPayslipMandatory: boolean;
  mandatoryTerms: string[];
}

export interface EmploymentTerminationRulePayload {
  // 1. Probation limits
  standardProbationMonths: number;
  maxProbationMonths: number;
  probationNoticeDays: number;
  probationExtensionAllowed: boolean;
  maxProbationExtensionMonths?: number | null;

  // 2. Minimum notice periods by tenure
  standardNoticeWeeks: number;
  employeeNoticeWeeks: number;
  noticeTiers: NoticePeriodTier[];
  seniorAgeBonusEnabled: boolean;
  seniorAgeThreshold?: number | null; // e.g. 45 years
  seniorAgeAdditionalWeeks?: number | null; // e.g. +1 week extra notice
  paymentInLieuOfNoticeAllowed: boolean;

  // 3. Severance formulas (structured JSON, never eval)
  severancePayEligible: boolean;
  severanceFormula: StructuredSeveranceFormula;

  // 4. Final-settlement components
  finalSettlementPaymentTimelineDays: number;
  mandatoryLeaveEncashment: boolean;
  leaveEncashmentLoadingPercentage?: number | null; // e.g. 17.5% annual leave loading
  finalSettlementComponents: FinalSettlementComponentConfig[];

  // 5. Statutory contract requirements
  contractRequirements: StatutoryContractRequirements;

  notes?: string;
}

export interface EmploymentTerminationValidationResult {
  isValid: boolean;
  errors: string[];
  summaryError?: string;
}

/**
 * Sandboxed pure AST formula evaluator without eval() or Function() per PAYROLL_LOGIC.md §5.
 */
export function evaluateSeveranceAstNode(
  node: SeveranceAstNode,
  variables: Record<string, number>,
): number {
  switch (node.type) {
    case 'constant':
      return Number(node.value) || 0;
    case 'variable':
      return Number(variables[node.name]) || 0;
    case 'binary_op': {
      const left = evaluateSeveranceAstNode(node.left, variables);
      const right = evaluateSeveranceAstNode(node.right, variables);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case 'min': return Math.min(left, right);
        case 'max': return Math.max(left, right);
        default: return 0;
      }
    }
    case 'conditional': {
      const left = evaluateSeveranceAstNode(node.condition.left, variables);
      const right = evaluateSeveranceAstNode(node.condition.right, variables);
      let conditionMet = false;
      switch (node.condition.op) {
        case '>': conditionMet = left > right; break;
        case '>=': conditionMet = left >= right; break;
        case '<': conditionMet = left < right; break;
        case '<=': conditionMet = left <= right; break;
        case '==': conditionMet = Math.abs(left - right) < 1e-6; break;
      }
      return conditionMet
        ? evaluateSeveranceAstNode(node.then, variables)
        : evaluateSeveranceAstNode(node.else, variables);
    }
    default:
      return 0;
  }
}

export interface SeveranceCalculationInput {
  serviceYears: number;
  weeklyOrdinaryRate: number;
  dailyOrdinaryRate?: number;
  basicSalaryMonthly?: number;
  grossSalaryMonthly?: number;
  employeeAge?: number;
}

export interface SeveranceCalculationResult {
  eligible: boolean;
  severanceWeeks: number;
  severancePayAmount: number;
  formulaDescription: string;
  isCapped: boolean;
  capReason?: string;
}

export function evaluateStructuredSeveranceFormula(
  formula: StructuredSeveranceFormula,
  input: SeveranceCalculationInput,
): SeveranceCalculationResult {
  const minYears = formula.minimumServiceYearsRequired ?? 1;
  if (input.serviceYears < minYears) {
    return {
      eligible: false,
      severanceWeeks: 0,
      severancePayAmount: 0,
      formulaDescription: `Ineligible: Continuous service (${input.serviceYears.toFixed(1)} years) is below minimum qualification threshold (${minYears} year${minYears > 1 ? 's' : ''}).`,
      isCapped: false,
    };
  }

  let severanceWeeks = 0;
  let formulaDescription = '';

  if (formula.type === 'statutory_table' && Array.isArray(formula.tenureTable) && formula.tenureTable.length > 0) {
    const sorted = [...formula.tenureTable].sort((a, b) => a.minYears - b.minYears);
    let matchedTier: SeveranceTenureTableTier | undefined;
    for (const tier of sorted) {
      if (input.serviceYears >= tier.minYears) {
        if (tier.maxYears === null || tier.maxYears === undefined || input.serviceYears < tier.maxYears) {
          matchedTier = tier;
          break;
        }
      }
    }
    if (matchedTier) {
      severanceWeeks = matchedTier.severanceWeeks;
      formulaDescription = `Statutory Tenure Table: ${matchedTier.minYears}–${matchedTier.maxYears ?? '∞'} years of service = ${severanceWeeks} weeks redundancy pay.`;
    } else {
      // If above highest tier, use highest tier weeks
      const highest = sorted[sorted.length - 1];
      if (input.serviceYears >= highest.minYears) {
        severanceWeeks = highest.severanceWeeks;
        formulaDescription = `Statutory Tenure Table: ${highest.minYears}+ years = ${severanceWeeks} weeks redundancy pay.`;
      }
    }
  } else if (formula.type === 'multiplier_per_year' || formula.type === 'gratuity_statutory') {
    const rateNumber = formula.payUnitsPerYearNumber ?? 2;
    const unit = formula.payUnitPerYear ?? 'weeks';
    const effectiveYears = formula.proratePartialYears ? input.serviceYears : Math.floor(input.serviceYears);

    if (unit === 'weeks') {
      severanceWeeks = effectiveYears * rateNumber;
    } else if (unit === 'days') {
      severanceWeeks = (effectiveYears * rateNumber) / 5; // 5 working days per standard week
    } else if (unit === 'months') {
      severanceWeeks = (effectiveYears * rateNumber * 52) / 12;
    }
    formulaDescription = `${rateNumber} ${unit} pay per completed year of service × ${effectiveYears.toFixed(1)} years = ${severanceWeeks.toFixed(1)} weeks.`;
  } else if (formula.type === 'structured_ast' && formula.astRoot) {
    const variables: Record<string, number> = {
      service_years: input.serviceYears,
      weekly_rate: input.weeklyOrdinaryRate,
      daily_rate: input.dailyOrdinaryRate ?? (input.weeklyOrdinaryRate / 5),
      basic_salary: input.basicSalaryMonthly ?? (input.weeklyOrdinaryRate * 52 / 12),
      gross_salary: input.grossSalaryMonthly ?? (input.weeklyOrdinaryRate * 52 / 12),
    };
    const calculatedPay = evaluateSeveranceAstNode(formula.astRoot, variables);
    severanceWeeks = input.weeklyOrdinaryRate > 0 ? (calculatedPay / input.weeklyOrdinaryRate) : 0;
    formulaDescription = `Evaluated structured AST formula = ${severanceWeeks.toFixed(1)} weeks ($${calculatedPay.toFixed(2)}).`;
  }

  let isCapped = false;
  let capReason: string | undefined;

  // Apply maximum weeks cap
  if (formula.maxSeveranceWeeks !== null && formula.maxSeveranceWeeks !== undefined && formula.maxSeveranceWeeks > 0) {
    if (severanceWeeks > formula.maxSeveranceWeeks) {
      isCapped = true;
      capReason = `Severance weeks capped from ${severanceWeeks.toFixed(1)} to statutory ceiling of ${formula.maxSeveranceWeeks} weeks.`;
      severanceWeeks = formula.maxSeveranceWeeks;
    }
  }

  let severancePayAmount = severanceWeeks * input.weeklyOrdinaryRate;

  // Apply maximum monetary cap
  if (formula.maxSeveranceMonetaryCap !== null && formula.maxSeveranceMonetaryCap !== undefined && formula.maxSeveranceMonetaryCap > 0) {
    if (severancePayAmount > formula.maxSeveranceMonetaryCap) {
      isCapped = true;
      capReason = `Severance pay capped at statutory monetary ceiling of $${formula.maxSeveranceMonetaryCap.toFixed(2)}.`;
      severancePayAmount = formula.maxSeveranceMonetaryCap;
    }
  }

  return {
    eligible: true,
    severanceWeeks: Number(severanceWeeks.toFixed(2)),
    severancePayAmount: Number(severancePayAmount.toFixed(2)),
    formulaDescription,
    isCapped,
    capReason,
  };
}

/**
 * Calculates statutory notice period weeks based on tenure tiers and age bonus.
 */
export function calculateNoticePeriod(
  tenureMonths: number,
  tiers: NoticePeriodTier[],
  options?: {
    employeeAge?: number;
    seniorAgeBonusEnabled?: boolean;
    seniorAgeThreshold?: number | null;
    seniorAgeAdditionalWeeks?: number | null;
    fallbackStandardNoticeWeeks?: number;
  },
): {
  noticeWeeks: number;
  seniorBonusApplied: boolean;
  matchedTierDescription: string;
} {
  const sorted = [...tiers].sort((a, b) => a.minTenureMonths - b.minTenureMonths);
  let matchedNoticeWeeks = options?.fallbackStandardNoticeWeeks ?? 4;
  let matchedTierDescription = 'Default statutory baseline';

  for (const tier of sorted) {
    if (tenureMonths >= tier.minTenureMonths) {
      if (tier.maxTenureMonths === null || tier.maxTenureMonths === undefined || tenureMonths < tier.maxTenureMonths) {
        matchedNoticeWeeks = tier.noticeWeeks;
        matchedTierDescription = tier.description || `${tier.minTenureMonths}–${tier.maxTenureMonths ?? '∞'} months tenure`;
        break;
      }
    }
  }

  // Check senior age bonus (e.g. Fair Work Act: employee aged 45+ with 2+ years [24 months] continuous service gets +1 week)
  let seniorBonusApplied = false;
  if (options?.seniorAgeBonusEnabled && options.employeeAge !== undefined) {
    const ageThreshold = options.seniorAgeThreshold ?? 45;
    const additionalWeeks = options.seniorAgeAdditionalWeeks ?? 1;
    if (options.employeeAge >= ageThreshold && tenureMonths >= 24) {
      matchedNoticeWeeks += additionalWeeks;
      seniorBonusApplied = true;
      matchedTierDescription += ` (+${additionalWeeks} week senior age bonus for age ${options.employeeAge} with 2+ years service)`;
    }
  }

  return {
    noticeWeeks: matchedNoticeWeeks,
    seniorBonusApplied,
    matchedTierDescription,
  };
}

/**
 * Returns default statutory employment and termination rules for a jurisdiction.
 */
export function getDefaultEmploymentTerminationForCountry(
  countryIso?: string,
): EmploymentTerminationRulePayload {
  const iso = (countryIso || '').trim().toUpperCase();

  if (iso === 'AUS') {
    return {
      standardProbationMonths: 6,
      maxProbationMonths: 6,
      probationNoticeDays: 7,
      probationExtensionAllowed: false,
      maxProbationExtensionMonths: null,

      standardNoticeWeeks: 4,
      employeeNoticeWeeks: 2,
      noticeTiers: [
        { minTenureMonths: 0, maxTenureMonths: 12, noticeWeeks: 1, description: 'Not more than 1 year of continuous service' },
        { minTenureMonths: 12, maxTenureMonths: 36, noticeWeeks: 2, description: 'More than 1 year but not more than 3 years' },
        { minTenureMonths: 36, maxTenureMonths: 60, noticeWeeks: 3, description: 'More than 3 years but not more than 5 years' },
        { minTenureMonths: 60, maxTenureMonths: null, noticeWeeks: 4, description: 'More than 5 years of continuous service' },
      ],
      seniorAgeBonusEnabled: true,
      seniorAgeThreshold: 45,
      seniorAgeAdditionalWeeks: 1,
      paymentInLieuOfNoticeAllowed: true,

      severancePayEligible: true,
      severanceFormula: {
        type: 'statutory_table',
        minimumServiceYearsRequired: 1,
        maxSeveranceWeeks: 16,
        tenureTable: [
          { minYears: 1, maxYears: 2, severanceWeeks: 4 },
          { minYears: 2, maxYears: 3, severanceWeeks: 6 },
          { minYears: 3, maxYears: 4, severanceWeeks: 7 },
          { minYears: 4, maxYears: 5, severanceWeeks: 8 },
          { minYears: 5, maxYears: 6, severanceWeeks: 10 },
          { minYears: 6, maxYears: 7, severanceWeeks: 11 },
          { minYears: 7, maxYears: 8, severanceWeeks: 13 },
          { minYears: 8, maxYears: 9, severanceWeeks: 14 },
          { minYears: 9, maxYears: 10, severanceWeeks: 16 },
          { minYears: 10, maxYears: null, severanceWeeks: 12 }, // Fair Work NES §119: 10+ years reduces to 12 weeks
        ],
        notes: 'Fair Work Act 2009 (NES §119): Redundancy pay graduated schedule. Small businesses (<15 employees) statutory exemption applies.',
      },

      finalSettlementPaymentTimelineDays: 7,
      mandatoryLeaveEncashment: true,
      leaveEncashmentLoadingPercentage: 17.5,
      finalSettlementComponents: [
        {
          code: 'UNPAID_SALARY',
          name: 'Prorated Salary for Final Pay Period',
          kind: 'earning',
          isMandatory: true,
          taxability: 'fully_taxable',
          settlementTimelineDays: 7,
          calculationBasis: 'daily_rate',
          description: 'Ordinary hours and wages earned up to last day of employment.',
        },
        {
          code: 'ACC_LEAVE_PAYOUT',
          name: 'Accrued Unused Annual Leave Encashment',
          kind: 'earning',
          isMandatory: true,
          taxability: 'statutory_concessional',
          settlementTimelineDays: 7,
          calculationBasis: 'ordinary_hourly',
          description: 'Payment of unused annual leave balance plus 17.5% leave loading if modern award stipulates.',
        },
        {
          code: 'PILON',
          name: 'Payment in Lieu of Notice (PILON)',
          kind: 'earning',
          isMandatory: false,
          taxability: 'etp',
          settlementTimelineDays: 7,
          calculationBasis: 'structured_formula',
          description: 'Lump-sum payment in lieu of notice where unworked, taxed as an Employment Termination Payment (ETP).',
        },
        {
          code: 'REDUNDANCY_PAY',
          name: 'Statutory Redundancy / Severance Pay',
          kind: 'earning',
          isMandatory: true,
          taxability: 'statutory_concessional',
          settlementTimelineDays: 7,
          calculationBasis: 'structured_formula',
          description: 'NES §119 redundancy severance pay exempt from tax up to statutory tax-free limit.',
        },
        {
          code: 'COMPANY_RECOVERY',
          name: 'Authorized Loans & Equipment Deductions',
          kind: 'deduction',
          isMandatory: false,
          taxability: 'tax_exempt',
          settlementTimelineDays: 7,
          calculationBasis: 'fixed_balance',
          description: 'Lawful deduction for unreturned assets or pre-authorized employee loan repayments.',
        },
      ],

      contractRequirements: {
        writtenContractMandatory: true,
        minAgeOfEmployment: 15,
        allowedEmploymentTypes: ['full_time', 'part_time', 'casual', 'fixed_term', 'apprentice'],
        casualLoadingPercentage: 25.0,
        maxFixedTermMonths: 24,
        maxFixedTermRenewals: 1,
        minimumWageHourly: 24.10,
        minimumWageMonthly: 3663.20,
        itemizedPayslipMandatory: true,
        mandatoryTerms: [
          'Employment Classification & Modern Award reference',
          'Ordinary Hours of Work & Roster Patterns',
          'Hourly / Annual Base Compensation Rate',
          'Superannuation Contribution Guarantee compliance',
          'Notice Period and Termination Terms',
          'Fair Work Information Statement delivery confirmation',
        ],
      },
      notes: 'Australia Fair Work Act 2009 (NES): Strict notice tiers (§117), redundancy pay scale (§119), casual loading 25%, and 24-month fixed-term contract ceiling.',
    };
  }

  if (iso === 'BGD') {
    return {
      standardProbationMonths: 6,
      maxProbationMonths: 6,
      probationNoticeDays: 14,
      probationExtensionAllowed: true,
      maxProbationExtensionMonths: 3,

      standardNoticeWeeks: 4,
      employeeNoticeWeeks: 4,
      noticeTiers: [
        { minTenureMonths: 0, maxTenureMonths: 6, noticeWeeks: 2, noticeDays: 14, description: 'Probationary / temporary period' },
        { minTenureMonths: 6, maxTenureMonths: null, noticeWeeks: 17, noticeDays: 120, description: 'Permanent worker (120 days employer notice or wages in lieu)' },
      ],
      seniorAgeBonusEnabled: false,
      seniorAgeThreshold: null,
      seniorAgeAdditionalWeeks: null,
      paymentInLieuOfNoticeAllowed: true,

      severancePayEligible: true,
      severanceFormula: {
        type: 'multiplier_per_year',
        payUnitPerYear: 'days',
        payUnitsPerYearNumber: 30,
        proratePartialYears: true,
        minimumServiceYearsRequired: 1,
        maxSeveranceWeeks: 52,
        notes: 'Bangladesh Labor Act 2006 (§26/§27): 30 days basic wage compensation for each completed year of service, or 45 days if tenure exceeds 10 years.',
      },

      finalSettlementPaymentTimelineDays: 30,
      mandatoryLeaveEncashment: true,
      leaveEncashmentLoadingPercentage: null,
      finalSettlementComponents: [
        {
          code: 'UNPAID_SALARY',
          name: 'Wages for Worked Days in Final Month',
          kind: 'earning',
          isMandatory: true,
          taxability: 'fully_taxable',
          settlementTimelineDays: 30,
          calculationBasis: 'daily_rate',
          description: 'Basic wages plus statutory allowances up to last working day.',
        },
        {
          code: 'ACC_LEAVE_PAYOUT',
          name: 'Annual Leave Encashment (Earned Leave Balance)',
          kind: 'earning',
          isMandatory: true,
          taxability: 'fully_taxable',
          settlementTimelineDays: 30,
          calculationBasis: 'daily_rate',
          description: 'Unutilized earned leave balance encashment at daily basic rate.',
        },
        {
          code: 'RETRENCHMENT_COMP',
          name: 'Retrenchment / Severance Compensation (§20/§26)',
          kind: 'earning',
          isMandatory: true,
          taxability: 'statutory_concessional',
          settlementTimelineDays: 30,
          calculationBasis: 'structured_formula',
          description: '30 days wages per completed year of service.',
        },
        {
          code: 'GRATUITY',
          name: 'Statutory Gratuity Payout',
          kind: 'earning',
          isMandatory: true,
          taxability: 'statutory_concessional',
          settlementTimelineDays: 30,
          calculationBasis: 'structured_formula',
          description: 'Statutory gratuity for employees completing at least 5 years continuous service.',
        },
      ],

      contractRequirements: {
        writtenContractMandatory: true,
        minAgeOfEmployment: 14,
        allowedEmploymentTypes: ['full_time', 'part_time', 'casual', 'fixed_term', 'apprentice'],
        casualLoadingPercentage: null,
        maxFixedTermMonths: null,
        maxFixedTermRenewals: null,
        minimumWageHourly: 60.0,
        minimumWageMonthly: 12500.0,
        itemizedPayslipMandatory: true,
        mandatoryTerms: [
          'Appointment Letter & Form 34 Service Book details',
          'Job Title & Nature of Work',
          'Probation Period & Confirmation Terms',
          'Basic Wage, House Rent, Medical Allowance breakdown',
          'Festival Bonus and Statutory Benefits',
        ],
      },
      notes: 'Bangladesh Labor Act 2006: 120-day notice for permanent worker termination, 30-day wage severance per year, 30 days final settlement timeline.',
    };
  }

  if (iso === 'USA') {
    return {
      standardProbationMonths: 3,
      maxProbationMonths: 6,
      probationNoticeDays: 0,
      probationExtensionAllowed: true,
      maxProbationExtensionMonths: 3,

      standardNoticeWeeks: 2,
      employeeNoticeWeeks: 2,
      noticeTiers: [
        { minTenureMonths: 0, maxTenureMonths: null, noticeWeeks: 2, description: 'At-will employment baseline (customary 2 weeks notice)' },
      ],
      seniorAgeBonusEnabled: false,
      seniorAgeThreshold: null,
      seniorAgeAdditionalWeeks: null,
      paymentInLieuOfNoticeAllowed: true,

      severancePayEligible: false,
      severanceFormula: {
        type: 'multiplier_per_year',
        payUnitPerYear: 'weeks',
        payUnitsPerYearNumber: 1,
        proratePartialYears: false,
        minimumServiceYearsRequired: 1,
        maxSeveranceWeeks: 26,
        notes: 'US At-Will Baseline: Severance is discretionary / policy-driven unless triggered by federal WARN Act (60-day notice for qualifying mass layoffs).',
      },

      finalSettlementPaymentTimelineDays: 3,
      mandatoryLeaveEncashment: true,
      leaveEncashmentLoadingPercentage: null,
      finalSettlementComponents: [
        {
          code: 'UNPAID_SALARY',
          name: 'Final Wages for Worked Days',
          kind: 'earning',
          isMandatory: true,
          taxability: 'fully_taxable',
          settlementTimelineDays: 3,
          calculationBasis: 'daily_rate',
          description: 'Payment of all earned hours through final day (state final pay law compliant).',
        },
        {
          code: 'ACC_PTO_PAYOUT',
          name: 'Accrued Paid Time Off (PTO) Payout',
          kind: 'earning',
          isMandatory: true,
          taxability: 'fully_taxable',
          settlementTimelineDays: 3,
          calculationBasis: 'ordinary_hourly',
          description: 'Mandatory accrued PTO payout in states like CA, IL, NY, CO.',
        },
      ],

      contractRequirements: {
        writtenContractMandatory: false,
        minAgeOfEmployment: 16,
        allowedEmploymentTypes: ['full_time', 'part_time', 'casual', 'fixed_term', 'contractor'],
        casualLoadingPercentage: null,
        maxFixedTermMonths: null,
        maxFixedTermRenewals: null,
        minimumWageHourly: 7.25,
        minimumWageMonthly: null,
        itemizedPayslipMandatory: true,
        mandatoryTerms: [
          'At-will employment acknowledgment',
          'FLSA exempt / non-exempt status',
          'Compensation and payroll frequency',
        ],
      },
      notes: 'US Fair Labor Standards Act (FLSA) & state final wage rules (e.g. CA Labor Code §201 immediate pay upon discharge).',
    };
  }

  // International statutory baseline
  return {
    standardProbationMonths: 6,
    maxProbationMonths: 6,
    probationNoticeDays: 7,
    probationExtensionAllowed: true,
    maxProbationExtensionMonths: 3,

    standardNoticeWeeks: 4,
    employeeNoticeWeeks: 2,
    noticeTiers: [
      { minTenureMonths: 0, maxTenureMonths: 12, noticeWeeks: 1, description: 'Up to 1 year of service' },
      { minTenureMonths: 12, maxTenureMonths: 36, noticeWeeks: 2, description: '1 to 3 years of service' },
      { minTenureMonths: 36, maxTenureMonths: 60, noticeWeeks: 3, description: '3 to 5 years of service' },
      { minTenureMonths: 60, maxTenureMonths: null, noticeWeeks: 4, description: 'Over 5 years of service' },
    ],
    seniorAgeBonusEnabled: false,
    seniorAgeThreshold: null,
    seniorAgeAdditionalWeeks: null,
    paymentInLieuOfNoticeAllowed: true,

    severancePayEligible: true,
    severanceFormula: {
      type: 'multiplier_per_year',
      payUnitPerYear: 'weeks',
      payUnitsPerYearNumber: 2,
      proratePartialYears: true,
      minimumServiceYearsRequired: 1,
      maxSeveranceWeeks: 26,
      notes: 'Standard statutory baseline: 2 weeks ordinary pay per completed year of service.',
    },

    finalSettlementPaymentTimelineDays: 14,
    mandatoryLeaveEncashment: true,
    leaveEncashmentLoadingPercentage: null,
    finalSettlementComponents: [
      {
        code: 'UNPAID_SALARY',
        name: 'Final Wages for Worked Days',
        kind: 'earning',
        isMandatory: true,
        taxability: 'fully_taxable',
        settlementTimelineDays: 14,
        calculationBasis: 'daily_rate',
        description: 'Earned wages for final payroll cycle.',
      },
      {
        code: 'ACC_LEAVE_PAYOUT',
        name: 'Accrued Unused Annual Leave Encashment',
        kind: 'earning',
        isMandatory: true,
        taxability: 'statutory_concessional',
        settlementTimelineDays: 14,
        calculationBasis: 'ordinary_hourly',
        description: 'Mandatory payout of all earned but unused statutory leave.',
      },
      {
        code: 'SEVERANCE_PAY',
        name: 'Statutory Severance Pay',
        kind: 'earning',
        isMandatory: true,
        taxability: 'statutory_concessional',
        settlementTimelineDays: 14,
        calculationBasis: 'structured_formula',
        description: 'Statutory severance payment based on years of continuous service.',
      },
    ],

    contractRequirements: {
      writtenContractMandatory: true,
      minAgeOfEmployment: 16,
      allowedEmploymentTypes: ['full_time', 'part_time', 'casual', 'fixed_term', 'contractor'],
      casualLoadingPercentage: null,
      maxFixedTermMonths: 36,
      maxFixedTermRenewals: 2,
      minimumWageHourly: 15.0,
      minimumWageMonthly: 2500.0,
      itemizedPayslipMandatory: true,
      mandatoryTerms: [
        'Written employment contract',
        'Job title & duties',
        'Remuneration and pay intervals',
        'Working hours and rest intervals',
        'Notice and termination conditions',
      ],
    },
    notes: 'International baseline employment and termination regulations.',
  };
}

/**
 * Normalizes legacy and loosely-structured payloads into the strict EmploymentTerminationRulePayload format.
 */
export function normalizeEmploymentTerminationPayload(
  raw: Record<string, unknown> | null | undefined,
  countryIso?: string,
): EmploymentTerminationRulePayload {
  const defaults = getDefaultEmploymentTerminationForCountry(countryIso);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  // Support legacy keys: minimum_wage_hourly, standard_notice_weeks, standard_probation_months, severance_pay_formula
  const legacyMinWage = typeof raw.minimum_wage_hourly === 'number' ? raw.minimum_wage_hourly : undefined;
  const legacyNoticeWeeks = typeof raw.standard_notice_weeks === 'number' ? raw.standard_notice_weeks : undefined;
  const legacyProbationMonths = typeof raw.standard_probation_months === 'number' ? raw.standard_probation_months : undefined;

  const standardProbation =
    typeof raw.standardProbationMonths === 'number'
      ? raw.standardProbationMonths
      : legacyProbationMonths ?? defaults.standardProbationMonths;

  const maxProbation =
    typeof raw.maxProbationMonths === 'number'
      ? raw.maxProbationMonths
      : Math.max(standardProbation, defaults.maxProbationMonths);

  const standardNotice =
    typeof raw.standardNoticeWeeks === 'number'
      ? raw.standardNoticeWeeks
      : legacyNoticeWeeks ?? defaults.standardNoticeWeeks;

  const rawNoticeTiers = Array.isArray(raw.noticeTiers) && raw.noticeTiers.length > 0
    ? (raw.noticeTiers as NoticePeriodTier[])
    : defaults.noticeTiers;

  const rawFormula = (raw.severanceFormula as StructuredSeveranceFormula) || defaults.severanceFormula;

  const rawSettlementComponents = Array.isArray(raw.finalSettlementComponents) && raw.finalSettlementComponents.length > 0
    ? (raw.finalSettlementComponents as FinalSettlementComponentConfig[])
    : defaults.finalSettlementComponents;

  const rawContractReqs = (raw.contractRequirements as StatutoryContractRequirements) || defaults.contractRequirements;

  const minWageHourly =
    typeof rawContractReqs.minimumWageHourly === 'number'
      ? rawContractReqs.minimumWageHourly
      : legacyMinWage ?? defaults.contractRequirements.minimumWageHourly;

  return {
    standardProbationMonths: Number(standardProbation) || defaults.standardProbationMonths,
    maxProbationMonths: Number(maxProbation) || defaults.maxProbationMonths,
    probationNoticeDays: typeof raw.probationNoticeDays === 'number' ? raw.probationNoticeDays : defaults.probationNoticeDays,
    probationExtensionAllowed: typeof raw.probationExtensionAllowed === 'boolean' ? raw.probationExtensionAllowed : defaults.probationExtensionAllowed,
    maxProbationExtensionMonths: typeof raw.maxProbationExtensionMonths === 'number' ? raw.maxProbationExtensionMonths : defaults.maxProbationExtensionMonths,

    standardNoticeWeeks: Number(standardNotice) || defaults.standardNoticeWeeks,
    employeeNoticeWeeks: typeof raw.employeeNoticeWeeks === 'number' ? raw.employeeNoticeWeeks : defaults.employeeNoticeWeeks,
    noticeTiers: rawNoticeTiers,
    seniorAgeBonusEnabled: typeof raw.seniorAgeBonusEnabled === 'boolean' ? raw.seniorAgeBonusEnabled : defaults.seniorAgeBonusEnabled,
    seniorAgeThreshold: typeof raw.seniorAgeThreshold === 'number' ? raw.seniorAgeThreshold : defaults.seniorAgeThreshold,
    seniorAgeAdditionalWeeks: typeof raw.seniorAgeAdditionalWeeks === 'number' ? raw.seniorAgeAdditionalWeeks : defaults.seniorAgeAdditionalWeeks,
    paymentInLieuOfNoticeAllowed: typeof raw.paymentInLieuOfNoticeAllowed === 'boolean' ? raw.paymentInLieuOfNoticeAllowed : defaults.paymentInLieuOfNoticeAllowed,

    severancePayEligible: typeof raw.severancePayEligible === 'boolean' ? raw.severancePayEligible : defaults.severancePayEligible,
    severanceFormula: {
      type: rawFormula.type || defaults.severanceFormula.type,
      tenureTable: rawFormula.tenureTable || defaults.severanceFormula.tenureTable,
      payUnitPerYear: rawFormula.payUnitPerYear || defaults.severanceFormula.payUnitPerYear,
      payUnitsPerYearNumber: typeof rawFormula.payUnitsPerYearNumber === 'number' ? rawFormula.payUnitsPerYearNumber : defaults.severanceFormula.payUnitsPerYearNumber,
      proratePartialYears: typeof rawFormula.proratePartialYears === 'boolean' ? rawFormula.proratePartialYears : defaults.severanceFormula.proratePartialYears,
      minimumServiceYearsRequired: typeof rawFormula.minimumServiceYearsRequired === 'number' ? rawFormula.minimumServiceYearsRequired : defaults.severanceFormula.minimumServiceYearsRequired,
      maxSeveranceWeeks: typeof rawFormula.maxSeveranceWeeks === 'number' ? rawFormula.maxSeveranceWeeks : defaults.severanceFormula.maxSeveranceWeeks,
      maxSeveranceMonetaryCap: typeof rawFormula.maxSeveranceMonetaryCap === 'number' ? rawFormula.maxSeveranceMonetaryCap : defaults.severanceFormula.maxSeveranceMonetaryCap,
      astRoot: rawFormula.astRoot || defaults.severanceFormula.astRoot,
      notes: typeof rawFormula.notes === 'string' ? rawFormula.notes : defaults.severanceFormula.notes,
    },

    finalSettlementPaymentTimelineDays: typeof raw.finalSettlementPaymentTimelineDays === 'number' ? raw.finalSettlementPaymentTimelineDays : defaults.finalSettlementPaymentTimelineDays,
    mandatoryLeaveEncashment: typeof raw.mandatoryLeaveEncashment === 'boolean' ? raw.mandatoryLeaveEncashment : defaults.mandatoryLeaveEncashment,
    leaveEncashmentLoadingPercentage: typeof raw.leaveEncashmentLoadingPercentage === 'number' ? raw.leaveEncashmentLoadingPercentage : defaults.leaveEncashmentLoadingPercentage,
    finalSettlementComponents: rawSettlementComponents,

    contractRequirements: {
      writtenContractMandatory: typeof rawContractReqs.writtenContractMandatory === 'boolean' ? rawContractReqs.writtenContractMandatory : defaults.contractRequirements.writtenContractMandatory,
      minAgeOfEmployment: typeof rawContractReqs.minAgeOfEmployment === 'number' ? rawContractReqs.minAgeOfEmployment : defaults.contractRequirements.minAgeOfEmployment,
      allowedEmploymentTypes: Array.isArray(rawContractReqs.allowedEmploymentTypes) ? rawContractReqs.allowedEmploymentTypes : defaults.contractRequirements.allowedEmploymentTypes,
      casualLoadingPercentage: typeof rawContractReqs.casualLoadingPercentage === 'number' ? rawContractReqs.casualLoadingPercentage : defaults.contractRequirements.casualLoadingPercentage,
      maxFixedTermMonths: typeof rawContractReqs.maxFixedTermMonths === 'number' ? rawContractReqs.maxFixedTermMonths : defaults.contractRequirements.maxFixedTermMonths,
      maxFixedTermRenewals: typeof rawContractReqs.maxFixedTermRenewals === 'number' ? rawContractReqs.maxFixedTermRenewals : defaults.contractRequirements.maxFixedTermRenewals,
      minimumWageHourly: Number(minWageHourly) || defaults.contractRequirements.minimumWageHourly,
      minimumWageMonthly: typeof rawContractReqs.minimumWageMonthly === 'number' ? rawContractReqs.minimumWageMonthly : defaults.contractRequirements.minimumWageMonthly,
      itemizedPayslipMandatory: typeof rawContractReqs.itemizedPayslipMandatory === 'boolean' ? rawContractReqs.itemizedPayslipMandatory : defaults.contractRequirements.itemizedPayslipMandatory,
      mandatoryTerms: Array.isArray(rawContractReqs.mandatoryTerms) ? rawContractReqs.mandatoryTerms : defaults.contractRequirements.mandatoryTerms,
    },

    notes: typeof raw.notes === 'string' ? raw.notes : defaults.notes,
  };
}

/**
 * Validates an Employment & Termination rule payload with strict validation rules.
 */
export function validateEmploymentTerminationPayload(
  payload: unknown,
): EmploymentTerminationValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      errors: ['Employment and termination rules payload must be a non-empty object.'],
      summaryError: 'Employment and termination rules payload must be a non-empty object.',
    };
  }

  const p = payload as Partial<EmploymentTerminationRulePayload>;

  // 1. Probation validation
  if (p.standardProbationMonths === undefined || p.standardProbationMonths === null || typeof p.standardProbationMonths !== 'number' || isNaN(p.standardProbationMonths)) {
    errors.push('Standard probation months is required and must be a valid number.');
  } else if (p.standardProbationMonths < 0 || p.standardProbationMonths > 24) {
    errors.push('Standard probation duration must be between 0 and 24 months.');
  }

  if (p.maxProbationMonths === undefined || p.maxProbationMonths === null || typeof p.maxProbationMonths !== 'number' || isNaN(p.maxProbationMonths)) {
    errors.push('Maximum statutory probation months is required and must be a valid number.');
  } else if (p.maxProbationMonths < (p.standardProbationMonths ?? 0)) {
    errors.push(`Maximum probation (${p.maxProbationMonths}m) cannot be less than standard probation (${p.standardProbationMonths}m).`);
  }

  if (p.probationNoticeDays !== undefined && p.probationNoticeDays !== null) {
    if (typeof p.probationNoticeDays !== 'number' || p.probationNoticeDays < 0) {
      errors.push('Probation notice days cannot be negative.');
    }
  }

  // 2. Notice period validation
  if (p.standardNoticeWeeks === undefined || p.standardNoticeWeeks === null || typeof p.standardNoticeWeeks !== 'number' || isNaN(p.standardNoticeWeeks)) {
    errors.push('Standard notice weeks is required and must be a valid number.');
  } else if (p.standardNoticeWeeks < 0 || p.standardNoticeWeeks > 52) {
    errors.push('Standard notice weeks must be between 0 and 52 weeks.');
  }

  if (p.employeeNoticeWeeks !== undefined && p.employeeNoticeWeeks !== null) {
    if (typeof p.employeeNoticeWeeks !== 'number' || p.employeeNoticeWeeks < 0 || p.employeeNoticeWeeks > 52) {
      errors.push('Employee notice weeks must be between 0 and 52 weeks.');
    }
  }

  if (Array.isArray(p.noticeTiers)) {
    p.noticeTiers.forEach((tier, idx) => {
      if (typeof tier.minTenureMonths !== 'number' || tier.minTenureMonths < 0) {
        errors.push(`Notice tier #${idx + 1}: Minimum tenure months must be 0 or greater.`);
      }
      if (tier.maxTenureMonths !== null && tier.maxTenureMonths !== undefined) {
        if (typeof tier.maxTenureMonths !== 'number' || tier.maxTenureMonths <= tier.minTenureMonths) {
          errors.push(`Notice tier #${idx + 1}: Maximum tenure (${tier.maxTenureMonths}m) must be greater than minimum tenure (${tier.minTenureMonths}m).`);
        }
      }
      if (typeof tier.noticeWeeks !== 'number' || tier.noticeWeeks < 0) {
        errors.push(`Notice tier #${idx + 1}: Notice weeks must be 0 or greater.`);
      }
    });
  }

  // 3. Severance formula validation
  if (p.severancePayEligible && p.severanceFormula) {
    const f = p.severanceFormula;
    if (!['statutory_table', 'multiplier_per_year', 'gratuity_statutory', 'structured_ast'].includes(f.type)) {
      errors.push("Severance formula type must be one of: 'statutory_table', 'multiplier_per_year', 'gratuity_statutory', 'structured_ast'.");
    }

    if (f.type === 'statutory_table') {
      if (!Array.isArray(f.tenureTable) || f.tenureTable.length === 0) {
        errors.push('Statutory severance table must contain at least one tenure tier.');
      } else {
        f.tenureTable.forEach((tier, idx) => {
          if (typeof tier.minYears !== 'number' || tier.minYears < 0) {
            errors.push(`Severance table tier #${idx + 1}: Minimum service years must be non-negative.`);
          }
          if (tier.maxYears !== null && tier.maxYears !== undefined) {
            if (typeof tier.maxYears !== 'number' || tier.maxYears <= tier.minYears) {
              errors.push(`Severance table tier #${idx + 1}: Maximum years (${tier.maxYears}) must be greater than min years (${tier.minYears}).`);
            }
          }
          if (typeof tier.severanceWeeks !== 'number' || tier.severanceWeeks < 0) {
            errors.push(`Severance table tier #${idx + 1}: Severance weeks cannot be negative.`);
          }
        });
      }
    }

    if (f.type === 'multiplier_per_year' || f.type === 'gratuity_statutory') {
      if (typeof f.payUnitsPerYearNumber !== 'number' || f.payUnitsPerYearNumber <= 0) {
        errors.push('Pay units per year number must be greater than 0.');
      }
    }
  }

  // 4. Final settlement components
  if (p.finalSettlementPaymentTimelineDays !== undefined && p.finalSettlementPaymentTimelineDays !== null) {
    if (typeof p.finalSettlementPaymentTimelineDays !== 'number' || p.finalSettlementPaymentTimelineDays < 0 || p.finalSettlementPaymentTimelineDays > 365) {
      errors.push('Final settlement payment timeline must be between 0 and 365 days.');
    }
  }

  if (Array.isArray(p.finalSettlementComponents)) {
    p.finalSettlementComponents.forEach((comp, idx) => {
      if (!comp.code || !comp.code.trim()) {
        errors.push(`Final settlement component #${idx + 1}: Code is required.`);
      }
      if (!comp.name || !comp.name.trim()) {
        errors.push(`Final settlement component #${idx + 1}: Name is required.`);
      }
      if (comp.kind !== 'earning' && comp.kind !== 'deduction') {
        errors.push(`Final settlement component #${idx + 1}: Kind must be 'earning' or 'deduction'.`);
      }
    });
  }

  // 5. Contract requirements validation
  if (p.contractRequirements) {
    const c = p.contractRequirements;
    if (typeof c.minAgeOfEmployment !== 'number' || c.minAgeOfEmployment < 10 || c.minAgeOfEmployment > 30) {
      errors.push('Minimum age of employment must be between 10 and 30 years.');
    }
    if (typeof c.minimumWageHourly !== 'number' || isNaN(c.minimumWageHourly) || c.minimumWageHourly <= 0) {
      errors.push('Statutory minimum hourly wage is required and must be greater than 0.');
    }
    if (c.casualLoadingPercentage !== undefined && c.casualLoadingPercentage !== null) {
      if (typeof c.casualLoadingPercentage !== 'number' || c.casualLoadingPercentage < 0 || c.casualLoadingPercentage > 100) {
        errors.push('Casual loading percentage must be between 0% and 100%.');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    summaryError: errors[0],
  };
}

// ============================================================================
// PUBLIC & STATUTORY BANK HOLIDAYS (STAGE C.07 - JURISDICTION CALENDARS)
// ============================================================================

export type HolidayDateType = 'fixed' | 'moving';

export type HolidayMovingRuleType =
  | 'nth_weekday_of_month'
  | 'easter_relative'
  | 'lunar_hijri'
  | 'custom_gazette';

export interface HolidayMovingRule {
  ruleType: HolidayMovingRuleType;
  month?: number; // 1 - 12
  weekday?: number; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  occurrence?: number; // 1 = 1st, 2 = 2nd, 3 = 3rd, 4 = 4th, -1 = last
  easterOffsetDays?: number; // -2 for Good Friday, -1 for Holy Saturday, 0 for Easter Sunday, 1 for Easter Monday, etc.
  description?: string; // human-readable explanation
}

export interface PublicHolidayItem {
  id: string;
  name: string;
  date: string; // ISO format 'YYYY-MM-DD'
  observedDate: string | null; // observed date if different from calendar date (weekend rollover)
  dateType: HolidayDateType; // 'fixed' | 'moving'
  movingRule?: HolidayMovingRule | null;
  isHalfDay: boolean;
  halfDayStartHour?: number | null; // e.g. 19 for 7 PM start
  penaltyMultiplier?: number | null; // e.g. 2.5x OT rate override
  stateProvinceId?: string | null; // null = National/Federal; UUID = specific State/Province
  stateCode?: string | null; // e.g. "NSW", "VIC"
  notes?: string;
  gazetteReference?: string;
  recurring?: boolean;
}

export interface PublicHolidayRulePayload {
  holidays: PublicHolidayItem[];
  defaultPenaltyMultiplier?: number;
  weekendObservationStrategy?: 'following_weekday' | 'none' | 'closest_weekday';
  calendarYears?: number[];
  notes?: string;
}

export interface PublicHolidayValidationResult {
  isValid: boolean;
  errors: string[];
  summaryError?: string;
}

export interface InheritingTenantLocationView {
  id: string;
  name: string;
  stateProvinceId: string | null;
  stateCode: string | null;
  employeeCount: number;
}

export interface InheritingTenantCompanyView {
  id: string;
  name: string;
  stateProvinceId: string | null;
  stateCode: string | null;
  stateName: string | null;
  employeeCount: number;
  locations: InheritingTenantLocationView[];
}

export interface InheritingTenantView {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  plan: string;
  companies: InheritingTenantCompanyView[];
  totalEmployeesInCountry: number;
}

export interface InheritingTenantsResponse {
  countryId: string;
  countryName: string;
  isoCode: string;
  totalTenants: number;
  totalEmployees: number;
  tenants: InheritingTenantView[];
}

/**
 * Deterministically computes Western Easter Sunday for a given year
 * using the Meeus/Jones/Butcher algorithm (valid for all Gregorian calendar years).
 */
export function calculateEasterSunday(year: number): { month: number; day: number; dateStr: string } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { month, day, dateStr };
}

/**
 * Calculates a date relative to Easter Sunday (e.g. Good Friday is Easter - 2 days).
 */
export function calculateEasterRelativeDate(year: number, offsetDays: number): string {
  const easter = calculateEasterSunday(year);
  const date = new Date(Date.UTC(year, easter.month - 1, easter.day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates the Nth weekday of a month (e.g. 2nd Monday of June, 1st Monday of October, or last Monday [-1]).
 * @param targetWeekday 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param occurrence 1 = 1st, 2 = 2nd, 3 = 3rd, 4 = 4th, -1 = last
 */
export function calculateNthWeekdayOfMonth(
  year: number,
  month: number,
  targetWeekday: number,
  occurrence: number,
): string {
  if (occurrence === -1) {
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = lastDayOfMonth; day >= 1; day--) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCDay() === targetWeekday) {
        return d.toISOString().slice(0, 10);
      }
    }
  } else {
    let count = 0;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= lastDayOfMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCDay() === targetWeekday) {
        count++;
        if (count === occurrence) {
          return d.toISOString().slice(0, 10);
        }
      }
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Calculates the observed public holiday date when a fixed holiday falls on a weekend.
 */
export function calculateObservedDate(
  dateStr: string,
  strategy: 'following_weekday' | 'none' | 'closest_weekday' = 'following_weekday',
): string {
  if (strategy === 'none') {
    return dateStr;
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayOfWeek = date.getUTCDay();

  if (dayOfWeek === 6) {
    // Saturday
    if (strategy === 'closest_weekday') {
      date.setUTCDate(date.getUTCDate() - 1); // Friday
    } else {
      date.setUTCDate(date.getUTCDate() + 2); // Monday
    }
    return date.toISOString().slice(0, 10);
  }
  if (dayOfWeek === 0) {
    // Sunday
    date.setUTCDate(date.getUTCDate() + 1); // Monday
    return date.toISOString().slice(0, 10);
  }
  return dateStr;
}

/**
 * Evaluates moving rule parameters to return the exact calendar date for targetYear.
 */
export function calculateMovingHolidayDate(
  rule: HolidayMovingRule,
  targetYear: number,
  observationStrategy: 'following_weekday' | 'none' | 'closest_weekday' = 'following_weekday',
): { dateStr: string; observedDate: string; description: string } {
  let dateStr: string;
  let desc = rule.description || '';

  switch (rule.ruleType) {
    case 'easter_relative': {
      const offset = rule.easterOffsetDays ?? 0;
      dateStr = calculateEasterRelativeDate(targetYear, offset);
      if (!desc) {
        if (offset === -2) desc = 'Good Friday (2 days before Easter Sunday)';
        else if (offset === -1) desc = 'Holy Saturday (1 day before Easter Sunday)';
        else if (offset === 0) desc = 'Easter Sunday';
        else if (offset === 1) desc = 'Easter Monday (1 day after Easter Sunday)';
        else desc = `Easter Sunday + ${offset} days`;
      }
      break;
    }
    case 'nth_weekday_of_month': {
      const month = rule.month || 1;
      const weekday = rule.weekday !== undefined ? rule.weekday : 1;
      const occurrence = rule.occurrence || 1;
      dateStr = calculateNthWeekdayOfMonth(targetYear, month, weekday, occurrence);
      if (!desc) {
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const occNames: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'Last' };
        desc = `${occNames[occurrence] || occurrence} ${weekdayNames[weekday]} of ${monthNames[month]}`;
      }
      break;
    }
    default: {
      dateStr = `${targetYear}-01-01`;
      if (!desc) desc = 'Custom moving holiday decree';
      break;
    }
  }

  const observedDate = calculateObservedDate(dateStr, observationStrategy);
  return { dateStr, observedDate, description: desc };
}

/**
 * Rolls forward all holidays from sourceYear to targetYear.
 * - Fixed holidays keep the same month and day, with recalculated observed date.
 * - Moving holidays recalculate their dynamic date for the target year.
 */
export function copyHolidaysToYear(
  sourceHolidays: PublicHolidayItem[],
  targetYear: number,
  observationStrategy: 'following_weekday' | 'none' | 'closest_weekday' = 'following_weekday',
): PublicHolidayItem[] {
  return sourceHolidays.map((h, idx) => {
    const id = `hol-${targetYear}-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`;
    if (h.dateType === 'moving' && h.movingRule) {
      const calc = calculateMovingHolidayDate(h.movingRule, targetYear, observationStrategy);
      return {
        ...h,
        id,
        date: calc.dateStr,
        observedDate: calc.observedDate,
        notes: h.notes || calc.description,
      };
    }

    // Fixed date: roll MM-DD to targetYear
    const mmdd = h.date.slice(5); // e.g. "12-25"
    const newDate = `${targetYear}-${mmdd}`;
    const observedDate = calculateObservedDate(newDate, observationStrategy);
    return {
      ...h,
      id,
      date: newDate,
      observedDate,
    };
  });
}

/**
 * Parses raw CSV string into partial PublicHolidayItem records with error reporting.
 */
export function parseHolidaysCsv(
  csvText: string,
): { holidays: Partial<PublicHolidayItem>[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { holidays: [], errors: ['CSV content is empty.'] };
  }

  const headerLine = lines[0];
  const headers = headerLine
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'holiday_name' || h === 'holiday');
  const dateIdx = headers.findIndex((h) => h === 'date' || h === 'holiday_date');
  const dateTypeIdx = headers.findIndex((h) => h === 'date_type' || h === 'type');
  const movingRuleIdx = headers.findIndex((h) => h === 'moving_rule' || h === 'rule');
  const observedIdx = headers.findIndex((h) => h === 'observed_date' || h === 'observed');
  const isHalfDayIdx = headers.findIndex((h) => h === 'is_half_day' || h === 'half_day');
  const stateCodeIdx = headers.findIndex((h) => h === 'state_code' || h === 'state');
  const penaltyIdx = headers.findIndex((h) => h === 'penalty_multiplier' || h === 'multiplier');
  const notesIdx = headers.findIndex((h) => h === 'notes' || h === 'description');

  if (nameIdx === -1 || dateIdx === -1) {
    return {
      holidays: [],
      errors: ['CSV must contain at least "name" and "date" column headers.'],
    };
  }

  const holidays: Partial<PublicHolidayItem>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(cur.trim().replace(/^["']|["']$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim().replace(/^["']|["']$/g, ''));

    const name = cells[nameIdx];
    const date = cells[dateIdx];

    if (!name) {
      errors.push(`Row ${i + 1}: Name is required.`);
      continue;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${i + 1}: Date must be in YYYY-MM-DD format (received "${date}").`);
      continue;
    }

    const rawDateType = dateTypeIdx !== -1 ? cells[dateTypeIdx]?.toLowerCase() : 'fixed';
    const dateType: HolidayDateType = rawDateType === 'moving' ? 'moving' : 'fixed';
    const observedDate = observedIdx !== -1 && cells[observedIdx] ? cells[observedIdx] : null;
    const isHalfDay = isHalfDayIdx !== -1 ? cells[isHalfDayIdx]?.toLowerCase() === 'true' || cells[isHalfDayIdx] === '1' : false;
    const stateCode = stateCodeIdx !== -1 && cells[stateCodeIdx] ? cells[stateCodeIdx].toUpperCase() : null;
    const penaltyMultiplier = penaltyIdx !== -1 && cells[penaltyIdx] ? parseFloat(cells[penaltyIdx]) : 2.5;
    const notes = notesIdx !== -1 ? cells[notesIdx] : undefined;

    holidays.push({
      id: `hol-csv-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      date,
      observedDate,
      dateType,
      isHalfDay,
      stateCode,
      penaltyMultiplier: !isNaN(penaltyMultiplier) ? penaltyMultiplier : 2.5,
      notes,
    });
  }

  return { holidays, errors };
}

/**
 * Normalizes legacy public holiday payloads into the rich PublicHolidayRulePayload structure.
 */
export function normalizePublicHolidayPayload(raw: unknown): PublicHolidayRulePayload {
  if (!raw || typeof raw !== 'object') {
    return {
      holidays: [],
      defaultPenaltyMultiplier: 2.5,
      weekendObservationStrategy: 'following_weekday',
      calendarYears: [new Date().getUTCFullYear()],
    };
  }

  const p = raw as any;
  const rawHolidays: any[] = Array.isArray(p.holidays) ? p.holidays : Array.isArray(p) ? p : [];

  const holidays: PublicHolidayItem[] = rawHolidays.map((h, idx) => {
    const id = typeof h.id === 'string' && h.id ? h.id : `hol-${h.date || 'item'}-${idx + 1}`;
    const name = typeof h.name === 'string' ? h.name : 'Public Holiday';
    const date = typeof h.date === 'string' ? h.date : '2025-01-01';
    const dateType: HolidayDateType = h.dateType === 'moving' ? 'moving' : 'fixed';
    const observedDate = typeof h.observedDate === 'string' ? h.observedDate : typeof h.observed === 'string' ? h.observed : null;
    const isHalfDay = Boolean(h.isHalfDay);
    const halfDayStartHour = typeof h.halfDayStartHour === 'number' ? h.halfDayStartHour : null;
    const penaltyMultiplier = typeof h.penaltyMultiplier === 'number' ? h.penaltyMultiplier : 2.5;
    const stateProvinceId = typeof h.stateProvinceId === 'string' ? h.stateProvinceId : null;
    const stateCode = typeof h.stateCode === 'string' ? h.stateCode : null;
    const notes = typeof h.notes === 'string' ? h.notes : undefined;
    const gazetteReference = typeof h.gazetteReference === 'string' ? h.gazetteReference : undefined;
    const recurring = typeof h.recurring === 'boolean' ? h.recurring : true;

    return {
      id,
      name,
      date,
      observedDate,
      dateType,
      movingRule: h.movingRule || null,
      isHalfDay,
      halfDayStartHour,
      penaltyMultiplier,
      stateProvinceId,
      stateCode,
      notes,
      gazetteReference,
      recurring,
    };
  });

  const years = Array.from(new Set(holidays.map((h) => parseInt(h.date.slice(0, 4), 10)).filter((y) => !isNaN(y))));

  return {
    holidays,
    defaultPenaltyMultiplier: typeof p.defaultPenaltyMultiplier === 'number' ? p.defaultPenaltyMultiplier : 2.5,
    weekendObservationStrategy: p.weekendObservationStrategy || 'following_weekday',
    calendarYears: years.length > 0 ? years : [new Date().getUTCFullYear()],
    notes: p.notes,
  };
}

/**
 * Pure validator for public holiday rule payloads.
 */
export function validatePublicHolidayPayload(payload: unknown): PublicHolidayValidationResult {
  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      errors: ['Public holiday payload must be a non-null object.'],
      summaryError: 'Public holiday payload must be a non-null object.',
    };
  }

  const p = payload as Record<string, any>;
  const errors: string[] = [];

  if (!Array.isArray(p.holidays)) {
    errors.push('Holidays property must be an array of holiday entries.');
    return { isValid: false, errors, summaryError: errors[0] };
  }

  p.holidays.forEach((h: any, idx: number) => {
    const rowNum = idx + 1;
    if (!h.name || typeof h.name !== 'string' || !h.name.trim()) {
      errors.push(`Holiday #${rowNum}: Name is required.`);
    }
    if (!h.date || typeof h.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) {
      errors.push(`Holiday #${rowNum} ("${h.name || 'unnamed'}"): Date is required and must follow YYYY-MM-DD format.`);
    } else {
      const parts = h.date.split('-').map(Number);
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (d.getUTCFullYear() !== parts[0] || d.getUTCMonth() !== parts[1] - 1 || d.getUTCDate() !== parts[2]) {
        errors.push(`Holiday #${rowNum}: "${h.date}" is not a valid calendar date.`);
      }
    }

    if (h.observedDate && typeof h.observedDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(h.observedDate)) {
      errors.push(`Holiday #${rowNum}: Observed date must follow YYYY-MM-DD format if provided.`);
    }

    if (h.dateType && h.dateType !== 'fixed' && h.dateType !== 'moving') {
      errors.push(`Holiday #${rowNum}: Date type must be either 'fixed' or 'moving'.`);
    }

    if (h.dateType === 'moving' && h.movingRule) {
      const mr = h.movingRule;
      const validRuleTypes: HolidayMovingRuleType[] = [
        'nth_weekday_of_month',
        'easter_relative',
        'lunar_hijri',
        'custom_gazette',
      ];
      if (!validRuleTypes.includes(mr.ruleType)) {
        errors.push(`Holiday #${rowNum}: Moving rule type must be one of: ${validRuleTypes.join(', ')}.`);
      }
      if (mr.ruleType === 'nth_weekday_of_month') {
        if (typeof mr.month !== 'number' || mr.month < 1 || mr.month > 12) {
          errors.push(`Holiday #${rowNum}: Nth-weekday rule requires a month between 1 and 12.`);
        }
        if (typeof mr.weekday !== 'number' || mr.weekday < 0 || mr.weekday > 6) {
          errors.push(`Holiday #${rowNum}: Nth-weekday rule requires a weekday between 0 (Sunday) and 6 (Saturday).`);
        }
        if (typeof mr.occurrence !== 'number' || (![1, 2, 3, 4, -1].includes(mr.occurrence))) {
          errors.push(`Holiday #${rowNum}: Occurrence must be 1 (1st), 2 (2nd), 3 (3rd), 4 (4th), or -1 (Last).`);
        }
      }
      if (mr.ruleType === 'easter_relative') {
        if (typeof mr.easterOffsetDays !== 'number' || isNaN(mr.easterOffsetDays)) {
          errors.push(`Holiday #${rowNum}: Easter-relative rule requires a numeric easterOffsetDays (e.g. -2 for Good Friday).`);
        }
      }
    }

    if (h.penaltyMultiplier !== undefined && h.penaltyMultiplier !== null) {
      if (typeof h.penaltyMultiplier !== 'number' || h.penaltyMultiplier < 1.0 || h.penaltyMultiplier > 10.0) {
        errors.push(`Holiday #${rowNum}: Penalty multiplier must be between 1.0 and 10.0.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    summaryError: errors[0],
  };
}

/**
 * Returns statutory public holiday presets for supported jurisdictions.
 */
export function getDefaultPublicHolidaysForCountry(
  isoCode: string,
  year: number = 2025,
): PublicHolidayRulePayload {
  const normIso = (isoCode || 'AUS').toUpperCase();

  switch (normIso) {
    case 'AUS': {
      const goodFriday = calculateEasterRelativeDate(year, -2);
      const easterMonday = calculateEasterRelativeDate(year, 1);
      const kingsBirthday = calculateNthWeekdayOfMonth(year, 6, 1, 2); // 2nd Monday of June
      const labourDayNsw = calculateNthWeekdayOfMonth(year, 10, 1, 1); // 1st Monday of October (NSW/ACT/SA)
      const melbourneCupVic = calculateNthWeekdayOfMonth(year, 11, 2, 1); // 1st Tuesday of November (VIC)

      const holidays: PublicHolidayItem[] = [
        {
          id: `aus-nyd-${year}`,
          name: "New Year's Day",
          date: `${year}-01-01`,
          observedDate: calculateObservedDate(`${year}-01-01`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Public Holiday (Fair Work Act 2009 NES §115)',
        },
        {
          id: `aus-ad-${year}`,
          name: 'Australia Day',
          date: `${year}-01-26`,
          observedDate: calculateObservedDate(`${year}-01-26`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Public Holiday celebrating Australian national heritage',
        },
        {
          id: `aus-gf-${year}`,
          name: 'Good Friday',
          date: goodFriday,
          observedDate: goodFriday,
          dateType: 'moving',
          movingRule: {
            ruleType: 'easter_relative',
            easterOffsetDays: -2,
            description: 'Good Friday (2 days before Easter Sunday)',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Fair Work Public Holiday',
        },
        {
          id: `aus-em-${year}`,
          name: 'Easter Monday',
          date: easterMonday,
          observedDate: easterMonday,
          dateType: 'moving',
          movingRule: {
            ruleType: 'easter_relative',
            easterOffsetDays: 1,
            description: 'Easter Monday (1 day after Easter Sunday)',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Fair Work Public Holiday',
        },
        {
          id: `aus-anzac-${year}`,
          name: 'Anzac Day',
          date: `${year}-04-25`,
          observedDate: `${year}-04-25`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Day of Remembrance',
        },
        {
          id: `aus-kb-${year}`,
          name: "King's Birthday",
          date: kingsBirthday,
          observedDate: kingsBirthday,
          dateType: 'moving',
          movingRule: {
            ruleType: 'nth_weekday_of_month',
            month: 6,
            weekday: 1, // Monday
            occurrence: 2, // 2nd Monday
            description: '2nd Monday in June (National except WA/QLD)',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'Federal baseline holiday (proclamation varied in WA/QLD)',
        },
        {
          id: `aus-labour-nsw-${year}`,
          name: 'Labour Day (NSW / ACT / SA)',
          date: labourDayNsw,
          observedDate: labourDayNsw,
          dateType: 'moving',
          movingRule: {
            ruleType: 'nth_weekday_of_month',
            month: 10,
            weekday: 1, // Monday
            occurrence: 1, // 1st Monday
            description: '1st Monday in October',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: 'NSW',
          notes: 'State-specific Public Holiday in New South Wales',
        },
        {
          id: `aus-cup-vic-${year}`,
          name: 'Melbourne Cup Day (VIC)',
          date: melbourneCupVic,
          observedDate: melbourneCupVic,
          dateType: 'moving',
          movingRule: {
            ruleType: 'nth_weekday_of_month',
            month: 11,
            weekday: 2, // Tuesday
            occurrence: 1, // 1st Tuesday
            description: '1st Tuesday in November',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: 'VIC',
          notes: 'State-specific Public Holiday in Victoria',
        },
        {
          id: `aus-xmas-${year}`,
          name: 'Christmas Day',
          date: `${year}-12-25`,
          observedDate: calculateObservedDate(`${year}-12-25`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Fair Work Public Holiday',
        },
        {
          id: `aus-boxing-${year}`,
          name: 'Boxing Day',
          date: `${year}-12-26`,
          observedDate: calculateObservedDate(`${year}-12-26`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.5,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Fair Work Public Holiday',
        },
      ];

      return {
        holidays,
        defaultPenaltyMultiplier: 2.5,
        weekendObservationStrategy: 'following_weekday',
        calendarYears: [year],
        notes: 'Australia Fair Work Act 2009 NES §115 Public Holidays Baseline',
      };
    }
    case 'BGD': {
      const holidays: PublicHolidayItem[] = [
        {
          id: `bgd-lang-${year}`,
          name: 'International Mother Language Day',
          date: `${year}-02-21`,
          observedDate: `${year}-02-21`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'Shaheed Dibash (Bangladesh Labor Act 2006 §118)',
        },
        {
          id: `bgd-indep-${year}`,
          name: 'Independence Day',
          date: `${year}-03-26`,
          observedDate: `${year}-03-26`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'National Independence Day of Bangladesh',
        },
        {
          id: `bgd-pohela-${year}`,
          name: 'Bengali New Year (Pohela Boishakh)',
          date: `${year}-04-14`,
          observedDate: `${year}-04-14`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'First day of the Bengali calendar',
        },
        {
          id: `bgd-may-${year}`,
          name: 'May Day (Labor Day)',
          date: `${year}-05-01`,
          observedDate: `${year}-05-01`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'International Workers Day',
        },
        {
          id: `bgd-eid1-${year}`,
          name: 'Eid-ul-Fitr',
          date: `${year}-03-31`,
          observedDate: `${year}-03-31`,
          dateType: 'moving',
          movingRule: {
            ruleType: 'lunar_hijri',
            description: 'Subject to sighting of the moon (1st Shawwal)',
          },
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'Statutory Islamic Festival (3 days gazetted)',
        },
        {
          id: `bgd-victory-${year}`,
          name: 'Victory Day (Bijoy Dibosh)',
          date: `${year}-12-16`,
          observedDate: `${year}-12-16`,
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
          notes: 'Victory Day commemorating Liberation War victory',
        },
      ];

      return {
        holidays,
        defaultPenaltyMultiplier: 2.0,
        weekendObservationStrategy: 'none',
        calendarYears: [year],
        notes: 'Bangladesh Labor Act 2006 §118 Statutory Festival Holidays',
      };
    }
    default: {
      const holidays: PublicHolidayItem[] = [
        {
          id: `gen-nyd-${year}`,
          name: "New Year's Day",
          date: `${year}-01-01`,
          observedDate: calculateObservedDate(`${year}-01-01`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
        },
        {
          id: `gen-xmas-${year}`,
          name: 'Christmas Day',
          date: `${year}-12-25`,
          observedDate: calculateObservedDate(`${year}-12-25`),
          dateType: 'fixed',
          isHalfDay: false,
          penaltyMultiplier: 2.0,
          stateProvinceId: null,
          stateCode: null,
        },
      ];
      return {
        holidays,
        defaultPenaltyMultiplier: 2.0,
        weekendObservationStrategy: 'following_weekday',
        calendarYears: [year],
        notes: 'General Statutory Public Holidays Baseline',
      };
    }
  }
}

