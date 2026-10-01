import {
  PAYROLL_RUN_FLOW,
  PAYROLL_RUN_RECALCULABLE_STATUSES,
  type PayrollPeriodRecord,
  type PayrollRunRecord,
  type PayrollRunStatus,
  type PayrollTotalsExpectation,
  type PermissionAction,
} from '@hrm/shared-types';
import { ApiError } from './tenant-api-client';

export const STALE_REVIEW_CODE = 'STALE_REVIEW';

export type RunAction = 'calculate' | 'submit' | 'approve' | 'finalize' | 'pay' | 'sendBack' | 'cancel';

/** Actions that need the review dialog with employee count and totals before they run. */
export type ConfirmedAction = 'approve' | 'finalize' | 'pay' | 'cancel' | 'calculate';

const FORWARD: Partial<Record<PayrollRunStatus, { action: RunAction; target: PayrollRunStatus }>> = {
  calculated: { action: 'submit', target: 'under_review' },
  under_review: { action: 'approve', target: 'approved' },
  approved: { action: 'finalize', target: 'finalized' },
  finalized: { action: 'pay', target: 'paid' },
};

const BACKWARD: Partial<Record<PayrollRunStatus, PayrollRunStatus>> = {
  under_review: 'calculated',
  approved: 'under_review',
};

const CANCELLABLE: readonly PayrollRunStatus[] = ['draft', 'calculated', 'under_review', 'approved'];

export function forwardStep(status: PayrollRunStatus) {
  return FORWARD[status] ?? null;
}

export function sendBackTarget(status: PayrollRunStatus): PayrollRunStatus | null {
  return BACKWARD[status] ?? null;
}

export function canCancel(status: PayrollRunStatus): boolean {
  return CANCELLABLE.includes(status);
}

export function canCalculate(status: PayrollRunStatus): boolean {
  return PAYROLL_RUN_RECALCULABLE_STATUSES.includes(status);
}

export function targetFor(action: Exclude<RunAction, 'calculate'>, from: PayrollRunStatus): PayrollRunStatus | null {
  if (action === 'sendBack') return sendBackTarget(from);
  if (action === 'cancel') return canCancel(from) ? 'cancelled' : null;
  const step = forwardStep(from);
  return step?.action === action ? step.target : null;
}

export function permissionFor(action: RunAction): PermissionAction {
  switch (action) {
    case 'approve':
      return 'approve';
    case 'finalize':
    case 'pay':
      return 'finalize';
    default:
      return 'edit';
  }
}

export function isLockedRun(run: Pick<PayrollRunRecord, 'status' | 'locked'>): boolean {
  return run.locked || run.status === 'finalized' || run.status === 'paid';
}

export function flowIndex(status: PayrollRunStatus): number {
  const index = PAYROLL_RUN_FLOW.indexOf(status);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/** Parses a 2-dp money string to integer cents so sums match the server's decimal arithmetic. */
export function toCents(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return Math.round(Number(value) * 100) || 0;
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -cents : cents;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Base-currency amounts of a run; runs not yet converted fall back to their pay currency amounts. */
export function baseAmounts(run: PayrollRunRecord) {
  return {
    gross: toCents(run.grossPayBase ?? run.grossPay),
    deductions: toCents(run.totalDeductionsBase ?? run.totalDeductions),
    net: toCents(run.netPayBase ?? run.netPay),
  };
}

export interface RunTotals {
  runCount: number;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
}

export function totalsFor(runs: PayrollRunRecord[]): RunTotals {
  const sum = { gross: 0, deductions: 0, net: 0 };
  for (const run of runs) {
    const amounts = baseAmounts(run);
    sum.gross += amounts.gross;
    sum.deductions += amounts.deductions;
    sum.net += amounts.net;
  }
  return {
    runCount: runs.length,
    grossPay: fromCents(sum.gross),
    totalDeductions: fromCents(sum.deductions),
    netPay: fromCents(sum.net),
  };
}

export function expectationFor(totals: RunTotals): PayrollTotalsExpectation {
  return { runCount: totals.runCount, grossPay: totals.grossPay, netPay: totals.netPay };
}

export function baseCurrencyOf(runs: PayrollRunRecord[]): string | null {
  return runs.find((run) => run.exchangeRate)?.baseCurrency ?? runs[0]?.baseCurrency ?? null;
}

/** What the user is about to do, frozen when they start so the review shows exactly what gets sent. */
export interface ActionPlan {
  action: RunAction;
  /** Null for calculate, which can span draft, calculated and under review. */
  fromStatus: PayrollRunStatus | null;
  targetStatus: PayrollRunStatus | null;
  runs: PayrollRunRecord[];
  totals: RunTotals;
}

export function buildPlan(action: RunAction, runs: PayrollRunRecord[]): ActionPlan | null {
  if (runs.length === 0) return null;
  if (action === 'calculate') {
    const eligible = runs.filter((run) => canCalculate(run.status));
    return eligible.length === 0
      ? null
      : { action, fromStatus: null, targetStatus: null, runs: eligible, totals: totalsFor(eligible) };
  }
  const fromStatus = runs[0].status;
  if (runs.some((run) => run.status !== fromStatus)) return null;
  const targetStatus = targetFor(action, fromStatus);
  return targetStatus ? { action, fromStatus, targetStatus, runs, totals: totalsFor(runs) } : null;
}

export function needsConfirmation(plan: ActionPlan): boolean {
  if (plan.action === 'calculate') return plan.runs.some((run) => run.status === 'under_review');
  return plan.action === 'approve' || plan.action === 'finalize' || plan.action === 'pay' || plan.action === 'cancel';
}

/** Actions available to runs that all share `status`, forward step first. */
export function actionsFor(status: PayrollRunStatus): RunAction[] {
  const actions: RunAction[] = [];
  if (status === 'draft') actions.push('calculate');
  const forward = forwardStep(status);
  if (forward) actions.push(forward.action);
  if (status === 'calculated' || status === 'under_review') actions.push('calculate');
  if (sendBackTarget(status)) actions.push('sendBack');
  if (canCancel(status)) actions.push('cancel');
  return actions;
}

export function isStaleReview(error: unknown): boolean {
  return error instanceof ApiError && error.code === STALE_REVIEW_CODE;
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);

/** `YYYY-MM` → first and last day of that month. */
export function monthRange(month: string): { startDate: string; endDate: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function isCalendarMonth(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate || startDate.slice(0, 7) !== endDate.slice(0, 7)) return false;
  const range = monthRange(startDate.slice(0, 7));
  return range.startDate === startDate.slice(0, 10) && range.endDate === endDate.slice(0, 10);
}

export function monthName(iso: string): string {
  return monthFormat.format(utc(iso));
}

export function periodLabel(period: Pick<PayrollPeriodRecord, 'startDate' | 'endDate'>): string {
  if (isCalendarMonth(period.startDate, period.endDate)) return monthName(period.startDate);
  return `${shortDateFormat.format(utc(period.startDate))} – ${shortDateFormat.format(utc(period.endDate))}`;
}

export function periodsOverlap(
  a: Pick<PayrollPeriodRecord, 'startDate' | 'endDate'>,
  b: Pick<PayrollPeriodRecord, 'startDate' | 'endDate'>,
): boolean {
  return a.startDate.slice(0, 10) <= b.endDate.slice(0, 10) && b.startDate.slice(0, 10) <= a.endDate.slice(0, 10);
}

/** The earliest step any active run is still in — what the period is waiting on. */
export function periodStage(statusCounts: Partial<Record<PayrollRunStatus, number>> | undefined): {
  stage: PayrollRunStatus | null;
  mixed: boolean;
  locked: boolean;
} {
  const present = PAYROLL_RUN_FLOW.filter((status) => (statusCounts?.[status] ?? 0) > 0);
  if (present.length === 0) return { stage: null, mixed: false, locked: false };
  return {
    stage: present[0],
    mixed: present.length > 1,
    locked: present.every((status) => status === 'finalized' || status === 'paid'),
  };
}
