import type {
  LeaveBalanceRecord,
  LeavePolicyRecord,
  LeaveRequestRecord,
  LeaveTypeRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listLeaveTypes(companyId: string): Promise<LeaveTypeRecord[]> {
  return tenantApiRequest<LeaveTypeRecord[]>(
    `/companies/${companyId}/leave-types`,
  );
}

export function createLeaveType(
  companyId: string,
  input: { name: string; isPaid?: boolean },
): Promise<LeaveTypeRecord> {
  return tenantApiRequest<LeaveTypeRecord>(
    `/companies/${companyId}/leave-types`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function deleteLeaveType(
  companyId: string,
  leaveTypeId: string,
): Promise<void> {
  return tenantApiRequest<void>(
    `/companies/${companyId}/leave-types/${leaveTypeId}`,
    { method: 'DELETE' },
  );
}

export function listLeavePolicies(
  companyId: string,
  leaveTypeId?: string,
): Promise<LeavePolicyRecord[]> {
  const query = leaveTypeId
    ? `?leaveTypeId=${encodeURIComponent(leaveTypeId)}`
    : '';
  return tenantApiRequest<LeavePolicyRecord[]>(
    `/companies/${companyId}/leave-policies${query}`,
  );
}

export function createLeavePolicy(
  companyId: string,
  input: {
    leaveTypeId: string;
    entitlementDays: number;
    accrualType: 'monthly' | 'yearly' | 'on_hire';
    effectiveFrom: string;
    approvalSteps?: Array<{ roleName: string }>;
  },
): Promise<LeavePolicyRecord> {
  return tenantApiRequest<LeavePolicyRecord>(
    `/companies/${companyId}/leave-policies`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listLeaveRequests(
  companyId: string,
  query?: { status?: string; employeeId?: string },
): Promise<LeaveRequestRecord[]> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return tenantApiRequest<LeaveRequestRecord[]>(
    `/companies/${companyId}/leave-requests${qs}`,
  );
}

export function approveLeaveRequest(
  requestId: string,
  comment?: string,
): Promise<LeaveRequestRecord> {
  return tenantApiRequest<LeaveRequestRecord>(
    `/leave-requests/${requestId}/approve`,
    { method: 'POST', body: JSON.stringify({ comment: comment ?? null }) },
  );
}

export function rejectLeaveRequest(
  requestId: string,
  comment?: string,
): Promise<LeaveRequestRecord> {
  return tenantApiRequest<LeaveRequestRecord>(
    `/leave-requests/${requestId}/reject`,
    { method: 'POST', body: JSON.stringify({ comment: comment ?? null }) },
  );
}

export function getEmployeeLeaveBalances(
  employeeId: string,
): Promise<LeaveBalanceRecord[]> {
  return tenantApiRequest<LeaveBalanceRecord[]>(
    `/employees/${employeeId}/leave-balances`,
  );
}
