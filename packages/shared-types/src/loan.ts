import type { PayrollPeriodStatus, PayrollRunStatus } from './payroll';

export type EmployeeLoanKind = 'loan' | 'salary_advance';

export type EmployeeLoanStatus =
  | 'pending_approval'
  | 'active'
  | 'fully_paid'
  | 'rejected'
  | 'cancelled';

export type LoanInstallmentStatus = 'scheduled' | 'paid' | 'skipped';

export interface LoanInstallmentRecord {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalPortion: number;
  interestPortion: number;
  totalDue: number;
  status: LoanInstallmentStatus;
  paidAt: string | null;
  payrollRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeLoanRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  referenceNumber: string;
  loanKind: EmployeeLoanKind;
  purposeLabel: string | null;
  principalAmount: number;
  interestRatePercent: number;
  tenorMonths: number;
  monthlyInstallment: number;
  totalRepayable: number;
  repaidAmount: number;
  remainingBalance: number;
  installmentsPaid: number;
  installmentsTotal: number;
  deductFromPayroll: boolean;
  status: EmployeeLoanStatus;
  firstDueDate: string | null;
  disbursedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  payComponentId: string | null;
  salaryStructureId: string | null;
  notes: string | null;
  rejectionReason: string | null;
  /** Earliest scheduled installment due today or later; past-due ones are counted in `overdueInstallments`. */
  nextDueDate: string | null;
  nextDueAmount: number | null;
  /** Scheduled installments whose due date has passed without being recovered. */
  overdueInstallments: number;
  overdueAmount: number;
  installments: LoanInstallmentRecord[];
  createdAt: string;
  updatedAt: string;
}

/**
 * How an installment is (or will be) recovered:
 * - `recovered` — deducted by a finalized payroll run
 * - `in_payroll` — included in a payroll run for its pay period that is not finalized yet
 * - `awaiting_run` — its pay period exists but has no payroll run for the employee yet
 * - `upcoming` — due later; no pay period covers the due date yet
 * - `missed` — the due date passed without a deduction (pay period closed, or none was created)
 * - `manual` — the loan is repaid outside payroll
 * - `skipped` — waived
 * - `projected` — schedule preview for a request that is not approved yet
 */
export type LoanInstallmentRecovery =
  | 'recovered'
  | 'in_payroll'
  | 'awaiting_run'
  | 'upcoming'
  | 'missed'
  | 'manual'
  | 'skipped'
  | 'projected';

export interface LoanPayPeriodRef {
  id: string;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: PayrollPeriodStatus;
}

export interface LoanPayrollRunRef {
  id: string;
  status: PayrollRunStatus;
  netPay: number;
  totalDeductions: number;
  finalizedAt: string | null;
}

export interface LoanScheduleRow {
  /** Null for projected rows of a pending request. */
  installmentId: string | null;
  installmentNumber: number;
  dueDate: string;
  principalPortion: number;
  interestPortion: number;
  totalDue: number;
  /** Balance left once this and every earlier installment is recovered. */
  balanceAfter: number;
  status: LoanInstallmentStatus | null;
  paidAt: string | null;
  recovery: LoanInstallmentRecovery;
  payPeriod: LoanPayPeriodRef | null;
  payrollRun: LoanPayrollRunRef | null;
}

export type LoanPeriodDeductionState = 'recovered' | 'pending' | 'missed';

/** The loan's deductions grouped by the pay period they belong to. */
export interface LoanPayPeriodDeduction {
  payPeriod: LoanPayPeriodRef;
  payrollRun: LoanPayrollRunRef | null;
  installmentNumbers: number[];
  amount: number;
  state: LoanPeriodDeductionState;
}

export interface EmployeeLoanDetailRecord extends EmployeeLoanRecord {
  /** True when the schedule is a preview for a request that has not been approved. */
  scheduleIsProjected: boolean;
  schedule: LoanScheduleRow[];
  payrollDeductions: LoanPayPeriodDeduction[];
  principalRepaid: number;
  interestRepaid: number;
}
