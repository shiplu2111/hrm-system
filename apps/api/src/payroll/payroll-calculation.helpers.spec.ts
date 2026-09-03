import { applySalaryStructureOverrides, computePayrollDelta } from './payroll-calculation.helpers';

describe('Payroll simulation helpers', () => {
  it('computes delta between baseline and simulated totals', () => {
    const delta = computePayrollDelta(
      {
        grossPay: '6600.00',
        totalDeductions: '990.00',
        netPay: '5610.00',
      },
      {
        grossPay: '5500.00',
        totalDeductions: '825.00',
        netPay: '4675.00',
      },
    );

    expect(delta.grossPay).toBe('-1100.00');
    expect(delta.totalDeductions).toBe('-165.00');
    expect(delta.netPay).toBe('-935.00');
  });

  it('applies in-memory overrides without mutating unrelated structures', () => {
    const rows = [
      {
        id: 'ss-1',
        componentId: 'comp-basic',
        amountOrFormula: { amount: '6000.00' },
        component: { name: 'Basic Salary' },
      },
      {
        id: 'ss-2',
        componentId: 'comp-hra',
        amountOrFormula: { percentage: 10 },
        component: { name: 'HRA' },
      },
    ] as unknown as Parameters<typeof applySalaryStructureOverrides>[0];

    const updated = applySalaryStructureOverrides(rows, [
      { componentId: 'comp-basic', amount: '5000.00' },
    ]);

    expect(updated[0].amountOrFormula).toEqual({ amount: '5000.00' });
    expect(updated[1].amountOrFormula).toEqual({ percentage: 10 });
  });
});
