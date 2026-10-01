import type {
  CreateEmployeePortalAccessRequest,
  EmployeePortalAccessState,
  EmployeePortalAccessView,
  EmployeePortalCredentialsResult,
  EmployeePortalRoleOption,
  UpdateEmployeePortalAccessRequest,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listAssignablePortalRoles(): Promise<EmployeePortalRoleOption[]> {
  return tenantApiRequest<EmployeePortalRoleOption[]>('/employees/portal-access/roles');
}

export function getPortalAccess(employeeId: string): Promise<EmployeePortalAccessState> {
  return tenantApiRequest<EmployeePortalAccessState>(`/employees/${employeeId}/portal-access`);
}

export function createPortalAccess(
  employeeId: string,
  input: CreateEmployeePortalAccessRequest,
): Promise<EmployeePortalCredentialsResult> {
  return tenantApiRequest<EmployeePortalCredentialsResult>(
    `/employees/${employeeId}/portal-access`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function resetPortalPassword(
  employeeId: string,
): Promise<EmployeePortalCredentialsResult> {
  return tenantApiRequest<EmployeePortalCredentialsResult>(
    `/employees/${employeeId}/portal-access/reset-password`,
    { method: 'POST' },
  );
}

export function updatePortalAccess(
  employeeId: string,
  input: UpdateEmployeePortalAccessRequest,
): Promise<EmployeePortalAccessView> {
  return tenantApiRequest<EmployeePortalAccessView>(
    `/employees/${employeeId}/portal-access`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
