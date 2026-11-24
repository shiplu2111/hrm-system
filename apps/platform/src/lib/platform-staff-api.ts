import { apiRequest } from './api-client';
import type {
  InvitePlatformUserInput,
  Platform2faResetRequestView,
  PlatformUserDetailedView,
  Request2faResetInput,
  Review2faResetInput,
} from '@hrm/shared-types';

export interface PlatformRoleOption {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Array<{ module: string; action: string }>;
  _count?: { users: number };
}

export function listPlatformRoles(): Promise<PlatformRoleOption[]> {
  return apiRequest<PlatformRoleOption[]>('/platform/staff/roles');
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
