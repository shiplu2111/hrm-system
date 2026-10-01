/** Auth-related shared types — see AUTH_FLOW.md */

import type { PermissionAction } from './common';

export interface PermissionClaim {
  module: string;
  action: PermissionAction;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  roleId: string;
  employeeId: string | null;
  permissions: PermissionClaim[];
  /** Set when an admin issued a temporary password; every API except change-password/logout returns 403 until cleared. */
  mustChangePassword?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSubdomain?: string;
  tenantId?: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface RefreshResponse extends AuthTokens {}

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  employee_id: string | null;
  permissions: PermissionClaim[];
  must_change_password?: boolean;
}

/** Active tenant membership for multi-tenant login (AUTH_FLOW.md §5). */
export interface TenantMembershipView {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  logoUrl: string | null;
  roleName: string;
  isCurrent: boolean;
}

export interface SwitchTenantResponse extends AuthTokens {
  user: AuthUser & { roleName: string };
}

/** Admin-managed login for an employee (MODULES.md §08). */
export interface EmployeePortalAccessView {
  employeeId: string;
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface EmployeePortalAccessState {
  access: EmployeePortalAccessView | null;
  /** Work email from the employee profile, used to prefill a new login. */
  suggestedEmail: string | null;
  /** False for terminated employees — logins cannot be created or re-enabled. */
  canGrant: boolean;
  /** Why the signed-in admin cannot change this login, if they cannot. */
  manageBlockedReason: EmployeePortalManageBlockedReason | null;
}

export type EmployeePortalManageBlockedReason = 'self' | 'role_privilege';

export interface EmployeePortalRoleOption {
  id: string;
  name: string;
}

export interface CreateEmployeePortalAccessRequest {
  email: string;
  roleId: string;
}

export interface UpdateEmployeePortalAccessRequest {
  email?: string;
  roleId?: string;
  isActive?: boolean;
}

/** Returned once when a login is created or its password is reset; never retrievable again. */
export interface EmployeePortalCredentialsResult {
  access: EmployeePortalAccessView;
  temporaryPassword: string;
}
