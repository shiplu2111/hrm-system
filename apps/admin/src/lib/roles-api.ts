import type {
  CreateRoleRequest,
  PermissionCatalog,
  TenantRoleRecord,
  UpdateRoleRequest,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export type TenantRoleSummary = Pick<TenantRoleRecord, 'id' | 'name' | 'isSystem'>;

export function listTenantRoles(): Promise<TenantRoleSummary[]> {
  return tenantApiRequest<TenantRoleSummary[]>('/roles');
}

export function listRoles(): Promise<TenantRoleRecord[]> {
  return tenantApiRequest<TenantRoleRecord[]>('/roles');
}

export function getPermissionCatalog(): Promise<PermissionCatalog> {
  return tenantApiRequest<PermissionCatalog>('/roles/permission-catalog');
}

export function createRole(input: CreateRoleRequest): Promise<TenantRoleRecord> {
  return tenantApiRequest<TenantRoleRecord>('/roles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateRole(id: string, input: UpdateRoleRequest): Promise<TenantRoleRecord> {
  return tenantApiRequest<TenantRoleRecord>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteRole(id: string): Promise<void> {
  return tenantApiRequest<void>(`/roles/${id}`, { method: 'DELETE' });
}
