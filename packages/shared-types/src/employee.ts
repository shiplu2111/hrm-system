/** Employee domain types — placeholder stubs */

export type EmploymentStatus = 'active' | 'inactive' | 'terminated' | 'on_leave';

export interface EmployeeSummary {
  id: string;
  tenantId: string;
  employeeNumber: string;
  fullName: string;
  status: EmploymentStatus;
}
