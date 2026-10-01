import { PayComponentCalculationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createPayrollFormulaContext } from './formula/formula-interpreter';
import { computePayrollFromStructures } from './payroll-calculation.core';
import type { StructureRow } from './payroll-calculation.helpers';
import { AUS_SUPERANNUATION_RATES } from './regression/payroll-regression.fixtures';

function structureRow(partial: {
  id: string;
  componentId: string;
  componentType: 'earning' | 'deduction';
  name: string;
  calculationType: PayComponentCalculationType;
  amountOrFormula: Record<string, unknown>;
  payBasis?: 'monthly' | 'daily' | 'hourly';
  formula?: Record<string, unknown> | null;
}): StructureRow {
  return {
    id: partial.id,
    employeeId: 'emp-1',
    componentId: partial.componentId,
    componentType: partial.componentType,
    amountOrFormula: partial.amountOrFormula,
    payBasis: partial.payBasis ?? 'monthly',
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    component: {
      id: partial.componentId,
      companyId: 'company-1',
      name: partial.name,
      type: partial.componentType,
      calculationType: partial.calculationType,
      formula: partial.formula ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as StructureRow;
}

describe('Payroll calculation chain (PAYROLL_LOGIC.md §2, §6)', () => {
  const asOfDate = new Date('2024-06-30T00:00:00.000Z');
  const buildContext = async () => createPayrollFormulaContext({});

  it('Australia (AUS): basic + HRA + employer super on gross (country rule)', async () => {
    const rows: StructureRow[] = [
      structureRow({
        id: 'ss-basic',
        componentId: 'comp-basic',
        componentType: 'earning',
        name: 'Basic Salary',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '6000.00' },
      }),
      structureRow({
        id: 'ss-hra',
        componentId: 'comp-hra',
        componentType: 'earning',
        name: 'House Rent Allowance',
        calculationType: PayComponentCalculationType.percentage,
        amountOrFormula: { percentage: 10 },
        formula: { base: 'basic' },
      }),
    ];

    const preview = await computePayrollFromStructures({
      employeeId: 'emp-aus',
      companyId: 'company-aus',
      asOfDate,
      active: rows,
      buildContext,
      superannuationRates: AUS_SUPERANNUATION_RATES,
    });

    expect(preview.grossPay).toBe('6600.00');
    expect(preview.totalDeductions).toBe('0.00');
    expect(preview.netPay).toBe('6600.00');
    expect(preview.superannuation?.employerContribution).toBe('726.00');
    expect(preview.superannuation?.employeeContribution).toBe('0.00');
  });

  it('Bangladesh (BGD): basic + transport fixed − income tax on gross', async () => {
    const rows: StructureRow[] = [
      structureRow({
        id: 'ss-basic-bgd',
        componentId: 'comp-basic-bgd',
        componentType: 'earning',
        name: 'Basic Salary',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '45000.00' },
      }),
      structureRow({
        id: 'ss-transport',
        componentId: 'comp-transport',
        componentType: 'earning',
        name: 'Transport Allowance',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '3000.00' },
      }),
      structureRow({
        id: 'ss-tax-bgd',
        componentId: 'comp-tax-bgd',
        componentType: 'deduction',
        name: 'Income Tax',
        calculationType: PayComponentCalculationType.percentage,
        amountOrFormula: { percentage: 5 },
        formula: { base: 'gross' },
      }),
    ];

    const preview = await computePayrollFromStructures({
      employeeId: 'emp-bgd',
      companyId: 'company-bgd',
      asOfDate,
      active: rows,
      buildContext,
    });

    expect(preview.grossPay).toBe('48000.00');
    expect(preview.totalDeductions).toBe('2400.00');
    expect(preview.netPay).toBe('45600.00');
  });

  it('includes formula overtime earnings when worked hours exceed standard', async () => {
    const rows: StructureRow[] = [
      structureRow({
        id: 'ss-basic',
        componentId: 'comp-basic',
        componentType: 'earning',
        name: 'Basic Salary',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '6000.00' },
      }),
      structureRow({
        id: 'ss-ot',
        componentId: 'comp-ot',
        componentType: 'earning',
        name: 'Overtime',
        calculationType: PayComponentCalculationType.formula,
        amountOrFormula: {},
        formula: {
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
        },
      }),
    ];

    const preview = await computePayrollFromStructures({
      employeeId: 'emp-ot',
      companyId: 'company-1',
      asOfDate,
      active: rows,
      buildContext: async () =>
        createPayrollFormulaContext({
          employee: {
            worked_hours: new Decimal(180),
            hourly_rate: new Decimal(50),
          },
          shift: {
            standard_hours: new Decimal(160),
            ot_multiplier: new Decimal('1.5'),
          },
        }),
    });

    expect(preview.grossPay).toBe('7500.00');
    expect(preview.netPay).toBe('7500.00');
  });

  it('pays a daily-basis amount per day worked and feeds it into basic', async () => {
    const rows: StructureRow[] = [
      structureRow({
        id: 'ss-daily',
        componentId: 'comp-basic',
        componentType: 'earning',
        name: 'Basic Salary',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '500.00' },
        payBasis: 'daily',
      }),
      structureRow({
        id: 'ss-hra',
        componentId: 'comp-hra',
        componentType: 'earning',
        name: 'House Rent Allowance',
        calculationType: PayComponentCalculationType.percentage,
        amountOrFormula: { percentage: 10 },
        formula: { base: 'basic' },
      }),
    ];

    const preview = await computePayrollFromStructures({
      employeeId: 'emp-daily',
      companyId: 'company-1',
      asOfDate,
      active: rows,
      buildContext: async () =>
        createPayrollFormulaContext({ employee: { days_worked: new Decimal('20.5') } }),
    });

    expect(preview.earnings[0]).toMatchObject({
      amount: '10250.00',
      payBasis: 'daily',
      rate: '500.00',
      units: '20.5',
    });
    expect(preview.grossPay).toBe('11275.00');
  });

  it('pays an hourly-basis amount per hour worked and uses it as the overtime rate', async () => {
    const rows: StructureRow[] = [
      structureRow({
        id: 'ss-hourly',
        componentId: 'comp-basic',
        componentType: 'earning',
        name: 'Basic Salary',
        calculationType: PayComponentCalculationType.fixed,
        amountOrFormula: { amount: '25.00' },
        payBasis: 'hourly',
      }),
      structureRow({
        id: 'ss-ot',
        componentId: 'comp-ot',
        componentType: 'earning',
        name: 'Overtime',
        calculationType: PayComponentCalculationType.formula,
        amountOrFormula: {},
        formula: {
          version: 1,
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
        },
      }),
    ];

    const preview = await computePayrollFromStructures({
      employeeId: 'emp-hourly',
      companyId: 'company-1',
      asOfDate,
      active: rows,
      buildContext: async ({ overrides }) =>
        createPayrollFormulaContext({
          employee: {
            worked_hours: new Decimal(180),
            hourly_rate: new Decimal(String(overrides?.hourly_rate ?? 0)),
          },
          shift: {
            standard_hours: new Decimal(160),
            ot_multiplier: new Decimal('1.5'),
          },
        }),
    });

    expect(preview.earnings[0]).toMatchObject({
      amount: '4500.00',
      payBasis: 'hourly',
      rate: '25.00',
      units: '180',
    });
    expect(preview.earnings[1].amount).toBe('750.00');
    expect(preview.grossPay).toBe('5250.00');
  });

  it('rounds hours to 2 decimals before multiplying so rate × units matches the amount', async () => {
    const preview = await computePayrollFromStructures({
      employeeId: 'emp-hourly',
      companyId: 'company-1',
      asOfDate,
      active: [
        structureRow({
          id: 'ss-hourly',
          componentId: 'comp-basic',
          componentType: 'earning',
          name: 'Basic Salary',
          calculationType: PayComponentCalculationType.fixed,
          amountOrFormula: { amount: '40.00' },
          payBasis: 'hourly',
        }),
      ],
      buildContext: async () =>
        createPayrollFormulaContext({ employee: { worked_hours: new Decimal(340).div(60) } }),
    });

    expect(preview.earnings[0]).toMatchObject({ amount: '226.80', rate: '40.00', units: '5.67' });
  });

  it('keeps monthly amounts unchanged and never loads attendance for them', async () => {
    const buildContext = jest.fn(async () => createPayrollFormulaContext({}));
    const preview = await computePayrollFromStructures({
      employeeId: 'emp-monthly',
      companyId: 'company-1',
      asOfDate,
      active: [
        structureRow({
          id: 'ss-basic',
          componentId: 'comp-basic',
          componentType: 'earning',
          name: 'Basic Salary',
          calculationType: PayComponentCalculationType.fixed,
          amountOrFormula: { amount: '6000.00' },
        }),
      ],
      buildContext,
    });

    expect(preview.earnings[0]).toMatchObject({ amount: '6000.00', rate: null, units: null });
    expect(buildContext).toHaveBeenCalledTimes(2);
  });
});
