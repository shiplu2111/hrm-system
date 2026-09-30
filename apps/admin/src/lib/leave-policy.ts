import type {
  LeaveAccrualType,
  LeavePolicyInput,
  LeavePolicyRecord,
  YearlyAccrualAnchor,
} from '@hrm/shared-types';
import type { FormErrors } from '@/hooks/useOrgForm';

export const MAX_APPROVAL_STEPS = 5;
export const DEFAULT_APPROVAL_STEPS = ['Manager', 'HR Admin'];

/** Role names the workflow engine resolves to the requester's reporting line. */
export const REPORTING_LINE_APPROVERS = [
  { value: 'Manager', label: 'Direct manager' },
  { value: 'Skip-level Manager', label: 'Skip-level manager' },
];

export const LEAVE_TYPE_PRESETS: Array<{ name: string; isPaid: boolean }> = [
  { name: 'Annual Leave', isPaid: true },
  { name: 'Sick Leave', isPaid: true },
  { name: 'Personal Leave', isPaid: true },
  { name: 'Unpaid Leave', isPaid: false },
  { name: 'Maternity Leave', isPaid: true },
  { name: 'Paternity Leave', isPaid: true },
  { name: 'Compassionate Leave', isPaid: true },
];

export type LeavePolicyFormValues = {
  entitlementDays: string;
  accrualType: LeaveAccrualType;
  yearlyAccrualAnchor: YearlyAccrualAnchor;
  carryForwardEnabled: boolean;
  carryForwardMax: string;
  /** Blank means carried-forward days never expire. */
  expiryMonths: string;
  encashmentAllowed: boolean;
  probationRestricted: boolean;
  allowNegativeBalance: boolean;
  /** Blank means no cap on the negative balance. */
  negativeBalanceCap: string;
  halfDayAllowed: boolean;
  deductPublicHolidays: boolean;
  approvalSteps: string[];
  effectiveFrom: string;
  effectiveTo: string;
};

/** Local calendar date as YYYY-MM-DD (not UTC, so it matches what the user sees). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultPolicyValues(effectiveFrom = todayIso()): LeavePolicyFormValues {
  return {
    entitlementDays: '20',
    accrualType: 'monthly',
    yearlyAccrualAnchor: 'financial_year',
    carryForwardEnabled: false,
    carryForwardMax: '5',
    expiryMonths: '',
    encashmentAllowed: false,
    probationRestricted: true,
    allowNegativeBalance: false,
    negativeBalanceCap: '',
    halfDayAllowed: true,
    deductPublicHolidays: false,
    approvalSteps: [...DEFAULT_APPROVAL_STEPS],
    effectiveFrom,
    effectiveTo: '',
  };
}

export function policyToFormValues(policy: LeavePolicyRecord): LeavePolicyFormValues {
  const carryForwardEnabled = (policy.carryForwardMax ?? 0) > 0;
  return {
    entitlementDays: String(policy.entitlementDays),
    accrualType: policy.accrualType,
    yearlyAccrualAnchor: policy.yearlyAccrualAnchor,
    carryForwardEnabled,
    carryForwardMax: carryForwardEnabled ? String(policy.carryForwardMax) : '5',
    expiryMonths: policy.expiryMonths ? String(policy.expiryMonths) : '',
    encashmentAllowed: policy.encashmentAllowed,
    probationRestricted: policy.probationRestricted,
    allowNegativeBalance: policy.allowNegativeBalance,
    negativeBalanceCap:
      policy.negativeBalanceCap !== null ? String(policy.negativeBalanceCap) : '',
    halfDayAllowed: policy.halfDayAllowed,
    deductPublicHolidays: policy.deductPublicHolidays,
    approvalSteps: policy.approvalSteps.length
      ? policy.approvalSteps.map((s) => s.roleName)
      : [...DEFAULT_APPROVAL_STEPS],
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo ?? '',
  };
}

export function formValuesToPolicyInput(values: LeavePolicyFormValues): LeavePolicyInput {
  return {
    entitlementDays: Number(values.entitlementDays),
    accrualType: values.accrualType,
    yearlyAccrualAnchor: values.yearlyAccrualAnchor,
    carryForwardMax: values.carryForwardEnabled ? Number(values.carryForwardMax) : null,
    expiryMonths:
      values.carryForwardEnabled && values.expiryMonths.trim()
        ? Number(values.expiryMonths)
        : null,
    encashmentAllowed: values.encashmentAllowed,
    probationRestricted: values.probationRestricted,
    allowNegativeBalance: values.allowNegativeBalance,
    negativeBalanceCap:
      values.allowNegativeBalance && values.negativeBalanceCap.trim()
        ? Number(values.negativeBalanceCap)
        : null,
    halfDayAllowed: values.halfDayAllowed,
    deductPublicHolidays: values.deductPublicHolidays,
    approvalSteps: values.approvalSteps.map((roleName) => ({ roleName: roleName.trim() })),
    effectiveFrom: values.effectiveFrom,
    effectiveTo: values.effectiveTo || null,
  };
}

function validateDays(
  raw: string,
  label: string,
  { required, min = 0 }: { required: boolean; min?: number },
): string | undefined {
  const value = raw.trim();
  if (!value) return required ? `${label} is required` : undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return `${label} must be a number with up to 2 decimals`;
  const n = Number(value);
  if (n < min) return `${label} must be at least ${min}`;
  if (n > 366) return `${label} cannot exceed 366 days`;
  return undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePolicyValues(
  values: LeavePolicyFormValues,
  /** New versions must start after every existing version of the leave type. */
  opts: { effectiveFromAfter?: string } = {},
): FormErrors<LeavePolicyFormValues> {
  const errors: FormErrors<LeavePolicyFormValues> = {};

  errors.entitlementDays = validateDays(values.entitlementDays, 'Entitlement', { required: true });

  if (values.carryForwardEnabled) {
    errors.carryForwardMax = validateDays(values.carryForwardMax, 'Carry-forward limit', {
      required: true,
      min: 0.5,
    });
    const expiry = values.expiryMonths.trim();
    if (expiry && (!/^\d+$/.test(expiry) || Number(expiry) < 1 || Number(expiry) > 60)) {
      errors.expiryMonths = 'Expiry must be a whole number of months between 1 and 60';
    }
  }

  if (values.allowNegativeBalance) {
    errors.negativeBalanceCap = validateDays(values.negativeBalanceCap, 'Negative cap', {
      required: false,
      min: 0.5,
    });
  }

  const steps = values.approvalSteps.map((s) => s.trim());
  if (steps.length === 0) errors.approvalSteps = 'Add at least one approval step';
  else if (steps.length > MAX_APPROVAL_STEPS)
    errors.approvalSteps = `At most ${MAX_APPROVAL_STEPS} approval steps`;
  else if (steps.some((s) => !s)) errors.approvalSteps = 'Choose an approver for every step';
  else if (new Set(steps).size !== steps.length)
    errors.approvalSteps = 'The same approver appears more than once';

  if (!DATE_RE.test(values.effectiveFrom)) {
    errors.effectiveFrom = 'Effective from is required';
  } else if (opts.effectiveFromAfter && values.effectiveFrom <= opts.effectiveFromAfter) {
    errors.effectiveFrom = `Must be after ${formatIsoDate(opts.effectiveFromAfter)}, when the latest version starts`;
  }
  if (values.effectiveTo) {
    if (!DATE_RE.test(values.effectiveTo)) errors.effectiveTo = 'Enter a valid date';
    else if (DATE_RE.test(values.effectiveFrom) && values.effectiveTo < values.effectiveFrom)
      errors.effectiveTo = 'Must be on or after the effective from date';
  }

  return errors;
}

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDays(n: number): string {
  const rounded = Number(n.toFixed(2));
  return `${rounded} ${Math.abs(rounded) === 1 ? 'day' : 'days'}`;
}

export function accrualSummary(
  policy: Pick<LeavePolicyRecord, 'accrualType' | 'entitlementDays' | 'yearlyAccrualAnchor'>,
): string {
  switch (policy.accrualType) {
    case 'monthly':
      return `Monthly, ${formatDays(policy.entitlementDays / 12)} per month`;
    case 'yearly':
      return policy.yearlyAccrualAnchor === 'hire_anniversary'
        ? 'Yearly, on hire anniversary'
        : 'Yearly, at financial year start';
    case 'on_hire':
      return 'In full on hire';
  }
}

export function carryForwardSummary(
  policy: Pick<LeavePolicyRecord, 'carryForwardMax' | 'expiryMonths'>,
): string {
  if (!policy.carryForwardMax) return 'None';
  const expiry = policy.expiryMonths
    ? `expires after ${policy.expiryMonths} month${policy.expiryMonths === 1 ? '' : 's'}`
    : 'no expiry';
  return `Up to ${formatDays(policy.carryForwardMax)}, ${expiry}`;
}

export function negativeBalanceSummary(
  policy: Pick<LeavePolicyRecord, 'allowNegativeBalance' | 'negativeBalanceCap'>,
): string {
  if (!policy.allowNegativeBalance) return 'Not allowed';
  return policy.negativeBalanceCap !== null
    ? `Allowed, down to −${formatDays(policy.negativeBalanceCap)}`
    : 'Allowed, no cap';
}

export type PolicyVersionStatus = 'current' | 'scheduled' | 'ended';

export function policyVersionStatus(
  policy: Pick<LeavePolicyRecord, 'effectiveFrom' | 'effectiveTo'>,
  today = todayIso(),
): PolicyVersionStatus {
  if (policy.effectiveFrom > today) return 'scheduled';
  if (policy.effectiveTo !== null && policy.effectiveTo < today) return 'ended';
  return 'current';
}

export function approverLabel(roleName: string): string {
  return REPORTING_LINE_APPROVERS.find((a) => a.value === roleName)?.label ?? roleName;
}
