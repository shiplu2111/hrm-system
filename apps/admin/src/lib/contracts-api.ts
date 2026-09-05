import type {
  EmploymentContractRecord,
  EmploymentContractType,
  EmploymentContractDisplayStatus,
  PayFrequency,
  OvertimeRule,
} from '@hrm/shared-types';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

export interface CreateEmploymentContractInput {
  employeeId: string;
  contractType: EmploymentContractType;
  startDate: string;
  endDate?: string;
  probationEndDate?: string;
  workingHoursPerWeek?: number;
  payRate?: number;
  payFrequency?: PayFrequency;
  currency?: string;
  leaveEntitlementDays?: number;
  overtimeRule?: OvertimeRule;
  noticePeriodDays?: number;
  employerNoticeDays?: number;
  terminationConditions?: string;
  signedAt?: string;
  activate?: boolean;
}

export const CONTRACT_TYPE_LABELS: Record<EmploymentContractType, string> = {
  permanent: 'Permanent',
  fixed_term: 'Fixed-Term',
  casual: 'Casual',
  project_based: 'Project',
};

export const DISPLAY_STATUS_LABELS: Record<EmploymentContractDisplayStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  terminated: 'Terminated',
};

export function listEmploymentContracts(
  companyId: string,
  query?: { employeeId?: string; displayStatus?: string },
): Promise<EmploymentContractRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.displayStatus) params.set('displayStatus', query.displayStatus);
  const qs = params.toString();
  return tenantApiRequest<EmploymentContractRecord[]>(
    `/companies/${companyId}/employment-contracts${qs ? `?${qs}` : ''}`,
  );
}

export function getEmploymentContract(
  contractId: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}`,
  );
}

export function createEmploymentContract(
  companyId: string,
  input: CreateEmploymentContractInput,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/companies/${companyId}/employment-contracts`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateEmploymentContract(
  contractId: string,
  input: Partial<CreateEmploymentContractInput> & {
    status?: 'draft' | 'active' | 'terminated';
    endDate?: string | null;
    probationEndDate?: string | null;
  },
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function activateEmploymentContract(
  contractId: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/activate`,
    { method: 'POST' },
  );
}

export function terminateEmploymentContract(
  contractId: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/terminate`,
    { method: 'POST' },
  );
}

export function renewEmploymentContract(
  contractId: string,
  input: { startDate: string; endDate?: string; probationEndDate?: string; submit?: boolean },
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/renew`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function submitContractRenewal(
  contractId: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/submit-renewal`,
    { method: 'POST' },
  );
}

export function approveContractRenewal(
  contractId: string,
  comment?: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/approve-renewal`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function rejectContractRenewal(
  contractId: string,
  comment?: string,
): Promise<EmploymentContractRecord> {
  return tenantApiRequest<EmploymentContractRecord>(
    `/employment-contracts/${contractId}/reject-renewal`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export async function uploadContractDocument(
  contractId: string,
  label: string,
  file: File,
) {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('label', label);

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/employment-contracts/${contractId}/documents`,
    { method: 'POST', headers, body: formData },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? `Upload failed (${response.status})`,
      response.status,
    );
  }

  return payload.data;
}

export function getContractDocumentFileUrl(
  contractId: string,
  documentId: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return tenantApiRequest<{ url: string; expiresInSeconds: number }>(
    `/employment-contracts/${contractId}/documents/${documentId}/file-url`,
  );
}
