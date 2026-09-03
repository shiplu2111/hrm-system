import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PayComponentCalculationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayrollCalculationLine,
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  PayrollSimulationResult,
} from '@hrm/shared-types';
import {
  applySalaryStructureOverrides,
  computePayrollDelta,
  type StructureRow,
} from './payroll-calculation.helpers';
import { PrismaService } from '../database/prisma.service';
import { evaluatePayFormulaRule } from './formula/formula-interpreter';
import {
  PayrollContextService,
  resolvePayrollPeriod,
} from './payroll-context.service';
import {
  formatDateOnly,
  formatMoney,
  isEffectiveOn,
  parseAmountConfig,
  parseDateOnly,
  parseFormulaConfig,
  parseFormulaRuleFromComponent,
  parseMoney,
  resolvePercentageBase,
  resolvePercentageRate,
} from './payroll.utils';

export interface PayrollComputeOptions {
  employeeId: string;
  asOf?: string;
  structureOverrides?: PayrollSalaryStructureOverride[];
}

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollContext: PayrollContextService,
  ) {}

  /**
   * Gross → Deductions → Net preview (PAYROLL_LOGIC.md §6).
   * Supports fixed, percentage, and sandboxed formula components (§5).
   */
  async preview(
    employeeId: string,
    asOf?: string,
  ): Promise<PayrollCalculationPreview> {
    return this.compute({ employeeId, asOf });
  }

  /** What-if mode — no payroll_run writes (PAYROLL_LOGIC.md §8). */
  async simulate(
    options: PayrollComputeOptions,
  ): Promise<PayrollSimulationResult> {
    const baseline = await this.compute({
      employeeId: options.employeeId,
      asOf: options.asOf,
    });
    const simulated = await this.compute(options);

    return {
      employeeId: options.employeeId,
      asOfDate: baseline.asOfDate,
      baseline,
      simulated,
      delta: computePayrollDelta(baseline, simulated),
    };
  }

  async compute(
    options: PayrollComputeOptions,
  ): Promise<PayrollCalculationPreview> {
    const { employeeId, asOf, structureOverrides } = options;

    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const asOfDate = asOf
      ? parseDateOnly(asOf, 'asOf')
      : new Date(formatDateOnly(new Date()) + 'T00:00:00.000Z');

    const structures = await this.prisma.unscoped.salaryStructure.findMany({
      where: { employeeId },
      include: { component: true },
    });

    const active = applySalaryStructureOverrides(
      structures.filter((row) =>
        isEffectiveOn(row.effectiveFrom, row.effectiveTo, asOfDate),
      ),
      structureOverrides,
    );

    return this.computeFromStructures(
      employeeId,
      employee.companyId,
      asOfDate,
      active,
    );
  }

  private async computeFromStructures(
    employeeId: string,
    companyId: string,
    asOfDate: Date,
    active: StructureRow[],
  ): Promise<PayrollCalculationPreview> {
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
        const line = this.computeFixedLine(row);
        earningLines.push(line);
        const amount = parseMoney(line.amount);
        gross = gross.plus(amount);
        basic = basic.plus(amount);
        continue;
      }
      if (
        row.component.calculationType === PayComponentCalculationType.percentage
      ) {
        const line = this.computePercentageLine(row, basic, gross);
        earningLines.push(line);
        gross = gross.plus(parseMoney(line.amount));
        continue;
      }
    }

    const period = resolvePayrollPeriod(asOfDate);
    let formulaContext = await this.payrollContext.buildContext({
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
      formulaContext = await this.payrollContext.buildContext({
        employeeId,
        companyId,
        period,
        basicSalary: basic,
        grossEarnings: gross,
        overrides: amountConfig as Record<string, unknown>,
      });

      const line = this.computeFormulaLine(row, formulaContext);
      earningLines.push(line);
      gross = gross.plus(parseMoney(line.amount));
    }

    const deductionLines: PayrollCalculationLine[] = [];
    let totalDeductions = new Decimal(0);

    for (const row of deductions) {
      if (row.component.calculationType === PayComponentCalculationType.fixed) {
        const line = this.computeFixedLine(row);
        deductionLines.push(line);
        totalDeductions = totalDeductions.plus(parseMoney(line.amount));
        continue;
      }
      if (
        row.component.calculationType === PayComponentCalculationType.percentage
      ) {
        const line = this.computePercentageLine(row, basic, gross);
        deductionLines.push(line);
        totalDeductions = totalDeductions.plus(parseMoney(line.amount));
        continue;
      }
    }

    formulaContext = await this.payrollContext.buildContext({
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
      formulaContext = await this.payrollContext.buildContext({
        employeeId,
        companyId,
        period,
        basicSalary: basic,
        grossEarnings: gross,
        overrides: amountConfig as Record<string, unknown>,
      });

      const line = this.computeFormulaLine(row, formulaContext);
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

  private computeFixedLine(row: StructureRow): PayrollCalculationLine {
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

  private computePercentageLine(
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

  private computeFormulaLine(
    row: StructureRow,
    context: import('./formula/formula-interpreter').PayrollFormulaContext,
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
}
