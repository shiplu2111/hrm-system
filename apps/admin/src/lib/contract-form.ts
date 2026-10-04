import type {
  EmploymentContractRecord,
  EmploymentContractType,
  OvertimeRule,
  PayFrequency,
} from '@hrm/shared-types';
import type {
  CreateEmploymentContractInput,
  UpdateEmploymentContractInput,
} from '@/lib/contracts-api';

export type OvertimeType = OvertimeRule['type'];

export const OVERTIME_TYPE_LABELS: Record<OvertimeType, string> = {
  none: 'No overtime',
  multiplier_after_weekly_hours: 'After weekly hours',
  multiplier_after_daily_hours: 'After daily hours',
};

/** Contract terms as edited in forms — every input is a string until submitted. */
export interface ContractTermsForm {
  contractType: EmploymentContractType;
  startDate: string;
  endDate: string;
  probationEndDate: string;
  workingHoursPerWeek: string;
  payRate: string;
  payFrequency: PayFrequency | '';
  currency: string;
  leaveEntitlementDays: string;
  overtimeType: OvertimeType;
  overtimeThreshold: string;
  overtimeMultiplier: string;
  noticePeriodDays: string;
  employerNoticeDays: string;
  terminationConditions: string;
}

export type ContractTermsErrors = Partial<Record<keyof ContractTermsForm, string>>;

export function emptyTermsForm(overrides: Partial<ContractTermsForm> = {}): ContractTermsForm {
  return {
    contractType: 'permanent',
    startDate: '',
    endDate: '',
    probationEndDate: '',
    workingHoursPerWeek: '40',
    payRate: '',
    payFrequency: 'monthly',
    currency: 'AUD',
    leaveEntitlementDays: '25',
    overtimeType: 'multiplier_after_weekly_hours',
    overtimeThreshold: '40',
    overtimeMultiplier: '1.5',
    noticePeriodDays: '30',
    employerNoticeDays: '30',
    terminationConditions: '',
    ...overrides,
  };
}

const numberText = (value: number | null | undefined) => (value == null ? '' : String(value));

export function termsFormFromRecord(record: EmploymentContractRecord): ContractTermsForm {
  const rule = record.overtimeRule;
  return {
    contractType: record.contractType,
    startDate: record.startDate,
    endDate: record.endDate ?? '',
    probationEndDate: record.probationEndDate ?? '',
    workingHoursPerWeek: numberText(record.workingHoursPerWeek),
    payRate: numberText(record.payRate),
    payFrequency: record.payFrequency ?? '',
    currency: record.currency,
    leaveEntitlementDays: numberText(record.leaveEntitlementDays),
    overtimeType: rule?.type ?? 'none',
    overtimeThreshold: numberText(rule?.thresholdHours),
    overtimeMultiplier: numberText(rule?.multiplier),
    noticePeriodDays: numberText(record.noticePeriodDays),
    employerNoticeDays: numberText(record.employerNoticeDays),
    terminationConditions: record.terminationConditions ?? '',
  };
}

/** Terms carried into a new contract: same pay and rules, fresh dates. */
export function termsFormForNewContract(previous: EmploymentContractRecord | undefined): ContractTermsForm {
  if (!previous) return emptyTermsForm();
  return { ...termsFormFromRecord(previous), startDate: '', endDate: '', probationEndDate: '' };
}

function isNonNegativeNumber(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function validateTermsForm(form: ContractTermsForm): ContractTermsErrors {
  const errors: ContractTermsErrors = {};
  if (!form.startDate) errors.startDate = 'Enter a start date.';
  if (form.endDate && form.startDate && form.endDate < form.startDate) {
    errors.endDate = 'End date must be on or after the start date.';
  }
  if (form.contractType === 'fixed_term' && !form.endDate) {
    errors.endDate = 'Fixed-term contracts need an end date.';
  }
  if (form.probationEndDate && form.startDate && form.probationEndDate < form.startDate) {
    errors.probationEndDate = 'Probation must end after the start date.';
  }
  if (form.probationEndDate && form.endDate && form.probationEndDate > form.endDate) {
    errors.probationEndDate = 'Probation must end before the contract does.';
  }
  const optionalNumbers: (keyof ContractTermsForm)[] = [
    'workingHoursPerWeek',
    'payRate',
    'leaveEntitlementDays',
    'noticePeriodDays',
    'employerNoticeDays',
  ];
  for (const key of optionalNumbers) {
    if (form[key] !== '' && !isNonNegativeNumber(form[key])) errors[key] = 'Enter a number of 0 or more.';
  }
  for (const key of ['noticePeriodDays', 'employerNoticeDays'] as const) {
    if (!errors[key] && form[key] !== '' && !Number.isInteger(Number(form[key]))) {
      errors[key] = 'Use whole days.';
    }
  }
  if (form.payRate !== '' && !form.payFrequency) errors.payFrequency = 'Choose how often the rate is paid.';
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) errors.currency = 'Use a 3-letter currency code, e.g. AUD.';
  if (form.overtimeType !== 'none') {
    if (!isNonNegativeNumber(form.overtimeThreshold) || Number(form.overtimeThreshold) === 0) {
      errors.overtimeThreshold = 'Enter the hours after which overtime applies.';
    }
    if (!isNonNegativeNumber(form.overtimeMultiplier) || Number(form.overtimeMultiplier) < 1) {
      errors.overtimeMultiplier = 'Use a multiplier of 1 or more, e.g. 1.5.';
    }
  }
  return errors;
}

const optionalNumber = (value: string) => (value.trim() === '' ? null : Number(value));
const optionalText = (value: string) => (value.trim() === '' ? null : value.trim());

function toOvertimeRule(form: ContractTermsForm): OvertimeRule {
  if (form.overtimeType === 'none') return { type: 'none' };
  return {
    type: form.overtimeType,
    thresholdHours: Number(form.overtimeThreshold),
    multiplier: Number(form.overtimeMultiplier),
  };
}

/** Normalised terms in API shape; `null` means "not set". */
function toTerms(form: ContractTermsForm) {
  return {
    contractType: form.contractType,
    startDate: form.startDate,
    endDate: optionalText(form.endDate),
    probationEndDate: optionalText(form.probationEndDate),
    workingHoursPerWeek: optionalNumber(form.workingHoursPerWeek),
    payRate: optionalNumber(form.payRate),
    payFrequency: form.payFrequency || null,
    currency: form.currency.trim().toUpperCase(),
    leaveEntitlementDays: optionalNumber(form.leaveEntitlementDays),
    overtimeRule: toOvertimeRule(form),
    noticePeriodDays: optionalNumber(form.noticePeriodDays),
    employerNoticeDays: optionalNumber(form.employerNoticeDays),
    terminationConditions: optionalText(form.terminationConditions),
  };
}

export function termsFormToCreateInput(
  employeeId: string,
  form: ContractTermsForm,
  activate: boolean,
): CreateEmploymentContractInput {
  const terms = toTerms(form);
  return {
    employeeId,
    activate,
    contractType: terms.contractType,
    startDate: terms.startDate,
    endDate: terms.endDate ?? undefined,
    probationEndDate: terms.probationEndDate ?? undefined,
    workingHoursPerWeek: terms.workingHoursPerWeek ?? undefined,
    payRate: terms.payRate ?? undefined,
    payFrequency: terms.payFrequency ?? undefined,
    currency: terms.currency,
    leaveEntitlementDays: terms.leaveEntitlementDays ?? undefined,
    overtimeRule: terms.overtimeRule,
    noticePeriodDays: terms.noticePeriodDays ?? undefined,
    employerNoticeDays: terms.employerNoticeDays ?? undefined,
    terminationConditions: terms.terminationConditions ?? undefined,
  };
}

function sameOvertime(a: OvertimeRule | null, b: OvertimeRule): boolean {
  const left = a ?? { type: 'none' as const };
  if (left.type !== b.type) return false;
  if (b.type === 'none') return true;
  return left.thresholdHours === b.thresholdHours && left.multiplier === b.multiplier;
}

/** Only the fields that differ from the saved contract, so the audit log shows real changes. */
export function termsFormToUpdateInput(
  record: EmploymentContractRecord,
  form: ContractTermsForm,
): UpdateEmploymentContractInput {
  const next = toTerms(form);
  const patch: UpdateEmploymentContractInput = {};
  if (next.contractType !== record.contractType) patch.contractType = next.contractType;
  if (next.startDate !== record.startDate) patch.startDate = next.startDate;
  if (next.endDate !== record.endDate) patch.endDate = next.endDate;
  if (next.probationEndDate !== record.probationEndDate) patch.probationEndDate = next.probationEndDate;
  if (next.workingHoursPerWeek !== record.workingHoursPerWeek) patch.workingHoursPerWeek = next.workingHoursPerWeek;
  if (next.payRate !== record.payRate) patch.payRate = next.payRate;
  if (next.payFrequency !== record.payFrequency) patch.payFrequency = next.payFrequency;
  if (next.currency !== record.currency) patch.currency = next.currency;
  if (next.leaveEntitlementDays !== record.leaveEntitlementDays) {
    patch.leaveEntitlementDays = next.leaveEntitlementDays;
  }
  if (!sameOvertime(record.overtimeRule, next.overtimeRule)) patch.overtimeRule = next.overtimeRule;
  if (next.noticePeriodDays !== record.noticePeriodDays) patch.noticePeriodDays = next.noticePeriodDays;
  if (next.employerNoticeDays !== record.employerNoticeDays) patch.employerNoticeDays = next.employerNoticeDays;
  if (next.terminationConditions !== (record.terminationConditions?.trim() || null)) {
    patch.terminationConditions = next.terminationConditions;
  }
  return patch;
}

const PAY_SUFFIX: Record<PayFrequency, string> = {
  hourly: '/hr',
  weekly: '/wk',
  biweekly: '/fortnight',
  monthly: '/mo',
  annual: '/yr',
};

export function formatContractPay(contract: Pick<EmploymentContractRecord, 'payRate' | 'payFrequency' | 'currency'>): string {
  if (contract.payRate == null) return '—';
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: contract.currency,
      maximumFractionDigits: 2,
    }).format(contract.payRate);
  } catch {
    formatted = `${contract.currency} ${contract.payRate}`;
  }
  return contract.payFrequency ? `${formatted}${PAY_SUFFIX[contract.payFrequency]}` : formatted;
}

export function formatOvertimeRule(rule: OvertimeRule | null): string {
  if (!rule || rule.type === 'none') return 'No overtime';
  if (rule.description) return rule.description;
  const multiplier = rule.multiplier ?? 1.5;
  return rule.type === 'multiplier_after_weekly_hours'
    ? `${multiplier}× after ${rule.thresholdHours ?? 40} hrs/week`
    : `${multiplier}× after ${rule.thresholdHours ?? 8} hrs/day`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatContractDate(isoDate: string | null, empty = '—'): string {
  if (!isoDate) return empty;
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormat.format(date);
}

/** "in 12 days", "today", "5 days ago" — for end dates. */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

/** Whole days from today until `isoDate` (negative once past); null without a date. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Contracts that can still run out: live, not terminated, with an end date inside the window. */
export function endsWithin(contract: EmploymentContractRecord, days: number): boolean {
  if (contract.status !== 'active') return false;
  const remaining = daysUntil(contract.endDate);
  return remaining !== null && remaining >= 0 && remaining <= days;
}

/** The renewal draft or pending renewal that supersedes `contract`, if one exists. */
export function openRenewalOf(
  contract: EmploymentContractRecord,
  all: EmploymentContractRecord[],
): EmploymentContractRecord | undefined {
  return all.find((c) => c.renewedFromId === contract.id && c.status !== 'terminated');
}

/** A live contract can be renewed once, while no renewal is already in progress. */
export function canRenew(contract: EmploymentContractRecord, all: EmploymentContractRecord[]): boolean {
  return contract.status === 'active' && !openRenewalOf(contract, all);
}
