import type { RuleLayer } from './rules';

/** Superannuation / pension contribution settings — MODULES.md §21 */

export type SuperannuationContributionBase = 'gross' | 'basic';

export type SuperannuationField =
  | 'schemeName'
  | 'employerContributionRate'
  | 'employeeContributionRate'
  | 'contributionBase';

/** Where an effective value came from: a Rule Resolver layer, or the built-in fallback. */
export type SuperannuationValueSource = RuleLayer | 'system_default';

export type SuperannuationFieldValue = string | number;

export interface SuperannuationRates {
  schemeName: string;
  employerContributionRate: number;
  employeeContributionRate: number;
  contributionBase: SuperannuationContributionBase;
}

export interface SuperannuationFieldTrace {
  field: SuperannuationField;
  value: SuperannuationFieldValue;
  source: SuperannuationValueSource;
  /** Payload key that supplied the value, e.g. `superannuationGuaranteeRate`. */
  sourceKey: string | null;
  /** Value the lower layers would give without the source layer. Null when nothing below set it. */
  inheritedValue: SuperannuationFieldValue | null;
  inheritedSource: SuperannuationValueSource | null;
  /** The value each applied layer sets on its own (layers that don't set the field are absent). */
  layerValues: Partial<Record<RuleLayer, SuperannuationFieldValue>>;
}

export interface SuperannuationOtherSetting {
  key: string;
  value: unknown;
  source: RuleLayer;
}

export interface SuperannuationRuleWarning {
  layer: RuleLayer;
  key: string;
  message: string;
}

export interface SuperannuationLayerSummary {
  layer: RuleLayer;
  applied: boolean;
  ruleId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  payload: Record<string, unknown> | null;
}

/** `superseded`: in its date range, but an overlapping version with a later start wins. */
export type SuperannuationVersionTiming = 'past' | 'current' | 'superseded' | 'upcoming';

export interface SuperannuationRuleVersion {
  id: string;
  layer: Exclude<RuleLayer, 'employee_contract'>;
  /** Only set for state/province versions. */
  stateCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Relative to the `asOf` date of the response. */
  timing: SuperannuationVersionTiming;
  /** Only the contribution fields this version sets itself. */
  values: Partial<Record<SuperannuationField, SuperannuationFieldValue>>;
  payload: Record<string, unknown>;
}

export interface SuperannuationStateRule {
  stateCode: string;
  ruleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employeeCount: number;
  payload: Record<string, unknown>;
}

export interface SuperannuationEmployeeException {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  stateCode: string | null;
  /** Per-employee layers that applied on top of the company default. */
  appliedLayers: Array<'state' | 'employee_contract'>;
  configured: boolean;
  rates: SuperannuationRates;
  /** Fields that differ from the company default. */
  differingFields: SuperannuationField[];
}

export interface SuperannuationSettingsRecord {
  ruleType: 'social_security';
  /** YYYY-MM-DD — the date the rules were resolved for. */
  asOf: string;
  company: { id: string; name: string; currency: string };
  country: { id: string; name: string; isoCode: string; currency: string };
  /** False when no layer sets a contribution rate — payroll then calculates no super. */
  configured: boolean;
  rates: SuperannuationRates;
  fields: SuperannuationFieldTrace[];
  /** Company-default resolution: the state and employee contract layers never apply here. */
  layers: SuperannuationLayerSummary[];
  otherSettings: SuperannuationOtherSetting[];
  warnings: SuperannuationRuleWarning[];
  versions: SuperannuationRuleVersion[];
  stateRules: SuperannuationStateRule[];
  employeeExceptions: SuperannuationEmployeeException[];
  /** Employees (not terminated) whose payroll resolves against this company. */
  employeeCount: number;
}
