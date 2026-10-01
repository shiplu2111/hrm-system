import { Decimal } from '@prisma/client/runtime/library';
import { createPayrollFormulaContext } from './formula/formula-interpreter';
import {
  applyAttendanceOverride,
  applySalaryStructureOverrides,
  buildHypotheticalStructureRows,
  computePayrollDelta,
  summarizeAttendance,
} from './payroll-calculation.helpers';

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

  it('drops rows marked for removal', () => {
    const rows = [
      { id: 'ss-1', componentId: 'comp-basic', amountOrFormula: { amount: '6000.00' } },
      { id: 'ss-2', componentId: 'comp-hra', amountOrFormula: { percentage: 10 } },
    ] as unknown as Parameters<typeof applySalaryStructureOverrides>[0];

    const updated = applySalaryStructureOverrides(rows, [
      { salaryStructureId: 'ss-2', remove: true },
    ]);

    expect(updated.map((row) => row.id)).toEqual(['ss-1']);
  });

  it('builds hypothetical rows only for components without an active assignment', () => {
    const asOf = new Date('2026-10-01T00:00:00.000Z');
    const active = [
      { id: 'ss-1', componentId: 'comp-basic', amountOrFormula: { amount: '6000.00' } },
    ] as unknown as Parameters<typeof buildHypotheticalStructureRows>[2];
    const components = [
      { id: 'comp-basic', type: 'earning', name: 'Basic' },
      { id: 'comp-pf', type: 'deduction', name: 'Provident Fund' },
    ] as unknown as Parameters<typeof buildHypotheticalStructureRows>[3];

    const added = buildHypotheticalStructureRows('emp-1', asOf, active, components, [
      { componentId: 'comp-basic', amount: '7000.00' },
      { componentId: 'comp-pf', percentage: 5 },
      { componentId: 'comp-unknown', amount: '1.00' },
    ]);

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      componentId: 'comp-pf',
      componentType: 'deduction',
      employeeId: 'emp-1',
    });

    const merged = applySalaryStructureOverrides([...active, ...added], [
      { componentId: 'comp-pf', percentage: 5 },
    ]);
    expect(merged[1].amountOrFormula).toEqual({ percentage: 5 });
  });

  describe('attendance overrides', () => {
    const recorded = createPayrollFormulaContext({
      employee: { days_worked: new Decimal(20), worked_hours: new Decimal('160.5') },
      attendance: { status: 'present', unpaid_days: new Decimal(0) },
      payroll: { working_days_in_period: new Decimal(22) },
      shift: { standard_hours: new Decimal(176) },
    });

    it('keeps recorded attendance when nothing is overridden', () => {
      expect(applyAttendanceOverride(recorded, undefined)).toBe(recorded);
      expect(applyAttendanceOverride(recorded, {}).employee.days_worked.toString()).toBe('20');
    });

    it('replaces only the overridden figures and flags unpaid leave', () => {
      const simulated = applyAttendanceOverride(recorded, { daysWorked: '18.5', unpaidDays: '2' });
      expect(simulated.employee.days_worked.toString()).toBe('18.5');
      expect(simulated.employee.worked_hours.toString()).toBe('160.5');
      expect(simulated.attendance).toEqual({ status: 'unpaid_leave', unpaid_days: new Decimal(2) });
    });

    it('summarizes the figures with the local pay month', () => {
      const summary = summarizeAttendance(recorded, {
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 30, 23, 59, 59, 999),
      });
      expect(summary).toEqual({
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        daysWorked: '20.00',
        workedHours: '160.50',
        unpaidDays: '0.00',
        workingDaysInPeriod: '22.00',
        standardHours: '176.00',
      });
    });
  });
});
