import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayrollCalculationLine,
  PayrollCalculationPreview,
  RuleLayer,
  SuperannuationContributionPreview,
  SuperannuationField,
  SuperannuationFieldTrace,
  SuperannuationFieldValue,
  SuperannuationOtherSetting,
  SuperannuationRates,
  SuperannuationRuleWarning,
  SuperannuationValueSource,
} from '@hrm/shared-types';
import { mergeRulePayloads } from '../rule-resolver/rule-merge.utils';
import { formatMoney, parseMoney } from './payroll.utils';

export type SuperannuationContributionBase = 'gross' | 'basic';

export interface ResolvedSuperannuationRates {
  schemeName: string;
  employerContributionRate: Decimal;
  employeeContributionRate: Decimal;
  contributionBase: SuperannuationContributionBase;
}

export const DEFAULT_SUPERANNUATION_SCHEME_NAME = 'Superannuation / Pension';

/** Accepted payload keys per field, highest priority first. */
export const SUPERANNUATION_FIELD_KEYS: Record<
  SuperannuationField,
  readonly string[]
> = {
  schemeName: ['schemeName', 'scheme'],
  employerContributionRate: [
    'employerContributionRate',
    'superannuationGuaranteeRate',
    'employerRate',
  ],
  employeeContributionRate: ['employeeContributionRate', 'employeeRate'],
  contributionBase: ['contributionBase'],
};

export const SUPERANNUATION_FIELDS = Object.keys(
  SUPERANNUATION_FIELD_KEYS,
) as SuperannuationField[];

const DEFAULT_FIELD_VALUES: Record<SuperannuationField, SuperannuationFieldValue> =
  {
    schemeName: DEFAULT_SUPERANNUATION_SCHEME_NAME,
    employerContributionRate: 0,
    employeeContributionRate: 0,
    contributionBase: 'gross',
  };

const LAYER_LABELS: Record<RuleLayer, string> = {
  global: 'The global default',
  country: 'The country rule',
  state: 'The state rule',
  company: 'The company rule',
  employee_contract: 'The employee contract rule',
};

const ALL_FIELD_KEYS = new Set(Object.values(SUPERANNUATION_FIELD_KEYS).flat());

interface FieldHit {
  key: string;
  raw: unknown;
}

/** The payload key payroll reads for a field, mirroring `parseSuperannuationRates`. */
function readField(
  payload: Record<string, unknown>,
  field: SuperannuationField,
): FieldHit | null {
  for (const key of SUPERANNUATION_FIELD_KEYS[field]) {
    const raw = payload[key];
    if (field === 'schemeName') {
      if (typeof raw === 'string' && raw.trim()) return { key, raw };
    } else if (raw != null) {
      return { key, raw };
    }
  }
  return null;
}

/** Normalised value, or null when the raw value can't be used (payroll then falls back). */
function toFieldValue(
  field: SuperannuationField,
  raw: unknown,
): SuperannuationFieldValue | null {
  switch (field) {
    case 'schemeName':
      return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    case 'contributionBase':
      return raw === 'basic' ? 'basic' : 'gross';
    default:
      return readRate(raw)?.toNumber() ?? null;
  }
}

/** Parse merged `social_security` rule payload from the country-rule engine. */
export function parseSuperannuationRates(
  payload: Record<string, unknown>,
): ResolvedSuperannuationRates | null {
  const employer = readField(payload, 'employerContributionRate');
  const employee = readField(payload, 'employeeContributionRate');
  const employerRate = employer ? readRate(employer.raw) : null;
  const employeeRate = employee ? readRate(employee.raw) : null;

  if (employerRate == null && employeeRate == null) {
    return null;
  }

  const scheme = readField(payload, 'schemeName');

  return {
    schemeName:
      typeof scheme?.raw === 'string'
        ? scheme.raw.trim()
        : DEFAULT_SUPERANNUATION_SCHEME_NAME,
    employerContributionRate: employerRate ?? new Decimal(0),
    employeeContributionRate: employeeRate ?? new Decimal(0),
    contributionBase:
      payload.contributionBase === 'basic' ? 'basic' : 'gross',
  };
}

export function toSuperannuationRates(
  rates: ResolvedSuperannuationRates | null,
): SuperannuationRates {
  if (!rates) {
    return {
      schemeName: DEFAULT_SUPERANNUATION_SCHEME_NAME,
      employerContributionRate: 0,
      employeeContributionRate: 0,
      contributionBase: 'gross',
    };
  }
  return {
    schemeName: rates.schemeName,
    employerContributionRate: rates.employerContributionRate.toNumber(),
    employeeContributionRate: rates.employeeContributionRate.toNumber(),
    contributionBase: rates.contributionBase,
  };
}

/** The contribution fields a single rule payload sets on its own. */
export function superannuationValuesOf(
  payload: Record<string, unknown>,
): Partial<Record<SuperannuationField, SuperannuationFieldValue>> {
  const values: Partial<Record<SuperannuationField, SuperannuationFieldValue>> =
    {};
  for (const field of SUPERANNUATION_FIELDS) {
    const hit = readField(payload, field);
    const value = hit ? toFieldValue(field, hit.raw) : null;
    if (value != null) values[field] = value;
  }
  return values;
}

export interface SuperannuationLayerInput {
  layer: RuleLayer;
  payload: Record<string, unknown> | null;
}

interface FieldResolution {
  value: SuperannuationFieldValue;
  source: SuperannuationValueSource;
  sourceKey: string | null;
  sourceIndex: number;
}

function resolveField(
  layers: SuperannuationLayerInput[],
  field: SuperannuationField,
): FieldResolution {
  const merged = mergeRulePayloads(layers.map((entry) => entry.payload));
  const hit = readField(merged, field);
  const value = hit ? toFieldValue(field, hit.raw) : null;

  if (!hit || value == null) {
    return {
      value: DEFAULT_FIELD_VALUES[field],
      source: 'system_default',
      sourceKey: null,
      sourceIndex: -1,
    };
  }

  // Later layers win the merge, so the last layer that defines the key supplied it.
  let sourceIndex = -1;
  layers.forEach((entry, index) => {
    if (entry.payload && entry.payload[hit.key] !== undefined) {
      sourceIndex = index;
    }
  });

  return {
    value,
    source: layers[sourceIndex]?.layer ?? 'system_default',
    sourceKey: hit.key,
    sourceIndex,
  };
}

export interface SuperannuationTrace {
  configured: boolean;
  rates: SuperannuationRates;
  fields: SuperannuationFieldTrace[];
  otherSettings: SuperannuationOtherSetting[];
  warnings: SuperannuationRuleWarning[];
}

/**
 * Explain a resolved `social_security` rule field by field: the effective value, the layer
 * that supplied it and what the layers below would have given. `layers` must be in
 * Rule Resolver order and contain only the versions that applied.
 */
export function traceSuperannuationSettings(
  layers: SuperannuationLayerInput[],
): SuperannuationTrace {
  const applied = layers.filter((entry) => entry.payload != null);
  const merged = mergeRulePayloads(applied.map((entry) => entry.payload));
  const parsed = parseSuperannuationRates(merged);
  const warnings: SuperannuationRuleWarning[] = [];

  const fields = SUPERANNUATION_FIELDS.map((field): SuperannuationFieldTrace => {
    const resolution = resolveField(applied, field);
    const inherited =
      resolution.sourceIndex > 0
        ? resolveField(applied.slice(0, resolution.sourceIndex), field)
        : null;

    const layerValues: SuperannuationFieldTrace['layerValues'] = {};
    for (const entry of applied) {
      const hit = readField(entry.payload ?? {}, field);
      const value = hit ? toFieldValue(field, hit.raw) : null;
      if (value != null) layerValues[entry.layer] = value;
    }

    const winningKey = readField(merged, field)?.key ?? null;
    for (const entry of applied) {
      for (const key of SUPERANNUATION_FIELD_KEYS[field]) {
        const raw = entry.payload?.[key];
        if (raw == null) continue;
        if (field === 'schemeName' && (typeof raw !== 'string' || !raw.trim())) {
          continue;
        }
        warnings.push(
          ...fieldWarnings(entry.layer, field, key, raw, winningKey),
        );
      }
    }

    return {
      field,
      value: resolution.value,
      source: resolution.source,
      sourceKey: resolution.sourceKey,
      inheritedValue:
        inherited && inherited.source !== 'system_default'
          ? inherited.value
          : null,
      inheritedSource:
        inherited && inherited.source !== 'system_default'
          ? inherited.source
          : null,
      layerValues,
    };
  });

  const otherSettings: SuperannuationOtherSetting[] = Object.keys(merged)
    .filter((key) => !ALL_FIELD_KEYS.has(key))
    .map((key) => {
      let source: RuleLayer = applied[0].layer;
      for (const entry of applied) {
        if (entry.payload?.[key] !== undefined) source = entry.layer;
      }
      return { key, value: merged[key], source };
    });

  return {
    configured: parsed != null,
    rates: toSuperannuationRates(parsed),
    fields,
    otherSettings,
    warnings,
  };
}

function fieldWarnings(
  layer: RuleLayer,
  field: SuperannuationField,
  key: string,
  raw: unknown,
  winningKey: string | null,
): SuperannuationRuleWarning[] {
  const who = LAYER_LABELS[layer];

  if (winningKey && key !== winningKey) {
    return [
      {
        layer,
        key,
        message: `${who} sets "${key}", but payroll reads "${winningKey}" first, so this value is ignored.`,
      },
    ];
  }

  if (field === 'contributionBase' && raw !== 'gross' && raw !== 'basic') {
    return [
      {
        layer,
        key,
        message: `${who} sets "${key}" to ${JSON.stringify(raw)}; only "gross" or "basic" are supported, so payroll uses gross pay.`,
      },
    ];
  }

  if (field === 'employerContributionRate' || field === 'employeeContributionRate') {
    const rate = readRate(raw);
    if (rate == null) {
      return [
        {
          layer,
          key,
          message: `${who} sets "${key}" to ${JSON.stringify(raw)}, which is not a number, so payroll ignores it.`,
        },
      ];
    }
    if (rate.lt(0) || rate.gt(100)) {
      return [
        {
          layer,
          key,
          message: `${who} sets "${key}" to ${rate.toString()}%, which is outside 0–100%.`,
        },
      ];
    }
  }

  return [];
}

export function applySuperannuationToPreview(input: {
  preview: PayrollCalculationPreview;
  rates: ResolvedSuperannuationRates;
  basicAmount: Decimal;
  grossAmount: Decimal;
}): PayrollCalculationPreview {
  const { preview, rates, basicAmount, grossAmount } = input;

  const baseAmount =
    rates.contributionBase === 'basic' ? basicAmount : grossAmount;

  if (baseAmount.isZero()) {
    return { ...preview, superannuation: null };
  }

  const employerContribution = baseAmount
    .mul(rates.employerContributionRate)
    .div(100);
  const employeeContribution = baseAmount
    .mul(rates.employeeContributionRate)
    .div(100);

  if (employerContribution.isZero() && employeeContribution.isZero()) {
    return { ...preview, superannuation: null };
  }

  const deductions: PayrollCalculationLine[] = [...preview.deductions];
  let totalDeductions = parseMoney(preview.totalDeductions);
  let netPay = parseMoney(preview.netPay);

  if (employeeContribution.gt(0)) {
    deductions.push({
      salaryStructureId: 'superannuation-employee',
      componentId: 'superannuation-employee',
      componentName: `${rates.schemeName} (employee)`,
      componentType: 'deduction',
      calculationType: 'percentage',
      baseAmount: formatMoney(baseAmount),
      percentage: rates.employeeContributionRate.toNumber(),
      amount: formatMoney(employeeContribution),
      formulaDescription: 'Country social_security rule — employee contribution',
    });
    totalDeductions = totalDeductions.plus(employeeContribution);
    netPay = netPay.minus(employeeContribution);
  }

  const superannuation: SuperannuationContributionPreview = {
    schemeName: rates.schemeName,
    contributionBase: rates.contributionBase,
    employerContributionRate: rates.employerContributionRate.toNumber(),
    employeeContributionRate: rates.employeeContributionRate.toNumber(),
    baseAmount: formatMoney(baseAmount),
    employerContribution: formatMoney(employerContribution),
    employeeContribution: formatMoney(employeeContribution),
    totalContribution: formatMoney(employerContribution.plus(employeeContribution)),
    ruleType: 'social_security',
  };

  return {
    ...preview,
    totalDeductions: formatMoney(totalDeductions),
    netPay: formatMoney(netPay),
    deductions,
    superannuation,
  };
}

function readRate(value: unknown): Decimal | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Decimal(value);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return new Decimal(value);
    } catch {
      return null;
    }
  }
  return null;
}
