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
  installments: LoanInstallmentRecord[];
  createdAt: string;
  updatedAt: string;
}
