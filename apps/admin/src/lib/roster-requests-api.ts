import type { OvertimeRequestRecord, ShiftSwapRequestRecord } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listCompanyShiftSwaps(companyId: string): Promise<ShiftSwapRequestRecord[]> {
  return tenantApiRequest<ShiftSwapRequestRecord[]>(
    `/companies/${companyId}/shift-swap-requests`,
  );
}

export function approveShiftSwapRequest(
  requestId: string,
  comment?: string,
): Promise<ShiftSwapRequestRecord> {
  return tenantApiRequest<ShiftSwapRequestRecord>(`/shift-swap-requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function rejectShiftSwapRequest(
  requestId: string,
  comment?: string,
): Promise<ShiftSwapRequestRecord> {
  return tenantApiRequest<ShiftSwapRequestRecord>(`/shift-swap-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function listCompanyOvertimeRequests(companyId: string): Promise<OvertimeRequestRecord[]> {
  return tenantApiRequest<OvertimeRequestRecord[]>(
    `/companies/${companyId}/overtime-requests`,
  );
}

export function approveOvertimeRequest(
  requestId: string,
  comment?: string,
): Promise<OvertimeRequestRecord> {
  return tenantApiRequest<OvertimeRequestRecord>(`/overtime-requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function rejectOvertimeRequest(
  requestId: string,
  comment?: string,
): Promise<OvertimeRequestRecord> {
  return tenantApiRequest<OvertimeRequestRecord>(`/overtime-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

