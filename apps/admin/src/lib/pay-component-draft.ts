import type {
  CreatePayComponentRequest,
  PayComponentCalculationType,
  PayComponentRecord,
  PayComponentType,
  PayFormulaRule,
} from '@hrm/shared-types';
import {
  PAY_FORMULA_LOAN_INSTALLMENT,
  PAY_FORMULA_OVERTIME_EXAMPLE,
  PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
  isPayFormulaRule,
} from '@hrm/shared-types';
import { describeFormula, formatRate, payrollCopy, percentageSettings } from '@/lib/payroll-copy';

export interface PayComponentDraft {
  name: string;
  type: PayComponentType;
  calculationType: PayComponentCalculationType;
  base: 'basic' | 'gross';
  defaultRate: string;
  formulaText: string;
}

export type FormulaTemplate = 'overtime' | 'unpaid' | 'loan' | 'custom';

export const FORMULA_TEMPLATES: Record<Exclude<FormulaTemplate, 'custom'>, PayFormulaRule> = {
  overtime: PAY_FORMULA_OVERTIME_EXAMPLE,
  unpaid: PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
  loan: PAY_FORMULA_LOAN_INSTALLMENT,
};

export const stringifyFormula = (rule: PayFormulaRule) => JSON.stringify(rule, null, 2);

export function draftFromComponent(component: PayComponentRecord | null, type: PayComponentType): PayComponentDraft {
  if (!component) {
    return {
      name: '',
      type,
      calculationType: 'fixed',
      base: 'basic',
      defaultRate: '',
      formulaText: stringifyFormula(PAY_FORMULA_OVERTIME_EXAMPLE),
    };
  }
  const { base, defaultRate } = percentageSettings(component);
  return {
    name: component.name,
    type: component.type,
    calculationType: component.calculationType,
    base,
    defaultRate: defaultRate === null ? '' : formatRate(defaultRate),
    formulaText:
      component.formula && isPayFormulaRule(component.formula)
        ? stringifyFormula(component.formula)
        : stringifyFormula(PAY_FORMULA_OVERTIME_EXAMPLE),
  };
}

export function parseFormulaText(text: string): { rule: PayFormulaRule | null; error: string | null } {
  const errors = payrollCopy.componentForm.errors;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rule: null, error: errors.formulaJson };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    (parsed as { version?: unknown }).version !== 1 ||
    !(parsed as { then?: unknown }).then
  ) {
    return { rule: null, error: errors.formulaShape };
  }
  return { rule: parsed as PayFormulaRule, error: null };
}

export function safeDescribeFormula(rule: PayFormulaRule): string | null {
  try {
    return describeFormula(rule);
  } catch {
    return null;
  }
}

export function draftToRequest(draft: PayComponentDraft): CreatePayComponentRequest {
  const request: CreatePayComponentRequest = {
    name: draft.name.trim(),
    type: draft.type,
    calculationType: draft.calculationType,
  };
  if (draft.calculationType === 'percentage') {
    request.formula = {
      base: draft.base,
      ...(draft.defaultRate.trim() ? { percentage: Number(draft.defaultRate) } : {}),
    };
  }
  if (draft.calculationType === 'formula') {
    request.formula = parseFormulaText(draft.formulaText).rule ?? undefined;
  }
  return request;
}
