/** Structured pay formula AST — PAYROLL_LOGIC.md §5 (never raw code). */

export type PayFormulaCompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export type PayFormulaArithmeticOp = 'add' | 'sub' | 'mul' | 'div';

/** Percentage component defaults (calculationType: percentage). */
export interface PayComponentPercentageFormula {
  base?: 'basic' | 'gross';
  percentage?: number;
}

/** Conditional rule (calculationType: formula). */
export interface PayFormulaRule {
  version: 1;
  when?: PayFormulaCondition;
  then: PayFormulaExpression;
  else?: PayFormulaExpression;
}

export interface PayFormulaCondition {
  op: PayFormulaCompareOp;
  left: PayFormulaExpression;
  right: PayFormulaExpression;
}

export type PayFormulaExpression =
  | PayFormulaLiteral
  | PayFormulaReference
  | PayFormulaArithmetic;

export interface PayFormulaLiteral {
  lit: string | number | boolean;
}

export interface PayFormulaReference {
  ref: string;
}

export interface PayFormulaArithmetic {
  op: PayFormulaArithmeticOp;
  args: PayFormulaExpression[];
}

/** Allowed context paths for sandboxed evaluation. */
export const PAY_FORMULA_REF_PATHS = [
  'employee.worked_hours',
  'employee.hourly_rate',
  'shift.standard_hours',
  'shift.ot_multiplier',
  'attendance.status',
  'attendance.unpaid_days',
  'payroll.basic_salary',
  'payroll.gross_earnings',
  'payroll.working_days_in_period',
] as const;

export type PayFormulaRefPath = (typeof PAY_FORMULA_REF_PATHS)[number];

export type PayComponentFormula =
  | PayComponentPercentageFormula
  | PayFormulaRule;

export function isPayFormulaRule(
  formula: PayComponentFormula | null | undefined,
): formula is PayFormulaRule {
  return (
    formula != null &&
    typeof formula === 'object' &&
    'version' in formula &&
    formula.version === 1
  );
}

export function isPercentageFormula(
  formula: PayComponentFormula | null | undefined,
): formula is PayComponentPercentageFormula {
  return formula != null && !isPayFormulaRule(formula);
}

/** Overtime example from PAYROLL_LOGIC.md §5. */
export const PAY_FORMULA_OVERTIME_EXAMPLE: PayFormulaRule = {
  version: 1,
  when: {
    op: 'gt',
    left: { ref: 'employee.worked_hours' },
    right: { ref: 'shift.standard_hours' },
  },
  then: {
    op: 'mul',
    args: [
      {
        op: 'sub',
        args: [
          { ref: 'employee.worked_hours' },
          { ref: 'shift.standard_hours' },
        ],
      },
      { ref: 'employee.hourly_rate' },
      { ref: 'shift.ot_multiplier' },
    ],
  },
};

/** Unpaid leave deduction example from PAYROLL_LOGIC.md §5. */
export const PAY_FORMULA_UNPAID_LEAVE_EXAMPLE: PayFormulaRule = {
  version: 1,
  when: {
    op: 'eq',
    left: { ref: 'attendance.status' },
    right: { lit: 'unpaid_leave' },
  },
  then: {
    op: 'mul',
    args: [
      {
        op: 'div',
        args: [
          { ref: 'payroll.basic_salary' },
          { ref: 'payroll.working_days_in_period' },
        ],
      },
      { ref: 'attendance.unpaid_days' },
    ],
  },
};
