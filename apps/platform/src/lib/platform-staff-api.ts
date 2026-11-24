import { apiRequest } from './api-client';
import type {
  ActiveOwnerCheckResult,
  CreatePlatformRoleInput,
  InvitePlatformUserInput,
  Platform2faResetRequestView,
  PlatformPermissionDefinition,
  PlatformRoleRecord,
  PlatformUserDetailedView,
  Request2faResetInput,
  Review2faResetInput,
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
