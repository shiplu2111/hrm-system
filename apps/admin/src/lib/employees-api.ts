import type { EmployeePersonalInfo, EmployeeRecord } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listEmployees(companyId?: string): Promise<EmployeeRecord[]> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return tenantApiRequest<EmployeeRecord[]>(`/employees${query}`);
}

export function getEmployee(id: string): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>(`/employees/${id}`);
}

export function createEmployee(input: {
  companyId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  personalInfo?: EmployeePersonalInfo;
  employmentStatus?: string;
  departmentId?: string | null;
  designationId?: string | null;
  employmentTypeId?: string | null;
  managerId?: string | null;
  hireDate: string;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  workLocationId?: string | null;
  costCentreId?: string | null;
}): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmployee(
  id: string,
  input: Partial<{
    employeeNumber: string;
    firstName: string;
    lastName: string;
    personalInfo: EmployeePersonalInfo;
    employmentStatus: string;
    departmentId: string | null;
    designationId: string | null;
    employmentTypeId: string | null;
    managerId: string | null;
    hireDate: string;
    probationEndDate: string | null;
    confirmationDate: string | null;
    workLocationId: string | null;
    costCentreId: string | null;
  }>,
): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteEmployee(id: string): Promise<void> {
  return tenantApiRequest<void>(`/employees/${id}`, { method: 'DELETE' });
}
