import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayFormulaArithmetic,
  PayFormulaCompareOp,
  PayFormulaCondition,
  PayFormulaExpression,
  PayFormulaRule,
} from '@hrm/shared-types';

/** Runtime values exposed to sandboxed formulas (PAYROLL_LOGIC.md §5). */
export interface PayrollFormulaContext {
  employee: {
    worked_hours: Decimal;
    hourly_rate: Decimal;
  };
  shift: {
    standard_hours: Decimal;
    ot_multiplier: Decimal;
  };
  attendance: {
    /** Synthetic `unpaid_leave` when leave is not payroll-eligible */
    status: string;
    unpaid_days: Decimal;
  };
  payroll: {
    basic_salary: Decimal;
    gross_earnings: Decimal;
    working_days_in_period: Decimal;
  };
  loan: {
    installment_amount: Decimal;
    remaining_balance: Decimal;
    active_count: Decimal;
  };
}

export interface PayFormulaEvaluationResult {
  amount: Decimal;
  branch: 'then' | 'else' | 'default';
  conditionMet: boolean | null;
}

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const DEFAULT_OT_MULTIPLIER = new Decimal('1.5');
const DEFAULT_WORKING_DAYS = new Decimal(22);

export function evaluatePayFormulaRule(
  rule: PayFormulaRule,
  context: PayrollFormulaContext,
): PayFormulaEvaluationResult {
  const conditionMet =
    rule.when != null ? evaluateCondition(rule.when, context) : true;

  if (conditionMet) {
    return {
      amount: evaluateExpression(rule.then, context),
      branch: 'then',
      conditionMet: rule.when != null ? true : null,
    };
  }

  if (rule.else != null) {
    return {
      amount: evaluateExpression(rule.else, context),
      branch: 'else',
      conditionMet: false,
    };
  }

  return {
    amount: ZERO,
    branch: 'default',
    conditionMet: false,
  };
}

function evaluateCondition(
  condition: PayFormulaCondition,
  context: PayrollFormulaContext,
): boolean {
  const left = resolveComparable(condition.left, context);
  const right = resolveComparable(condition.right, context);

  switch (condition.op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'gt':
      return compareNumbers(left, right, 'gt');
    case 'gte':
      return compareNumbers(left, right, 'gte');
    case 'lt':
      return compareNumbers(left, right, 'lt');
    case 'lte':
      return compareNumbers(left, right, 'lte');
    default:
      return false;
  }
}

function compareNumbers(
  left: string | number | boolean,
  right: string | number | boolean,
  op: Exclude<PayFormulaCompareOp, 'eq' | 'ne'>,
): boolean {
  const leftNum = toDecimal(left);
  const rightNum = toDecimal(right);

  switch (op) {
    case 'gt':
      return leftNum.gt(rightNum);
    case 'gte':
      return leftNum.gte(rightNum);
    case 'lt':
      return leftNum.lt(rightNum);
    case 'lte':
      return leftNum.lte(rightNum);
    default:
      return false;
  }
}

function resolveComparable(
  expression: PayFormulaExpression,
  context: PayrollFormulaContext,
): string | number | boolean {
  if ('lit' in expression) {
    return expression.lit;
  }

  if ('ref' in expression) {
    const value = resolveRef(expression.ref, context);
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value;
    }
    return value.toString();
  }

  return evaluateExpression(expression, context).toString();
}

function evaluateExpression(
  expression: PayFormulaExpression,
  context: PayrollFormulaContext,
): Decimal {
  if ('lit' in expression) {
    if (typeof expression.lit === 'boolean') {
      throw new Error('Boolean literals cannot be used in arithmetic expressions');
    }
    return toDecimal(expression.lit);
  }

  if ('ref' in expression) {
    const value = resolveRef(expression.ref, context);
    if (typeof value === 'boolean' || typeof value === 'string') {
      throw new Error(`Reference ${expression.ref} is not numeric`);
    }
    return value;
  }

  return evaluateArithmetic(expression, context);
}

function evaluateArithmetic(
  node: PayFormulaArithmetic,
  context: PayrollFormulaContext,
): Decimal {
  const values = node.args.map((arg) => evaluateExpression(arg, context));

  switch (node.op) {
    case 'add':
      return values.reduce((sum, value) => sum.plus(value), ZERO);
    case 'sub':
      return values[0].minus(values[1]);
    case 'mul':
      return values.reduce((product, value) => product.mul(value), ONE);
    case 'div': {
      const divisor = values[1];
      if (divisor.isZero()) {
        return ZERO;
      }
      return values[0].div(divisor);
    }
    default:
      return ZERO;
  }
}

function resolveRef(
  ref: string,
  context: PayrollFormulaContext,
): Decimal | boolean | string {
  const [root, field] = ref.split('.');
  if (!field) {
    throw new Error(`Invalid reference path: ${ref}`);
  }

  switch (root) {
    case 'employee': {
      const bucket = context.employee;
      if (field === 'worked_hours') return bucket.worked_hours;
      if (field === 'hourly_rate') return bucket.hourly_rate;
      break;
    }
    case 'shift': {
      const bucket = context.shift;
      if (field === 'standard_hours') return bucket.standard_hours;
      if (field === 'ot_multiplier') return bucket.ot_multiplier;
      break;
    }
    case 'attendance': {
      const bucket = context.attendance;
      if (field === 'status') return bucket.status;
      if (field === 'unpaid_days') return bucket.unpaid_days;
      break;
    }
    case 'payroll': {
      const bucket = context.payroll;
      if (field === 'basic_salary') return bucket.basic_salary;
      if (field === 'gross_earnings') return bucket.gross_earnings;
      if (field === 'working_days_in_period') return bucket.working_days_in_period;
      break;
    }
    case 'loan': {
      const bucket = context.loan;
      if (field === 'installment_amount') return bucket.installment_amount;
      if (field === 'remaining_balance') return bucket.remaining_balance;
      if (field === 'active_count') return bucket.active_count;
      break;
    }
    default:
      break;
  }

  throw new Error(`Unknown reference path: ${ref}`);
}

function toDecimal(value: string | number | boolean): Decimal {
  if (typeof value === 'boolean') {
    throw new Error('Boolean values cannot be converted to Decimal');
  }
  return new Decimal(value);
}

export function createPayrollFormulaContext(
  partial: Partial<{
    employee: Partial<PayrollFormulaContext['employee']>;
    shift: Partial<PayrollFormulaContext['shift']>;
    attendance: Partial<PayrollFormulaContext['attendance']>;
    payroll: Partial<PayrollFormulaContext['payroll']>;
    loan: Partial<PayrollFormulaContext['loan']>;
  }>,
): PayrollFormulaContext {
  return {
    employee: {
      worked_hours: partial.employee?.worked_hours ?? ZERO,
      hourly_rate: partial.employee?.hourly_rate ?? ZERO,
    },
    shift: {
      standard_hours: partial.shift?.standard_hours ?? ZERO,
      ot_multiplier: partial.shift?.ot_multiplier ?? DEFAULT_OT_MULTIPLIER,
    },
    attendance: {
      status: partial.attendance?.status ?? 'present',
      unpaid_days: partial.attendance?.unpaid_days ?? ZERO,
    },
    payroll: {
      basic_salary: partial.payroll?.basic_salary ?? ZERO,
      gross_earnings: partial.payroll?.gross_earnings ?? ZERO,
      working_days_in_period:
        partial.payroll?.working_days_in_period ?? DEFAULT_WORKING_DAYS,
    },
    loan: {
      installment_amount: partial.loan?.installment_amount ?? ZERO,
      remaining_balance: partial.loan?.remaining_balance ?? ZERO,
      active_count: partial.loan?.active_count ?? ZERO,
    },
  };
}
