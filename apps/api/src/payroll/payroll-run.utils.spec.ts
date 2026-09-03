import { BadRequestException } from '@nestjs/common';
import {
  assertPayrollRunTransition,
  canRecalculatePayrollRun,
  isPayrollRunLocked,
  PAYROLL_RUN_TRANSITIONS,
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
