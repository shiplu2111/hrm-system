import { BadRequestException } from '@nestjs/common';
import { PayComponentCalculationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { PayrollCalculationLine, PayrollCalculationPreview } from '@hrm/shared-types';
import type { PayrollFormulaContext } from './formula/formula-interpreter';
import { evaluatePayFormulaRule } from './formula/formula-interpreter';
import type { StructureRow } from './payroll-calculation.helpers';
import { resolvePayrollPeriod } from './payroll-context.service';
import {
  formatDateOnly,
  formatMoney,
  parseAmountConfig,
  parseFormulaConfig,
  parseFormulaRuleFromComponent,
  parseMoney,
  resolvePercentageBase,
  resolvePercentageRate,
} from './payroll.utils';

export type PayrollContextBuilder = (input: {
  employeeId: string;
  companyId: string;
  period: ReturnType<typeof resolvePayrollPeriod>;
  basicSalary: Decimal;
  grossEarnings: Decimal;
  overrides?: Record<string, unknown>;
}) => Promise<PayrollFormulaContext>;

/** Gross → Deductions → Net chain (PAYROLL_LOGIC.md §6) — pure structure evaluation. */
export async function computePayrollFromStructures(input: {
  employeeId: string;
  companyId: string;
  asOfDate: Date;
  active: StructureRow[];
  buildContext: PayrollContextBuilder;
}): Promise<PayrollCalculationPreview> {
  const { employeeId, companyId, asOfDate, active, buildContext } = input;

  if (active.length === 0) {
    return {
      employeeId,
      asOfDate: formatDateOnly(asOfDate),
      grossPay: '0.00',
      totalDeductions: '0.00',
      netPay: '0.00',
      earnings: [],
      deductions: [],
    };
  }

  const earnings = active.filter((row) => row.componentType === 'earning');
  const deductions = active.filter((row) => row.componentType === 'deduction');

  const earningLines: PayrollCalculationLine[] = [];
  let gross = new Decimal(0);
  let basic = new Decimal(0);

  for (const row of earnings) {
    if (row.component.calculationType === PayComponentCalculationType.fixed) {
      const line = computeFixedLine(row);
      earningLines.push(line);
      const amount = parseMoney(line.amount);
      gross = gross.plus(amount);
      basic = basic.plus(amount);
      continue;
    }
    if (row.component.calculationType === PayComponentCalculationType.percentage) {
      const line = computePercentageLine(row, basic, gross);
      earningLines.push(line);
      gross = gross.plus(parseMoney(line.amount));
    }
  }

  const period = resolvePayrollPeriod(asOfDate);
  let formulaContext = await buildContext({
    employeeId,
    companyId,
    period,
    basicSalary: basic,
    grossEarnings: gross,
  });

  for (const row of earnings) {
    if (row.component.calculationType !== PayComponentCalculationType.formula) {
      continue;
    }

    const amountConfig = parseAmountConfig(row.amountOrFormula);
    formulaContext = await buildContext({
      employeeId,
      companyId,
      period,
      basicSalary: basic,
      grossEarnings: gross,
      overrides: amountConfig as Record<string, unknown>,
    });

    const line = computeFormulaLine(row, formulaContext);
    earningLines.push(line);
    gross = gross.plus(parseMoney(line.amount));
  }

  const deductionLines: PayrollCalculationLine[] = [];
  let totalDeductions = new Decimal(0);

  for (const row of deductions) {
    if (row.component.calculationType === PayComponentCalculationType.fixed) {
      const line = computeFixedLine(row);
      deductionLines.push(line);
      totalDeductions = totalDeductions.plus(parseMoney(line.amount));
      continue;
    }
    if (row.component.calculationType === PayComponentCalculationType.percentage) {
      const line = computePercentageLine(row, basic, gross);
      deductionLines.push(line);
      totalDeductions = totalDeductions.plus(parseMoney(line.amount));
    }
  }

  formulaContext = await buildContext({
    employeeId,
    companyId,
    period,
    basicSalary: basic,
    grossEarnings: gross,
  });

  for (const row of deductions) {
    if (row.component.calculationType !== PayComponentCalculationType.formula) {
      continue;
    }

    const amountConfig = parseAmountConfig(row.amountOrFormula);
    formulaContext = await buildContext({
      employeeId,
      companyId,
      period,
      basicSalary: basic,
      grossEarnings: gross,
      overrides: amountConfig as Record<string, unknown>,
    });

    const line = computeFormulaLine(row, formulaContext);
    deductionLines.push(line);
    totalDeductions = totalDeductions.plus(parseMoney(line.amount));
  }

  const net = gross.minus(totalDeductions);

  return {
    employeeId,
    asOfDate: formatDateOnly(asOfDate),
    grossPay: formatMoney(gross),
    totalDeductions: formatMoney(totalDeductions),
    netPay: formatMoney(net),
    earnings: earningLines,
    deductions: deductionLines,
  };
}

function computeFixedLine(row: StructureRow): PayrollCalculationLine {
  const config = parseAmountConfig(row.amountOrFormula);
  if (!config.amount) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Fixed component "${row.component.name}" is missing amount`,
    });
  }
  const amount = parseMoney(config.amount);
  return {
    salaryStructureId: row.id,
    componentId: row.componentId,
    componentName: row.component.name,
    componentType: row.componentType,
    calculationType: 'fixed',
    baseAmount: null,
    percentage: null,
    amount: formatMoney(amount),
  };
}

function computePercentageLine(
  row: StructureRow,
  basic: Decimal,
  gross: Decimal,
): PayrollCalculationLine {
  const amountConfig = parseAmountConfig(row.amountOrFormula);
  const formula = parseFormulaConfig(row.component.formula);
  const baseKind = resolvePercentageBase(formula);
  const baseAmount = baseKind === 'gross' ? gross : basic;
  const rate = resolvePercentageRate(amountConfig, formula);
  const amount = baseAmount.mul(rate).div(100);

  return {
    salaryStructureId: row.id,
    componentId: row.componentId,
    componentName: row.component.name,
    componentType: row.componentType,
    calculationType: 'percentage',
    baseAmount: formatMoney(baseAmount),
    percentage: rate.toNumber(),
    amount: formatMoney(amount),
  };
}

function computeFormulaLine(
  row: StructureRow,
  context: PayrollFormulaContext,
): PayrollCalculationLine {
  const rule = parseFormulaRuleFromComponent(row.component.formula);
  const result = evaluatePayFormulaRule(rule, context);

  return {
    salaryStructureId: row.id,
    componentId: row.componentId,
    componentName: row.component.name,
    componentType: row.componentType,
    calculationType: 'formula',
    baseAmount: null,
    percentage: null,
    amount: formatMoney(result.amount),
    formulaApplied: result.branch === 'then',
    formulaDescription: rule.when
      ? `Condition ${result.conditionMet ? 'met' : 'not met'} (${result.branch})`
      : 'Unconditional formula',
  };
}
