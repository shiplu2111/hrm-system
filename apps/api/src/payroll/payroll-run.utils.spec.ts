import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  assertPayrollRunTransition,
  canRecalculatePayrollRun,
  derivePayrollPeriodStatus,
  forEachLimited,
  isPayrollRunLocked,
  PAYROLL_RUN_TRANSITIONS,
  summarizePeriodRuns,
  type RunAmounts,
} from './payroll-run.utils';

describe('Payroll run status flow (PAYROLL_LOGIC.md §7)', () => {
  it('defines the full transition graph', () => {
    expect(PAYROLL_RUN_TRANSITIONS.draft).toEqual(['calculated', 'cancelled']);
    expect(PAYROLL_RUN_TRANSITIONS.calculated).toEqual([
      'under_review',
      'cancelled',
    ]);
    expect(PAYROLL_RUN_TRANSITIONS.under_review).toEqual([
      'approved',
      'calculated',
      'cancelled',
    ]);
    expect(PAYROLL_RUN_TRANSITIONS.approved).toEqual([
      'finalized',
      'under_review',
      'cancelled',
    ]);
    expect(PAYROLL_RUN_TRANSITIONS.finalized).toEqual(['paid']);
    expect(PAYROLL_RUN_TRANSITIONS.paid).toEqual([]);
    expect(PAYROLL_RUN_TRANSITIONS.cancelled).toEqual([]);
  });

  it('allows recalculation only in draft, calculated, and under_review', () => {
    expect(canRecalculatePayrollRun('draft')).toBe(true);
    expect(canRecalculatePayrollRun('calculated')).toBe(true);
    expect(canRecalculatePayrollRun('under_review')).toBe(true);
    expect(canRecalculatePayrollRun('approved')).toBe(false);
    expect(canRecalculatePayrollRun('finalized')).toBe(false);
    expect(canRecalculatePayrollRun('paid')).toBe(false);
  });

  it('locks finalized and paid runs', () => {
    expect(isPayrollRunLocked('finalized', true)).toBe(true);
    expect(isPayrollRunLocked('paid', false)).toBe(true);
    expect(isPayrollRunLocked('calculated', false)).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(() => assertPayrollRunTransition('draft', 'approved')).toThrow(
      BadRequestException,
    );
    expect(() => assertPayrollRunTransition('paid', 'cancelled')).toThrow(
      BadRequestException,
    );
  });

  it('allows the happy-path flow through to paid', () => {
    const flow = [
      ['draft', 'calculated'],
      ['calculated', 'under_review'],
      ['under_review', 'approved'],
      ['approved', 'finalized'],
      ['finalized', 'paid'],
    ] as const;

    for (const [from, to] of flow) {
      expect(() => assertPayrollRunTransition(from, to)).not.toThrow();
    }
  });
});

describe('Payroll period status follows its runs', () => {
  it('derives draft, open, processing and closed', () => {
    expect(derivePayrollPeriodStatus([])).toBe('draft');
    expect(derivePayrollPeriodStatus(['cancelled'])).toBe('draft');
    expect(derivePayrollPeriodStatus(['draft', 'approved'])).toBe('open');
    expect(derivePayrollPeriodStatus(['approved', 'finalized'])).toBe('processing');
    expect(derivePayrollPeriodStatus(['paid', 'finalized'])).toBe('processing');
    expect(derivePayrollPeriodStatus(['paid', 'paid', 'cancelled'])).toBe('closed');
  });
});

describe('Period run totals', () => {
  const run = (overrides: Partial<RunAmounts>): RunAmounts => ({
    status: 'calculated',
    grossPay: new Decimal('100.00'),
    totalDeductions: new Decimal('10.00'),
    netPay: new Decimal('90.00'),
    grossPayBase: null,
    totalDeductionsBase: null,
    netPayBase: null,
    baseCurrency: 'AUD',
    exchangeRate: null,
    ...overrides,
  });

  it('sums base-currency amounts, falling back to pay currency, and leaves cancelled runs out', () => {
    const summary = summarizePeriodRuns([
      run({
        grossPayBase: new Decimal('150.00'),
        totalDeductionsBase: new Decimal('15.00'),
        netPayBase: new Decimal('135.00'),
        exchangeRate: new Decimal('1.5'),
      }),
      run({}),
      run({ status: 'cancelled', grossPay: new Decimal('999.00') }),
    ]);

    expect(summary).toEqual({
      employeeCount: 2,
      statusCounts: { calculated: 2, cancelled: 1 },
      grossPay: '250.00',
      totalDeductions: '25.00',
      netPay: '225.00',
      baseCurrency: 'AUD',
    });
  });

  it('has no base currency until a run is calculated', () => {
    expect(summarizePeriodRuns([run({ status: 'draft' })]).baseCurrency).toBeNull();
  });
});

describe('forEachLimited', () => {
  it('runs every item without exceeding the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await forEachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push(n);
      inFlight -= 1;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(3);
  });
});
