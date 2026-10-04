import type {
  RuleLayer,
  SuperannuationField,
  SuperannuationFieldTrace,
  SuperannuationFieldValue,
  SuperannuationRates,
  SuperannuationValueSource,
  SuperannuationVersionTiming,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';
import { formatMoney, formatRate } from './payroll-copy';

export const LAYER_LABELS: Record<RuleLayer, string> = {
  global: 'Global default',
  country: 'Country',
  state: 'State / Province',
  company: 'Company',
  employee_contract: 'Employee contract',
};

export const FIELD_LABELS: Record<SuperannuationField, string> = {
  employerContributionRate: 'Employer contribution',
  employeeContributionRate: 'Employee contribution',
  contributionBase: 'Contribution base',
  schemeName: 'Scheme',
};

/** Display order: the rates people look for first. */
export const FIELD_ORDER: SuperannuationField[] = [
  'employerContributionRate',
  'employeeContributionRate',
  'contributionBase',
  'schemeName',
];

export const TIMING_LABELS: Record<SuperannuationVersionTiming, string> = {
  current: 'In effect',
  upcoming: 'Scheduled',
  past: 'Ended',
  superseded: 'Superseded',
};

export const TIMING_TONE: Record<SuperannuationVersionTiming, StatusPillTone> = {
  current: 'success',
  upcoming: 'accent',
  past: 'neutral',
  superseded: 'warning',
};

export function formatFieldValue(field: SuperannuationField, value: SuperannuationFieldValue): string {
  if (field === 'employerContributionRate' || field === 'employeeContributionRate') {
    return `${formatRate(Number(value))}%`;
  }
  if (field === 'contributionBase') {
    return value === 'basic' ? 'Basic pay' : 'Gross pay';
  }
  return String(value);
}

/** Short label for where a value comes from, e.g. "Company override" or "Inherited from country". */
export function sourceLabel(trace: Pick<SuperannuationFieldTrace, 'source' | 'inheritedValue'>): string {
  return describeSource(trace.source, trace.inheritedValue != null);
}

export function describeSource(source: SuperannuationValueSource, overridesSomething: boolean): string {
  switch (source) {
    case 'system_default':
      return 'Built-in default';
    case 'global':
      return 'Global default';
    case 'country':
      return 'Inherited from country';
    case 'state':
      return overridesSomething ? 'State override' : 'Set by state rule';
    case 'company':
      return overridesSomething ? 'Company override' : 'Set by company';
    case 'employee_contract':
      return 'Contract override';
  }
}

export function isCompanyLevelOverride(source: SuperannuationValueSource): boolean {
  return source === 'company' || source === 'state' || source === 'employee_contract';
}

/** "Employer 11% · Employee 0% · Gross pay · Superannuation Guarantee" */
export function summarizeValues(values: Partial<Record<SuperannuationField, SuperannuationFieldValue>>): string {
  const parts = FIELD_ORDER.flatMap((field) => {
    const value = values[field];
    if (value == null) return [];
    if (field === 'employerContributionRate') return [`Employer ${formatFieldValue(field, value)}`];
    if (field === 'employeeContributionRate') return [`Employee ${formatFieldValue(field, value)}`];
    return [formatFieldValue(field, value)];
  });
  return parts.join(' · ');
}

export const EXAMPLE_PAY = 5000;

export function exampleContributions(rates: SuperannuationRates, pay = EXAMPLE_PAY) {
  const employer = (pay * rates.employerContributionRate) / 100;
  const employee = (pay * rates.employeeContributionRate) / 100;
  return {
    pay: formatMoney(pay),
    employer: formatMoney(employer),
    employee: formatMoney(employee),
    total: formatMoney(employer + employee),
  };
}

export function formatSettingValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
