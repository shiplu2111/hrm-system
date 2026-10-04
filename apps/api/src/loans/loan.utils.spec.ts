import {
  addMonthsUtc,
  buildInstallmentSchedule,
  calculateLoanTotals,
  classifyInstallmentRecovery,
  findCoveringPeriod,
  formatDateValue,
  parseDateString,
  periodDeductionState,
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

  it('keeps month-end due dates inside short months', () => {
    const start = parseDateString('2026-01-31');
    expect(formatDateValue(addMonthsUtc(start, 1))).toBe('2026-02-28');
    expect(formatDateValue(addMonthsUtc(start, 2))).toBe('2026-03-31');
    expect(formatDateValue(addMonthsUtc(parseDateString('2028-01-31'), 1))).toBe('2028-02-29');
  });

  describe('classifyInstallmentRecovery', () => {
    const base = {
      status: 'scheduled' as const,
      dueDate: '2026-08-01',
      deductFromPayroll: true,
      period: null,
      run: null,
      today: '2026-10-04',
    };

    it('reports paid, skipped and manual installments directly', () => {
      expect(classifyInstallmentRecovery({ ...base, status: 'paid' })).toBe('recovered');
      expect(classifyInstallmentRecovery({ ...base, status: 'skipped' })).toBe('skipped');
      expect(classifyInstallmentRecovery({ ...base, deductFromPayroll: false })).toBe('manual');
    });

    it('follows the payroll run for the covering pay period', () => {
      const period = { status: 'open' };
      expect(classifyInstallmentRecovery({ ...base, period, run: { status: 'calculated' } })).toBe('in_payroll');
      expect(classifyInstallmentRecovery({ ...base, period, run: { status: 'finalized' } })).toBe('missed');
      expect(classifyInstallmentRecovery({ ...base, period, run: null })).toBe('awaiting_run');
      expect(classifyInstallmentRecovery({ ...base, period: { status: 'closed' }, run: null })).toBe('missed');
    });

    it('treats a past due date without any pay period as missed', () => {
      expect(classifyInstallmentRecovery(base)).toBe('missed');
      expect(classifyInstallmentRecovery({ ...base, dueDate: '2026-11-01' })).toBe('upcoming');
    });
  });

  it('picks the latest-starting period covering a date', () => {
    const periods = [
      { id: 'aug', startDate: '2026-08-01', endDate: '2026-08-31' },
      { id: 'aug-fix', startDate: '2026-08-15', endDate: '2026-08-31' },
    ];
    expect(findCoveringPeriod(periods, '2026-08-20')?.id).toBe('aug-fix');
    expect(findCoveringPeriod(periods, '2026-08-05')?.id).toBe('aug');
    expect(findCoveringPeriod(periods, '2026-09-01')).toBeNull();
  });

  it('summarises a pay period from its installments', () => {
    expect(periodDeductionState(['recovered', 'recovered'])).toBe('recovered');
    expect(periodDeductionState(['recovered', 'missed'])).toBe('missed');
    expect(periodDeductionState(['in_payroll'])).toBe('pending');
  });
});
