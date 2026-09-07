import type { EmployeeKudosRecord, EmployeeRecord } from '@hrm/shared-types';
import { request } from './client';

export function getEmployee(employeeId: string): Promise<EmployeeRecord> {
  return request<EmployeeRecord>(`/employees/${employeeId}`);
}

export function listCompanyEmployees(companyId: string): Promise<EmployeeRecord[]> {
  return request<EmployeeRecord[]>(
    `/employees?companyId=${encodeURIComponent(companyId)}`,
  );
}

export function listKudos(
  companyId: string,
  limit = 30,
): Promise<EmployeeKudosRecord[]> {
  return request<EmployeeKudosRecord[]>(
    `/companies/${companyId}/engagement/kudos?limit=${limit}`,
  );
}

export function createEmployeeKudos(
  employeeId: string,
  input: { toEmployeeId: string; message: string },
): Promise<EmployeeKudosRecord> {
  return request<EmployeeKudosRecord>(`/employees/${employeeId}/engagement/kudos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
