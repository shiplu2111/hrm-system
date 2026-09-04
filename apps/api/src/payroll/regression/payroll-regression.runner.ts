import { Decimal } from '@prisma/client/runtime/library';
import type { PayrollCalculationPreview } from '@hrm/shared-types';
import type { StructureRow } from '../payroll-calculation.helpers';
import {
  computePayrollFromStructures,
  type PayrollContextBuilder,
} from '../payroll-calculation.core';
import { createPayrollFormulaContext } from '../formula/formula-interpreter';
import { parseDateOnly } from '../payroll.utils';
import type {
  PayrollRegressionFixture,
  PayrollRegressionStructureInput,
  PayslipGoldenLine,
  PayslipGoldenOutput,
} from './payroll-regression.types';

function toStructureRow(
  employeeId: string,
  companyId: string,
  input: PayrollRegressionStructureInput,
): StructureRow {
  return {
    id: input.id,
    employeeId,
    componentId: input.componentId,
    componentType: input.componentType,
    amountOrFormula: input.amountOrFormula,
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    component: {
      id: input.componentId,
      companyId,
      name: input.name,
      type: input.componentType,
      calculationType: input.calculationType,
      formula: input.formula ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as StructureRow;
}

function buildContextFromFixture(
  fixture: PayrollRegressionFixture,
): PayrollContextBuilder {
  return async (opts) => {
    const { attendance, basicSalary: fixtureBasic } = fixture;
    const basicSalary = opts.basicSalary.isZero()
      ? new Decimal(fixtureBasic)
      : opts.basicSalary;

    return createPayrollFormulaContext({
      employee: {
        worked_hours: new Decimal(attendance.workedHours),
        hourly_rate: new Decimal(attendance.hourlyRate),
      },
      shift: {
        standard_hours: new Decimal(attendance.standardHours),
        ot_multiplier: new Decimal(attendance.otMultiplier),
      },
      attendance: {
        status: attendance.status,
        unpaid_days: new Decimal(attendance.unpaidDays),
      },
      payroll: {
        basic_salary: basicSalary,
        gross_earnings: opts.grossEarnings,
        working_days_in_period: new Decimal(attendance.workingDaysInPeriod),
      },
    });
  };
}

function normalizeLines(
  lines: PayrollCalculationPreview['earnings'],
): PayslipGoldenLine[] {
  return lines
    .map((line) => ({
      componentName: line.componentName,
      calculationType: line.calculationType,
      amount: line.amount,
    }))
    .sort((a, b) => a.componentName.localeCompare(b.componentName));
}

export async function runPayrollRegression(
  fixture: PayrollRegressionFixture,
): Promise<PayslipGoldenOutput> {
  const asOfDate = parseDateOnly(fixture.periodEnd, 'periodEnd');
  const structures = fixture.salaryStructures.map((row) =>
    toStructureRow(fixture.employeeId, fixture.companyId, row),
  );

  const preview = await computePayrollFromStructures({
    employeeId: fixture.employeeId,
    companyId: fixture.companyId,
    asOfDate,
    active: structures,
    buildContext: buildContextFromFixture(fixture),
  });

  return toGoldenOutput(fixture, preview);
}

export function toGoldenOutput(
  fixture: PayrollRegressionFixture,
  preview: PayrollCalculationPreview,
): PayslipGoldenOutput {
  return {
    countryCode: fixture.countryCode,
    periodEnd: fixture.periodEnd,
    grossPay: preview.grossPay,
    totalDeductions: preview.totalDeductions,
    netPay: preview.netPay,
    earnings: normalizeLines(preview.earnings),
    deductions: normalizeLines(preview.deductions),
    inputs: {
      attendance: fixture.attendance,
      leave: fixture.leave,
      basicSalary: fixture.basicSalary,
    },
  };
}
