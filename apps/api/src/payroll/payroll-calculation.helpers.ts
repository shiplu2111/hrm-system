import type { PayComponent, SalaryStructure } from '@prisma/client';
import type { PayrollSalaryStructureOverride } from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import { formatMoney, parseAmountConfig, parseMoney } from './payroll.utils';

export type StructureRow = SalaryStructure & { component: PayComponent };

export function applySalaryStructureOverrides(
  rows: StructureRow[],
  overrides?: PayrollSalaryStructureOverride[],
): StructureRow[] {
  if (!overrides?.length) {
    return rows;
  }

  return rows.flatMap((row) => {
    const match = overrides.find(
      (override) =>
        (override.salaryStructureId != null &&
          override.salaryStructureId === row.id) ||
        (override.componentId != null && override.componentId === row.componentId),
    );

    if (!match) {
      return [row];
    }
    if (match.remove) {
      return [];
    }

    const current = parseAmountConfig(row.amountOrFormula);
    const merged = {
      ...current,
      ...(match.amount !== undefined ? { amount: match.amount } : {}),
      ...(match.percentage !== undefined ? { percentage: match.percentage } : {}),
      ...(match.hourly_rate !== undefined ? { hourly_rate: match.hourly_rate } : {}),
      ...(match.ot_multiplier !== undefined
        ? { ot_multiplier: match.ot_multiplier }
        : {}),
    };

    return [
      {
        ...row,
        amountOrFormula: merged,
      },
    ];
  });
}

/** Component overrides with no active row become hypothetical assignments (what-if "add"). */
export function buildHypotheticalStructureRows(
  employeeId: string,
  asOfDate: Date,
  activeRows: StructureRow[],
  components: PayComponent[],
  overrides?: PayrollSalaryStructureOverride[],
): StructureRow[] {
  if (!overrides?.length) {
    return [];
  }
  const rows: StructureRow[] = [];
  for (const override of overrides) {
    if (override.remove || override.salaryStructureId || !override.componentId) {
      continue;
    }
    if (activeRows.some((row) => row.componentId === override.componentId)) {
      continue;
    }
    const component = components.find((c) => c.id === override.componentId);
    if (!component) {
      continue;
    }
    rows.push({
      id: `simulated-${component.id}`,
      employeeId,
      componentType: component.type,
      componentId: component.id,
      amountOrFormula: {},
      effectiveFrom: asOfDate,
      effectiveTo: null,
      createdAt: asOfDate,
      updatedAt: asOfDate,
      component,
    });
  }
  return rows;
}

export function computePayrollDelta(
  baseline: { grossPay: string; totalDeductions: string; netPay: string },
  simulated: { grossPay: string; totalDeductions: string; netPay: string },
): {
  grossPay: string;
  totalDeductions: string;
  netPay: string;
} {
  return {
    grossPay: formatMoney(
      parseMoney(simulated.grossPay).minus(parseMoney(baseline.grossPay)),
    ),
    totalDeductions: formatMoney(
      parseMoney(simulated.totalDeductions).minus(
        parseMoney(baseline.totalDeductions),
      ),
    ),
    netPay: formatMoney(
      parseMoney(simulated.netPay).minus(parseMoney(baseline.netPay)),
    ),
  };
}
