import type { PermissionAction } from './common';

/** One Role → Module → Action grant (ROLES_PERMISSIONS.md §3). */
export interface RolePermission {
  module: string;
  action: PermissionAction;
}

/** ROLES_PERMISSIONS.md §5 — `team` limits employee data to the holder's reporting tree. */
export type RoleDataScope = 'all' | 'team';

export const ROLE_DATA_SCOPES: readonly RoleDataScope[] = ['all', 'team'];

export interface TenantRoleRecord {
  id: string;
  tenantId: string | null;
  name: string;
  dataScope: RoleDataScope;
  /** Default system roles (§1) are read-only. */
  isSystem: boolean;
  userCount: number;
  permissions: RolePermission[];
}

export interface PermissionModuleDefinition {
  key: string;
  /** Actions the platform actually checks for this module — not every module uses every action. */
  actions: PermissionAction[];
  /** Platform-level modules cannot be granted to tenant roles. */
  grantable: boolean;
}

export interface PermissionCatalog {
  modules: string[];
  actions: PermissionAction[];
  moduleDefinitions: PermissionModuleDefinition[];
}

export interface CreateRoleRequest {
  name: string;
  dataScope?: RoleDataScope;
  permissions: RolePermission[];
}

export interface UpdateRoleRequest {
  name?: string;
  dataScope?: RoleDataScope;
  permissions?: RolePermission[];
}
