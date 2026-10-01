import { ConflictException } from '@nestjs/common';
import { PayComponentCalculationType } from '@prisma/client';
import type { PayrollCalculationPreview, PayrollSimulationResult } from '@hrm/shared-types';
import { PayComponentsService } from './pay-components.service';
import { computePayrollDelta } from './payroll-calculation.helpers';
import type { PayrollComputeOptions } from './payroll-calculation.service';

const COMPANY = 'company-1';
const COMPONENT = 'comp-tax';

function preview(gross: string, deductions: string, net: string, base?: [string, string, string]) {
  return {
    employeeId: 'x',
    asOfDate: '2026-09-30',
    grossPay: gross,
    totalDeductions: deductions,
    netPay: net,
    earnings: [],
    deductions: [],
    ...(base
      ? {
          currency: {
            payCurrency: 'USD',
            baseCurrency: 'BDT',
            exchangeRate: '120',
            exchangeRateDate: '2026-09-30',
            grossPayBase: base[0],
            totalDeductionsBase: base[1],
            netPayBase: base[2],
          },
        }
      : {}),
  } as PayrollCalculationPreview;
}

function simulation(baseline: PayrollCalculationPreview, simulated: PayrollCalculationPreview): PayrollSimulationResult {
  return {
    employeeId: 'x',
    asOfDate: '2026-09-30',
    baseline,
    simulated,
    attendance: { baseline: null, simulated: null },
    delta: computePayrollDelta(baseline, simulated),
  };
}

function setup(results: Record<string, PayrollSimulationResult | Error>, assignedRows = 3) {
  const employees = [
    { id: 'e1', employeeNumber: 'EMP-001', firstName: 'Ava', lastName: 'Khan' },
    { id: 'e2', employeeNumber: 'EMP-002', firstName: 'Ben', lastName: 'Roy' },
    { id: 'e3', employeeNumber: 'EMP-003', firstName: 'Cal', lastName: 'Das' },
  ].filter((e) => e.id in results);
  const prisma = {
    unscoped: {
      payComponent: {
        findFirst: jest.fn().mockResolvedValue({
          id: COMPONENT,
          companyId: COMPANY,
          calculationType: PayComponentCalculationType.percentage,
          formula: { base: 'gross', percentage: 10 },
        }),
      },
      salaryStructure: {
        count: jest.fn().mockResolvedValue(assignedRows),
        // e1 appears twice (two effective rows) and must be counted once.
        findMany: jest.fn().mockResolvedValue(
          [...employees, employees[0]].filter(Boolean).map((employee) => ({ employee })),
        ),
      },
    },
  };
  const calc = {
    simulate: jest.fn(async (options: PayrollComputeOptions) => {
      const result = results[options.employeeId];
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  const service = new PayComponentsService(
    prisma as never,
    { assertCompanyInTenant: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as never,
    { log: jest.fn() } as never,
    calc as never,
  );
  return { service, calc, prisma };
}

describe('PayComponentsService.impact', () => {
  it('sums baseline and simulated pay across employees and sorts by the size of the net change', async () => {
    const { service, calc } = setup({
      e1: simulation(preview('1000.00', '100.00', '900.00'), preview('1000.00', '150.00', '850.00')),
      e2: simulation(preview('3000.00', '300.00', '2700.00'), preview('3000.00', '450.00', '2550.00')),
      e3: simulation(preview('500.00', '50.00', '450.00'), preview('500.00', '50.00', '450.00')),
    });

    const result = await service.impact(COMPANY, COMPONENT, {
      formula: { base: 'gross', percentage: 15 },
      asOf: '2026-09-30',
    });

    expect(result.employeeCount).toBe(3);
    expect(result.baseline).toEqual({ grossPay: '4500.00', totalDeductions: '450.00', netPay: '4050.00' });
    expect(result.simulated).toEqual({ grossPay: '4500.00', totalDeductions: '650.00', netPay: '3850.00' });
    expect(result.delta).toEqual({ grossPay: '0.00', totalDeductions: '200.00', netPay: '-200.00' });
    expect(result.employees.map((e) => e.employeeNumber)).toEqual(['EMP-002', 'EMP-001', 'EMP-003']);
    expect(result.failures).toEqual([]);
    expect(calc.simulate).toHaveBeenCalledTimes(3);
    expect(calc.simulate).toHaveBeenCalledWith({
      employeeId: 'e1',
      asOf: '2026-09-30',
      componentOverrides: [
        {
          componentId: COMPONENT,
          calculationType: PayComponentCalculationType.percentage,
          formula: { base: 'gross', percentage: 15 },
        },
      ],
    });
  });

  it('reports employees whose pay cannot be calculated and leaves them out of the totals', async () => {
    const { service } = setup({
      e1: simulation(preview('1000.00', '100.00', '900.00'), preview('1000.00', '150.00', '850.00')),
      e2: new Error('Fixed component "Basic" is missing amount'),
    });

    const result = await service.impact(COMPANY, COMPONENT, { formula: { base: 'gross', percentage: 15 } });

    expect(result.employeeCount).toBe(2);
    expect(result.baseline.netPay).toBe('900.00');
    expect(result.failures).toEqual([
      {
        employeeId: 'e2',
        employeeNumber: 'EMP-002',
        fullName: 'Ben Roy',
        message: 'Fixed component "Basic" is missing amount',
      },
    ]);
  });

  it('totals in the base currency when employees are paid in another currency', async () => {
    const { service } = setup({
      e1: simulation(
        preview('100.00', '10.00', '90.00', ['12000.00', '1200.00', '10800.00']),
        preview('100.00', '15.00', '85.00', ['12000.00', '1800.00', '10200.00']),
      ),
    });

    const result = await service.impact(COMPANY, COMPONENT, { formula: { base: 'gross', percentage: 15 } });

    expect(result.baseCurrency).toBe('BDT');
    expect(result.delta.netPay).toBe('-600.00');
    expect(result.employees[0]).toMatchObject({ payCurrency: 'USD', delta: { netPay: '-5.00' } });
  });

  it('rejects a calculation type change while the component is assigned, like a save would', async () => {
    const { service, calc } = setup({});

    await expect(
      service.impact(COMPANY, COMPONENT, { calculationType: PayComponentCalculationType.fixed }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(calc.simulate).not.toHaveBeenCalled();
  });
});
