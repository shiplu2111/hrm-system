import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  OffboardingStatus,
  OffboardingTaskCategory,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface RecordExitInterviewInput {
  scheduledAt?: string;
  conductedAt?: string;
  interviewerEmployeeId?: string;
  feedback?: string;
  reasonForLeaving?: string;
  wouldRehire?: boolean;
  rating?: number;
}

export interface TriggerFinalSettlementInput {
  originalPayrollRunId?: string;
  applyToPayrollPeriodId?: string;
  reason?: string;
}

export function listEmployeeOffboardings(
  companyId: string,
  status?: OffboardingStatus,
): Promise<EmployeeOffboardingRecord[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  return tenantApiRequest<EmployeeOffboardingRecord[]>(
    `/companies/${companyId}/employee-offboardings${qs ? `?${qs}` : ''}`,
  );
}

export function getEmployeeOffboarding(
  offboardingId: string,
): Promise<EmployeeOffboardingRecord> {
  return tenantApiRequest<EmployeeOffboardingRecord>(
    `/employee-offboardings/${offboardingId}`,
  );
}

export function completeOffboardingTask(
  offboardingId: string,
  taskId: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest<EmployeeOffboardingTaskRecord>(
    `/employee-offboardings/${offboardingId}/tasks/${taskId}/complete`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function returnOffboardingAssets(
  offboardingId: string,
  taskId: string,
  input?: { returnAll?: boolean; conditionOnReturn?: string; notes?: string },
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest<EmployeeOffboardingTaskRecord>(
    `/employee-offboardings/${offboardingId}/tasks/${taskId}/return-assets`,
    { method: 'POST', body: JSON.stringify(input ?? { returnAll: true }) },
  );
}

export function revokeOffboardingAccess(
  offboardingId: string,
  taskId: string,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest<EmployeeOffboardingTaskRecord>(
    `/employee-offboardings/${offboardingId}/tasks/${taskId}/revoke-access`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function recordExitInterview(
  offboardingId: string,
  taskId: string,
  input: RecordExitInterviewInput,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest<EmployeeOffboardingTaskRecord>(
    `/employee-offboardings/${offboardingId}/tasks/${taskId}/exit-interview`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function triggerFinalSettlement(
  offboardingId: string,
  taskId: string,
  input?: TriggerFinalSettlementInput,
): Promise<EmployeeOffboardingTaskRecord> {
  return tenantApiRequest<EmployeeOffboardingTaskRecord>(
    `/employee-offboardings/${offboardingId}/tasks/${taskId}/trigger-settlement`,
    { method: 'POST', body: JSON.stringify(input ?? {}) },
  );
}

export const OFFBOARDING_CATEGORY_LABELS: Record<OffboardingTaskCategory, string> = {
  clearance: 'Clearance',
  asset_return: 'Asset Return',
  access_revocation: 'Access Revocation',
  exit_process: 'Exit Process',
  final_settlement: 'Final Settlement',
};
