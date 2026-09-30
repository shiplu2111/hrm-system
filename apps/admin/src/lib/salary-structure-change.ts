import type {
  LockedPayrollPeriodSummary,
  PayComponentRecord,
  SalaryStructureAmountConfig,
  SalaryStructureRecord,
} from '@hrm/shared-types';
import { addDaysIso, formatDate } from '@/lib/payroll-copy';

export type StructureValue = Pick<SalaryStructureAmountConfig, 'amount' | 'percentage'>;

export type StructureChange =
  | { kind: 'add'; component: PayComponentRecord; value: StructureValue; effectiveFrom: string; effectiveTo: string | null }
  | { kind: 'revise'; row: SalaryStructureRecord; component: PayComponentRecord; value: StructureValue; effectiveFrom: string }
  | {
      kind: 'correct';
      row: SalaryStructureRecord;
      component: PayComponentRecord;
      value: StructureValue;
      effectiveFrom: string;
      effectiveTo: string | null;
    }
  | { kind: 'end'; row: SalaryStructureRecord; component: PayComponentRecord; endDate: string }
  | { kind: 'delete'; row: SalaryStructureRecord; component: PayComponentRecord };

export type StructureFormMode =
  | { kind: 'add' }
  | { kind: 'revise' | 'correct' | 'end'; row: SalaryStructureRecord };

/** Inclusive overlap of ISO dates; null end means open-ended. */
export function datesOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  return aFrom <= (bTo ?? '9999-12-31') && bFrom <= (aTo ?? '9999-12-31');
}

export function lockedPeriodsIn(
  periods: LockedPayrollPeriodSummary[],
  from: string,
  to: string | null,
): LockedPayrollPeriodSummary[] {
  return periods.filter((p) => datesOverlap(from, to, p.startDate, p.endDate));
}

/** True when every day of a closed range falls inside a locked payroll period. */
export function rangeFullyLocked(periods: LockedPayrollPeriodSummary[], from: string, to: string | null): boolean {
  if (!to) return false;
  let cursor = from;
  for (const p of [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    if (p.endDate < cursor) continue;
    if (p.startDate > cursor) return false;
    cursor = addDaysIso(p.endDate, 1);
    if (cursor > to) return true;
  }
  return false;
}

/** Locked periods an in-place correction would touch, matching the API's check. */
export function correctionLockedPeriods(
  periods: LockedPayrollPeriodSummary[],
  row: SalaryStructureRecord,
  value: StructureValue,
  from: string,
  to: string | null,
): LockedPayrollPeriodSummary[] {
  const ranges: Array<[string, string | null]> = [];
  if (!sameStructureValue(value, row.amountOrFormula)) {
    ranges.push([row.effectiveFrom, row.effectiveTo], [from, to]);
  } else {
    if (from !== row.effectiveFrom) {
      const [early, late] = from < row.effectiveFrom ? [from, row.effectiveFrom] : [row.effectiveFrom, from];
      ranges.push([early, addDaysIso(late, -1)]);
    }
    if (to !== row.effectiveTo) {
      const lower = row.effectiveTo === null ? to! : to === null ? row.effectiveTo : to < row.effectiveTo ? to : row.effectiveTo;
      const upper = row.effectiveTo === null || to === null ? null : to > row.effectiveTo ? to : row.effectiveTo;
      ranges.push([addDaysIso(lower, 1), upper]);
    }
  }
  return uniquePeriods(ranges.flatMap(([f, t]) => lockedPeriodsIn(periods, f, t)));
}

export function uniquePeriods(periods: LockedPayrollPeriodSummary[]): LockedPayrollPeriodSummary[] {
  const seen = new Map<string, LockedPayrollPeriodSummary>();
  for (const p of periods) {
    const key = `${p.startDate}|${p.endDate}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function formatPeriodList(periods: LockedPayrollPeriodSummary[]): string {
  return uniquePeriods(periods)
    .map((p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`)
    .join(', ');
}

export function sameStructureValue(a: StructureValue, b: StructureValue): boolean {
  const amount = (v: StructureValue) => (v.amount ? Number(v.amount).toFixed(2) : null);
  return amount(a) === amount(b) && (a.percentage ?? null) === (b.percentage ?? null);
}
