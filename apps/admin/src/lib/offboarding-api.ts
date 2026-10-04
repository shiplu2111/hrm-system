import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  GenerateFinalSettlementInput,
  OffboardingChecklistTemplateRecord,
  OffboardingSettlementOptions,
  OffboardingStatus,
  PayrollAdjustmentRecord,
  SaveExitInterviewInput,
} from '@hrm/shared-types';
import { ApiError, tenantApiRequest } from './tenant-api-client';

export interface StartEmployeeOffboardingInput {
  employeeId: string;
  templateId?: string;
  lastWorkingDate?: string;
  startDate?: string;
}

const post = (body: unknown = {}) => ({ method: 'POST', body: JSON.stringify(body) });

export function listOffboardingTemplates(
  companyId: string,
  activeOnly = false,
): Promise<OffboardingChecklistTemplateRecord[]> {
  return tenantApiRequest<OffboardingChecklistTemplateRecord[]>(
    `/companies/${companyId}/offboarding-templates${activeOnly ? '?activeOnly=true' : ''}`,
  );
}

export function listEmployeeOffboardings(
  companyId: string,
  status?: OffboardingStatus,
): Promise<EmployeeOffboardingRecord[]> {
  const qs = status ? `?status=${status}` : '';
  return tenantApiRequest<EmployeeOffboardingRecord[]>(
    `/companies/${companyId}/employee-offboardings${qs}`,
  );
}

export function startEmployeeOffboarding(
  companyId: string,
  input: StartEmployeeOffboardingInput,
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest<EmployeeOffboardingRecord>(
    `/companies/${companyId}/employee-offboardings`,
    post(input),
  );
}

export function getEmployeeOffboarding(offboardingId: string): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest<EmployeeOffboardingRecord>(`/employee-offboardings/${offboardingId}`);
}

/** Resolves to null when the employee has no offboarding. */
export async function getOffboardingForEmployee(
  employeeId: string,
): Promise<EmployeeOffboardingRecord | null> {
  try {
    return await tenantApiRequest<EmployeeOffboardingRecord | null>(
      `/employees/${employeeId}/offboarding`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

const taskPath = (offboardingId: string, taskId: string, action: string) =>
  `/employee-offboardings/${offboardingId}/tasks/${taskId}/${action}`;

export function completeOffboardingTask(
  offboardingId: string,
  taskId: string,
  note?: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest(taskPath(offboardingId, taskId, 'complete'), post({ note }));
}

export function skipOffboardingTask(
  offboardingId: string,
  taskId: string,
  reason: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest(taskPath(offboardingId, taskId, 'skip'), post({ reason }));
}

export function reopenOffboardingTask(
  offboardingId: string,
  taskId: string,
  reason?: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest(taskPath(offboardingId, taskId, 'reopen'), post({ reason }));
}

/** Returns all matching assets for the step, or confirms nothing is outstanding. */
export function returnOffboardingAssets(
  offboardingId: string,
  taskId: string,
  input?: { conditionOnReturn?: string; notes?: string },
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest(
    taskPath(offboardingId, taskId, 'return-assets'),
    post({ returnAll: true, ...input }),
  );
}

export function returnOffboardingAsset(
  offboardingId: string,
  assetId: string,
  input: { conditionOnReturn?: string; notes?: string },
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest(
    `/employee-offboardings/${offboardingId}/assets/${assetId}/return`,
    post(input),
  );
}

export function revokeOffboardingAccess(
  offboardingId: string,
  taskId: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest(taskPath(offboardingId, taskId, 'revoke-access'), post());
}

export function saveExitInterview(
  offboardingId: string,
  input: SaveExitInterviewInput,
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest(`/employee-offboardings/${offboardingId}/exit-interview`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getSettlementOptions(offboardingId: string): Promise<OffboardingSettlementOptions> {
  return tenantApiRequest(`/employee-offboardings/${offboardingId}/settlement-options`);
}

export function generateFinalSettlement(
  offboardingId: string,
  taskId: string,
  input: GenerateFinalSettlementInput,
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest(taskPath(offboardingId, taskId, 'trigger-settlement'), post(input));
}

export function cancelFinalSettlement(
  offboardingId: string,
  reason?: string,
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest(
    `/employee-offboardings/${offboardingId}/settlement/cancel`,
    post({ reason }),
  );
}

export function submitPayrollAdjustment(
  companyId: string,
  adjustmentId: string,
): Promise<PayrollAdjustmentRecord> {
  return tenantApiRequest(`/companies/${companyId}/payroll-adjustments/${adjustmentId}/submit`, post());
}

export function applyPayrollAdjustment(
  companyId: string,
  adjustmentId: string,
): Promise<PayrollAdjustmentRecord> {
  return tenantApiRequest(`/companies/${companyId}/payroll-adjustments/${adjustmentId}/apply`, post());
}
