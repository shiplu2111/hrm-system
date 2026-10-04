import type {
  EmployeeLoanDetailRecord,
  EmployeeLoanKind,
  EmployeeLoanRecord,
  EmployeeLoanStatus,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface CreateEmployeeLoanInput {
  employeeId: string;
  loanKind: EmployeeLoanKind;
  purposeLabel?: string;
  principalAmount: number;
  interestRatePercent?: number;
  tenorMonths: number;
  firstDueDate?: string;
  deductFromPayroll?: boolean;
  notes?: string;
  approve?: boolean;
}

export interface EmployeeLoanFilters {
  employeeId?: string;
  status?: EmployeeLoanStatus;
  loanKind?: EmployeeLoanKind;
}

export const LOAN_KIND_LABELS: Record<EmployeeLoanKind, string> = {
  loan: 'Company Loan',
  salary_advance: 'Salary Advance',
};

export const LOAN_STATUS_LABELS: Record<EmployeeLoanStatus, string> = {
  pending_approval: 'Pending Approval',
  active: 'Active',
  fully_paid: 'Fully Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function listEmployeeLoans(
  companyId: string,
  filters: EmployeeLoanFilters = {},
): Promise<EmployeeLoanRecord[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return tenantApiRequest<EmployeeLoanRecord[]>(
    `/companies/${companyId}/employee-loans${qs ? `?${qs}` : ''}`,
  );
}

export function getEmployeeLoan(loanId: string): Promise<EmployeeLoanDetailRecord> {
  return tenantApiRequest<EmployeeLoanDetailRecord>(`/employee-loans/${loanId}`);
}

export function createEmployeeLoan(
  companyId: string,
  input: CreateEmployeeLoanInput,
): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(
    `/companies/${companyId}/employee-loans`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function approveEmployeeLoan(
  loanId: string,
  input: { firstDueDate?: string } = {},
): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(
    `/employee-loans/${loanId}/approve`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function rejectEmployeeLoan(
  loanId: string,
  reason: string,
): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(
    `/employee-loans/${loanId}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}
