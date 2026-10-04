export const LOAN_DEDUCTION_COMPONENT_NAME = 'Loan & Advance Recovery';

export interface LoanScheduleInput {
  principal: number;
  interestRatePercent: number;
  tenorMonths: number;
  firstDueDate: Date;
}

export interface LoanInstallmentDraft {
  installmentNumber: number;
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
  totalDue: number;
}

export interface LoanTotals {
  interestAmount: number;
  totalRepayable: number;
  monthlyInstallment: number;
}

export function calculateLoanTotals(
  principal: number,
  interestRatePercent: number,
  tenorMonths: number,
): LoanTotals {
  if (tenorMonths <= 0) {
    throw new Error('tenorMonths must be positive');
  }

  const interestAmount = roundMoney(principal * (interestRatePercent / 100));
  const totalRepayable = roundMoney(principal + interestAmount);
  const monthlyInstallment = roundMoney(totalRepayable / tenorMonths);

  return { interestAmount, totalRepayable, monthlyInstallment };
}

export function buildInstallmentSchedule(
  input: LoanScheduleInput,
): LoanInstallmentDraft[] {
  const { interestAmount, totalRepayable, monthlyInstallment } =
    calculateLoanTotals(
      input.principal,
      input.interestRatePercent,
      input.tenorMonths,
    );

  const principalPerMonth = input.principal / input.tenorMonths;
  const interestPerMonth = interestAmount / input.tenorMonths;
  const installments: LoanInstallmentDraft[] = [];

  let principalAccum = 0;
  let interestAccum = 0;

  for (let i = 0; i < input.tenorMonths; i += 1) {
    const isLast = i === input.tenorMonths - 1;
    const principalPortion = isLast
      ? roundMoney(input.principal - principalAccum)
      : roundMoney(principalPerMonth);
    const interestPortion = isLast
      ? roundMoney(interestAmount - interestAccum)
      : roundMoney(interestPerMonth);
    const totalDue = isLast
      ? roundMoney(
          totalRepayable - installments.reduce((s, r) => s + r.totalDue, 0),
        )
      : monthlyInstallment;

    principalAccum += principalPortion;
    interestAccum += interestPortion;

    installments.push({
      installmentNumber: i + 1,
      dueDate: addMonthsUtc(input.firstDueDate, i),
      principalPortion,
      interestPortion,
      totalDue,
    });
  }

  return installments;
}

/** Same day of month `months` later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

export function formatDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type InstallmentRecovery =
  | 'recovered'
  | 'in_payroll'
  | 'awaiting_run'
  | 'upcoming'
  | 'missed'
  | 'manual'
  | 'skipped';

const FINAL_RUN_STATUSES = new Set(['finalized', 'paid']);

/**
 * Where an installment stands against payroll. Dates are `YYYY-MM-DD`; `run` is the employee's
 * non-cancelled payroll run in the pay period covering the due date.
 */
export function classifyInstallmentRecovery(input: {
  status: 'scheduled' | 'paid' | 'skipped';
  dueDate: string;
  deductFromPayroll: boolean;
  period: { status: string } | null;
  run: { status: string } | null;
  today: string;
}): InstallmentRecovery {
  if (input.status === 'paid') return 'recovered';
  if (input.status === 'skipped') return 'skipped';
  if (!input.deductFromPayroll) return 'manual';

  if (input.run) {
    return FINAL_RUN_STATUSES.has(input.run.status) ? 'missed' : 'in_payroll';
  }
  if (input.period) {
    return input.period.status === 'closed' ? 'missed' : 'awaiting_run';
  }
  return input.dueDate < input.today ? 'missed' : 'upcoming';
}

/** The latest-starting period whose dates cover `date` (periods may overlap after corrections). */
export function findCoveringPeriod<T extends { startDate: string; endDate: string }>(
  periods: T[],
  date: string,
): T | null {
  let match: T | null = null;
  for (const period of periods) {
    if (period.startDate <= date && date <= period.endDate) {
      if (!match || period.startDate > match.startDate) match = period;
    }
  }
  return match;
}

export type PeriodDeductionState = 'recovered' | 'pending' | 'missed';

/** A pay period's share of a loan: fully recovered, partly missed, or still to be deducted. */
export function periodDeductionState(recoveries: InstallmentRecovery[]): PeriodDeductionState {
  if (recoveries.every((r) => r === 'recovered')) return 'recovered';
  if (recoveries.some((r) => r === 'missed')) return 'missed';
  return 'pending';
}

export function buildLoanReferenceNumber(
  countExisting: number,
  asOf: Date = new Date(),
): string {
  const year = asOf.getUTCFullYear();
  const seq = String(countExisting + 1).padStart(3, '0');
  return `LN-${year}-${seq}`;
}
