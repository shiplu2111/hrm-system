import { tenantApiRequest } from './tenant-api-client';

export interface TenantRoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
}

export function listTenantRoles(): Promise<TenantRoleSummary[]> {
  return tenantApiRequest<TenantRoleSummary[]>('/roles');
}
