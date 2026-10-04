import type {
  EmployeeLoanRecord,
  EmployeeLoanStatus,
  LoanInstallmentRecovery,
  LoanPeriodDeductionState,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export const LOAN_STATUS_TONE: Record<EmployeeLoanStatus, StatusPillTone> = {
  pending_approval: 'warning',
  active: 'accent',
  fully_paid: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export const LOAN_STATUS_FILTERS: { value: EmployeeLoanStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'fully_paid', label: 'Fully paid' },
  { value: 'rejected', label: 'Rejected' },
];

export const RECOVERY_LABEL: Record<LoanInstallmentRecovery, string> = {
  recovered: 'Recovered',
  in_payroll: 'In payroll run',
  awaiting_run: 'Awaiting payroll run',
  upcoming: 'Upcoming',
  missed: 'Not recovered',
  manual: 'Repaid outside payroll',
  skipped: 'Waived',
  projected: 'Projected',
};

export const RECOVERY_TONE: Record<LoanInstallmentRecovery, StatusPillTone> = {
  recovered: 'success',
  in_payroll: 'accent',
  awaiting_run: 'warning',
  upcoming: 'neutral',
  missed: 'error',
  manual: 'neutral',
  skipped: 'neutral',
  projected: 'neutral',
};

export const RECOVERY_HINT: Record<LoanInstallmentRecovery, string> = {
  recovered: 'Deducted by a finalized payroll run.',
  in_payroll: 'Included in this pay period’s payroll run; it is recorded as repaid when the run is finalized.',
  awaiting_run: 'The pay period exists, but the employee has no payroll run in it yet.',
  upcoming: 'No pay period covers this date yet.',
  missed: 'The due date passed without a payroll deduction. Collect it manually or adjust the schedule.',
  manual: 'This loan is not deducted from payroll.',
  skipped: 'This installment was waived.',
  projected: 'Preview — the real schedule is created when the request is approved.',
};

export const PERIOD_STATE_LABEL: Record<LoanPeriodDeductionState, string> = {
  recovered: 'Deducted',
  pending: 'Pending',
  missed: 'Not deducted',
};

export const PERIOD_STATE_TONE: Record<LoanPeriodDeductionState, StatusPillTone> = {
  recovered: 'success',
  pending: 'accent',
  missed: 'error',
};

export function loanTitle(loan: Pick<EmployeeLoanRecord, 'purposeLabel' | 'loanKind'>): string {
  return loan.purposeLabel ?? (loan.loanKind === 'salary_advance' ? 'Salary Advance' : 'Company Loan');
}

export function repaidPercent(loan: Pick<EmployeeLoanRecord, 'repaidAmount' | 'totalRepayable'>): number {
  if (loan.totalRepayable <= 0) return 0;
  return Math.min(100, Math.round((loan.repaidAmount / loan.totalRepayable) * 100));
}

/** Flat-interest installment, matching the API's schedule. */
export function estimateInstallment(principal: number, interestPercent: number, tenorMonths: number): number {
  if (!(tenorMonths > 0) || !(principal > 0)) return 0;
  const total = principal + Math.round(principal * (interestPercent / 100) * 100) / 100;
  return Math.round((total / tenorMonths) * 100) / 100;
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Same day next month (clamped to month end), as the API defaults the first installment. */
export function nextMonthIso(): string {
  const [y, m, d] = todayIso().split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m, Math.min(d, lastDay)));
  return date.toISOString().slice(0, 10);
}
