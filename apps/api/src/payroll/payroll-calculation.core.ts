import { BadRequestException } from '@nestjs/common';
import { PayComponentCalculationType, SalaryPayBasis } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { PayrollCalculationLine, PayrollCalculationPreview } from '@hrm/shared-types';
import type { PayrollFormulaContext } from './formula/formula-interpreter';
import { evaluatePayFormulaRule } from './formula/formula-interpreter';
import type { StructureRow } from './payroll-calculation.helpers';
import { resolvePayrollPeriod } from './payroll-context.service';
import {
  applySuperannuationToPreview,
  type ResolvedSuperannuationRates,
} from './superannuation.utils';
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
  superannuationRates?: ResolvedSuperannuationRates | null;
}): Promise<PayrollCalculationPreview> {
  const { employeeId, companyId, asOfDate, active, buildContext, superannuationRates } =
    input;

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
  const period = resolvePayrollPeriod(asOfDate);

  const timeBased = active.some(
    (row) =>
      row.component.calculationType === PayComponentCalculationType.fixed &&
      row.payBasis !== SalaryPayBasis.monthly,
  );
  const timeWorked: TimeWorked | null = timeBased
    ? await buildContext({
        employeeId,
        companyId,
        period,
        basicSalary: new Decimal(0),
        grossEarnings: new Decimal(0),
      }).then((ctx) => ({
        days: ctx.employee.days_worked,
        hours: ctx.employee.worked_hours,
      }))
    : null;

  // Hourly-paid staff: formulas such as overtime use their contracted rate, not basic ÷ standard hours.
  const hourlyRate = earnings
    .filter(
      (row) =>
        row.component.calculationType === PayComponentCalculationType.fixed &&
        row.payBasis === SalaryPayBasis.hourly,
    )
    .reduce<Decimal | null>((sum, row) => {
      const amount = parseAmountConfig(row.amountOrFormula).amount;
      return amount ? (sum ?? new Decimal(0)).plus(parseMoney(amount)) : sum;
    }, null);
  const formulaOverrides = (row: StructureRow): Record<string, unknown> => ({
    ...(hourlyRate ? { hourly_rate: hourlyRate.toFixed(2) } : {}),
    ...(parseAmountConfig(row.amountOrFormula) as Record<string, unknown>),
  });

  const earningLines: PayrollCalculationLine[] = [];
  let gross = new Decimal(0);
  let basic = new Decimal(0);

  for (const row of earnings) {
    if (row.component.calculationType === PayComponentCalculationType.fixed) {
      const line = computeFixedLine(row, timeWorked);
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

    formulaContext = await buildContext({
      employeeId,
      companyId,
      period,
      basicSalary: basic,
      grossEarnings: gross,
      overrides: formulaOverrides(row),
    });

    const line = computeFormulaLine(row, formulaContext);
    earningLines.push(line);
    gross = gross.plus(parseMoney(line.amount));
  }

  const deductionLines: PayrollCalculationLine[] = [];
  let totalDeductions = new Decimal(0);

  for (const row of deductions) {
    if (row.component.calculationType === PayComponentCalculationType.fixed) {
      const line = computeFixedLine(row, timeWorked);
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

    formulaContext = await buildContext({
      employeeId,
      companyId,
      period,
      basicSalary: basic,
      grossEarnings: gross,
      overrides: formulaOverrides(row),
    });

    const line = computeFormulaLine(row, formulaContext);
    deductionLines.push(line);
    totalDeductions = totalDeductions.plus(parseMoney(line.amount));
  }

  const net = gross.minus(totalDeductions);

  const preview: PayrollCalculationPreview = {
    employeeId,
    asOfDate: formatDateOnly(asOfDate),
    grossPay: formatMoney(gross),
    totalDeductions: formatMoney(totalDeductions),
    netPay: formatMoney(net),
    earnings: earningLines,
    deductions: deductionLines,
  };

  if (!superannuationRates) {
    return preview;
  }

  return applySuperannuationToPreview({
    preview,
    rates: superannuationRates,
    basicAmount: basic,
    grossAmount: gross,
  });
}

interface TimeWorked {
  days: Decimal;
  hours: Decimal;
}

function computeFixedLine(row: StructureRow, timeWorked: TimeWorked | null): PayrollCalculationLine {
  const config = parseAmountConfig(row.amountOrFormula);
  if (!config.amount) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Fixed component "${row.component.name}" is missing amount`,
    });
  }
  const rate = parseMoney(config.amount);
  const base = {
    salaryStructureId: row.id,
    componentId: row.componentId,
    componentName: row.component.name,
    componentType: row.componentType,
    calculationType: 'fixed' as const,
    baseAmount: null,
    percentage: null,
    payBasis: row.payBasis,
  };

  if (row.payBasis === SalaryPayBasis.monthly || !timeWorked) {
    return { ...base, amount: formatMoney(rate), rate: null, units: null };
  }

  // Rounded before multiplying so the payslip's "rate × units" reproduces the amount exactly.
  const units = (row.payBasis === SalaryPayBasis.daily ? timeWorked.days : timeWorked.hours).toDecimalPlaces(2);
  return {
    ...base,
    amount: formatMoney(rate.mul(units)),
    rate: formatMoney(rate),
    units: units.toString(),
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
