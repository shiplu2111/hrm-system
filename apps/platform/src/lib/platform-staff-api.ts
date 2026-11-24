import { apiRequest } from './api-client';
import type {
  ActiveOwnerCheckResult,
  CreatePlatformRoleInput,
  InvitePlatformUserInput,
  Platform2faResetRequestView,
  PlatformLoginHistoryFilter,
  PlatformPermissionDefinition,
  PlatformRoleRecord,
  PlatformSecurityStats,
  PlatformSessionFilter,
  PlatformStaffLoginHistoryView,
  PlatformStaffSessionView,
  PlatformUserDetailedView,
  Request2faResetInput,
  Review2faResetInput,
  RevokeSessionResult,
  RevokeUserSessionsResult,
  UpdatePlatformRoleInput,
} from '@hrm/shared-types';

export type PlatformRoleOption = PlatformRoleRecord;

export function getPlatformRoleDefinitions(): Promise<PlatformPermissionDefinition[]> {
  return apiRequest<PlatformPermissionDefinition[]>('/platform/staff/roles/definitions');
}

export function getActiveOwnerStatus(): Promise<ActiveOwnerCheckResult> {
  return apiRequest<ActiveOwnerCheckResult>('/platform/staff/roles/active-owner-check');
}

export function listPlatformRoles(): Promise<PlatformRoleRecord[]> {
  return apiRequest<PlatformRoleRecord[]>('/platform/staff/roles');
}

export function getPlatformRole(id: string): Promise<PlatformRoleRecord> {
  return apiRequest<PlatformRoleRecord>(`/platform/staff/roles/${id}`);
}

export function createPlatformRole(input: CreatePlatformRoleInput): Promise<PlatformRoleRecord> {
  return apiRequest<PlatformRoleRecord>('/platform/staff/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlatformRole(id: string, input: UpdatePlatformRoleInput): Promise<PlatformRoleRecord> {
  return apiRequest<PlatformRoleRecord>(`/platform/staff/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePlatformRole(id: string): Promise<{ success: boolean; id: string }> {
  return apiRequest<{ success: boolean; id: string }>(`/platform/staff/roles/${id}`, {
    method: 'DELETE',
  });
}

export function listPlatformUsers(): Promise<PlatformUserDetailedView[]> {
  return apiRequest<PlatformUserDetailedView[]>('/platform/staff/users');
}

export function invitePlatformUser(
  input: InvitePlatformUserInput,
): Promise<{ user: PlatformUserDetailedView; temporaryPassword?: string; requires2faOnFirstLogin: boolean }> {
  return apiRequest('/platform/staff/users/invite', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deactivatePlatformUser(id: string): Promise<PlatformUserDetailedView> {
  return apiRequest(`/platform/staff/users/${id}/deactivate`, {
    method: 'POST',
  });
}

export function reactivatePlatformUser(id: string): Promise<PlatformUserDetailedView> {
  return apiRequest(`/platform/staff/users/${id}/reactivate`, {
    method: 'POST',
  });
}

export function request2faReset(
  id: string,
  input: Request2faResetInput,
): Promise<Platform2faResetRequestView> {
  return apiRequest(`/platform/staff/users/${id}/2fa-reset/request`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function list2faResetRequests(): Promise<Platform2faResetRequestView[]> {
  return apiRequest<Platform2faResetRequestView[]>('/platform/staff/2fa-reset-requests');
}

export function review2faReset(
  requestId: string,
  input: Review2faResetInput,
): Promise<Platform2faResetRequestView> {
  return apiRequest(`/platform/staff/2fa-reset-requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listAllPlatformSessions(
  filter?: PlatformSessionFilter,
): Promise<PlatformStaffSessionView[]> {
  const query = new URLSearchParams();
  if (filter?.search) query.set('search', filter.search);
  if (filter?.userId) query.set('userId', filter.userId);
  if (filter?.status && filter.status !== 'all') query.set('status', filter.status);
  if (filter?.unusualOnly) query.set('unusualOnly', 'true');

  const qs = query.toString();
  return apiRequest<PlatformStaffSessionView[]>(`/platform/staff/sessions${qs ? `?${qs}` : ''}`);
}

export function revokePlatformSession(sessionId: string): Promise<RevokeSessionResult> {
  return apiRequest<RevokeSessionResult>(`/platform/staff/sessions/${sessionId}/revoke`, {
    method: 'POST',
  });
}

export function revokeAllUserPlatformSessions(userId: string): Promise<RevokeUserSessionsResult> {
  return apiRequest<RevokeUserSessionsResult>(`/platform/staff/users/${userId}/sessions/revoke-all`, {
    method: 'POST',
  });
}

export function listAllPlatformLoginHistory(
  filter?: PlatformLoginHistoryFilter,
): Promise<{ items: PlatformStaffLoginHistoryView[]; total: number; unusualCount: number }> {
  const query = new URLSearchParams();
  if (filter?.search) query.set('search', filter.search);
  if (filter?.userId) query.set('userId', filter.userId);
  if (filter?.status && filter.status !== 'All') query.set('status', filter.status);
  if (filter?.twoFactorResult && filter.twoFactorResult !== 'All') query.set('twoFactorResult', filter.twoFactorResult);
  if (filter?.unusualOnly) query.set('unusualOnly', 'true');
  if (filter?.limit) query.set('limit', String(filter.limit));
  if (filter?.offset) query.set('offset', String(filter.offset));

  const qs = query.toString();
  return apiRequest<{ items: PlatformStaffLoginHistoryView[]; total: number; unusualCount: number }>(
    `/platform/staff/login-history${qs ? `?${qs}` : ''}`,
  );
}

export function getPlatformSecurityStats(): Promise<PlatformSecurityStats> {
  return apiRequest<PlatformSecurityStats>('/platform/staff/security-stats');
}
