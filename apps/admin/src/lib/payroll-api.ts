import type {
  CreatePayComponentRequest,
  CreateSalaryStructureRequest,
  PayComponentRecord,
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  PayrollSimulationResult,
  ReviseSalaryStructureRequest,
  ReviseSalaryStructureResult,
  SalaryStructurePayrollLock,
  SalaryStructureRecord,
  UpdatePayComponentRequest,
  UpdateSalaryStructureRequest,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listPayComponents(companyId: string): Promise<PayComponentRecord[]> {
  return tenantApiRequest<PayComponentRecord[]>(`/companies/${companyId}/pay-components`);
}

export function createPayComponent(
  companyId: string,
  input: CreatePayComponentRequest,
): Promise<PayComponentRecord> {
  return tenantApiRequest<PayComponentRecord>(`/companies/${companyId}/pay-components`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePayComponent(
  companyId: string,
  componentId: string,
  input: UpdatePayComponentRequest,
): Promise<PayComponentRecord> {
  return tenantApiRequest<PayComponentRecord>(
    `/companies/${companyId}/pay-components/${componentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deletePayComponent(companyId: string, componentId: string): Promise<void> {
  return tenantApiRequest<void>(`/companies/${companyId}/pay-components/${componentId}`, {
    method: 'DELETE',
  });
}

export function listSalaryStructures(employeeId: string): Promise<SalaryStructureRecord[]> {
  return tenantApiRequest<SalaryStructureRecord[]>(`/employees/${employeeId}/salary-structures`);
}

export function getSalaryStructurePayrollLock(
  employeeId: string,
): Promise<SalaryStructurePayrollLock> {
  return tenantApiRequest<SalaryStructurePayrollLock>(
    `/employees/${employeeId}/salary-structures/payroll-lock`,
  );
}

export function createSalaryStructure(
  employeeId: string,
  input: CreateSalaryStructureRequest,
): Promise<SalaryStructureRecord> {
  return tenantApiRequest<SalaryStructureRecord>(`/employees/${employeeId}/salary-structures`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSalaryStructure(
  employeeId: string,
  structureId: string,
  input: UpdateSalaryStructureRequest,
): Promise<SalaryStructureRecord> {
  return tenantApiRequest<SalaryStructureRecord>(
    `/employees/${employeeId}/salary-structures/${structureId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function reviseSalaryStructure(
  employeeId: string,
  structureId: string,
  input: ReviseSalaryStructureRequest,
): Promise<ReviseSalaryStructureResult> {
  return tenantApiRequest<ReviseSalaryStructureResult>(
    `/employees/${employeeId}/salary-structures/${structureId}/revise`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function deleteSalaryStructure(employeeId: string, structureId: string): Promise<void> {
  return tenantApiRequest<void>(`/employees/${employeeId}/salary-structures/${structureId}`, {
    method: 'DELETE',
  });
}

export function previewPayroll(
  employeeId: string,
  asOf?: string,
): Promise<PayrollCalculationPreview> {
  const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  return tenantApiRequest<PayrollCalculationPreview>(`/employees/${employeeId}/payroll/preview${qs}`);
}

export function simulatePayroll(
  employeeId: string,
  input: { asOf?: string; structureOverrides?: PayrollSalaryStructureOverride[] },
): Promise<PayrollSimulationResult> {
  return tenantApiRequest<PayrollSimulationResult>(`/employees/${employeeId}/payroll/simulate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
