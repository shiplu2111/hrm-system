import type {
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
  query?: { employeeId?: string; status?: EmployeeLoanStatus },
): Promise<EmployeeLoanRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return tenantApiRequest<EmployeeLoanRecord[]>(
    `/companies/${companyId}/employee-loans${qs ? `?${qs}` : ''}`,
  );
}

export function getEmployeeLoan(loanId: string): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(`/employee-loans/${loanId}`);
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
): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(
    `/employee-loans/${loanId}/approve`,
    { method: 'POST' },
  );
}

export function rejectEmployeeLoan(
  loanId: string,
  notes?: string,
): Promise<EmployeeLoanRecord> {
  return tenantApiRequest<EmployeeLoanRecord>(
    `/employee-loans/${loanId}/reject`,
    { method: 'POST', body: JSON.stringify({ notes }) },
  );
}
