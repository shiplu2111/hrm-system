import type {
  AssetCategory,
  AssetStatus,
  CompanyAssetRecord,
  EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface CreateCompanyAssetInput {
  name: string;
  assetTag: string;
  category: AssetCategory;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  purchaseValue?: number;
  currency?: string;
  notes?: string;
}

export interface AssignAssetInput {
  employeeId: string;
  assignedAt?: string;
  conditionOnAssign?: string;
  notes?: string;
  onboardingTaskId?: string;
}

export interface ReturnAssetInput {
  returnedAt?: string;
  conditionOnReturn?: string;
  notes?: string;
  offboardingTaskId?: string;
}

export function listCompanyAssets(
  companyId: string,
  query?: { status?: AssetStatus; category?: AssetCategory; employeeId?: string },
): Promise<CompanyAssetRecord[]> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.category) params.set('category', query.category);
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  const qs = params.toString();
  return tenantApiRequest<CompanyAssetRecord[]>(
    `/companies/${companyId}/assets${qs ? `?${qs}` : ''}`,
  );
}

export function createCompanyAsset(
  companyId: string,
  input: CreateCompanyAssetInput,
): Promise<CompanyAssetRecord> {
  return tenantApiRequest<CompanyAssetRecord>(`/companies/${companyId}/assets`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listAssetAssignments(
  companyId: string,
  query?: { employeeId?: string; assetId?: string; activeOnly?: boolean },
): Promise<EmployeeAssetAssignmentRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.assetId) params.set('assetId', query.assetId);
  if (query?.activeOnly) params.set('activeOnly', 'true');
  const qs = params.toString();
  return tenantApiRequest<EmployeeAssetAssignmentRecord[]>(
    `/companies/${companyId}/asset-assignments${qs ? `?${qs}` : ''}`,
  );
}

/** Also completes the matching onboarding provisioning step (see `checklistUpdates`). */
export function assignAsset(
  assetId: string,
  input: AssignAssetInput,
): Promise<EmployeeAssetAssignmentRecord> {
  return tenantApiRequest<EmployeeAssetAssignmentRecord>(`/assets/${assetId}/assign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Also completes offboarding asset-return steps with nothing left outstanding (see `checklistUpdates`). */
export function returnAsset(
  assetId: string,
  input?: ReturnAssetInput,
): Promise<EmployeeAssetAssignmentRecord> {
  return tenantApiRequest<EmployeeAssetAssignmentRecord>(`/assets/${assetId}/return`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}
