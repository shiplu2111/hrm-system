import {
  evaluateLifecycleAction,
  type CreateLifecycleEventInput,
  type EmployeeRecord,
  type LifecycleActionDecision,
  type LifecycleActor,
  type LifecycleEventType,
} from '@hrm/shared-types';
import {
  ArrowRightLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  LogOut,
  RotateCcw,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export type LifecycleActionKind =
  | 'promotion'
  | 'transfer'
  | 'salary_revision'
  | 'probation'
  | 'confirmation'
  | 'suspension'
  | 'exit'
  | 'rehire';

export type ExitType = 'resignation' | 'termination';

export interface LifecycleActionDefinition {
  kind: LifecycleActionKind;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'Career' | 'Status' | 'Exit';
  /** Event types this form can record; `exit` records either one. */
  eventTypes: LifecycleEventType[];
  /** Destructive actions go through a review step before submitting. */
  requiresReview: boolean;
}

export const LIFECYCLE_ACTIONS: LifecycleActionDefinition[] = [
  {
    kind: 'promotion',
    label: 'Promotion',
    description: 'Move to a higher designation',
    icon: TrendingUp,
    group: 'Career',
    eventTypes: ['promotion'],
    requiresReview: false,
  },
  {
    kind: 'transfer',
    label: 'Transfer',
    description: 'Change department, manager or cost centre',
    icon: ArrowRightLeft,
    group: 'Career',
    eventTypes: ['transfer'],
    requiresReview: false,
  },
  {
    kind: 'salary_revision',
    label: 'Salary revision',
    description: 'Record a compensation change',
    icon: DollarSign,
    group: 'Career',
    eventTypes: ['salary_revision'],
    requiresReview: false,
  },
  {
    kind: 'probation',
    label: 'Extend probation',
    description: 'Set a new probation end date',
    icon: CalendarClock,
    group: 'Status',
    eventTypes: ['probation'],
    requiresReview: false,
  },
  {
    kind: 'confirmation',
    label: 'Confirmation',
    description: 'Confirm after probation',
    icon: CheckCircle2,
    group: 'Status',
    eventTypes: ['confirmation'],
    requiresReview: false,
  },
  {
    kind: 'suspension',
    label: 'Suspension',
    description: 'Temporarily suspend employment',
    icon: Ban,
    group: 'Status',
    eventTypes: ['suspension'],
    requiresReview: true,
  },
  {
    kind: 'rehire',
    label: 'Rehire',
    description: 'Re-engage a former employee',
    icon: RotateCcw,
    group: 'Status',
    eventTypes: ['rehire'],
    requiresReview: false,
  },
  {
    kind: 'exit',
    label: 'Resignation / Termination',
    description: 'End employment and start offboarding',
    icon: LogOut,
    group: 'Exit',
    eventTypes: ['resignation', 'termination'],
    requiresReview: true,
  },
];

export function getLifecycleAction(kind: LifecycleActionKind): LifecycleActionDefinition {
  return LIFECYCLE_ACTIONS.find((a) => a.kind === kind)!;
}

type Target = Pick<EmployeeRecord, 'id' | 'employmentStatus'>;

export function evaluateForEmployee(
  actor: LifecycleActor | null,
  eventType: LifecycleEventType,
  employee: Target,
): LifecycleActionDecision {
  if (!actor) {
    return { allowed: false, reason: 'permission', message: 'Sign in to record lifecycle events.' };
  }
  return evaluateLifecycleAction(actor, eventType, {
    employeeId: employee.id,
    employmentStatus: employee.employmentStatus,
  });
}

/** An action is available when at least one of its event types is allowed. */
export function evaluateActionKind(
  actor: LifecycleActor | null,
  kind: LifecycleActionKind,
  employee: Target,
): LifecycleActionDecision {
  const decisions = getLifecycleAction(kind).eventTypes.map((type) =>
    evaluateForEmployee(actor, type, employee),
  );
  return decisions.find((d) => d.allowed) ?? decisions[decisions.length - 1];
}

/** True when the role can record this kind at all, ignoring the employee's current state. */
export function roleCanRecord(actor: LifecycleActor | null, kind: LifecycleActionKind): boolean {
  if (!actor) return false;
  return getLifecycleAction(kind).eventTypes.some(
    (type) => evaluateLifecycleAction(actor, type).allowed,
  );
}

export interface LifecycleFormState {
  effectiveDate: string;
  notes: string;
  newDesignationId: string;
  newDepartmentId: string;
  newManagerId: string;
  newCostCentreId: string;
  previousAmount: string;
  newAmount: string;
  currency: string;
  reason: string;
  suspensionEndDate: string;
  exitType: ExitType | '';
  lastWorkingDate: string;
  newProbationEndDate: string;
  confirmationDate: string;
  newHireDate: string;
}

export type LifecycleFormErrors = Partial<Record<keyof LifecycleFormState, string>>;

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function initialLifecycleForm(
  overrides: Partial<LifecycleFormState> = {},
): LifecycleFormState {
  return {
    effectiveDate: todayIso(),
    notes: '',
    newDesignationId: '',
    newDepartmentId: '',
    newManagerId: '',
    newCostCentreId: '',
    previousAmount: '',
    newAmount: '',
    currency: 'AUD',
    reason: '',
    suspensionEndDate: '',
    exitType: '',
    lastWorkingDate: '',
    newProbationEndDate: '',
    confirmationDate: '',
    newHireDate: '',
    ...overrides,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

function parseAmount(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type EmployeeContext = Pick<
  EmployeeRecord,
  'designationId' | 'departmentId' | 'managerId' | 'costCentreId' | 'probationEndDate'
>;

export function validateLifecycleForm(
  kind: LifecycleActionKind,
  form: LifecycleFormState,
  employee: EmployeeContext,
): LifecycleFormErrors {
  const errors: LifecycleFormErrors = {};

  if (!form.effectiveDate) errors.effectiveDate = 'Effective date is required.';
  else if (!isDate(form.effectiveDate)) errors.effectiveDate = 'Enter a valid date.';

  const afterEffective = (field: keyof LifecycleFormState, label: string) => {
    const value = form[field] as string;
    if (!value) return;
    if (!isDate(value)) errors[field] = 'Enter a valid date.';
    else if (isDate(form.effectiveDate) && value < form.effectiveDate) {
      errors[field] = `${label} can't be before the effective date.`;
    }
  };

  switch (kind) {
    case 'promotion':
      if (!form.newDesignationId) errors.newDesignationId = 'Choose the new designation.';
      else if (form.newDesignationId === employee.designationId) {
        errors.newDesignationId = 'Choose a designation different from the current one.';
      }
      if (form.newDepartmentId && form.newDepartmentId === employee.departmentId) {
        errors.newDepartmentId = 'Already in this department. Leave blank to keep it.';
      }
      if (form.newManagerId && form.newManagerId === employee.managerId) {
        errors.newManagerId = 'Already reports to this manager. Leave blank to keep it.';
      }
      break;

    case 'transfer': {
      const changes = [form.newDepartmentId, form.newManagerId, form.newCostCentreId].filter(Boolean);
      if (changes.length === 0) {
        errors.newDepartmentId = 'Choose at least one change: department, manager or cost centre.';
      }
      if (form.newDepartmentId && form.newDepartmentId === employee.departmentId) {
        errors.newDepartmentId = 'Already in this department.';
      }
      if (form.newManagerId && form.newManagerId === employee.managerId) {
        errors.newManagerId = 'Already reports to this manager.';
      }
      if (form.newCostCentreId && form.newCostCentreId === employee.costCentreId) {
        errors.newCostCentreId = 'Already assigned to this cost centre.';
      }
      break;
    }

    case 'salary_revision': {
      const previous = parseAmount(form.previousAmount);
      const next = parseAmount(form.newAmount);
      if (previous === null) errors.previousAmount = 'Enter the current salary.';
      else if (previous < 0) errors.previousAmount = 'Salary can’t be negative.';
      if (next === null) errors.newAmount = 'Enter the new salary.';
      else if (next <= 0) errors.newAmount = 'New salary must be greater than zero.';
      else if (previous !== null && next === previous) {
        errors.newAmount = 'New salary is the same as the current salary.';
      }
      if (!/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) {
        errors.currency = 'Use a 3-letter currency code, e.g. AUD.';
      }
      break;
    }

    case 'probation':
      if (!form.newProbationEndDate) {
        errors.newProbationEndDate = 'Choose the new probation end date.';
      } else if (
        employee.probationEndDate &&
        isDate(form.newProbationEndDate) &&
        form.newProbationEndDate <= employee.probationEndDate
      ) {
        errors.newProbationEndDate = `Must be after the current end date (${employee.probationEndDate}).`;
      } else {
        afterEffective('newProbationEndDate', 'Probation end date');
      }
      break;

    case 'confirmation':
      if (form.confirmationDate && !isDate(form.confirmationDate)) {
        errors.confirmationDate = 'Enter a valid date.';
      }
      break;

    case 'suspension':
      if (form.reason.trim().length < 3) errors.reason = 'Give a reason for the suspension.';
      afterEffective('suspensionEndDate', 'Suspension end date');
      break;

    case 'exit':
      if (!form.exitType) errors.exitType = 'Choose resignation or termination.';
      if (form.exitType === 'termination' && form.reason.trim().length < 3) {
        errors.reason = 'A reason is required for termination.';
      }
      afterEffective('lastWorkingDate', 'Last working date');
      break;

    case 'rehire':
      if (form.newHireDate && !isDate(form.newHireDate)) errors.newHireDate = 'Enter a valid date.';
      break;
  }

  return errors;
}

export function resolveEventType(
  kind: LifecycleActionKind,
  form: LifecycleFormState,
): LifecycleEventType {
  if (kind === 'exit') return form.exitType || 'resignation';
  return kind;
}

export function buildLifecycleRequest(
  kind: LifecycleActionKind,
  form: LifecycleFormState,
): CreateLifecycleEventInput {
  const details: Record<string, unknown> = {};
  const set = (key: string, value: string) => {
    if (value.trim()) details[key] = value.trim();
  };
  set('notes', form.notes);

  switch (kind) {
    case 'promotion':
      set('newDesignationId', form.newDesignationId);
      set('newDepartmentId', form.newDepartmentId);
      set('newManagerId', form.newManagerId);
      break;
    case 'transfer':
      set('newDepartmentId', form.newDepartmentId);
      set('newManagerId', form.newManagerId);
      set('newCostCentreId', form.newCostCentreId);
      break;
    case 'salary_revision':
      details.previousAmount = Number(form.previousAmount);
      details.newAmount = Number(form.newAmount);
      details.currency = form.currency.trim().toUpperCase();
      set('reason', form.reason);
      break;
    case 'probation':
      set('newProbationEndDate', form.newProbationEndDate);
      break;
    case 'confirmation':
      details.confirmationDate = form.confirmationDate || form.effectiveDate;
      break;
    case 'suspension':
      set('reason', form.reason);
      set('suspensionEndDate', form.suspensionEndDate);
      break;
    case 'exit':
      set('reason', form.reason);
      set('lastWorkingDate', form.lastWorkingDate);
      break;
    case 'rehire':
      set('newHireDate', form.newHireDate);
      set('newDepartmentId', form.newDepartmentId);
      set('newDesignationId', form.newDesignationId);
      break;
  }

  return {
    eventType: resolveEventType(kind, form),
    effectiveDate: form.effectiveDate,
    details,
  };
}

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
