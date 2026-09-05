import {
  addMonthsUtc,
  buildInstallmentSchedule,
  calculateLoanTotals,
  parseDateString,
} from './loan.utils';

describe('loan.utils', () => {
  it('calculates flat interest totals', () => {
    const totals = calculateLoanTotals(10000, 10, 12);
    expect(totals.interestAmount).toBe(1000);
    expect(totals.totalRepayable).toBe(11000);
    expect(totals.monthlyInstallment).toBeCloseTo(916.67, 2);
  });

  it('builds installment schedule with equal payments', () => {
    const schedule = buildInstallmentSchedule({
      principal: 6000,
      interestRatePercent: 0,
      tenorMonths: 6,
      firstDueDate: parseDateString('2026-04-01'),
    });

    expect(schedule).toHaveLength(6);
    expect(schedule[0].totalDue).toBe(1000);
    expect(schedule[5].totalDue).toBe(1000);
    expect(schedule.reduce((sum, row) => sum + row.totalDue, 0)).toBe(6000);
    expect(schedule[1].dueDate).toEqual(addMonthsUtc(parseDateString('2026-04-01'), 1));
  });

  it('splits principal and interest across installments', () => {
    const schedule = buildInstallmentSchedule({
      principal: 1000,
      interestRatePercent: 10,
      tenorMonths: 2,
      firstDueDate: parseDateString('2026-01-01'),
    });

    expect(schedule[0].principalPortion + schedule[0].interestPortion).toBe(
      schedule[0].totalDue,
    );
    expect(schedule.reduce((sum, row) => sum + row.totalDue, 0)).toBe(1100);
  });
});
