import {
  PAY_FORMULA_REF_PATHS,
  type PayFormulaArithmetic,
  type PayFormulaArithmeticOp,
  type PayFormulaCompareOp,
  type PayFormulaCondition,
  type PayFormulaExpression,
  type PayFormulaRefPath,
  type PayFormulaRule,
} from '@hrm/shared-types';

const COMPARE_OPS: PayFormulaCompareOp[] = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
];

const ARITHMETIC_OPS: PayFormulaArithmeticOp[] = [
  'add',
  'sub',
  'mul',
  'div',
];

const REF_PATH_SET = new Set<string>(PAY_FORMULA_REF_PATHS);

export class PayFormulaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayFormulaValidationError';
  }
}

export function parsePayFormulaRule(raw: unknown): PayFormulaRule {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PayFormulaValidationError('Formula must be a JSON object');
  }

  const record = raw as Record<string, unknown>;
  if (record.version !== 1) {
    throw new PayFormulaValidationError('Formula version must be 1');
  }

  if (record.then == null) {
    throw new PayFormulaValidationError('Formula must include a then expression');
  }

  const rule: PayFormulaRule = {
    version: 1,
    then: parseExpression(record.then, 'then'),
  };

  if (record.when != null) {
    rule.when = parseCondition(record.when, 'when');
  }

  if (record.else != null) {
    rule.else = parseExpression(record.else, 'else');
  }

  return rule;
}

function parseCondition(raw: unknown, path: string): PayFormulaCondition {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PayFormulaValidationError(`${path} must be an object`);
  }

  const record = raw as Record<string, unknown>;
  const op = record.op;
  if (typeof op !== 'string' || !COMPARE_OPS.includes(op as PayFormulaCompareOp)) {
    throw new PayFormulaValidationError(
      `${path}.op must be one of: ${COMPARE_OPS.join(', ')}`,
    );
  }

  if (record.left == null || record.right == null) {
    throw new PayFormulaValidationError(`${path} must include left and right`);
  }

  return {
    op: op as PayFormulaCompareOp,
    left: parseExpression(record.left, `${path}.left`),
    right: parseExpression(record.right, `${path}.right`),
  };
}

function parseExpression(raw: unknown, path: string): PayFormulaExpression {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PayFormulaValidationError(`${path} must be an expression object`);
  }

  const record = raw as Record<string, unknown>;

  if ('lit' in record) {
    const value = record.lit;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new PayFormulaValidationError(`${path}.lit must be string, number, or boolean`);
    }
    return { lit: value };
  }

  if ('ref' in record) {
    if (typeof record.ref !== 'string' || record.ref.trim() === '') {
      throw new PayFormulaValidationError(`${path}.ref must be a non-empty string`);
    }
    assertAllowedRef(record.ref, path);
    return { ref: record.ref };
  }

  if ('op' in record) {
    const op = record.op;
    if (typeof op !== 'string' || !ARITHMETIC_OPS.includes(op as PayFormulaArithmeticOp)) {
      throw new PayFormulaValidationError(
        `${path}.op must be one of: ${ARITHMETIC_OPS.join(', ')}`,
      );
    }

    if (!Array.isArray(record.args) || record.args.length < 1) {
      throw new PayFormulaValidationError(`${path}.args must be a non-empty array`);
    }

    const args = record.args.map((arg, index) =>
      parseExpression(arg, `${path}.args[${index}]`),
    );

    if (op === 'sub' || op === 'div') {
      if (args.length !== 2) {
        throw new PayFormulaValidationError(`${path} ${op} requires exactly 2 arguments`);
      }
    }

    return { op: op as PayFormulaArithmeticOp, args };
  }

  throw new PayFormulaValidationError(
    `${path} must be a literal ({ lit }), reference ({ ref }), or arithmetic ({ op, args })`,
  );
}

function assertAllowedRef(ref: string, path: string): void {
  if (!REF_PATH_SET.has(ref)) {
    throw new PayFormulaValidationError(
      `${path}.ref "${ref}" is not allowed. Allowed refs: ${PAY_FORMULA_REF_PATHS.join(', ')}`,
    );
  }
}

export function collectFormulaRefs(rule: PayFormulaRule): PayFormulaRefPath[] {
  const refs = new Set<string>();

  const walk = (node: PayFormulaExpression | PayFormulaCondition | undefined) => {
    if (!node) return;

    if ('op' in node && 'left' in node && 'right' in node) {
      walk(node.left);
      walk(node.right);
      return;
    }

    const expr = node as PayFormulaExpression;
    if ('ref' in expr) {
      refs.add(expr.ref);
      return;
    }

    if ('op' in expr && 'args' in expr) {
      for (const arg of (expr as PayFormulaArithmetic).args) {
        walk(arg);
      }
    }
  };

  walk(rule.when);
  walk(rule.then);
  walk(rule.else);

  return [...refs] as PayFormulaRefPath[];
}
