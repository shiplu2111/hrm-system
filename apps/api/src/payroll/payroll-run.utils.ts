import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PAYROLL_RUN_RECALCULABLE_STATUSES,
  PAYROLL_RUN_TRANSITIONS,
  type PayrollPeriodStatus,
  type PayrollPeriodSummary,
  type PayrollRunStatus,
  type PermissionAction,
} from '@hrm/shared-types';
import { formatMoney } from './payroll.utils';

export { PAYROLL_RUN_RECALCULABLE_STATUSES, PAYROLL_RUN_TRANSITIONS };

/** Money fields of a run as stored; `*Base` is null until the run is calculated. */
export interface RunAmounts {
  status: PayrollRunStatus;
  grossPay: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  grossPayBase: Decimal | null;
  totalDeductionsBase: Decimal | null;
  netPayBase: Decimal | null;
  baseCurrency: string;
  exchangeRate: Decimal | null;
}

/** Base-currency totals of the given runs (falls back to pay currency for runs without a snapshot). */
export function sumRunAmounts(runs: RunAmounts[]): {
  grossPay: string;
  totalDeductions: string;
  netPay: string;
} {
  const zero = new Decimal(0);
  const sum = runs.reduce(
    (acc, run) => ({
      gross: acc.gross.plus(run.grossPayBase ?? run.grossPay),
      deductions: acc.deductions.plus(run.totalDeductionsBase ?? run.totalDeductions),
      net: acc.net.plus(run.netPayBase ?? run.netPay),
    }),
    { gross: zero, deductions: zero, net: zero },
  );
  return {
    grossPay: formatMoney(sum.gross),
    totalDeductions: formatMoney(sum.deductions),
    netPay: formatMoney(sum.net),
  };
}

export function summarizePeriodRuns(runs: RunAmounts[]): PayrollPeriodSummary {
  const statusCounts: Partial<Record<PayrollRunStatus, number>> = {};
  for (const run of runs) statusCounts[run.status] = (statusCounts[run.status] ?? 0) + 1;
  const active = runs.filter((run) => run.status !== 'cancelled');
  return {
    employeeCount: active.length,
    statusCounts,
    ...sumRunAmounts(active),
    baseCurrency: active.find((run) => run.exchangeRate !== null)?.baseCurrency ?? null,
  };
}

/**
 * Period status follows its runs: no runs → draft, all paid → closed,
 * anything finalized or paid → processing, otherwise open.
 */
export function derivePayrollPeriodStatus(statuses: PayrollRunStatus[]): PayrollPeriodStatus {
  const active = statuses.filter((status) => status !== 'cancelled');
  if (active.length === 0) return 'draft';
  if (active.every((status) => status === 'paid')) return 'closed';
  if (active.some((status) => status === 'finalized' || status === 'paid')) return 'processing';
  return 'open';
}

/** Runs `task` over `items` with at most `limit` in flight. */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

export function assertPayrollRunTransition(
  from: PayrollRunStatus,
  to: PayrollRunStatus,
): void {
  const allowed = PAYROLL_RUN_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition payroll run from "${from}" to "${to}"`,
    });
  }
}

export function canRecalculatePayrollRun(status: PayrollRunStatus): boolean {
  return PAYROLL_RUN_RECALCULABLE_STATUSES.includes(status);
}

export function isPayrollRunLocked(
  status: PayrollRunStatus,
  locked: boolean,
): boolean {
  return locked || status === 'finalized' || status === 'paid';
}

export function requiredPermissionForPayrollTransition(
  targetStatus: PayrollRunStatus,
): PermissionAction {
  switch (targetStatus) {
    case 'approved':
      return 'approve';
    case 'finalized':
    case 'paid':
      return 'finalize';
    default:
      return 'edit';
  }
}

export function auditActionForPayrollTransition(
  targetStatus: PayrollRunStatus,
): 'update' | 'approve' | 'finalize' | 'reject' {
  switch (targetStatus) {
    case 'approved':
      return 'approve';
    case 'finalized':
    case 'paid':
      return 'finalize';
    case 'cancelled':
      return 'reject';
    default:
      return 'update';
  }
}
