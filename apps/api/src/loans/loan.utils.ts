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

export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  return new Date(Date.UTC(year, month, day));
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildLoanReferenceNumber(
  countExisting: number,
  asOf: Date = new Date(),
): string {
  const year = asOf.getUTCFullYear();
  const seq = String(countExisting + 1).padStart(3, '0');
  return `LN-${year}-${seq}`;
}
