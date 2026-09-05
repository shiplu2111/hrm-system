import { Decimal } from '@prisma/client/runtime/library';
import {
  PAY_FORMULA_LOAN_INSTALLMENT,
  PAY_FORMULA_OVERTIME_EXAMPLE,
  PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
} from '@hrm/shared-types';
import {
  createPayrollFormulaContext,
  evaluatePayFormulaRule,
} from './formula-interpreter';
import { parsePayFormulaRule } from './formula-validator';

describe('Pay formula interpreter (PAYROLL_LOGIC.md §5)', () => {
  it('evaluates overtime example: (worked - standard) * hourly * ot_multiplier', () => {
    const context = createPayrollFormulaContext({
      employee: {
        worked_hours: new Decimal(180),
        hourly_rate: new Decimal(50),
      },
      shift: {
        standard_hours: new Decimal(160),
        ot_multiplier: new Decimal('1.5'),
      },
    });

    const result = evaluatePayFormulaRule(PAY_FORMULA_OVERTIME_EXAMPLE, context);

    expect(result.conditionMet).toBe(true);
    expect(result.branch).toBe('then');
    expect(result.amount.toFixed(2)).toBe('1500.00');
  });

  it('returns zero overtime when worked hours do not exceed standard', () => {
    const context = createPayrollFormulaContext({
      employee: {
        worked_hours: new Decimal(160),
        hourly_rate: new Decimal(50),
      },
      shift: {
        standard_hours: new Decimal(160),
        ot_multiplier: new Decimal('1.5'),
      },
    });

    const result = evaluatePayFormulaRule(PAY_FORMULA_OVERTIME_EXAMPLE, context);

    expect(result.conditionMet).toBe(false);
    expect(result.amount.toFixed(2)).toBe('0.00');
  });

  it('evaluates unpaid leave deduction: (basic / working_days) * unpaid_days', () => {
    const context = createPayrollFormulaContext({
      attendance: {
        status: 'unpaid_leave',
        unpaid_days: new Decimal(2),
      },
      payroll: {
        basic_salary: new Decimal(6000),
        working_days_in_period: new Decimal(22),
      },
    });

    const result = evaluatePayFormulaRule(
      PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
      context,
    );

    expect(result.conditionMet).toBe(true);
    expect(result.branch).toBe('then');
    expect(result.amount.toFixed(2)).toBe('545.45');
  });

  it('skips unpaid leave deduction when attendance status is not unpaid_leave', () => {
    const context = createPayrollFormulaContext({
      attendance: {
        status: 'present',
        unpaid_days: new Decimal(2),
      },
      payroll: {
        basic_salary: new Decimal(6000),
        working_days_in_period: new Decimal(22),
      },
    });

    const result = evaluatePayFormulaRule(
      PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
      context,
    );

    expect(result.conditionMet).toBe(false);
    expect(result.amount.toFixed(2)).toBe('0.00');
  });

  it('evaluates loan installment deduction from payroll context', () => {
    const context = createPayrollFormulaContext({
      loan: {
        installment_amount: new Decimal(1000),
        remaining_balance: new Decimal(6000),
        active_count: new Decimal(1),
      },
    });

    const result = evaluatePayFormulaRule(PAY_FORMULA_LOAN_INSTALLMENT, context);

    expect(result.amount.toFixed(2)).toBe('1000.00');
  });

  it('rejects disallowed reference paths at validation time', () => {
    expect(() =>
      parsePayFormulaRule({
        version: 1,
        then: { ref: 'process.exit' },
      }),
    ).toThrow(/not allowed/);
  });

  it('treats string literals as data, not executable code', () => {
    const context = createPayrollFormulaContext({});
    const rule = parsePayFormulaRule({
      version: 1,
      then: { lit: 0 },
    });
    const result = evaluatePayFormulaRule(rule, context);
    expect(result.amount.toFixed(2)).toBe('0.00');
  });
});
