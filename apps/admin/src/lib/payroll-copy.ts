import type {
  PayComponentCalculationType,
  PayComponentRecord,
  PayComponentType,
  PayFormulaCondition,
  PayFormulaExpression,
  PayFormulaRule,
  SalaryStructureRecord,
} from '@hrm/shared-types';
import { isPayFormulaRule, isPercentageFormula } from '@hrm/shared-types';

/**
 * All user-facing strings for the pay component and salary structure screens.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const payrollCopy = {
  common: {
    eyebrow: 'Payroll',
    cancel: 'Cancel',
    back: 'Back',
    retry: 'Retry',
    exportCsv: 'Export CSV',
    saving: 'Saving…',
    loading: 'Loading…',
    search: 'Search…',
    earning: 'Earning',
    deduction: 'Deduction',
    earnings: 'Earnings',
    deductions: 'Deductions',
    all: 'All',
    actions: 'Actions',
    total: 'Total',
    none: '—',
    auditNote: 'Every change is recorded in the audit log with the old value, new value and your name.',
  },
  calcType: {
    fixed: 'Fixed amount',
    percentage: 'Percentage',
    formula: 'Formula',
  } satisfies Record<PayComponentCalculationType, string>,
  calcTypeHint: {
    fixed: 'A set amount entered per employee (e.g. Basic salary, Transport allowance).',
    percentage: 'A rate applied to basic or gross pay (e.g. House rent 40% of basic, Pension 5%).',
    formula: 'Calculated by a structured rule from attendance, hours or loans (e.g. Overtime).',
  } satisfies Record<PayComponentCalculationType, string>,
  base: {
    basic: 'basic',
    gross: 'gross',
  },
  components: {
    title: 'Pay Components',
    description:
      'Define the earnings and deductions your company pays. Salary structures assign them to employees.',
    create: 'New component',
    statEarnings: 'Earning components',
    statDeductions: 'Deduction components',
    statInUse: 'In use',
    statInUseHint: 'assigned to at least one employee',
    filterCalc: 'Calculation',
    anyCalc: 'Any calculation',
    searchPlaceholder: 'Search components…',
    colName: 'Component',
    colType: 'Type',
    colCalc: 'Calculation',
    colRule: 'Rule',
    colEmployees: 'Employees',
    ruleFixed: 'Amount set per employee',
    rulePercentageDefault: (rate: string, base: string) => `${rate}% of ${base} (default)`,
    rulePercentageNoDefault: (base: string) => `Rate set per employee, of ${base}`,
    employees: (n: number) => `${n} employee${n === 1 ? '' : 's'}`,
    emptyTitle: 'No pay components yet',
    emptyDescription:
      'Start with Basic salary, then add allowances and deductions such as tax, pension or loan repayments.',
    emptyAction: 'Create your first component',
    noMatchTitle: 'No components match your filters',
    noMatchDescription: 'Try a different search or clear the filters.',
    clearFilters: 'Clear filters',
    loadError: 'Could not load pay components.',
    deleteBlocked: (rows: number) =>
      `Used in ${rows} salary structure row${rows === 1 ? '' : 's'} — payroll history must be kept.`,
    saved: (name: string) => `"${name}" saved.`,
    deleted: (name: string) => `"${name}" deleted.`,
  },
  componentForm: {
    createTitle: 'New pay component',
    editTitle: 'Edit pay component',
    description: 'Components are shared across all employees of the selected company.',
    name: 'Name',
    namePlaceholder: 'e.g. House Rent Allowance',
    type: 'Type',
    typeLocked: 'The type cannot change after creation.',
    calculation: 'Calculation',
    calcLocked: (n: number) =>
      `Assigned in ${n} salary structure row${n === 1 ? '' : 's'} — the calculation type is locked. Create a new component instead.`,
    base: 'Percentage of',
    baseBasic: 'Basic pay (sum of fixed earnings)',
    baseGross: 'Gross earnings',
    baseGrossEarningHint:
      'For earnings, gross only includes earnings calculated before this one. Basic is usually the right base for allowances.',
    defaultRate: 'Default rate (%)',
    defaultRateHint: 'Optional. Used when an employee’s salary structure doesn’t set its own rate.',
    template: 'Start from',
    templateOvertime: 'Overtime (hours above shift × rate × multiplier)',
    templateUnpaid: 'Unpaid leave deduction',
    templateLoan: 'Loan installment',
    templateCustom: 'Custom rule',
    formulaJson: 'Rule definition (structured JSON, version 1)',
    formulaReads: 'Reads as',
    formulaAvailableRefs: 'Available values',
    review: 'Review',
    errors: {
      nameRequired: 'Enter a name.',
      nameTooLong: 'Keep the name under 100 characters.',
      nameTaken: (type: string) => `Another ${type} already uses this name.`,
      rateRange: 'Enter a rate between 0 and 100 with up to 2 decimals.',
      formulaJson: 'This is not valid JSON.',
      formulaShape: 'A rule needs "version": 1 and a "then" expression.',
    },
  },
  componentReview: {
    createTitle: 'Confirm new pay component',
    editTitle: 'Confirm pay component changes',
    deleteTitle: 'Delete pay component?',
    createIntro: 'This component will be available to assign in salary structures.',
    createImpact: 'No employee’s pay changes until the component is assigned to them.',
    editImpact: (n: number) =>
      n === 0
        ? 'No employees currently have this component, so no pay changes right now.'
        : `${n === 1 ? '1 employee currently has' : `${n} employees currently have`} this component. Their pay will be calculated with the new settings from the next payroll run.`,
    finalizedNote: 'Finalized payroll is locked and will not change.',
    deleteBody: (name: string) =>
      `"${name}" has never been assigned. Deleting it removes it from the component list.`,
    noChanges: 'Nothing has changed.',
    field: 'Field',
    current: 'Current',
    next: 'New',
    confirmCreate: 'Create component',
    confirmSave: 'Save changes',
    confirmDelete: 'Delete component',
  },
  structures: {
    title: 'Salary Structures',
    description:
      'Each employee’s earnings and deductions, built from your pay components. Changes are effective-dated and never overwrite finalized payroll.',
    employees: 'Employees',
    searchEmployees: 'Search name or ID…',
    noEmployeesTitle: 'No employees in this company',
    noEmployeesDescription: 'Add employees before setting up their pay.',
    noEmployeeMatch: 'No employees match your search.',
    selectTitle: 'Select an employee',
    selectDescription: 'Pick someone from the list to see and change their salary structure.',
    asOf: 'Pay as of',
    gross: 'Gross earnings',
    totalDeductions: 'Total deductions',
    net: 'Net pay',
    breakdown: (date: string) => `Pay breakdown on ${date}`,
    breakdownEmpty: 'Nothing is payable on this date.',
    previewError: 'Could not calculate pay for this date.',
    assignments: 'Assignments',
    assignmentsHint: 'Full history, newest first. Ended rows stay for audit and retroactive adjustments.',
    showEnded: 'Show ended',
    addComponent: 'Add component',
    colComponent: 'Component',
    colValue: 'Value',
    colFrom: 'Effective from',
    colTo: 'Until',
    colStatus: 'Status',
    openEnded: 'Ongoing',
    statusActive: 'Active',
    statusScheduled: 'Scheduled',
    statusEnded: 'Ended',
    locked: 'Finalized payroll',
    lockedRowHint: 'Covers finalized payroll — record changes as a revision instead of editing.',
    lockBanner: (periods: string) =>
      `Finalized payroll for this employee: ${periods}. Entries can’t be edited in ways that change those periods; back-dated changes are settled as retroactive adjustments.`,
    valueFormula: 'Calculated by formula',
    valuePercentage: (rate: string, base: string) => `${rate}% of ${base}`,
    valueDefaultRate: (rate: string, base: string) => `${rate}% of ${base} (component default)`,
    actionRevise: 'Change amount',
    actionReviseHint: 'From a new effective date; keeps history',
    actionCorrect: 'Correct entry',
    actionCorrectHint: 'Fix a mistake in this row',
    actionEnd: 'End assignment',
    actionDelete: 'Delete',
    deleteLockedReason: 'Covers finalized payroll — end the assignment instead.',
    correctLockedReason: 'Covers finalized payroll — use Change amount instead.',
    emptyTitle: 'No salary structure yet',
    emptyDescription: 'Add Basic salary first, then allowances and deductions.',
    noComponentsTitle: 'No pay components defined',
    noComponentsDescription: 'Create earnings and deductions before building salary structures.',
    goToComponents: 'Go to Pay Components',
    loadError: 'Could not load this employee’s salary structure.',
    saved: 'Salary structure updated and recorded in the audit log.',
  },
  structureForm: {
    addTitle: 'Add component to salary structure',
    reviseTitle: 'Change amount',
    reviseDescription:
      'The current entry ends the day before the new date and a new entry starts, so earlier pay stays on record.',
    correctTitle: 'Correct entry',
    correctDescription: 'Only use this to fix a data-entry mistake. To give a raise, use Change amount.',
    endTitle: 'End assignment',
    endDescription: 'The component stops being paid or deducted after this date.',
    component: 'Pay component',
    chooseComponent: 'Choose a component…',
    amount: 'Amount',
    percentage: 'Rate (%)',
    percentageDefaultHint: (rate: string) => `Leave blank to use the component default (${rate}%).`,
    percentageBaseHint: (base: string) => `Applied to the employee’s ${base} pay.`,
    formulaNote: 'This component is calculated automatically by its formula. No amount is needed.',
    effectiveFrom: 'Effective from',
    effectiveTo: 'Until (optional)',
    newEffectiveFrom: 'New amount effective from',
    endDate: 'Last day',
    current: 'Current',
    review: 'Review change',
    errors: {
      componentRequired: 'Choose a component.',
      amountRequired: 'Enter an amount.',
      amountFormat: 'Use a positive number with up to 2 decimals.',
      percentageRequired: 'Enter a rate — this component has no default.',
      percentageRange: 'Enter a rate between 0 and 100 with up to 2 decimals.',
      dateRequired: 'Choose a date.',
      toBeforeFrom: 'The end date must be on or after the start date.',
      overlap: (from: string, to: string | null) =>
        `This employee already has this component ${to ? `from ${from} to ${to}` : `from ${from} onwards`}. End that entry first or pick other dates.`,
      reviseAfterStart: (date: string) => `Must be after ${date}, when the current entry starts.`,
      reviseBeforeEnd: (date: string) => `Must be on or before ${date}, when the current entry ends.`,
      sameValue: 'The new value is the same as the current one.',
      endBeforeStart: (date: string) => `Must be on or after ${date}.`,
      endInLockedPeriod: (periods: string) =>
        `Ending here would change finalized payroll (${periods}). Choose a last day on or after the end of that period.`,
      touchesLockedPeriod: (periods: string) =>
        `This correction would change finalized payroll (${periods}). Use Change amount instead, or keep those dates as they are.`,
      noChange: 'Nothing has changed.',
    },
  },
  structureReview: {
    title: 'Review salary change',
    intro: 'Check the impact before saving. This change affects what the employee is paid.',
    employee: 'Employee',
    change: 'Change',
    effective: 'Effective',
    impactTitle: (date: string) => `Pay on ${date}`,
    impactCurrent: 'Current',
    impactAfter: 'After change',
    impactDiff: 'Difference',
    impactUnavailable: (message: string) => `The pay impact could not be calculated: ${message}`,
    impactLoading: 'Calculating impact…',
    retroTitle: 'This change covers finalized payroll',
    retroBody: (periods: string) =>
      `Finalized payslips for ${periods} will not change. After saving, raise a retroactive adjustment so the difference is paid or recovered in the next payroll.`,
    acknowledgeRetro: 'I understand finalized payroll needs a retroactive adjustment.',
    acknowledgeUnavailable: 'I have checked the figures myself and want to save anyway.',
    confirm: 'Confirm and save',
    confirmDelete: 'Delete entry',
    describeAdd: (name: string, value: string) => `Add ${name}: ${value}`,
    describeRevise: (name: string, from: string, to: string) => `${name}: ${from} → ${to}`,
    describeCorrect: (name: string) => `Correct ${name}`,
    describeEnd: (name: string, date: string) => `Stop ${name} after ${date}`,
    describeDelete: (name: string) => `Delete ${name} entry`,
    detailValue: (from: string, to: string) => `Value: ${from} → ${to}`,
    detailDates: (from: string, to: string) => `Dates: ${from} → ${to}`,
  },
} as const;

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return payrollCopy.common.none;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? moneyFormat.format(n) : String(value);
}

export function formatSignedMoney(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return formatMoney(0);
  return `${n > 0 ? '+' : '−'}${moneyFormat.format(Math.abs(n))}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return payrollCopy.common.none;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

export function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0+$/, '');
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
export const RATE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export function isValidRate(value: string): boolean {
  if (!RATE_PATTERN.test(value.trim())) return false;
  const n = Number(value);
  return n >= 0 && n <= 100;
}

export function componentTypeLabel(type: PayComponentType): string {
  return type === 'earning' ? payrollCopy.common.earning : payrollCopy.common.deduction;
}

export function percentageSettings(component: Pick<PayComponentRecord, 'formula'>): {
  base: 'basic' | 'gross';
  defaultRate: number | null;
} {
  const formula = component.formula;
  if (formula && isPercentageFormula(formula)) {
    return {
      base: formula.base === 'gross' ? 'gross' : 'basic',
      defaultRate: formula.percentage ?? null,
    };
  }
  return { base: 'basic', defaultRate: null };
}

export function describeComponentRule(component: PayComponentRecord): string {
  const copy = payrollCopy.components;
  if (component.calculationType === 'fixed') return copy.ruleFixed;
  if (component.calculationType === 'percentage') {
    const { base, defaultRate } = percentageSettings(component);
    return defaultRate === null
      ? copy.rulePercentageNoDefault(payrollCopy.base[base])
      : copy.rulePercentageDefault(formatRate(defaultRate), payrollCopy.base[base]);
  }
  return component.formula && isPayFormulaRule(component.formula)
    ? describeFormula(component.formula)
    : payrollCopy.calcType.formula;
}

export function describeStructureValue(
  row: Pick<SalaryStructureRecord, 'amountOrFormula' | 'componentCalculationType'>,
  component?: PayComponentRecord,
): string {
  const copy = payrollCopy.structures;
  const calc = row.componentCalculationType ?? component?.calculationType;
  if (calc === 'formula') return copy.valueFormula;
  if (calc === 'percentage') {
    const settings = component ? percentageSettings(component) : { base: 'basic' as const, defaultRate: null };
    const base = payrollCopy.base[settings.base];
    if (row.amountOrFormula.percentage !== undefined) {
      return copy.valuePercentage(formatRate(row.amountOrFormula.percentage), base);
    }
    return settings.defaultRate === null
      ? payrollCopy.common.none
      : copy.valueDefaultRate(formatRate(settings.defaultRate), base);
  }
  return formatMoney(row.amountOrFormula.amount);
}

const REF_LABELS: Record<string, string> = {
  'employee.worked_hours': 'worked hours',
  'employee.hourly_rate': 'hourly rate',
  'shift.standard_hours': 'standard shift hours',
  'shift.ot_multiplier': 'overtime multiplier',
  'attendance.status': 'attendance status',
  'attendance.unpaid_days': 'unpaid days',
  'payroll.basic_salary': 'basic salary',
  'payroll.gross_earnings': 'gross earnings',
  'payroll.working_days_in_period': 'working days in period',
  'loan.installment_amount': 'loan installment',
  'loan.remaining_balance': 'loan balance',
  'loan.active_count': 'active loans',
};

export function refLabel(ref: string): string {
  return REF_LABELS[ref] ?? ref;
}

const OP_SYMBOLS = { add: '+', sub: '−', mul: '×', div: '÷' } as const;
const COMPARE_SYMBOLS = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' } as const;

function describeExpression(expr: PayFormulaExpression, nested = false): string {
  if ('lit' in expr) return String(expr.lit).replace(/_/g, ' ');
  if ('ref' in expr) return refLabel(expr.ref);
  const joined = expr.args
    .map((arg) => describeExpression(arg, true))
    .join(` ${OP_SYMBOLS[expr.op] ?? expr.op} `);
  return nested ? `(${joined})` : joined;
}

function describeCondition(cond: PayFormulaCondition): string {
  return `${describeExpression(cond.left)} ${COMPARE_SYMBOLS[cond.op] ?? cond.op} ${describeExpression(cond.right)}`;
}

export function describeFormula(rule: PayFormulaRule): string {
  const then = describeExpression(rule.then);
  if (!rule.when) return then;
  const otherwise = rule.else ? describeExpression(rule.else) : '0';
  return `If ${describeCondition(rule.when)} then ${then}, otherwise ${otherwise}`;
}
